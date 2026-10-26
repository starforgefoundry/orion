import { type InferSelectModel } from 'drizzle-orm';
import { boolean, foreignKey, index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import {
  ACCESS_BASIS,
  enumValues,
  MEMBER_EMAIL_TRIGGER,
  MEMBER_EMAIL_TYPE,
  SUBSCRIPTION_STATUS,
  VISIT_OUTCOME,
  VISIT_SOURCE,
  WAIVER_SOURCE,
} from '../../member_enums';
import { DateTime } from 'luxon';
import { luxonTimestamp } from './custom/luxon';
import {
  PAYMENT_STATUS,
  PAYMENT_TYPE,
  type BillingDiscount,
  type BillingLineItem,
} from '../../utils/billing';

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
    refundedDate: luxonTimestamp('refunded_date'),
    status: text('status', { enum: enumValues(PAYMENT_STATUS) }).notNull(),
    type: text('type', { enum: enumValues(PAYMENT_TYPE) }).notNull(),
    customerName: text('customer_name').notNull().default(''),
    customerEmail: text('customer_email').notNull().default(''),
    lineItems: jsonb('line_items').$type<BillingLineItem[]>().notNull().default([]),
    discounts: jsonb('discounts').$type<BillingDiscount[]>().notNull().default([]),
    total: integer('total').notNull(), // in cents
    // Where the customer goes to pay; a Square invoice link on payments from before Orion billing.
    paymentUrl: text('payment_url'),
    organizationId: text('organization_id').references(() => organization.id),
    squareOrderId: text('square_order_id'),
    squarePaymentId: text('square_payment_id'),
    squareInvoiceId: text('square_invoice_id'),
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
  grantsAccess: boolean('grants_access').notNull().default(true),
  accessEndDate: luxonTimestamp('access_end_date'),
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

export const member = pgTable('member', {
  id: text('id')
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  phone: text('phone'),
  squareCustomerId: text('square_customer_id'),
  passToken: text('pass_token')
    .notNull()
    .unique()
    .$defaultFn(() => crypto.randomUUID()),
  onboardingToken: text('onboarding_token')
    .notNull()
    .unique()
    .$defaultFn(() => crypto.randomUUID()),
  createdDate: luxonTimestamp('created_date')
    .notNull()
    .$defaultFn(() => DateTime.now()),
});

export type Member = InferSelectModel<typeof member>;

export const waiver = pgTable(
  'waiver',
  {
    id: text('id')
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    memberId: text('member_id')
      .notNull()
      .references(() => member.id),
    name: text('name').notNull(),
    email: text('email').notNull(),
    signatureUrl: text('signature_url').notNull(),
    signedDate: luxonTimestamp('signed_date')
      .notNull()
      .$defaultFn(() => DateTime.now()),
    source: text('source', { enum: enumValues(WAIVER_SOURCE) })
      .notNull()
      .default(WAIVER_SOURCE.WEB),
    isAdult: boolean('is_adult').notNull().default(false),
  },
  (table) => [index('waiver_member_idx').on(table.memberId)],
);

export type Waiver = InferSelectModel<typeof waiver>;

export const memberSubscription = pgTable(
  'member_subscription',
  {
    id: text('id').notNull().primaryKey(), // Square subscription id
    memberId: text('member_id')
      .notNull()
      .references(() => member.id),
    planVariationId: text('plan_variation_id').notNull(),
    planName: text('plan_name').notNull(),
    status: text('status', {
      enum: enumValues(SUBSCRIPTION_STATUS),
    }).notNull(),
    startDate: text('start_date').notNull(), // YYYY-MM-DD
    chargedThroughDate: text('charged_through_date'), // YYYY-MM-DD
    canceledDate: text('canceled_date'), // YYYY-MM-DD
    accessEndedDate: luxonTimestamp('access_ended_date'),
    refundedPaymentId: text('refunded_payment_id'),
    updatedDate: luxonTimestamp('updated_date')
      .notNull()
      .$defaultFn(() => DateTime.now()),
  },
  (table) => [index('member_subscription_member_idx').on(table.memberId)],
);

export type MemberSubscription = InferSelectModel<typeof memberSubscription>;

export const dayPass = pgTable(
  'day_pass',
  {
    id: text('id')
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    memberId: text('member_id')
      .notNull()
      .references(() => member.id),
    squareOrderId: text('square_order_id').notNull(),
    purchasedDate: luxonTimestamp('purchased_date').notNull(),
    usedDate: text('used_date'), // YYYY-MM-DD in Central time
  },
  (table) => [
    index('day_pass_member_idx').on(table.memberId),
    index('day_pass_order_idx').on(table.squareOrderId),
  ],
);

export type DayPass = InferSelectModel<typeof dayPass>;

export const organizationMember = pgTable(
  'organization_member',
  {
    id: text('id')
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id),
    memberId: text('member_id')
      .notNull()
      .references(() => member.id),
    addedDate: luxonTimestamp('added_date')
      .notNull()
      .$defaultFn(() => DateTime.now()),
    removedDate: luxonTimestamp('removed_date'),
  },
  (table) => [
    index('organization_member_org_idx').on(table.organizationId),
    index('organization_member_member_idx').on(table.memberId),
  ],
);

export type OrganizationMember = InferSelectModel<typeof organizationMember>;

export const visit = pgTable(
  'visit',
  {
    id: text('id')
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    memberId: text('member_id')
      .notNull()
      .references(() => member.id),
    scannedDate: luxonTimestamp('scanned_date')
      .notNull()
      .$defaultFn(() => DateTime.now()),
    source: text('source', { enum: enumValues(VISIT_SOURCE) }).notNull(),
    accessBasis: text('access_basis', {
      enum: enumValues(ACCESS_BASIS),
    }).notNull(),
    outcome: text('outcome', {
      enum: enumValues(VISIT_OUTCOME),
    }).notNull(),
  },
  (table) => [
    index('visit_member_idx').on(table.memberId),
    index('visit_scanned_date_idx').on(table.scannedDate),
  ],
);

export type Visit = InferSelectModel<typeof visit>;

export const memberEmail = pgTable(
  'member_email',
  {
    id: text('id')
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    memberId: text('member_id')
      .notNull()
      .references(() => member.id),
    type: text('type', { enum: enumValues(MEMBER_EMAIL_TYPE) }).notNull(),
    trigger: text('trigger', {
      enum: enumValues(MEMBER_EMAIL_TRIGGER),
    }).notNull(),
    sentDate: luxonTimestamp('sent_date')
      .notNull()
      .$defaultFn(() => DateTime.now()),
  },
  (table) => [index('member_email_member_idx').on(table.memberId)],
);

export type MemberEmail = InferSelectModel<typeof memberEmail>;

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
    paymentId: text('payment_id').references(() => payment.id),
    status: text('status', { enum: ['confirmed', 'canceled'] }).notNull(),
    bookingToken: text('booking_token')
      .notNull()
      .$defaultFn(() => crypto.randomUUID()),
    quantity: integer('quantity').notNull().default(1),
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

// Overlapping confirmed bookings are rejected by the car_bay_booking_no_overlap exclusion constraint.
export const carBayBooking = pgTable(
  'car_bay_booking',
  {
    id: text('id')
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tier: text('tier', { enum: ['quick_job', 'hourly', 'full_day'] }).notNull(),
    status: text('status', { enum: ['confirmed', 'canceled', 'no_show'] }).notNull(),
    startAt: luxonTimestamp('start_at').notNull(),
    endAt: luxonTimestamp('end_at').notNull(),
    blockedUntil: luxonTimestamp('blocked_until').notNull(),
    isMember: boolean('is_member').notNull(),
    customerName: text('customer_name').notNull(),
    customerEmail: text('customer_email').notNull(),
    customerPhone: text('customer_phone').notNull(),
    paymentId: text('payment_id').references(() => payment.id),
    createdByEmail: text('created_by_email').references(() => user.email),
    bookingToken: text('booking_token')
      .notNull()
      .$defaultFn(() => crypto.randomUUID()),
    reminderSentDate: luxonTimestamp('reminder_sent_date'),
    createdDate: luxonTimestamp('created_date')
      .notNull()
      .$defaultFn(() => DateTime.now()),
  },
  (table) => [
    index('car_bay_booking_start_idx').on(table.startAt),
    index('car_bay_booking_token_idx').on(table.bookingToken),
  ],
);

export type CarBayBooking = InferSelectModel<typeof carBayBooking>;

export const carBayOverrun = pgTable(
  'car_bay_overrun',
  {
    id: text('id')
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    bookingId: text('booking_id')
      .notNull()
      .references(() => carBayBooking.id),
    paymentId: text('payment_id')
      .notNull()
      .references(() => payment.id),
    createdDate: luxonTimestamp('created_date')
      .notNull()
      .$defaultFn(() => DateTime.now()),
  },
  (table) => [index('car_bay_overrun_booking_idx').on(table.bookingId)],
);

export type CarBayOverrun = InferSelectModel<typeof carBayOverrun>;

// Overlapping closures are rejected by the car_bay_closure_no_overlap exclusion constraint.
export const carBayClosure = pgTable(
  'car_bay_closure',
  {
    id: text('id')
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    startAt: luxonTimestamp('start_at').notNull(),
    endAt: luxonTimestamp('end_at').notNull(),
    reason: text('reason'),
    createdByEmail: text('created_by_email').references(() => user.email),
    createdDate: luxonTimestamp('created_date')
      .notNull()
      .$defaultFn(() => DateTime.now()),
  },
  (table) => [index('car_bay_closure_start_idx').on(table.startAt)],
);

export type CarBayClosure = InferSelectModel<typeof carBayClosure>;

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
  member,
  waiver,
  memberSubscription,
  dayPass,
  organizationMember,
  visit,
  memberEmail,
  classCatalog,
  classInstance,
  classBooking,
  carBayBooking,
  carBayOverrun,
  carBayClosure,
};
