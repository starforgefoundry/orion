import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { s3PublicUrl, uploadToS3 } from '$lib/server/utils/s3';
import { and, eq, gte, sum, type InferInsertModel, type InferSelectModel } from 'drizzle-orm';
import { chunk } from 'lodash-es';

function withPhotoUrl<T extends { photoUrl: string | null }>(catalog: T): T {
  return { ...catalog, photoUrl: s3PublicUrl(catalog.photoUrl) };
}

export class ClassRepository extends BaseRepository {
  // ── Catalog ──

  async createCatalog(data: InferInsertModel<typeof schema.classCatalog>) {
    return await this.db.insert(schema.classCatalog).values(data).returning().get();
  }

  async updateCatalog(id: string, updates: Partial<InferInsertModel<typeof schema.classCatalog>>) {
    return await this.db
      .update(schema.classCatalog)
      .set(updates)
      .where(eq(schema.classCatalog.id, id))
      .returning()
      .get();
  }

  async getCatalogById(id: string) {
    const catalog = await this.db
      .select()
      .from(schema.classCatalog)
      .where(eq(schema.classCatalog.id, id))
      .get();
    return catalog && withPhotoUrl(catalog);
  }

  async getAllCatalogs() {
    const catalogs = await this.db.select().from(schema.classCatalog).all();
    return catalogs.map(withPhotoUrl);
  }

  async getActiveCatalogs() {
    const catalogs = await this.db.select().from(schema.classCatalog).all();
    return catalogs.map(withPhotoUrl);
  }

  async uploadClassPhoto(catalogId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const key = `classes/${catalogId}/${crypto.randomUUID()}.${ext}`;
    return await uploadToS3(this.s3, file, key);
  }

  // ── Instance ──

  async createInstance(data: InferInsertModel<typeof schema.classInstance>) {
    return await this.db.insert(schema.classInstance).values(data).returning().get();
  }

  async createInstances(data: InferInsertModel<typeof schema.classInstance>[]) {
    if (data.length === 0) return [];

    const created: InferSelectModel<typeof schema.classInstance>[] = [];
    for (const batch of chunk(data, 3)) {
      created.push(...(await this.db.insert(schema.classInstance).values(batch).returning().all()));
    }
    return created;
  }

  async updateInstance(
    id: string,
    updates: Partial<InferInsertModel<typeof schema.classInstance>>,
  ) {
    return await this.db
      .update(schema.classInstance)
      .set(updates)
      .where(eq(schema.classInstance.id, id))
      .returning()
      .get();
  }

  async getInstanceById(id: string) {
    const result = await this.db
      .select()
      .from(schema.classInstance)
      .where(eq(schema.classInstance.id, id))
      .leftJoin(schema.user, eq(schema.classInstance.teacherEmail, schema.user.email))
      .leftJoin(schema.classCatalog, eq(schema.classInstance.classId, schema.classCatalog.id))
      .get();

    if (!result) return null;

    return {
      ...result.class_instance,
      teacher: result.user,
      catalog: result.class_catalog && withPhotoUrl(result.class_catalog),
    };
  }

  /**
   * Returns scheduled instances for a catalog alongside only the non-sensitive
   * teacher fields (name + picture). Intended for public-facing endpoints —
   * staff-only queries should use `getAllInstances` which returns the full
   * user row.
   */
  async getInstancesForCatalog(classId: string) {
    const results = await this.db
      .select({
        instance: schema.classInstance,
        teacherName: schema.user.name,
        teacherPicture: schema.user.picture,
      })
      .from(schema.classInstance)
      .where(
        and(
          eq(schema.classInstance.classId, classId),
          eq(schema.classInstance.status, 'scheduled'),
        ),
      )
      .leftJoin(schema.user, eq(schema.classInstance.teacherEmail, schema.user.email))
      .all();

    return results.map((r) => ({
      ...r.instance,
      teacher:
        r.teacherName !== null && r.teacherPicture !== null
          ? { name: r.teacherName, picture: r.teacherPicture }
          : null,
    }));
  }

  async getAllInstances() {
    const results = await this.db
      .select()
      .from(schema.classInstance)
      .leftJoin(schema.user, eq(schema.classInstance.teacherEmail, schema.user.email))
      .leftJoin(schema.classCatalog, eq(schema.classInstance.classId, schema.classCatalog.id))
      .all();

    return results.map((r) => ({
      ...r.class_instance,
      teacher: r.user,
      catalog: r.class_catalog && withPhotoUrl(r.class_catalog),
    }));
  }

  async getScheduledInstancesByRecurrenceGroup(recurrenceGroupId: string, fromDate: string) {
    return await this.db
      .select()
      .from(schema.classInstance)
      .where(
        and(
          eq(schema.classInstance.recurrenceGroupId, recurrenceGroupId),
          gte(schema.classInstance.date, fromDate),
          eq(schema.classInstance.status, 'scheduled'),
        ),
      )
      .all();
  }

  // ── Booking ──

  async createBooking(data: InferInsertModel<typeof schema.classBooking>) {
    return await this.db.insert(schema.classBooking).values(data).returning().get();
  }

  async getBookingById(id: string) {
    const result = await this.db
      .select()
      .from(schema.classBooking)
      .where(eq(schema.classBooking.id, id))
      .leftJoin(schema.classInstance, eq(schema.classBooking.instanceId, schema.classInstance.id))
      .leftJoin(schema.classCatalog, eq(schema.classInstance.classId, schema.classCatalog.id))
      .get();

    if (!result) return null;

    return {
      ...result.class_booking,
      instance: result.class_instance,
      catalog: result.class_catalog && withPhotoUrl(result.class_catalog),
    };
  }

  async getBookingByToken(token: string) {
    const result = await this.db
      .select()
      .from(schema.classBooking)
      .where(eq(schema.classBooking.bookingToken, token))
      .leftJoin(schema.classInstance, eq(schema.classBooking.instanceId, schema.classInstance.id))
      .leftJoin(schema.classCatalog, eq(schema.classInstance.classId, schema.classCatalog.id))
      .get();

    if (!result) return null;

    return {
      ...result.class_booking,
      instance: result.class_instance,
      catalog: result.class_catalog && withPhotoUrl(result.class_catalog),
    };
  }

  async updateBooking(id: string, updates: Partial<InferInsertModel<typeof schema.classBooking>>) {
    return await this.db
      .update(schema.classBooking)
      .set(updates)
      .where(eq(schema.classBooking.id, id))
      .returning()
      .get();
  }

  async getBookingsForInstance(instanceId: string) {
    return await this.db
      .select()
      .from(schema.classBooking)
      .where(eq(schema.classBooking.instanceId, instanceId))
      .all();
  }

  async getConfirmedBookingsForInstance(instanceId: string) {
    return await this.db
      .select()
      .from(schema.classBooking)
      .where(
        and(
          eq(schema.classBooking.instanceId, instanceId),
          eq(schema.classBooking.status, 'confirmed'),
        ),
      )
      .all();
  }

  async getConfirmedBookingCount(instanceId: string): Promise<number> {
    const result = await this.db
      .select({ total: sum(schema.classBooking.quantity) })
      .from(schema.classBooking)
      .where(
        and(
          eq(schema.classBooking.instanceId, instanceId),
          eq(schema.classBooking.status, 'confirmed'),
        ),
      )
      .get();
    return Number(result?.total ?? 0);
  }

  // ── Teacher / Google Calendar ──

  async setGoogleCalendarId(email: string, calendarId: string) {
    await this.db
      .update(schema.user)
      .set({ googleCalendarId: calendarId })
      .where(eq(schema.user.email, email))
      .run();
  }

  async setGoogleEventId(instanceId: string, eventId: string | null) {
    await this.db
      .update(schema.classInstance)
      .set({ googleEventId: eventId })
      .where(eq(schema.classInstance.id, instanceId))
      .run();
  }

  async getScheduledInstanceIdsForTeacher(teacherEmail: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: schema.classInstance.id })
      .from(schema.classInstance)
      .where(
        and(
          eq(schema.classInstance.teacherEmail, teacherEmail),
          eq(schema.classInstance.status, 'scheduled'),
        ),
      )
      .all();
    return rows.map((r) => r.id);
  }

  // ── Staff / Payment ──

  async getStaffUsers() {
    return await this.db.select().from(schema.user).all();
  }

  async processSquarePayment(
    sourceId: string,
    amountCents: number,
    locationId: string,
    customerEmail: string,
    customerName: string,
    itemName?: string,
    itemDescription?: string,
  ) {
    const customer = await this.square.customers.search({
      query: {
        filter: {
          emailAddress: { exact: customerEmail },
        },
      },
    });

    let customerId: string | undefined;
    const customers = customer.customers ?? [];
    if (customers.length > 0) {
      customerId = customers[0].id;
    } else {
      const [firstName, ...lastNameParts] = customerName.split(' ');
      const created = await this.square.customers.create({
        givenName: firstName,
        familyName: lastNameParts.join(' '),
        emailAddress: customerEmail,
      });
      customerId = created.customer?.id;
    }

    const result = await this.square.payments.create({
      sourceId,
      idempotencyKey: crypto.randomUUID(),
      amountMoney: {
        amount: BigInt(amountCents),
        currency: 'USD',
      },
      locationId,
      customerId,
      ...(itemName ? { note: itemName } : {}),
      ...(itemDescription
        ? {
            statementDescriptionIdentifier: itemName,
          }
        : {}),
    });

    return result.payment;
  }

  async refundPayment(paymentId: string, amountCents: number) {
    const result = await this.square.refunds.refundPayment({
      paymentId,
      idempotencyKey: crypto.randomUUID(),
      amountMoney: {
        amount: BigInt(amountCents),
        currency: 'USD',
      },
    });

    return result.refund;
  }
}
