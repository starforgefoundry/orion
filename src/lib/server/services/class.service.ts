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
import { ClassRepository } from '$lib/server/repositories/class.repository';
import { DiscordRepository } from '$lib/server/repositories/discord.repository';
import { MailgunRepository } from '$lib/server/repositories/mailgun.repository';
import { SettingsRepository } from '$lib/server/repositories/settings.repository';
import { DateTime } from 'luxon';

export class ClassService {
  private classRepository: ClassRepository;
  private discordRepository: DiscordRepository;
  private mailgunRepository: MailgunRepository;
  private settingsRepository: SettingsRepository;

  constructor(
    classRepository?: ClassRepository,
    mailgunRepository?: MailgunRepository,
    settingsRepository?: SettingsRepository,
    discordRepository?: DiscordRepository,
  ) {
    this.classRepository = classRepository ?? new ClassRepository();
    this.discordRepository = discordRepository ?? new DiscordRepository();
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
    return await this.classRepository.updateCatalog(id, updates);
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

    return await this.classRepository.createInstances(instances);
  }

  async createInstance(dto: CreateInstanceDto) {
    return await this.classRepository.createInstance({
      classId: dto.classId,
      teacherEmail: dto.teacherEmail,
      date: dto.date,
      startTime: dto.startTime,
      durationMinutes: dto.durationMinutes,
      seats: dto.seats,
      status: 'scheduled',
    });
  }

  async updateInstance(dto: UpdateInstanceDto) {
    const { id, ...updates } = dto;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined),
    );
    return await this.classRepository.updateInstance(id, filtered);
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

  async generateIcalFeed(icalToken: string): Promise<string | null> {
    const data = await this.classRepository.getBookingsForTeacherByIcalToken(icalToken);
    if (!data) return null;

    const { teacher, entries } = data;

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Starforge//Class Bookings//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${teacher.name} - Class Bookings`,
      'X-WR-TIMEZONE:America/Chicago',
      'BEGIN:VTIMEZONE',
      'TZID:America/Chicago',
      'BEGIN:STANDARD',
      'DTSTART:19701101T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
      'TZOFFSETFROM:-0500',
      'TZOFFSETTO:-0600',
      'TZNAME:CST',
      'END:STANDARD',
      'BEGIN:DAYLIGHT',
      'DTSTART:19700308T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
      'TZOFFSETFROM:-0600',
      'TZOFFSETTO:-0500',
      'TZNAME:CDT',
      'END:DAYLIGHT',
      'END:VTIMEZONE',
    ];

    for (const { instance, catalog, bookings } of entries) {
      const [hours, minutes] = instance.startTime.split(':').map(Number);
      const startDt = DateTime.fromISO(instance.date, { zone: 'America/Chicago' }).set({
        hour: hours,
        minute: minutes,
      });
      const endDt = startDt.plus({ minutes: instance.durationMinutes });

      const totalAttendees = bookings.reduce((sum, b) => sum + (b.quantity ?? 1), 0);
      const description = [
        `Class: ${catalog.name}`,
        `Number of attendees: ${totalAttendees}/${instance.seats}`,
        ``,
        `Attendees:`,
        ...bookings.map((b) => `- ${b.customerName}${b.quantity > 1 ? ` (x${b.quantity})` : ''} (${b.customerPhone})`),
      ].join('\\n');

      const uid = `${instance.id}@starforgefoundry.com`;

      lines.push(
        'BEGIN:VEVENT',
        `DTSTART;TZID=America/Chicago:${startDt.toFormat("yyyyMMdd'T'HHmmss")}`,
        `DTEND;TZID=America/Chicago:${endDt.toFormat("yyyyMMdd'T'HHmmss")}`,
        `SUMMARY:${catalog.name} (${totalAttendees} booked)`,
        `DESCRIPTION:${description}`,
        `UID:${uid}`,
        `DTSTAMP:${DateTime.now().toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'")}`,
        'END:VEVENT',
      );
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }
}

export const classService = new ClassService();
