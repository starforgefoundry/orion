import { PASS_KIND } from '$lib/member_enums';
import {
  schema,
  type CarBayBooking,
  type ClassBooking,
  type ClassCatalog,
  type ClassInstance,
  type DayPass,
  type Member,
} from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { eq } from 'drizzle-orm';

export type MembershipPass = {
  kind: typeof PASS_KIND.MEMBERSHIP;
  passToken: string;
  member: Member;
};

export type DayPassTicket = {
  kind: typeof PASS_KIND.DAY_PASS;
  passToken: string;
  member: Member;
  dayPass: DayPass;
};

/** Bookings made before passes existed have no member until their first kiosk scan. */
export type ClassPass = {
  kind: typeof PASS_KIND.CLASS;
  passToken: string;
  member: Member | null;
  booking: ClassBooking;
  instance: ClassInstance;
  catalog: ClassCatalog;
};

export type CarBayPass = {
  kind: typeof PASS_KIND.CAR_BAY;
  passToken: string;
  member: Member | null;
  booking: CarBayBooking;
};

export type BookingPass = ClassPass | CarBayPass;
export type IssuedPass = MembershipPass | DayPassTicket | BookingPass;

export class PassRepository extends BaseRepository {
  async getByToken(passToken: string): Promise<IssuedPass | undefined> {
    const passes = await Promise.all([
      this.getMembership(passToken),
      this.getDayPass(passToken),
      this.getClassPass(passToken),
      this.getCarBayPass(passToken),
    ]);
    return passes.find((pass) => pass !== undefined);
  }

  async linkMember(pass: BookingPass, memberId: string) {
    const table = pass.kind === PASS_KIND.CLASS ? schema.classBooking : schema.carBayBooking;
    await this.db.update(table).set({ memberId }).where(eq(table.id, pass.booking.id));
  }

  private async getMembership(passToken: string): Promise<MembershipPass | undefined> {
    const [member] = await this.db
      .select()
      .from(schema.member)
      .where(eq(schema.member.passToken, passToken))
      .limit(1);
    return member && { kind: PASS_KIND.MEMBERSHIP, passToken, member };
  }

  private async getDayPass(passToken: string): Promise<DayPassTicket | undefined> {
    const [row] = await this.db
      .select({ dayPass: schema.dayPass, member: schema.member })
      .from(schema.dayPass)
      .innerJoin(schema.member, eq(schema.dayPass.memberId, schema.member.id))
      .where(eq(schema.dayPass.passToken, passToken))
      .limit(1);
    return row && { kind: PASS_KIND.DAY_PASS, passToken, ...row };
  }

  private async getClassPass(passToken: string): Promise<ClassPass | undefined> {
    const [row] = await this.db
      .select({
        booking: schema.classBooking,
        instance: schema.classInstance,
        catalog: schema.classCatalog,
        member: schema.member,
      })
      .from(schema.classBooking)
      .innerJoin(schema.classInstance, eq(schema.classBooking.instanceId, schema.classInstance.id))
      .innerJoin(schema.classCatalog, eq(schema.classInstance.classId, schema.classCatalog.id))
      .leftJoin(schema.member, eq(schema.classBooking.memberId, schema.member.id))
      .where(eq(schema.classBooking.passToken, passToken))
      .limit(1);
    return row && { kind: PASS_KIND.CLASS, passToken, ...row };
  }

  private async getCarBayPass(passToken: string): Promise<CarBayPass | undefined> {
    const [row] = await this.db
      .select({ booking: schema.carBayBooking, member: schema.member })
      .from(schema.carBayBooking)
      .leftJoin(schema.member, eq(schema.carBayBooking.memberId, schema.member.id))
      .where(eq(schema.carBayBooking.passToken, passToken))
      .limit(1);
    return row && { kind: PASS_KIND.CAR_BAY, passToken, ...row };
  }
}
