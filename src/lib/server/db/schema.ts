import { type InferSelectModel } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { DateTime } from 'luxon';
import { luxonTimestamp } from './custom/luxon';

export const user = sqliteTable('user', {
  email: text('email').notNull().unique().primaryKey(),
  name: text('name').notNull(),
  picture: text('picture').notNull(),
  icalToken: text('ical_token').$defaultFn(() => crypto.randomUUID()),
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
  paymentId: text('payment_id').references(() => payment.id),

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

export const payment = sqliteTable(
  'payment',
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
    organizationId: text('organization_id').references(() => organization.id),
    type: text('type', { enum: ['print_request', 'balance', 'org_charge'] }).notNull(),

    total: integer('total').notNull(), // in cents
    orderObject: text('order_object'),
    paymentUrl: text('payment_url'),
  },
  (table) => [
    index('square_invoice_idx').on(table.squareInvoiceId),
    index('square_order_idx').on(table.squareOrderId),
  ],
);

export type Payment = InferSelectModel<typeof payment>;

export const printMaterial = sqliteTable('print_material', {
  id: text('id')
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  available: integer('available', { mode: 'boolean' }).notNull().default(true),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  bblTagId: text('bbl_tag_id'),
  bblTagData: text('bbl_tag_data'),
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

export const billingCode = sqliteTable('billing_code', {
  id: text('id')
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  code: text('code').notNull().unique(),
  description: text('description').notNull(),
  organizationId: text('organization_id').references(() => organization.id),
  discountId: text('discount_id'),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
});

export type BillingCode = InferSelectModel<typeof billingCode>;

export const organization = sqliteTable('organization', {
  id: text('id')
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  email: text('email').notNull(),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
});

export type Organization = InferSelectModel<typeof organization>;

export const organizationCharge = sqliteTable(
  'organization_charge',
  {
    id: text('id')
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id),
    creationDate: luxonTimestamp('creation_date').notNull(),
    description: text('description').notNull(),
    paymentId: text('payment_id')
      .references(() => payment.id)
      .notNull(),
  },
  (table) => [index('org_charge_org_idx').on(table.organizationId)],
);

export type OrganizationCharge = InferSelectModel<typeof organizationCharge>;

export const inventoryItem = sqliteTable('inventory_item', {
  id: text('id')
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  vendor: text('vendor').notNull(),
  url: text('url').notNull(),
  imageUrl: text('image_url'),
  description: text('description').notNull(),
});

export type InventoryItem = InferSelectModel<typeof inventoryItem>;

export const purchaseList = sqliteTable(
  'purchase_list',
  {
    id: text('id')
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    inventoryItemId: text('inventory_item_id')
      .notNull()
      .unique()
      .references(() => inventoryItem.id),
    addedDate: luxonTimestamp('added_date').notNull(),
  },
  (table) => [index('purchase_list_item_idx').on(table.inventoryItemId)],
);

export type PurchaseList = InferSelectModel<typeof purchaseList>;

export const waiver = sqliteTable('waiver', {
  id: text('id')
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  email: text('email').notNull(),
  signatureUrl: text('signature_url').notNull(),
  signedDate: luxonTimestamp('signed_date')
    .notNull()
    .$defaultFn(() => DateTime.now()),
});

export type Waiver = InferSelectModel<typeof waiver>;

export const classCatalog = sqliteTable('class_catalog', {
  id: text('id')
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description').notNull(),
  price: integer('price').notNull(), // in cents
  photoUrl: text('photo_url'),
  createdDate: luxonTimestamp('created_date')
    .notNull()
    .$defaultFn(() => DateTime.now()),
});

export type ClassCatalog = InferSelectModel<typeof classCatalog>;

export const classInstance = sqliteTable(
  'class_instance',
  {
    id: text('id')
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    classId: text('class_id')
      .notNull()
      .references(() => classCatalog.id),
    teacherEmail: text('teacher_email')
      .notNull()
      .references(() => user.email),
    date: text('date').notNull(), // YYYY-MM-DD in Central time
    startTime: text('start_time').notNull(), // HH:mm
    durationMinutes: integer('duration_minutes').notNull(),
    seats: integer('seats').notNull(),
    status: text('status', { enum: ['scheduled', 'canceled'] })
      .notNull()
      .default('scheduled'),
    recurrenceGroupId: text('recurrence_group_id'),
    createdDate: luxonTimestamp('created_date')
      .notNull()
      .$defaultFn(() => DateTime.now()),
  },
  (table) => [
    index('class_instance_class_idx').on(table.classId),
    index('class_instance_date_idx').on(table.date),
    index('class_instance_recurrence_idx').on(table.recurrenceGroupId),
  ],
);

export type ClassInstance = InferSelectModel<typeof classInstance>;

export const classBooking = sqliteTable(
  'class_booking',
  {
    id: text('id')
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    instanceId: text('instance_id')
      .notNull()
      .references(() => classInstance.id),
    customerName: text('customer_name').notNull(),
    customerEmail: text('customer_email').notNull(),
    customerPhone: text('customer_phone').notNull(),
    squarePaymentId: text('square_payment_id'),
    status: text('status', { enum: ['confirmed', 'canceled'] }).notNull(),
    bookingToken: text('booking_token')
      .notNull()
      .$defaultFn(() => crypto.randomUUID()),
    quantity: integer('quantity').notNull().default(1),
    amountPaid: integer('amount_paid').notNull().default(0), // in cents
    createdDate: luxonTimestamp('created_date')
      .notNull()
      .$defaultFn(() => DateTime.now()),
  },
  (table) => [
    index('class_booking_instance_idx').on(table.instanceId),
    index('class_booking_token_idx').on(table.bookingToken),
  ],
);

export type ClassBooking = InferSelectModel<typeof classBooking>;

export const localBambuConnectPrinter = sqliteTable('local_bambu_connect_printer', {
  id: text('id')
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  localIp: text('local_ip').notNull(),
  serial: text('serial').notNull(),
  accessCode: text('access_code').notNull(),
});

export type LocalBambuConnectPrinter = InferSelectModel<typeof localBambuConnectPrinter>;

export const schema = {
  user,
  printRequest,
  printRequestFile,
  payment,
  printMaterial,
  settings,
  squareWebhookLog,
  billingCode,
  organization,
  organizationCharge,
  inventoryItem,
  purchaseList,
  waiver,
  classCatalog,
  classInstance,
  classBooking,
  localBambuConnectPrinter,
};
