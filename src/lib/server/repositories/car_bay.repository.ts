import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { CarBayRuleError, type CarBayTier } from '$lib/utils/car_bay';
import { and, asc, eq, gt, gte, isNull, lt, lte, type InferInsertModel } from 'drizzle-orm';
import type { DateTime } from 'luxon';

const EXCLUSION_VIOLATION = '23P01';

export class CarBaySlotTakenError extends CarBayRuleError {
  constructor() {
    super('That time was just booked by someone else. Please pick another time.');
  }
}

function isExclusionViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if ((error as { code?: string }).code === EXCLUSION_VIOLATION) return true;
  return isExclusionViolation(error.cause);
}

export class CarBayRepository extends BaseRepository {
  async create(data: InferInsertModel<typeof schema.carBayBooking>) {
    try {
      const [booking] = await this.db.insert(schema.carBayBooking).values(data).returning();
      return booking;
    } catch (error) {
      if (isExclusionViolation(error)) throw new CarBaySlotTakenError();
      throw error;
    }
  }

  async update(id: string, updates: Partial<InferInsertModel<typeof schema.carBayBooking>>) {
    const [booking] = await this.db
      .update(schema.carBayBooking)
      .set(updates)
      .where(eq(schema.carBayBooking.id, id))
      .returning();
    return booking;
  }

  async getById(id: string) {
    const [booking] = await this.db
      .select()
      .from(schema.carBayBooking)
      .where(eq(schema.carBayBooking.id, id));
    return booking ?? null;
  }

  async getByToken(token: string) {
    const [booking] = await this.db
      .select()
      .from(schema.carBayBooking)
      .where(eq(schema.carBayBooking.bookingToken, token));
    return booking ?? null;
  }

  async getConfirmedInRange(from: DateTime, to: DateTime) {
    return await this.db
      .select()
      .from(schema.carBayBooking)
      .where(
        and(
          eq(schema.carBayBooking.status, 'confirmed'),
          lt(schema.carBayBooking.startAt, to),
          gt(schema.carBayBooking.blockedUntil, from),
        ),
      )
      .orderBy(asc(schema.carBayBooking.startAt));
  }

  async getAllInRange(from: DateTime, to: DateTime) {
    return await this.db
      .select()
      .from(schema.carBayBooking)
      .where(and(lt(schema.carBayBooking.startAt, to), gt(schema.carBayBooking.blockedUntil, from)))
      .orderBy(asc(schema.carBayBooking.startAt));
  }

  async hasConfirmedForCustomer(
    customerEmail: string,
    tier: CarBayTier,
    from: DateTime,
    to: DateTime,
  ) {
    const rows = await this.db
      .select({ id: schema.carBayBooking.id })
      .from(schema.carBayBooking)
      .where(
        and(
          eq(schema.carBayBooking.status, 'confirmed'),
          eq(schema.carBayBooking.tier, tier),
          eq(schema.carBayBooking.customerEmail, customerEmail),
          gte(schema.carBayBooking.startAt, from),
          lt(schema.carBayBooking.startAt, to),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async getReminderCandidates(now: DateTime, until: DateTime) {
    return await this.db
      .select()
      .from(schema.carBayBooking)
      .where(
        and(
          eq(schema.carBayBooking.status, 'confirmed'),
          isNull(schema.carBayBooking.reminderSentDate),
          gt(schema.carBayBooking.startAt, now),
          lte(schema.carBayBooking.startAt, until),
        ),
      );
  }

  async getOverrunPayments(bookingId: string) {
    return await this.db
      .select()
      .from(schema.payment)
      .where(eq(schema.payment.carBayBookingId, bookingId))
      .orderBy(asc(schema.payment.issuedDate));
  }
}
