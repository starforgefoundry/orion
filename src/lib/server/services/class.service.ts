import { forEachSettled, runInBackground } from '$lib/server/utils/background';
import type {
  BookClassDto,
  CancelBookingDto,
  CancelBookingStaffDto,
  CancelInstanceDto,
  CreateInstanceDto,
  GenerateInstancesDto,
  ManualBookClassDto,
  RescheduleBookingDto,
  UpdateInstanceDto,
  UpsertCatalogDto,
} from '$lib/remotes/dtos/class.dto';
import type {
  ClassBooking,
  ClassCatalog,
  ClassInstance,
  Payment,
  User,
} from '$lib/server/db/schema';
import { DISCORD_COLOR } from '$lib/server/repositories/discord.repository';
import type { GoogleCalendarEventInput } from '$lib/server/repositories/google_calendar.repository';
import { ConflictError, NotFoundError, UserError } from '$lib/errors';
import { BaseService } from '$lib/server/services/base.service';
import { SENDERS } from '$lib/server/utils/email_templates/senders';
import {
  buildBill,
  amountPaid,
  centsToDollars,
  formatCents,
  PAYMENT_STATUS,
  PAYMENT_TYPE,
} from '$lib/utils/billing';
import { SPACE_ZONE } from '$lib/space';
import { spaceDate } from '$lib/server/utils/member_access';
import { classBookingUrl, passLinks } from '$lib/server/utils/member_links';
import { bookWithPayment } from '$lib/server/utils/paid_booking';
import {
  CLASS_BOOKING_STATUS,
  CLASS_DATE_FORMAT,
  CLASS_INSTANCE_STATUS,
  classHasStarted,
  classStartsAt,
  formatClassTime,
} from '$lib/utils/classes';
import { dueForReminder } from '$lib/utils/reminders';
import { DateTime, Duration } from 'luxon';

const FULLY_BOOKED_MESSAGE = 'This class is fully booked';
const CLASS_STARTED_MESSAGE = 'This class has already started and can no longer be canceled';
export const CLASS_REMINDER_LEAD = Duration.fromObject({ hours: 24 });

function bookingEmailVariables(
  booking: Pick<ClassBooking, 'customerName' | 'quantity' | 'bookingToken' | 'passToken'>,
  instance: Pick<ClassInstance, 'date' | 'startTime'>,
  catalog: Pick<ClassCatalog, 'name'>,
) {
  return {
    customerName: booking.customerName,
    className: catalog.name,
    classDate: classStartsAt(instance).toFormat(CLASS_DATE_FORMAT),
    classTime: formatClassTime(instance),
    quantity: booking.quantity.toString(),
    bookingUrl: classBookingUrl(booking),
    ...passLinks(booking),
  };
}

type PaidBooking = { payment: Payment | null };

function requireActive<T extends Pick<ClassBooking, 'status'>>(booking: T | null | undefined): T {
  if (!booking) throw new NotFoundError('Booking not found');
  if (booking.status === CLASS_BOOKING_STATUS.CANCELED) {
    throw new UserError('Booking is already canceled');
  }
  return booking;
}

export class ClassService extends BaseService {
  private async refund(booking: PaidBooking) {
    if (!booking.payment) return;
    await this.paymentRepository.refund(booking.payment);
  }

  // ── Catalog ──

  async createCatalog(dto: Omit<UpsertCatalogDto, 'id' | 'photo'>) {
    return await this.classRepository.createCatalog({
      name: dto.name,
      description: dto.description,
      price: dto.price,
    });
  }

  async updateCatalog(dto: { id: string } & Omit<UpsertCatalogDto, 'photo'>) {
    const { id, ...updates } = dto;
    const result = await this.classRepository.updateCatalog(id, updates);
    // The class name shows up in every event's summary, so re-sync all
    // scheduled instances of this catalog so Google Calendar stays current.
    runInBackground(this.syncInstancesForCatalog(id), 'sync catalog update to calendar');
    return result;
  }

  private async syncInstancesForCatalog(catalogId: string): Promise<void> {
    if (!this.googleCalendarRepository.isConfigured()) return;
    const instances = await this.classRepository.getInstancesForCatalog(catalogId);
    for (const inst of instances) {
      try {
        await this.syncInstanceToCalendar(inst.id);
      } catch (err) {
        console.error(`Failed to re-sync instance ${inst.id} after catalog update:`, err);
      }
    }
  }

  async getCatalogById(id: string) {
    return await this.classRepository.getCatalogById(id);
  }

  async getAllCatalogs() {
    return await this.classRepository.getAllCatalogs();
  }

  async getActiveCatalogsWithInstances() {
    const catalogs = await this.classRepository.getAllCatalogs();
    const today = DateTime.now().setZone(SPACE_ZONE).toISODate()!;
    const results = [];

    for (const catalog of catalogs) {
      const instances = await this.classRepository.getInstancesForCatalog(catalog.id);
      const futureInstances = instances.filter((i) => i.date >= today);
      if (futureInstances.length > 0) {
        const withCounts = [];
        for (const inst of futureInstances) {
          const count = await this.classRepository.getConfirmedBookingCount(inst.id);
          withCounts.push({ ...inst, confirmedCount: count });
        }
        results.push({ ...catalog, instances: withCounts });
      }
    }

    return results;
  }

  async uploadClassPhoto(catalogId: string, photo: File) {
    const photoUrl = await this.classRepository.uploadClassPhoto(catalogId, photo);
    await this.classRepository.updateCatalog(catalogId, { photoUrl });
    return photoUrl;
  }

  // ── Instance ──

  async generateInstances(dto: GenerateInstancesDto) {
    const recurrenceGroupId = crypto.randomUUID();
    const startDt = DateTime.fromISO(dto.startDate, { zone: SPACE_ZONE });
    const endDt = DateTime.fromISO(dto.endDate, { zone: SPACE_ZONE });

    const instances: {
      classId: string;
      teacherEmail: string;
      date: string;
      startTime: string;
      durationMinutes: number;
      seats: number;
      status: typeof CLASS_INSTANCE_STATUS.SCHEDULED;
      recurrenceGroupId: string;
    }[] = [];

    let current = startDt;
    while (current <= endDt) {
      // Luxon weekday: 1=Monday..7=Sunday. Convert to 0=Sunday..6=Saturday.
      const dayOfWeek = current.weekday % 7;
      if (dayOfWeek === dto.dayOfWeek) {
        instances.push({
          classId: dto.classId,
          teacherEmail: dto.teacherEmail,
          date: current.toISODate()!,
          startTime: dto.startTime,
          durationMinutes: dto.durationMinutes,
          seats: dto.seats,
          status: CLASS_INSTANCE_STATUS.SCHEDULED,
          recurrenceGroupId,
        });
      }
      current = current.plus({ days: 1 });
    }

    const created = await this.classRepository.createInstances(instances);
    runInBackground(
      Promise.all(created.map((inst) => this.syncInstanceToCalendar(inst.id))),
      'sync generated instances to calendar',
    );
    return created;
  }

  async createInstance(dto: CreateInstanceDto) {
    const instance = await this.classRepository.createInstance({
      classId: dto.classId,
      teacherEmail: dto.teacherEmail,
      date: dto.date,
      startTime: dto.startTime,
      durationMinutes: dto.durationMinutes,
      seats: dto.seats,
      status: CLASS_INSTANCE_STATUS.SCHEDULED,
    });
    runInBackground(this.syncInstanceToCalendar(instance.id), 'sync created instance to calendar');
    return instance;
  }

  async updateInstance(dto: UpdateInstanceDto) {
    const { id, ...updates } = dto;
    const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
    const updated = await this.classRepository.updateInstance(id, filtered);
    runInBackground(this.syncInstanceToCalendar(id), 'sync updated instance to calendar');
    return updated;
  }

  async cancelInstance(dto: CancelInstanceDto) {
    const instance = await this.classRepository.getInstanceById(dto.instanceId);
    if (!instance) throw new NotFoundError('Instance not found');

    if (dto.mode === 'this_and_future' && instance.recurrenceGroupId) {
      const futureInstances = await this.classRepository.getScheduledInstancesByRecurrenceGroup(
        instance.recurrenceGroupId,
        instance.date,
      );

      for (const inst of futureInstances) {
        await this.cancelSingleInstance(inst.id);
      }

      return { canceledCount: futureInstances.length };
    }

    await this.cancelSingleInstance(dto.instanceId);
    return { canceledCount: 1 };
  }

  private async cancelSingleInstance(instanceId: string) {
    const bookings = await this.classRepository.getConfirmedBookingsForInstance(instanceId);

    for (const booking of bookings) {
      if (booking.payment) {
        try {
          await this.refund(booking);
        } catch (err) {
          console.error(`Failed to refund booking ${booking.id}:`, err);
        }
      }
      await this.classRepository.updateBooking(booking.id, {
        status: CLASS_BOOKING_STATUS.CANCELED,
      });
    }

    await this.classRepository.updateInstance(instanceId, {
      status: CLASS_INSTANCE_STATUS.CANCELED,
    });

    // syncInstanceToCalendar detects the canceled status and deletes the event.
    runInBackground(
      this.syncInstanceToCalendar(instanceId),
      'remove canceled instance from calendar',
    );
  }

  async getInstanceById(id: string) {
    return await this.classRepository.getInstanceById(id);
  }

  async getAllInstances() {
    const instances = await this.classRepository.getAllInstances();
    const result = [];
    for (const instance of instances) {
      const count = await this.classRepository.getConfirmedBookingCount(instance.id);
      result.push({ ...instance, confirmedCount: count });
    }
    return result;
  }

  async getInstancesForCatalog(classId: string) {
    const instances = await this.classRepository.getInstancesForCatalog(classId);
    const result = [];
    for (const instance of instances) {
      const count = await this.classRepository.getConfirmedBookingCount(instance.id);
      result.push({ ...instance, confirmedCount: count });
    }
    return result;
  }

  async getInstanceDetail(instanceId: string) {
    const instance = await this.classRepository.getInstanceById(instanceId);
    if (!instance) return null;

    const bookings = await this.classRepository.getBookingsForInstance(instanceId);

    return {
      ...instance,
      bookings,
    };
  }

  async getStaffUsers() {
    return await this.classRepository.getStaffUsers();
  }

  // ── Booking ──

  async bookClass(dto: BookClassDto) {
    const instance = await this.classRepository.getInstanceById(dto.instanceId);
    if (!instance) throw new NotFoundError('Class not found');
    if (instance.status !== CLASS_INSTANCE_STATUS.SCHEDULED)
      throw new UserError('This class has been canceled');

    const catalog = instance.catalog;
    if (!catalog) throw new NotFoundError('Class not found');

    if (classHasStarted(instance)) throw new UserError('Cannot book a class in the past');

    await this.assertSeatsAvailable(instance, dto.quantity);

    const formattedDate = DateTime.fromISO(instance.date, { zone: SPACE_ZONE }).toFormat(
      'MMM d, yyyy',
    );
    const cancel = (booking: ClassBooking) =>
      this.classRepository.updateBooking(booking.id, { status: CLASS_BOOKING_STATUS.CANCELED });

    const { booking } = await bookWithPayment(
      this.paymentRepository,
      {
        type: PAYMENT_TYPE.CLASS_BOOKING,
        status: PAYMENT_STATUS.PENDING,
        customer: { name: dto.customerName, email: dto.customerEmail },
        bill: buildBill([
          {
            name: `${catalog.name} - ${formattedDate}`,
            quantity: dto.quantity,
            unitAmount: catalog.price,
          },
        ]),
      },
      dto.sourceId,
      {
        create: async (authorized) => {
          const booking = await this.classRepository.createBooking({
            instanceId: dto.instanceId,
            ...(await this.memberRepository.customerColumns(dto)),
            paymentId: authorized.id,
            status: CLASS_BOOKING_STATUS.CONFIRMED,
            quantity: dto.quantity,
          });
          if (await this.isOverbooked(instance)) {
            await cancel(booking);
            throw new UserError(FULLY_BOOKED_MESSAGE);
          }
          return booking;
        },
        cancel,
      },
    );

    // Send confirmation email and discord notification asynchronously
    runInBackground(this.sendBookingConfirmationEmail(booking.id), 'send booking email');
    runInBackground(
      this.sendBookingDiscordNotification(booking.id),
      'send booking discord notification',
    );

    runInBackground(this.syncInstanceToCalendar(dto.instanceId), 'sync booking change to calendar');

    return booking;
  }

  private async assertSeatsAvailable(
    instance: Pick<ClassInstance, 'id' | 'seats'>,
    quantity: number,
    confirmedCount?: number,
  ) {
    const booked =
      confirmedCount ?? (await this.classRepository.getConfirmedBookingCount(instance.id));
    if (booked + quantity <= instance.seats) return;

    const remaining = instance.seats - booked;
    throw new UserError(
      remaining <= 0
        ? FULLY_BOOKED_MESSAGE
        : `Only ${remaining} spot${remaining !== 1 ? 's' : ''} remaining`,
    );
  }

  private async isOverbooked(instance: Pick<ClassInstance, 'id' | 'seats'>) {
    const booked = await this.classRepository.getConfirmedBookingCount(instance.id);
    return booked > instance.seats;
  }

  async getBookingByToken(token: string) {
    const booking = await this.classRepository.getBookingByToken(token);
    if (!booking) return null;

    const { payment, ...rest } = booking;
    return { ...rest, amountPaid: amountPaid(booking.payment) };
  }

  async cancelBooking(dto: CancelBookingDto) {
    const booking = requireActive(await this.classRepository.getBookingByToken(dto.bookingToken));
    if (booking.instance && classHasStarted(booking.instance)) {
      throw new UserError(CLASS_STARTED_MESSAGE);
    }
    return await this.cancel(booking);
  }

  async cancelBookingStaff(dto: CancelBookingStaffDto) {
    return await this.cancel(
      requireActive(await this.classRepository.getBookingById(dto.bookingId)),
    );
  }

  private async cancel(booking: Pick<ClassBooking, 'id' | 'instanceId'> & PaidBooking) {
    await this.refund(booking);
    await this.classRepository.updateBooking(booking.id, { status: CLASS_BOOKING_STATUS.CANCELED });

    runInBackground(
      this.syncInstanceToCalendar(booking.instanceId),
      'sync canceled booking to calendar',
    );

    return { success: true };
  }

  async rescheduleBooking(dto: RescheduleBookingDto) {
    const booking = await this.classRepository.getBookingById(dto.bookingId);
    if (!booking || !booking.instance) throw new NotFoundError('Booking not found');
    if (booking.status === CLASS_BOOKING_STATUS.CANCELED)
      throw new UserError('Booking is already canceled');
    if (booking.instanceId === dto.targetInstanceId)
      throw new UserError('Booking is already in this class session');

    const target = await this.classRepository.getInstanceById(dto.targetInstanceId);
    if (!target) throw new NotFoundError('Class session not found');
    if (target.classId !== booking.instance.classId)
      throw new UserError('Bookings can only move to a session of the same class');
    if (target.status !== CLASS_INSTANCE_STATUS.SCHEDULED)
      throw new UserError('This class has been canceled');
    if (classHasStarted(target))
      throw new UserError('Cannot move a booking to a class in the past');

    const targetBookings = await this.classRepository.getConfirmedBookingsForInstance(target.id);
    const customerEmail = booking.customerEmail.toLowerCase();
    if (targetBookings.some((b) => b.customerEmail.toLowerCase() === customerEmail))
      throw new ConflictError('Customer is already booked in that session');

    const confirmedCount = targetBookings.reduce((total, b) => total + b.quantity, 0);
    await this.assertSeatsAvailable(target, booking.quantity, confirmedCount);

    const updated = await this.classRepository.updateBooking(booking.id, {
      instanceId: target.id,
      reminderSentDate: null,
    });

    if (await this.isOverbooked(target)) {
      await this.classRepository.updateBooking(booking.id, {
        instanceId: booking.instanceId,
        reminderSentDate: booking.reminderSentDate,
      });
      throw new UserError(FULLY_BOOKED_MESSAGE);
    }

    runInBackground(
      this.sendBookingConfirmationEmail(booking.id),
      'send rescheduled booking email',
    );
    runInBackground(
      this.syncInstanceToCalendar(booking.instanceId),
      'sync rescheduled booking source to calendar',
    );
    runInBackground(
      this.syncInstanceToCalendar(target.id),
      'sync rescheduled booking target to calendar',
    );

    return { booking: updated, previousInstanceId: booking.instanceId };
  }

  async manualBookClass(dto: ManualBookClassDto) {
    const instance = await this.classRepository.getInstanceById(dto.instanceId);
    if (!instance) throw new NotFoundError('Class not found');
    if (instance.status !== CLASS_INSTANCE_STATUS.SCHEDULED)
      throw new UserError('This class has been canceled');

    await this.assertSeatsAvailable(instance, dto.quantity);

    // Create booking with no payment
    const booking = await this.classRepository.createBooking({
      instanceId: dto.instanceId,
      ...(await this.memberRepository.customerColumns(dto)),
      status: CLASS_BOOKING_STATUS.CONFIRMED,
      quantity: dto.quantity,
    });

    if (await this.isOverbooked(instance)) {
      await this.classRepository.updateBooking(booking.id, {
        status: CLASS_BOOKING_STATUS.CANCELED,
      });
      throw new UserError(FULLY_BOOKED_MESSAGE);
    }

    runInBackground(this.syncInstanceToCalendar(dto.instanceId), 'sync manual booking to calendar');

    return booking;
  }

  async sendBookingConfirmationEmail(bookingId: string) {
    const booking = await this.classRepository.getBookingById(bookingId);
    if (!booking || !booking.instance || !booking.catalog) {
      throw new Error('Booking not found');
    }

    await this.mailgunRepository.sendTemplate(
      booking.customerEmail,
      SENDERS.classes,
      'class_booking',
      {
        ...bookingEmailVariables(booking, booking.instance, booking.catalog),
        classDuration: booking.instance.durationMinutes.toString(),
        amountPaid: centsToDollars(amountPaid(booking.payment)),
      },
    );
  }

  async sendDueReminders(now: DateTime = DateTime.now()) {
    const candidates = await this.classRepository.getReminderCandidates(
      spaceDate(now),
      spaceDate(now.plus(CLASS_REMINDER_LEAD)),
    );
    const due = candidates.filter(({ booking, instance }) =>
      dueForReminder(
        { startsAt: classStartsAt(instance), bookedAt: booking.createdDate },
        now,
        CLASS_REMINDER_LEAD,
      ),
    );

    await forEachSettled(
      due,
      async ({ booking, instance, catalog }) => {
        await this.mailgunRepository.sendTemplate(
          booking.customerEmail,
          SENDERS.classes,
          'class_reminder',
          bookingEmailVariables(booking, instance, catalog),
        );
        await this.classRepository.updateBooking(booking.id, { reminderSentDate: now });
      },
      ({ booking }) => `send class reminder for booking ${booking.id}`,
    );
  }

  async sendBookingDiscordNotification(bookingId: string) {
    const booking = await this.classRepository.getBookingById(bookingId);
    if (!booking || !booking.instance || !booking.catalog) {
      throw new Error('Booking not found');
    }

    const [{ discordWebhookUrl }, confirmedCount] = await Promise.all([
      this.settingsRepository.getSetting('classSettings'),
      this.classRepository.getConfirmedBookingCount(booking.instance.id),
    ]);

    const embed = {
      title: '🎓 New Class Booking',
      color: DISCORD_COLOR.GREEN,
      fields: [
        {
          name: 'Class',
          value: booking.catalog.name,
          inline: true,
        },
        {
          name: 'Date',
          value: classStartsAt(booking.instance).toFormat(CLASS_DATE_FORMAT),
          inline: true,
        },
        {
          name: 'Time',
          value: formatClassTime(booking.instance),
          inline: true,
        },
        {
          name: 'Customer',
          value: booking.customerName,
          inline: true,
        },
        {
          name: 'Spots',
          value: `${booking.quantity} booked (${confirmedCount}/${booking.instance.seats} filled)`,
          inline: true,
        },
        {
          name: 'Amount Paid',
          value: formatCents(amountPaid(booking.payment)),
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    await this.discordRepository.notify(discordWebhookUrl, {
      embeds: [embed],
    });
  }

  // ── Google Calendar sync ──

  /**
   * Ensures the given teacher has a Google Calendar and returns its ID.
   * Accepts the already-loaded `User` row (typically from a JOIN on a class
   * query) so the sync path doesn't need to make a separate user lookup.
   * On first-time creation, all of the teacher's currently-scheduled classes
   * are backfilled as events.
   */
  private async ensureCalendarForTeacher(teacher: User): Promise<string> {
    if (teacher.googleCalendarId) return teacher.googleCalendarId;

    const calendarId = await this.googleCalendarRepository.createCalendar(
      teacher.name,
      teacher.email,
    );
    await this.classRepository.setGoogleCalendarId(teacher.email, calendarId);
    // Mutate the in-memory copy so subsequent calls in the same request see it.
    teacher.googleCalendarId = calendarId;

    // Backfill existing scheduled instances so the new calendar is populated.
    const instanceIds = await this.classRepository.getScheduledInstanceIdsForTeacher(teacher.email);
    for (const id of instanceIds) {
      try {
        await this.syncInstanceToCalendar(id);
      } catch (err) {
        console.error(`Failed to backfill instance ${id} to calendar:`, err);
      }
    }

    return calendarId;
  }

  /**
   * Returns the shareable "add to calendar" URL for the given teacher,
   * creating the calendar on-demand if it doesn't exist yet. The caller must
   * supply the teacher's `User` row (from the authenticated session's
   * database view) so the service doesn't do a redundant user lookup.
   */
  async getTeacherCalendarLink(teacher: User): Promise<string | null> {
    if (!this.googleCalendarRepository.isConfigured()) return null;
    const calendarId = await this.ensureCalendarForTeacher(teacher);
    return this.googleCalendarRepository.buildAddCalendarUrl(calendarId);
  }

  /**
   * Creates or updates the Google Calendar event for the given class instance.
   * Creates the teacher's calendar lazily if needed. Silently no-ops when the
   * Google service account isn't configured.
   */
  async syncInstanceToCalendar(instanceId: string): Promise<void> {
    if (!this.googleCalendarRepository.isConfigured()) return;

    const instance = await this.classRepository.getInstanceById(instanceId);
    if (!instance || !instance.teacher || !instance.catalog) return;

    // If the instance was canceled, remove the event instead.
    if (instance.status !== CLASS_INSTANCE_STATUS.SCHEDULED) {
      await this.deleteInstanceFromCalendar(instance);
      return;
    }

    const bookings = await this.classRepository.getConfirmedBookingsForInstance(instance.id);

    // Teacher calendars only track classes with actual attendees — empty
    // classes should not clutter the feed. Remove any existing event if we've
    // dropped to zero bookings, and skip creating one otherwise.
    if (bookings.length === 0) {
      if (instance.googleEventId) {
        await this.deleteInstanceFromCalendar(instance);
      }
      return;
    }

    const calendarId = await this.ensureCalendarForTeacher(instance.teacher);

    const event = this.buildEventPayload(
      instance.catalog.name,
      instance.date,
      instance.startTime,
      instance.durationMinutes,
      instance.seats,
      bookings,
    );

    if (instance.googleEventId) {
      try {
        await this.googleCalendarRepository.updateEvent(calendarId, instance.googleEventId, event);
        return;
      } catch (err) {
        // If the event was deleted out-of-band, fall through and recreate it.
        console.warn(`Failed to update event ${instance.googleEventId}, recreating:`, err);
      }
    }

    const eventId = await this.googleCalendarRepository.createEvent(calendarId, event);
    await this.classRepository.setGoogleEventId(instance.id, eventId);
  }

  private async deleteInstanceFromCalendar(instance: {
    id: string;
    googleEventId: string | null;
    teacher: User | null;
  }): Promise<void> {
    if (!this.googleCalendarRepository.isConfigured()) return;
    if (!instance.teacher?.googleCalendarId || !instance.googleEventId) return;

    try {
      await this.googleCalendarRepository.deleteEvent(
        instance.teacher.googleCalendarId,
        instance.googleEventId,
      );
    } catch (err) {
      console.error(`Failed to delete event ${instance.googleEventId}:`, err);
    }
    await this.classRepository.setGoogleEventId(instance.id, null);
  }

  private buildEventPayload(
    className: string,
    date: string,
    startTime: string,
    durationMinutes: number,
    seats: number,
    bookings: Array<{ customerName: string; customerPhone: string; quantity: number }>,
  ): GoogleCalendarEventInput {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startDt = DateTime.fromISO(date, { zone: SPACE_ZONE }).set({
      hour: hours,
      minute: minutes,
      second: 0,
      millisecond: 0,
    });
    const endDt = startDt.plus({ minutes: durationMinutes });

    const totalAttendees = bookings.reduce((sum, b) => sum + (b.quantity ?? 1), 0);
    const descriptionLines = [
      `Class: ${className}`,
      `Number of attendees: ${totalAttendees}/${seats}`,
    ];

    if (bookings.length > 0) {
      descriptionLines.push('', 'Attendees:');
      for (const b of bookings) {
        const qty = b.quantity > 1 ? ` (x${b.quantity})` : '';
        descriptionLines.push(`- ${b.customerName}${qty} (${b.customerPhone})`);
      }
    }

    return {
      summary: `${className} (${totalAttendees} booked)`,
      description: descriptionLines.join('\n'),
      startDateTime: startDt.toISO({ suppressMilliseconds: true })!,
      endDateTime: endDt.toISO({ suppressMilliseconds: true })!,
      timeZone: SPACE_ZONE,
    };
  }
}

export const classService = new ClassService();
