import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { formatTime } from '$lib/frontend/utils';
import type {
  BookClassDto,
  CancelBookingDto,
  CancelBookingStaffDto,
  CancelInstanceDto,
  CreateInstanceDto,
  GenerateInstancesDto,
  ManualBookClassDto,
  UpdateInstanceDto,
  UpsertCatalogDto,
} from '$lib/remotes/dtos/class.dto';
import type { User } from '$lib/server/db/schema';
import { ClassRepository } from '$lib/server/repositories/class.repository';
import { DiscordRepository } from '$lib/server/repositories/discord.repository';
import {
  GoogleCalendarRepository,
  type GoogleCalendarEventInput,
} from '$lib/server/repositories/google_calendar.repository';
import { MailgunRepository } from '$lib/server/repositories/mailgun.repository';
import { SettingsRepository } from '$lib/server/repositories/settings.repository';
import { DateTime } from 'luxon';

export class ClassService {
  private classRepository: ClassRepository;
  private discordRepository: DiscordRepository;
  private googleCalendarRepository: GoogleCalendarRepository;
  private mailgunRepository: MailgunRepository;
  private settingsRepository: SettingsRepository;

  constructor(
    classRepository?: ClassRepository,
    mailgunRepository?: MailgunRepository,
    settingsRepository?: SettingsRepository,
    discordRepository?: DiscordRepository,
    googleCalendarRepository?: GoogleCalendarRepository,
  ) {
    this.classRepository = classRepository ?? new ClassRepository();
    this.discordRepository = discordRepository ?? new DiscordRepository();
    this.googleCalendarRepository =
      googleCalendarRepository ?? new GoogleCalendarRepository();
    this.mailgunRepository = mailgunRepository ?? new MailgunRepository();
    this.settingsRepository = settingsRepository ?? new SettingsRepository();
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
    this.runInBackground(
      this.syncInstancesForCatalog(id),
      'sync catalog update to calendar',
    );
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
    const today = DateTime.now().setZone('America/Chicago').toISODate()!;
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
    const startDt = DateTime.fromISO(dto.startDate, { zone: 'America/Chicago' });
    const endDt = DateTime.fromISO(dto.endDate, { zone: 'America/Chicago' });

    const instances: {
      classId: string;
      teacherEmail: string;
      date: string;
      startTime: string;
      durationMinutes: number;
      seats: number;
      status: 'scheduled';
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
          status: 'scheduled',
          recurrenceGroupId,
        });
      }
      current = current.plus({ days: 1 });
    }

    const created = await this.classRepository.createInstances(instances);
    this.runInBackground(
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
      status: 'scheduled',
    });
    this.runInBackground(
      this.syncInstanceToCalendar(instance.id),
      'sync created instance to calendar',
    );
    return instance;
  }

  async updateInstance(dto: UpdateInstanceDto) {
    const { id, ...updates } = dto;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined),
    );
    const updated = await this.classRepository.updateInstance(id, filtered);
    this.runInBackground(
      this.syncInstanceToCalendar(id),
      'sync updated instance to calendar',
    );
    return updated;
  }

  async cancelInstance(dto: CancelInstanceDto) {
    const instance = await this.classRepository.getInstanceById(dto.instanceId);
    if (!instance) throw new Error('Instance not found');

    if (dto.mode === 'this_and_future' && instance.recurrenceGroupId) {
      const futureInstances =
        await this.classRepository.getScheduledInstancesByRecurrenceGroup(
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
      if (booking.squarePaymentId && booking.amountPaid > 0) {
        try {
          await this.classRepository.refundPayment(booking.squarePaymentId, booking.amountPaid);
        } catch (err) {
          console.error(`Failed to refund booking ${booking.id}:`, err);
        }
      }
      await this.classRepository.updateBooking(booking.id, { status: 'canceled' });
    }

    await this.classRepository.updateInstance(instanceId, { status: 'canceled' });

    // syncInstanceToCalendar detects the canceled status and deletes the event.
    this.runInBackground(
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
    if (!instance) throw new Error('Class not found');
    if (instance.status !== 'scheduled') throw new Error('This class has been canceled');

    const catalog = instance.catalog;
    if (!catalog) throw new Error('Class not found');

    // Verify the instance start time is in the future
    const now = DateTime.now().setZone('America/Chicago');
    const instanceStart = DateTime.fromISO(`${instance.date}T${instance.startTime}`, {
      zone: 'America/Chicago',
    });
    if (instanceStart <= now) {
      throw new Error('Cannot book a class in the past');
    }

    // Check seat availability
    const confirmedCount = await this.classRepository.getConfirmedBookingCount(dto.instanceId);
    if (confirmedCount + dto.quantity > instance.seats) {
      throw new Error(
        confirmedCount >= instance.seats
          ? 'This class is fully booked'
          : `Only ${instance.seats - confirmedCount} spot${instance.seats - confirmedCount !== 1 ? 's' : ''} remaining`,
      );
    }

    // Process payment via Square
    const totalPrice = catalog.price * dto.quantity;
    const squareSettings = await this.settingsRepository.getSetting('printRequestSquare');
    const dateDt = DateTime.fromISO(instance.date, { zone: 'America/Chicago' });
    const formattedDate = dateDt.toFormat('EEEE, MMMM d, yyyy');
    const payment = await this.classRepository.processSquarePayment(
      dto.sourceId,
      totalPrice,
      squareSettings.locationId,
      dto.customerEmail,
      dto.customerName,
      catalog.name,
      `Class booking (x${dto.quantity}) for ${formattedDate}`,
    );

    if (!payment || payment.status !== 'COMPLETED') {
      throw new Error('Payment failed');
    }

    // Create booking
    const booking = await this.classRepository.createBooking({
      instanceId: dto.instanceId,
      customerName: dto.customerName,
      customerEmail: dto.customerEmail,
      customerPhone: dto.customerPhone,
      squarePaymentId: payment.id,
      status: 'confirmed',
      quantity: dto.quantity,
      amountPaid: totalPrice,
    });

    // Re-check booking count after insert (overbooking prevention)
    const newCount = await this.classRepository.getConfirmedBookingCount(dto.instanceId);
    if (newCount > instance.seats) {
      await this.classRepository.updateBooking(booking.id, { status: 'canceled' });
      if (payment.id) {
        await this.classRepository.refundPayment(payment.id, totalPrice);
      }
      throw new Error('This class is fully booked');
    }

    // Send confirmation email and discord notification asynchronously
    const ctx = getRequestEvent().platform?.ctx;
    const emailPromise = this.sendBookingConfirmationEmail(booking.id);
    const discordPromise = this.sendBookingDiscordNotification(booking.id);
    if (ctx) {
      ctx.waitUntil(emailPromise);
      ctx.waitUntil(discordPromise);
    } else {
      emailPromise.catch((err) => console.error('Failed to send booking email:', err));
      discordPromise.catch((err) => console.error('Failed to send booking discord notification:', err));
    }

    this.runInBackground(
      this.syncInstanceToCalendar(dto.instanceId),
      'sync booking change to calendar',
    );

    return booking;
  }

  async getBookingByToken(token: string) {
    return await this.classRepository.getBookingByToken(token);
  }

  async cancelBooking(dto: CancelBookingDto) {
    const booking = await this.classRepository.getBookingByToken(dto.bookingToken);
    if (!booking) throw new Error('Booking not found');
    if (booking.status === 'canceled') throw new Error('Booking is already canceled');

    if (booking.squarePaymentId && booking.amountPaid > 0) {
      await this.classRepository.refundPayment(booking.squarePaymentId, booking.amountPaid);
    }

    await this.classRepository.updateBooking(booking.id, { status: 'canceled' });

    this.runInBackground(
      this.syncInstanceToCalendar(booking.instanceId),
      'sync canceled booking to calendar',
    );

    return { success: true };
  }

  async cancelBookingStaff(dto: CancelBookingStaffDto) {
    const booking = await this.classRepository.getBookingById(dto.bookingId);
    if (!booking) throw new Error('Booking not found');
    if (booking.status === 'canceled') throw new Error('Booking is already canceled');

    if (booking.squarePaymentId && booking.amountPaid > 0) {
      await this.classRepository.refundPayment(booking.squarePaymentId, booking.amountPaid);
    }

    await this.classRepository.updateBooking(booking.id, { status: 'canceled' });

    this.runInBackground(
      this.syncInstanceToCalendar(booking.instanceId),
      'sync staff-canceled booking to calendar',
    );

    return { success: true };
  }

  async manualBookClass(dto: ManualBookClassDto) {
    const instance = await this.classRepository.getInstanceById(dto.instanceId);
    if (!instance) throw new Error('Class not found');
    if (instance.status !== 'scheduled') throw new Error('This class has been canceled');

    // Check seat availability
    const confirmedCount = await this.classRepository.getConfirmedBookingCount(dto.instanceId);
    if (confirmedCount + dto.quantity > instance.seats) {
      throw new Error(
        confirmedCount >= instance.seats
          ? 'This class is fully booked'
          : `Only ${instance.seats - confirmedCount} spot${instance.seats - confirmedCount !== 1 ? 's' : ''} remaining`,
      );
    }

    // Create booking with no payment
    const booking = await this.classRepository.createBooking({
      instanceId: dto.instanceId,
      customerName: dto.customerName,
      customerEmail: dto.customerEmail,
      customerPhone: dto.customerPhone,
      squarePaymentId: null,
      status: 'confirmed',
      quantity: dto.quantity,
      amountPaid: 0,
    });

    // Re-check booking count after insert (overbooking prevention)
    const newCount = await this.classRepository.getConfirmedBookingCount(dto.instanceId);
    if (newCount > instance.seats) {
      await this.classRepository.updateBooking(booking.id, { status: 'canceled' });
      throw new Error('This class is fully booked');
    }

    this.runInBackground(
      this.syncInstanceToCalendar(dto.instanceId),
      'sync manual booking to calendar',
    );

    return booking;
  }

  async sendBookingConfirmationEmail(bookingId: string) {
    const booking = await this.classRepository.getBookingById(bookingId);
    if (!booking || !booking.instance || !booking.catalog) {
      throw new Error('Booking not found');
    }

    const dateDt = DateTime.fromISO(booking.instance.date, { zone: 'America/Chicago' });
    const bookingUrl = `${env.FRONTEND_URL}/classes/booking/${booking.bookingToken}`;

    await this.mailgunRepository.sendTemplate(
      booking.customerEmail,
      'Starforge Classes <classes@starforgefoundry.com>',
      'classes@starforgefoundry.com',
      `Class Booking Confirmation - ${booking.catalog.name}`,
      'class_booking',
      {
        customerName: booking.customerName,
        className: booking.catalog.name,
        classDate: dateDt.toFormat('EEEE, MMMM d, yyyy'),
        classTime: formatTime(booking.instance.startTime),
        classDuration: booking.instance.durationMinutes.toString(),
        quantity: booking.quantity.toString(),
        amountPaid: (booking.amountPaid / 100).toFixed(2),
        bookingUrl,
      },
    );
  }

  async sendBookingDiscordNotification(bookingId: string) {
    const booking = await this.classRepository.getBookingById(bookingId);
    if (!booking || !booking.instance || !booking.catalog) {
      throw new Error('Booking not found');
    }

    const settings = await this.settingsRepository.getSetting('classSettings');
    const webhookUrl = settings.discordWebhookUrl;
    if (!webhookUrl) {
      console.warn('Discord webhook URL not configured for class bookings');
      return;
    }

    const dateDt = DateTime.fromISO(booking.instance.date, { zone: 'America/Chicago' });
    const confirmedCount = await this.classRepository.getConfirmedBookingCount(
      booking.instance.id,
    );

    const embed = {
      title: '🎓 New Class Booking',
      color: 0x57f287, // Green
      fields: [
        {
          name: 'Class',
          value: booking.catalog.name,
          inline: true,
        },
        {
          name: 'Date',
          value: dateDt.toFormat('EEEE, MMMM d, yyyy'),
          inline: true,
        },
        {
          name: 'Time',
          value: formatTime(booking.instance.startTime),
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
          value: `$${(booking.amountPaid / 100).toFixed(2)}`,
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    await this.discordRepository.sendWebhookNotification(webhookUrl, {
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
    const instanceIds = await this.classRepository.getScheduledInstanceIdsForTeacher(
      teacher.email,
    );
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
    if (instance.status !== 'scheduled') {
      await this.deleteInstanceFromCalendar(instance);
      return;
    }

    const bookings = await this.classRepository.getConfirmedBookingsForInstance(
      instance.id,
    );

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
        await this.googleCalendarRepository.updateEvent(
          calendarId,
          instance.googleEventId,
          event,
        );
        return;
      } catch (err) {
        // If the event was deleted out-of-band, fall through and recreate it.
        console.warn(
          `Failed to update event ${instance.googleEventId}, recreating:`,
          err,
        );
      }
    }

    const eventId = await this.googleCalendarRepository.createEvent(calendarId, event);
    await this.classRepository.setGoogleEventId(instance.id, eventId);
  }

  private async deleteInstanceFromCalendar(
    instance: { id: string; googleEventId: string | null; teacher: User | null },
  ): Promise<void> {
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
    const startDt = DateTime.fromISO(date, { zone: 'America/Chicago' }).set({
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
      timeZone: 'America/Chicago',
    };
  }

  /**
   * Runs a calendar sync in the background via Cloudflare's waitUntil so API
   * responses aren't blocked on Google API latency. Errors are logged but
   * never propagate to the caller.
   */
  private runInBackground(promise: Promise<unknown>, label: string): void {
    const wrapped = promise.catch((err) => {
      console.error(`Background task failed (${label}):`, err);
    });

    try {
      const ctx = getRequestEvent().platform?.ctx;
      if (ctx) {
        ctx.waitUntil(wrapped);
        return;
      }
    } catch {
      // Not inside a request context (e.g. during tests).
    }
    // Fire-and-forget outside a request context.
    void wrapped;
  }
}

export const classService = new ClassService();
