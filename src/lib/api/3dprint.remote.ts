import { command, form, query } from '$app/server';
import { verifyAuth } from '$lib/api/utils';
import { getDB } from '$lib/db';
import * as schema from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import * as v from 'valibot';

export const submitPrintRequestForm = form(
  v.object({
    customerName: v.string(),
    customerEmail: v.pipe(v.string(), v.email()),
    projectName: v.string(),
    specialRequests: v.optional(v.string(), ''),
    isQuote: v.optional(v.boolean(), false),
    material: v.string(),
    billingCode: v.optional(v.string(), ''),
    files: v.pipe(
      v.array(
        v.object({
          file: v.file(),
          filename: v.string(),
          quantity: v.number(),
        }),
      ),
      v.minLength(1),
    ),
  }),
  async (data) => {
    const db = getDB();

    await db
      .insert(schema.printRequestCustomer)
      .values({
        email: data.customerEmail,
        name: data.customerName,
      })
      .onConflictDoNothing()
      .returning();

    const printRequest = await db
      .insert(schema.printRequest)
      .values({
        customer: data.customerEmail,
        projectName: data.projectName,
        specialRequests: data.specialRequests ?? '',
        isQuote: data.isQuote,
        status: 'ready_to_print',
        material: data.material,
        billingCode: data.billingCode ?? null,
      })
      .returning();

    await db.insert(schema.printRequestFile).values(
      data.files.map((file) => ({
        printRequestId: printRequest[0].id,
        fileName: file.filename,
        fileUrl: '', // TODO: Upload file and get URL
        quantity: file.quantity,
      })),
    );

    return {
      status: 'success',
      printRequestId: printRequest[0].id,
    };
  },
);

export const getPrintMaterials = query(async () => {
  const db = getDB();

  const materials = await db
    .select()
    .from(schema.printMaterial)
    .where(eq(schema.printMaterial.isAvailable, true));
  return materials;
});

export const createPrintMaterial = command(
  v.object({
    name: v.string(),
    costPerGramCents: v.number(),
    isAvailable: v.boolean(),
  }),
  async (data) => {
    verifyAuth();
    const db = getDB();

    await db.insert(schema.printMaterial).values({
      name: data.name,
      costPerGramCents: data.costPerGramCents,
      isAvailable: data.isAvailable,
    });
  },
);

export const updatePrintMaterialAvailability = command(
  v.object({
    id: v.string(),
    isAvailable: v.boolean(),
  }),
  async (data) => {
    verifyAuth();
    const db = getDB();

    const material = await db
      .update(schema.printMaterial)
      .set({ isAvailable: data.isAvailable })
      .where(eq(schema.printMaterial.id, data.id))
      .returning();

    getPrintMaterials().refresh();

    return material[0];
  },
);
