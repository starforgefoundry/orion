import { type InferSelectModel } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { DateTime } from 'luxon';
import { luxonTimestamp } from './custom/luxon';

export const user = sqliteTable('user', {
  email: text('email').notNull().unique().primaryKey(),
  name: text('name').notNull(),
  picture: text('picture').notNull(),
});

export type User = InferSelectModel<typeof user>;

export const printRequest = sqliteTable('print_request', {
  id: text('id')
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  submissionDate: luxonTimestamp()
    .notNull()
    .$defaultFn(() => DateTime.now()),
  completionDate: luxonTimestamp(),

  email: text('email').notNull(),
  customerName: text('customer_name').notNull(),
  projectName: text('project_name').notNull(),

  status: text('status', {
    enum: ['in_queue', 'printing', 'done', 'picked_up', 'canceled'],
  }).notNull(),

  isQuote: integer('is_quote', { mode: 'boolean' }).notNull().default(false),

  material: text('material')
    .notNull()
    .references(() => printMaterial.id),

  specialRequests: text('special_requests').notNull(),

  billingCode: text('billing_code'),
  paymentId: text('payment_id').references(() => printRequestPayment.id),

  buildplateCount: integer('buildplate_count').default(1),
  materialCost: integer('material_cost').default(0),
});

export type PrintRequest = InferSelectModel<typeof printRequest>;

export const printRequestFile = sqliteTable('print_request_file', {
  id: text('id')
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  printRequestId: text('print_request_id')
    .notNull()
    .references(() => printRequest.id),
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(),
  quantity: integer('quantity').notNull().default(1),
});

export type PrintRequestFile = InferSelectModel<typeof printRequestFile>;

export const printRequestPayment = sqliteTable(
  'print_request_payment',
  {
    id: text('id')
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    issuedDate: luxonTimestamp('issued_date').notNull(),
    paymentDate: luxonTimestamp('payment_date'),
    status: text('status', { enum: ['quote', 'pending', 'paid', 'canceled'] }).notNull(),
    squareInvoiceId: text('square_invoice_id'),
    squareOrderId: text('square_order_id'),

    total: integer('total').notNull(), // in cents
    orderObject: text('order_object'),
  },
  (table) => [
    index('square_invoice_idx').on(table.squareInvoiceId),
    index('square_order_idx').on(table.squareOrderId),
  ],
);

export type PrintRequestPayment = InferSelectModel<typeof printRequestPayment>;

export const printMaterial = sqliteTable('print_material', {
  id: text('id')
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  available: integer('available', { mode: 'boolean' }).notNull().default(true),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
});

export type PrintMaterial = InferSelectModel<typeof printMaterial>;

export const settings = sqliteTable('settings', {
  key: text('key').notNull().primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
});

export const squareWebhookLog = sqliteTable('square_webhook_log', {
  id: text('id').notNull().primaryKey(),
  payload: text('payload', { mode: 'json' }).notNull(),
});

export type SquareWebhookLog = InferSelectModel<typeof squareWebhookLog>;

export const schema = {
  user,
  printRequest,
  printRequestFile,
  printRequestPayment,
  printMaterial,
  settings,
  squareWebhookLog,
};
