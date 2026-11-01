import { forEachSettled, runInBackground } from '$lib/server/utils/background';
import type {
  BookClassDto,
  CancelBookingDto,
  CancelBookingStaffDto,
  CancelInstanceDto,
  CreateInstanceDto,
  GenerateInstancesDto,
  ManualBookClassDto,
  PublicClassInstance,
  RescheduleBookingDto,
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
import { SPACE_ZONE, spaceDate } from '$lib/space';
import { classBookingUrl, passLinks } from '$lib/server/utils/member_links';
import { bookWithPayment } from '$lib/server/utils/paid_booking';
import {
  CANCEL_INSTANCE_MODE,
  CLASS_BOOKING_STATUS,
  CLASS_DATE_FORMAT,
  CLASS_INSTANCE_STATUS,
  CLASS_SHORT_DATE_FORMAT,
  classHasStarted,
  classEndsAt,
  classStartsAt,
  formatClassTime,
  weeklyDates,
} from '$lib/utils/classes';
import { dueForReminder } from '$lib/utils/reminders';
import { DateTime, Duration } from 'luxon';

const FULLY_BOOKED_MESSAGE = 'This class is fully booked';
const CLASS_NOT_FOUND_MESSAGE = 'Class not found';
const CLASS_CANCELED_MESSAGE = 'This class has been canceled';
const CLASS_IN_PAST_MESSAGE = 'Cannot book a class in the past';
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

/** Leaves out the teacher's email and calendar ids, which the public pages must not see. */
function toPublicInstance(instance: ClassInstance & PublicClassInstance): PublicClassInstance {
  const { id, classId, date, startTime, durationMinutes, seats, status, teacher } = instance;
  return {
    id,
    classId,
    date,
    startTime,
    durationMinutes,
    seats,
    status,
    teacher,
    confirmedCount: instance.confirmedCount,
  };
}

function requireActive<T extends Pick<ClassBooking, 'status'>>(booking: T | null | undefined): T {
  if (!booking) throw new NotFoundError('Booking not found');
  if (booking.status === CLASS_BOOKING_STATUS.CANCELED) {
    throw new UserError('Booking is already canceled');
  }
  return booking;
}

/** Staff may still add people to a scheduled class that already started. */
function requireScheduled<T extends Pick<ClassInstance, 'status'>>(instance: T | null): T {
  if (!instance) throw new NotFoundError(CLASS_NOT_FOUND_MESSAGE);
  if (instance.status !== CLASS_INSTANCE_STATUS.SCHEDULED) {
    throw new UserError(CLASS_CANCELED_MESSAGE);
  }
  return instance;
}

function requireBookable<T extends Pick<ClassInstance, 'status' | 'date' | 'startTime'>>(
  instance: T | null,
  now: DateTime,
): T {
  const scheduled = requireScheduled(instance);
  if (classHasStarted(scheduled, now)) throw new UserError(CLASS_IN_PAST_MESSAGE);
  return scheduled;
}

export class ClassService extends BaseService {
  private async refund(booking: PaidBooking) {
    if (!booking.payment) return;
    await this.paymentGateway.refund(booking.payment);
  }

  // ── Catalog ──

  /** Saves the catalog entry, then its photo when one was uploaded. */
  async upsertCatalog({ id, photo, ...fields }: UpsertCatalogDto) {
    const catalog = id
      ? await this.updateCatalog(id, fields)
      : await this.classRepository.createCatalog(fields);
    if (photo) await this.uploadClassPhoto(catalog.id, photo);
    return catalog;
  }

  private async updateCatalog(id: string, updates: Omit<UpsertCatalogDto, 'id' | 'photo'>) {
    const result = await this.classRepository.updateCatalog(id, updates);
    // The class name shows up in every event's summary, so re-sync all
    // scheduled instances of this catalog so Google Calendar stays current.
    runInBackground(this.syncInstancesForCatalog(id), 'sync catalog update to calendar');
    return result;
  }

  private async syncInstancesForCatalog(catalogId: string): Promise<void> {
    if (!this.googleCalendarRepository.isConfigured()) return;
    const instances = await this.classRepository.getScheduledInstances(catalogId);
    await forEachSettled(
      instances,
      (instance) => this.syncInstanceToCalendar(instance.id),
      (instance) => `re-sync instance ${instance.id} after catalog update`,
    );
  }

  async getCatalogById(id: string) {
    return await this.classRepository.getCatalogById(id);
  }

  async getAllCatalogs() {
    return await this.classRepository.getAllCatalogs();
  }

  async getActiveCatalogsWithInstances() {
    const today = spaceDate(DateTime.now());
    const [catalogs, scheduled] = await Promise.all([
      this.classRepository.getAllCatalogs(),
      this.classRepository.getScheduledInstances(),
    ]);
    const upcoming = (await this.withSeatCounts(scheduled.filter((i) => i.date >= today))).map(
      toPublicInstance,
    );

    return catalogs
      .map((catalog) => ({
        ...catalog,
        instances: upcoming.filter((instance) => instance.classId === catalog.id),
      }))
      .filter((catalog) => catalog.instances.length > 0);
  }

  private async withSeatCounts<T extends Pick<ClassInstance, 'id'>>(instances: T[]) {
    const counts = await this.classRepository.getConfirmedSeatCounts(instances.map((i) => i.id));
    return instances.map((instance) => ({
      ...instance,
      confirmedCount: counts.get(instance.id) ?? 0,
    }));
  }

  private async uploadClassPhoto(catalogId: string, photo: File) {
    const photoUrl = await this.classRepository.uploadClassPhoto(catalogId, photo);
    await this.classRepository.updateCatalog(catalogId, { photoUrl });
  }

  // ── Instance ──

  async generateInstances(dto: GenerateInstancesDto) {
    const recurrenceGroupId = crypto.randomUUID();
    const instances = weeklyDates(dto.startDate, dto.endDate, dto.dayOfWeek).map((date) => ({
      classId: dto.classId,
      teacherEmail: dto.teacherEmail,
      date,
      startTime: dto.startTime,
      durationMinutes: dto.durationMinutes,
      seats: dto.seats,
      status: CLASS_INSTANCE_STATUS.SCHEDULED,
      recurrenceGroupId,
    }));

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

  async cancelInstance(dto: CancelInstanceDto) {
    const instance = await this.classRepository.getInstanceById(dto.instanceId);
    if (!instance) throw new NotFoundError('Instance not found');

    if (dto.mode === CANCEL_INSTANCE_MODE.THIS_AND_FUTURE && instance.recurrenceGroupId) {
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
      await this.cancelBookingRow(booking);
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

  async getAllInstances() {
    return await this.withSeatCounts(await this.classRepository.getAllInstances());
  }

  async getInstancesForCatalog(classId: string) {
    const instances = await this.classRepository.getScheduledInstances(classId);
    return (await this.withSeatCounts(instances)).map(toPublicInstance);
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
    return await this.userRepository.getAll();
  }

  // ── Booking ──

  async bookClass(dto: BookClassDto, now: DateTime = DateTime.now()) {
    const instance = requireBookable(
      await this.classRepository.getInstanceById(dto.instanceId),
      now,
    );
    const catalog = instance.catalog;
    if (!catalog) throw new NotFoundError(CLASS_NOT_FOUND_MESSAGE);

    await this.assertSeatsAvailable(instance, dto.quantity);

    const formattedDate = classStartsAt(instance).toFormat(CLASS_SHORT_DATE_FORMAT);
    const { booking } = await bookWithPayment(
      this.paymentGateway,
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
          const customer = await this.memberRepository.customerColumns(dto);
          return await this.claimSeats(
            instance,
            () =>
              this.classRepository.createBooking({
                instanceId: dto.instanceId,
                ...customer,
                paymentId: authorized.id,
                status: CLASS_BOOKING_STATUS.CONFIRMED,
                quantity: dto.quantity,
              }),
            (created) => this.cancelBookingRow(created),
          );
        },
        cancel: (booking) => this.cancelBookingRow(booking),
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

  /**
   * Writes the seats first and checks the class after, undoing the write if it overfilled the
   * class. Of two writes racing for the last seats, the later check always sees both.
   */
  private async claimSeats<T>(
    instance: Pick<ClassInstance, 'id' | 'seats'>,
    write: () => Promise<T>,
    undo: (written: T) => Promise<unknown>,
  ) {
    const written = await write();
    const booked = await this.classRepository.getConfirmedBookingCount(instance.id);
    if (booked > instance.seats) {
      await undo(written);
      throw new UserError(FULLY_BOOKED_MESSAGE);
    }
    return written;
  }

  private async cancelBookingRow(booking: Pick<ClassBooking, 'id'>) {
    await this.classRepository.updateBooking(booking.id, { status: CLASS_BOOKING_STATUS.CANCELED });
  }

  async getBookingByToken(token: string) {
    const booking = await this.classRepository.getBookingByToken(token);
    if (!booking) return null;

    const { payment, ...rest } = booking;
    return { ...rest, amountPaid: amountPaid(booking.payment) };
  }

  async cancelBooking(dto: CancelBookingDto, now: DateTime = DateTime.now()) {
    const booking = requireActive(await this.classRepository.getBookingByToken(dto.bookingToken));
    if (booking.instance && classHasStarted(booking.instance, now)) {
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
    await this.cancelBookingRow(booking);

    runInBackground(
      this.syncInstanceToCalendar(booking.instanceId),
      'sync canceled booking to calendar',
    );

    return { success: true, instanceId: booking.instanceId };
  }

  async rescheduleBooking(dto: RescheduleBookingDto, now: DateTime = DateTime.now()) {
    const booking = requireActive(await this.classRepository.getBookingById(dto.bookingId));
    if (booking.instanceId === dto.targetInstanceId)
      throw new UserError('Booking is already in this class session');

    const target = requireBookable(
      await this.classRepository.getInstanceById(dto.targetInstanceId),
      now,
    );
    if (target.classId !== booking.instance?.classId)
      throw new UserError('Bookings can only move to a session of the same class');

    const targetBookings = await this.classRepository.getConfirmedBookingsForInstance(target.id);
    const customerEmail = booking.customerEmail.toLowerCase();
    if (targetBookings.some((b) => b.customerEmail.toLowerCase() === customerEmail))
      throw new ConflictError('Customer is already booked in that session');

    const confirmedCount = targetBookings.reduce((total, b) => total + b.quantity, 0);
    await this.assertSeatsAvailable(target, booking.quantity, confirmedCount);

    const updated = await this.claimSeats(
      target,
      () =>
        this.classRepository.updateBooking(booking.id, {
          instanceId: target.id,
          reminderSentDate: null,
        }),
      () =>
        this.classRepository.updateBooking(booking.id, {
          instanceId: booking.instanceId,
          reminderSentDate: booking.reminderSentDate,
        }),
    );

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
    const instance = requireScheduled(await this.classRepository.getInstanceById(dto.instanceId));
    await this.assertSeatsAvailable(instance, dto.quantity);

    const customer = await this.memberRepository.customerColumns(dto);
    const booking = await this.claimSeats(
      instance,
      () =>
        this.classRepository.createBooking({
          instanceId: dto.instanceId,
          ...customer,
          status: CLASS_BOOKING_STATUS.CONFIRMED,
          quantity: dto.quantity,
        }),
      (created) => this.cancelBookingRow(created),
    );

    runInBackground(this.syncInstanceToCalendar(dto.instanceId), 'sync manual booking to calendar');

    return booking;
  }

  private async sendBookingConfirmationEmail(bookingId: string) {
    const booking = await this.classRepository.getBookingById(bookingId);
    if (!booking || !booking.instance || !booking.catalog) {
      throw new Error('Booking not found');
    }

    await this.mailgunGateway.sendTemplate(
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
        await this.mailgunGateway.sendTemplate(
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

  private async sendBookingDiscordNotification(bookingId: string) {
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

  /** The teacher's "add to calendar" link, creating their calendar on first use. */
  async getCalendarLinkFor(email: string): Promise<string | null> {
    if (!this.googleCalendarRepository.isConfigured()) return null;
    const teacher = await this.userRepository.getByEmail(email);
    if (!teacher) return null;
    const calendarId = teacher.googleCalendarId ?? (await this.createTeacherCalendar(teacher));
    return this.googleCalendarRepository.buildAddCalendarUrl(calendarId);
  }

  private async createTeacherCalendar(teacher: User) {
    const calendarId = await this.googleCalendarRepository.createCalendar(
      teacher.name,
      teacher.email,
    );
    await this.userRepository.setGoogleCalendarId(teacher.email, calendarId);
    await this.backfillCalendar(teacher.email);
    return calendarId;
  }

  /** Fills a new calendar with the teacher's scheduled classes. */
  private async backfillCalendar(teacherEmail: string) {
    const instanceIds = await this.classRepository.getScheduledInstanceIdsForTeacher(teacherEmail);
    await forEachSettled(
      instanceIds,
      (id) => this.syncInstanceToCalendar(id),
      (id) => `backfill instance ${id} to calendar`,
    );
  }

  /**
   * Teacher calendars only show scheduled classes that have attendees, so an event is removed when
   * its class is canceled or empties out. Does nothing when Google is not configured.
   */
  private async syncInstanceToCalendar(instanceId: string): Promise<void> {
    if (!this.googleCalendarRepository.isConfigured()) return;

    const instance = await this.classRepository.getInstanceById(instanceId);
    if (!instance?.teacher || !instance.catalog) return;

    const bookings =
      instance.status === CLASS_INSTANCE_STATUS.SCHEDULED
        ? await this.classRepository.getConfirmedBookingsForInstance(instance.id)
        : [];
    const calendarId = instance.teacher.googleCalendarId;

    if (bookings.length === 0) {
      if (calendarId) await this.removeEvent(instance, calendarId);
      return;
    }
    if (!calendarId) {
      // Creating the calendar backfills every scheduled class, this one included.
      await this.createTeacherCalendar(instance.teacher);
      return;
    }

    const event = calendarEvent(instance, instance.catalog, bookings);
    if (instance.googleEventId) {
      try {
        await this.googleCalendarRepository.updateEvent(calendarId, instance.googleEventId, event);
        return;
      } catch (err) {
        // The event may have been deleted in Google Calendar, so recreate it.
        console.warn(`Failed to update event ${instance.googleEventId}, recreating:`, err);
      }
    }

    const eventId = await this.googleCalendarRepository.createEvent(calendarId, event);
    await this.classRepository.setGoogleEventId(instance.id, eventId);
  }

  private async removeEvent(
    instance: Pick<ClassInstance, 'id' | 'googleEventId'>,
    calendarId: string,
  ) {
    if (!instance.googleEventId) return;

    try {
      await this.googleCalendarRepository.deleteEvent(calendarId, instance.googleEventId);
    } catch (err) {
      console.error(`Failed to delete event ${instance.googleEventId}:`, err);
    }
    await this.classRepository.setGoogleEventId(instance.id, null);
  }
}

function calendarEvent(
  instance: Pick<ClassInstance, 'date' | 'startTime' | 'durationMinutes' | 'seats'>,
  catalog: Pick<ClassCatalog, 'name'>,
  bookings: Pick<ClassBooking, 'customerName' | 'customerPhone' | 'quantity'>[],
): GoogleCalendarEventInput {
  const attendees = bookings.reduce((total, booking) => total + booking.quantity, 0);
  const attendeeLines = bookings.map((booking) => {
    const quantity = booking.quantity > 1 ? ` (x${booking.quantity})` : '';
    return `- ${booking.customerName}${quantity} (${booking.customerPhone})`;
  });

  return {
    summary: `${catalog.name} (${attendees} booked)`,
    description: [
      `Class: ${catalog.name}`,
      `Number of attendees: ${attendees}/${instance.seats}`,
      '',
      'Attendees:',
      ...attendeeLines,
    ].join('\n'),
    startDateTime: classStartsAt(instance).toISO({ suppressMilliseconds: true })!,
    endDateTime: classEndsAt(instance).toISO({ suppressMilliseconds: true })!,
    timeZone: SPACE_ZONE,
  };
}

export const classService = new ClassService();
