import { schema, type CarBayBooking, type Payment } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import {
  CAR_BAY_STATUS,
  CarBayRuleError,
  CarBaySlotTakenError,
  type CarBayTier,
} from '$lib/utils/car_bay';
import { and, asc, eq, gt, gte, isNull, lt, lte, type InferInsertModel } from 'drizzle-orm';
import type { DateTime } from 'luxon';

const EXCLUSION_VIOLATION = '23P01';

export type CarBayBookingWithPayment = CarBayBooking & { payment: Payment | null };

function withPayment(row: {
  booking: CarBayBooking;
  payment: Payment | null;
}): CarBayBookingWithPayment {
  return { ...row.booking, payment: row.payment };
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

  private selectWithPayment() {
    return this.db
      .select({ booking: schema.carBayBooking, payment: schema.payment })
      .from(schema.carBayBooking)
      .leftJoin(schema.payment, eq(schema.carBayBooking.paymentId, schema.payment.id));
  }

  async getById(id: string): Promise<CarBayBookingWithPayment | null> {
    const [row] = await this.selectWithPayment().where(eq(schema.carBayBooking.id, id));
    return row ? withPayment(row) : null;
  }

  async getByToken(token: string): Promise<CarBayBookingWithPayment | null> {
    const [row] = await this.selectWithPayment().where(
      eq(schema.carBayBooking.bookingToken, token),
    );
    return row ? withPayment(row) : null;
  }

  async getConfirmedInRange(from: DateTime, to: DateTime) {
    return await this.db
      .select()
      .from(schema.carBayBooking)
      .where(
        and(
          eq(schema.carBayBooking.status, CAR_BAY_STATUS.CONFIRMED),
          lt(schema.carBayBooking.startAt, to),
          gt(schema.carBayBooking.blockedUntil, from),
        ),
      )
      .orderBy(asc(schema.carBayBooking.startAt));
  }

  async getAllInRange(from: DateTime, to: DateTime): Promise<CarBayBookingWithPayment[]> {
    const rows = await this.selectWithPayment()
      .where(and(lt(schema.carBayBooking.startAt, to), gt(schema.carBayBooking.blockedUntil, from)))
      .orderBy(asc(schema.carBayBooking.startAt));
    return rows.map(withPayment);
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
          eq(schema.carBayBooking.status, CAR_BAY_STATUS.CONFIRMED),
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
          eq(schema.carBayBooking.status, CAR_BAY_STATUS.CONFIRMED),
          isNull(schema.carBayBooking.reminderSentDate),
          gt(schema.carBayBooking.startAt, now),
          lte(schema.carBayBooking.startAt, until),
        ),
      );
  }

  async createOverrun(bookingId: string, paymentId: string) {
    const [overrun] = await this.db
      .insert(schema.carBayOverrun)
      .values({ bookingId, paymentId })
      .returning();
    return overrun;
  }

  async getOverrunPayments(bookingId: string) {
    const rows = await this.db
      .select({ payment: schema.payment })
      .from(schema.carBayOverrun)
      .innerJoin(schema.payment, eq(schema.carBayOverrun.paymentId, schema.payment.id))
      .where(eq(schema.carBayOverrun.bookingId, bookingId))
      .orderBy(asc(schema.payment.issuedDate));
    return rows.map((row) => row.payment);
  }

  async createClosure(data: InferInsertModel<typeof schema.carBayClosure>) {
    try {
      const [closure] = await this.db.insert(schema.carBayClosure).values(data).returning();
      return closure;
    } catch (error) {
      if (isExclusionViolation(error)) throw new CarBayRuleError('The bay is already closed then');
      throw error;
    }
  }

  async deleteClosure(id: string) {
    const [closure] = await this.db
      .delete(schema.carBayClosure)
      .where(eq(schema.carBayClosure.id, id))
      .returning();
    return closure ?? null;
  }

  async getClosuresInRange(from: DateTime, to: DateTime) {
    return await this.db
      .select()
      .from(schema.carBayClosure)
      .where(and(lt(schema.carBayClosure.startAt, to), gt(schema.carBayClosure.endAt, from)))
      .orderBy(asc(schema.carBayClosure.startAt));
  }
}
