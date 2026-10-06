import { type InferSelectModel } from 'drizzle-orm';
import { boolean, foreignKey, index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { DateTime } from 'luxon';
import { luxonTimestamp } from './custom/luxon';

export const user = pgTable('user', {
  email: text('email').notNull().unique().primaryKey(),
  name: text('name').notNull(),
  picture: text('picture').notNull(),
  googleCalendarId: text('google_calendar_id'),
});

export type User = InferSelectModel<typeof user>;

export const printRequest = pgTable('print_request', {
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

  isQuote: boolean('is_quote').notNull().default(false),

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

export const printRequestFile = pgTable('print_request_file', {
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

export const printRequestComment = pgTable(
  'print_request_comment',
  {
    id: text('id')
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    printRequestId: text('print_request_id')
      .notNull()
      .references(() => printRequest.id),
    authorEmail: text('author_email')
      .notNull()
      .references(() => user.email),
    body: text('body').notNull(),
    createdDate: luxonTimestamp('created_date')
      .notNull()
      .$defaultFn(() => DateTime.now()),
  },
  (table) => [index('print_request_comment_request_idx').on(table.printRequestId)],
);

export type PrintRequestComment = InferSelectModel<typeof printRequestComment>;

export const printRequestCommentFile = pgTable(
  'print_request_comment_file',
  {
    id: text('id')
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    commentId: text('comment_id').notNull(),
    fileName: text('file_name').notNull(),
    fileUrl: text('file_url').notNull(),
  },
  (table) => [
    index('print_request_comment_file_comment_idx').on(table.commentId),
    // The generated name exceeds Postgres' 63 character identifier limit
    foreignKey({
      name: 'print_request_comment_file_comment_id_fk',
      columns: [table.commentId],
      foreignColumns: [printRequestComment.id],
    }),
  ],
);

export type PrintRequestCommentFile = InferSelectModel<typeof printRequestCommentFile>;

export const payment = pgTable(
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

export const printMaterial = pgTable('print_material', {
  id: text('id')
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  available: boolean('available').notNull().default(true),
  archived: boolean('archived').notNull().default(false),
  tagId: text('tag_id').unique(),
  filamentId: text('filament_id'),
  vendor: text('vendor'),
  materialType: text('material_type'),
  colorName: text('color_name'),
  colorHex: text('color_hex'),
});

export type PrintMaterial = InferSelectModel<typeof printMaterial>;

export const settings = pgTable('settings', {
  key: text('key').notNull().primaryKey(),
  value: jsonb('value').notNull(),
});

export const squareWebhookLog = pgTable('square_webhook_log', {
  id: text('id').notNull().primaryKey(),
  payload: jsonb('payload').notNull(),
});

export type SquareWebhookLog = InferSelectModel<typeof squareWebhookLog>;

export const billingCode = pgTable('billing_code', {
  id: text('id')
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  code: text('code').notNull().unique(),
  description: text('description').notNull(),
  organizationId: text('organization_id').references(() => organization.id),
  discountId: text('discount_id'),
  archived: boolean('archived').notNull().default(false),
});

export type BillingCode = InferSelectModel<typeof billingCode>;

export const organization = pgTable('organization', {
  id: text('id')
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  email: text('email').notNull(),
  archived: boolean('archived').notNull().default(false),
});

export type Organization = InferSelectModel<typeof organization>;

export const organizationCharge = pgTable(
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

export const inventoryItem = pgTable('inventory_item', {
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

export const purchaseList = pgTable(
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

export const waiver = pgTable('waiver', {
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

export const classCatalog = pgTable('class_catalog', {
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

export const classInstance = pgTable(
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
    googleEventId: text('google_event_id'),
  },
  (table) => [
    index('class_instance_class_idx').on(table.classId),
    index('class_instance_date_idx').on(table.date),
    index('class_instance_recurrence_idx').on(table.recurrenceGroupId),
  ],
);

export type ClassInstance = InferSelectModel<typeof classInstance>;

export const classBooking = pgTable(
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

export const schema = {
  user,
  printRequest,
  printRequestFile,
  printRequestComment,
  printRequestCommentFile,
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
};
