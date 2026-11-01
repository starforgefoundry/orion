import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { DateTime } from 'luxon';
import postgres from 'postgres';
// Relative imports: SvelteKit's $lib alias is not available to Node scripts.
import {
  ACCESS_BASIS,
  MEMBER_EMAIL_TRIGGER,
  MEMBER_EMAIL_TYPE,
  SUBSCRIPTION_STATUS,
  VISIT_OUTCOME,
  VISIT_SOURCE,
  WAIVER_SOURCE,
  type AccessBasis,
  type SubscriptionStatus,
} from '../src/lib/utils/member-enums.ts';
import { SPACE_ZONE, spaceDate } from '../src/lib/utils/space.ts';
import {
  buildBill,
  PAYMENT_STATUS,
  PAYMENT_TYPE,
  type Bill,
  type BillingLineItem,
  type PaymentStatus,
  type PaymentType,
} from '../src/lib/utils/billing.ts';
import {
  CAR_BAY_STATUS,
  CAR_BAY_TIER,
  CAR_BAY_TIER_NAMES,
  CarBayRules,
  DEFAULT_CAR_BAY_POLICY,
  type CarBayTier,
} from '../src/lib/utils/car-bay.ts';
import { CLASS_BOOKING_STATUS, CLASS_INSTANCE_STATUS } from '../src/lib/utils/classes.ts';
import { printBill, type PrintPricing } from '../src/lib/utils/print-pricing.ts';
import { PRINT_REQUEST_STATUS, type PrintRequestStatus } from '../src/lib/utils/print-request.ts';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const LOCAL_HOSTS = ['localhost', '127.0.0.1', 'postgres'];
const databaseHost = new URL(process.env.DATABASE_URL).hostname;
if (!LOCAL_HOSTS.includes(databaseHost)) {
  throw new Error(`Refusing to seed non-local database host "${databaseHost}"`);
}

const DEV_USER_EMAIL = process.env.DEV_LOGIN_EMAIL || 'dev@starforgefoundry.com';
const STORAGE_DIR = resolve(process.env.STORAGE_DIR || 'storage');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const SQUARE_SANDBOX_HOST = 'squareupsandbox.com';
const PRINT_PRICING: PrintPricing = { additionalBuildPlatePrice: 300, memberDiscountPercent: 10 };
const CAR_BAY_RULES = new CarBayRules(DEFAULT_CAR_BAY_POLICY);

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });

type Transaction = postgres.TransactionSql;

function daysAgo(days: number) {
  return DateTime.now().minus({ days }).toISO();
}

function isoDate(offsetDays: number) {
  return spaceDate(DateTime.now().plus({ days: offsetDays }));
}

function pick<T>(items: readonly T[], index: number) {
  return items[index % items.length];
}

async function writeStorageFile(key: string, contents: string) {
  const path = resolve(STORAGE_DIR, key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
  return key;
}

type SeedPayment = {
  id?: string;
  type: PaymentType;
  status: PaymentStatus;
  customerName: string;
  customerEmail: string;
  bill: Pick<Bill, 'lineItems' | 'discounts' | 'total'>;
  issuedDaysAgo: number;
  organizationId?: string | null;
  /** Only payments from before Orion billing have a stored Square invoice link. */
  paymentUrl?: string | null;
  squareInvoiceId?: string | null;
};

const PAID_STATUSES: PaymentStatus[] = [PAYMENT_STATUS.PAID, PAYMENT_STATUS.REFUNDED];

async function insertPayment(tx: Transaction, payment: SeedPayment) {
  const id = payment.id ?? randomUUID();
  const paid = PAID_STATUSES.includes(payment.status);

  await tx`
    INSERT INTO payment (id, type, status, issued_date, payment_date, refunded_date, customer_name,
      customer_email, line_items, discounts, total, organization_id, payment_url, square_invoice_id)
    VALUES (${id}, ${payment.type}, ${payment.status}, ${daysAgo(payment.issuedDaysAgo)},
      ${paid ? daysAgo(payment.issuedDaysAgo - 0.5) : null},
      ${payment.status === PAYMENT_STATUS.REFUNDED ? daysAgo(0) : null}, ${payment.customerName},
      ${payment.customerEmail}, ${tx.json(payment.bill.lineItems)}, ${tx.json(payment.bill.discounts)},
      ${payment.bill.total}, ${payment.organizationId ?? null}, ${payment.paymentUrl ?? null},
      ${payment.squareInvoiceId ?? null})`;
  return id;
}

function itemBill(name: string, quantity: number, unitAmount: number) {
  return buildBill([{ name, quantity, unitAmount }]);
}

function printRequestBill(
  materialType: string,
  materialCost: number,
  buildPlates: number,
  isMember = false,
) {
  return printBill(
    { materialType, materialCost, buildPlates, isMember, billedToOrganization: false },
    PRINT_PRICING,
  );
}

/** Card payments need a real sandbox location, so the first one on the dev account is used. */
async function sandboxLocationId() {
  const squareUrl = process.env.SQUARE_URL ?? '';
  if (!squareUrl.includes(SQUARE_SANDBOX_HOST) || !process.env.SQUARE_TOKEN) return '';

  const response = await fetch(`${squareUrl}/v2/locations`, {
    headers: { Authorization: `Bearer ${process.env.SQUARE_TOKEN}` },
  });
  if (!response.ok) return '';
  const { locations } = (await response.json()) as { locations?: { id: string }[] };
  return locations?.[0]?.id ?? '';
}

const SIGNATURE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120"><path d="M20 80 C60 20 90 110 130 60 S200 30 230 70 S300 100 380 40" stroke="black" stroke-width="3" fill="none"/></svg>`;

const users = [
  { email: DEV_USER_EMAIL, name: 'Dev User' },
  { email: 'alex@starforgefoundry.com', name: 'Alex Rivera' },
  { email: 'sam@starforgefoundry.com', name: 'Sam Chen' },
];

const materials = [
  { name: 'PLA Basic - Black', type: 'PLA', color: 'Black', hex: '#000000', available: true },
  { name: 'PLA Basic - White', type: 'PLA', color: 'Jade White', hex: '#FFFFFF', available: true },
  { name: 'PLA Basic - Red', type: 'PLA', color: 'Red', hex: '#C12E1F', available: true },
  {
    name: 'PLA Matte - Sky Blue',
    type: 'PLA',
    color: 'Sky Blue',
    hex: '#56B7E6',
    available: true,
  },
  { name: 'PETG HF - Orange', type: 'PETG', color: 'Orange', hex: '#F99963', available: true },
  { name: 'PETG HF - Gray', type: 'PETG', color: 'Gray', hex: '#8E9089', available: false },
  { name: 'TPU 95A - Black', type: 'TPU', color: 'Black', hex: '#101820', available: true },
  { name: 'ASA - Green', type: 'ASA', color: 'Green', hex: '#00AE42', available: false },
].map((material, index) => ({
  ...material,
  id: randomUUID(),
  tagId: `TAG${(1000 + index).toString(16).toUpperCase()}`,
}));

const organizations = [
  { name: 'Robotics Club', email: 'robotics@example.edu' },
  { name: 'Engineering Department', email: 'engineering@example.edu' },
  { name: 'Art Collective', email: 'hello@artcollective.example' },
].map((organization) => ({ ...organization, id: randomUUID() }));

type Organization = (typeof organizations)[number];

const billingCodes = [
  { code: 'ROBOTICS25', description: 'Robotics Club sponsored prints', org: organizations[0].id },
  { code: 'ENGDEPT', description: 'Engineering coursework', org: organizations[1].id },
];

const customers = [
  ['Jordan Smith', 'jordan.smith@example.com'],
  ['Taylor Nguyen', 'taylor.n@example.com'],
  ['Morgan Patel', 'mpatel@example.com'],
  ['Casey Johnson', 'casey.j@example.com'],
  ['Riley Garcia', 'riley.garcia@example.com'],
  ['Avery Thompson', 'avery.t@example.com'],
  ['Quinn Martinez', 'quinn.m@example.com'],
  ['Jamie Lee', 'jamie.lee@example.com'],
];

type MemberScenario = {
  name: string;
  email: string;
  waiver: boolean;
  subscription?: {
    planName: string;
    status: SubscriptionStatus;
    canceled?: boolean;
    refunded?: boolean;
  };
  organization?: number;
  /** Days ago each pass was used, null when unused. */
  dayPasses?: (number | null)[];
  visits?: number;
  visitBasis?: AccessBasis;
};

const memberScenarios: MemberScenario[] = [
  {
    name: 'Jordan Smith',
    email: 'jordan.smith@example.com',
    waiver: true,
    subscription: { planName: 'Monthly Membership', status: SUBSCRIPTION_STATUS.ACTIVE },
    visits: 9,
    visitBasis: ACCESS_BASIS.SUBSCRIPTION,
  },
  {
    name: 'Taylor Nguyen',
    email: 'taylor.n@example.com',
    waiver: true,
    subscription: {
      planName: 'Monthly Membership',
      status: SUBSCRIPTION_STATUS.ACTIVE,
      canceled: true,
    },
    visits: 4,
    visitBasis: ACCESS_BASIS.SUBSCRIPTION,
  },
  {
    name: 'Morgan Patel',
    email: 'mpatel@example.com',
    waiver: true,
    subscription: {
      planName: 'Student Membership',
      status: SUBSCRIPTION_STATUS.ACTIVE,
      refunded: true,
    },
    visits: 3,
    visitBasis: ACCESS_BASIS.SUBSCRIPTION,
  },
  {
    name: 'Casey Johnson',
    email: 'casey.j@example.com',
    waiver: true,
    organization: 0,
    visits: 6,
    visitBasis: ACCESS_BASIS.ORGANIZATION,
  },
  {
    name: 'Riley Garcia',
    email: 'riley.garcia@example.com',
    waiver: true,
    organization: 1,
    visits: 2,
  },
  {
    name: 'Avery Thompson',
    email: 'avery.t@example.com',
    waiver: true,
    dayPasses: [3, null],
    visits: 1,
    visitBasis: ACCESS_BASIS.DAY_PASS,
  },
  {
    name: 'Quinn Martinez',
    email: 'quinn.m@example.com',
    waiver: true,
    dayPasses: [8],
    visits: 1,
    visitBasis: ACCESS_BASIS.DAY_PASS,
  },
  { name: 'Jamie Lee', email: 'jamie.lee@example.com', waiver: true },
  {
    name: 'Drew Kim',
    email: 'drew.kim@example.com',
    waiver: false,
    subscription: { planName: 'Monthly Membership', status: SUBSCRIPTION_STATUS.ACTIVE },
  },
  { name: 'Pat Morales', email: 'pat.morales@example.com', waiver: false, dayPasses: [null] },
  { name: 'Robin Park', email: 'robin.park@example.com', waiver: false, organization: 0 },
  {
    name: 'Sky Alvarez',
    email: 'sky.alvarez@example.com',
    waiver: true,
    subscription: { planName: 'Monthly Membership', status: SUBSCRIPTION_STATUS.PAUSED },
  },
];

const projects = [
  'Drone Frame v3',
  'Replacement Knob',
  'Cosplay Helmet',
  'Raspberry Pi Case',
  'Planter Set',
  'Gear Prototype',
  'Desk Organizer',
  'Phone Stand',
  'Keyboard Case with a Really Long Project Name That Should Truncate',
  'Mini Figures',
  'Robot Arm Joint',
  'Lamp Shade',
];

const PRINT_STATUSES: PrintRequestStatus[] = [
  PRINT_REQUEST_STATUS.IN_QUEUE,
  PRINT_REQUEST_STATUS.IN_QUEUE,
  PRINT_REQUEST_STATUS.PRINTING,
  PRINT_REQUEST_STATUS.DONE,
  PRINT_REQUEST_STATUS.PICKED_UP,
  PRINT_REQUEST_STATUS.CANCELED,
];
const OPEN_PAYMENT_STATUSES: PaymentStatus[] = [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PAID];

const SPECIAL_REQUESTS = [
  '',
  'Please print at 30% infill.\nSupports only where needed.',
  'Need it by Friday if possible!',
  '',
  'Use tree supports, the overhangs are tricky.',
];

const COMMENTS = [
  'Sliced it, about 6 hours total. Starting tonight.',
  'Customer asked to bump infill to 40%.',
  'First plate failed — bed adhesion. Reprinting with glue stick.',
  'Done and bagged on the pickup shelf.',
  'Attached the updated slicer profile.',
];

function bayTime(offsetDays: number, hour: number, minute = 0) {
  return DateTime.now()
    .setZone(SPACE_ZONE)
    .startOf('day')
    .plus({ days: offsetDays })
    .set({ hour, minute });
}

function bayHours(offsetDays: number) {
  return CAR_BAY_RULES.openWindow(isoDate(offsetDays));
}

type SeedCarBayBooking = {
  tier: CarBayTier;
  status: (typeof CAR_BAY_STATUS)[keyof typeof CAR_BAY_STATUS];
  startAt: DateTime;
  endAt: DateTime;
  customer: number;
  amountPaid: number;
};

const carBayBookings: SeedCarBayBooking[] = [
  // Past days, so staff can see history behind the striped past slots.
  {
    tier: CAR_BAY_TIER.HOURLY,
    status: CAR_BAY_STATUS.CONFIRMED,
    startAt: bayTime(-2, 17),
    endAt: bayTime(-2, 20),
    customer: 0,
    amountPaid: 3000,
  },
  {
    tier: CAR_BAY_TIER.QUICK_JOB,
    status: CAR_BAY_STATUS.NO_SHOW,
    startAt: bayTime(-1, 16),
    endAt: bayTime(-1, 17, 30),
    customer: 1,
    amountPaid: 1800,
  },
  {
    tier: CAR_BAY_TIER.QUICK_JOB,
    status: CAR_BAY_STATUS.CONFIRMED,
    startAt: bayTime(-1, 18),
    endAt: bayTime(-1, 19, 30),
    customer: 2,
    amountPaid: 1200,
  },
  // Today, later in the evening.
  {
    tier: CAR_BAY_TIER.HOURLY,
    status: CAR_BAY_STATUS.CONFIRMED,
    startAt: bayTime(0, 18),
    endAt: bayTime(0, 20),
    customer: 3,
    amountPaid: 3000,
  },
  // Back to back: the second booking starts right after the first one's turnover.
  {
    tier: CAR_BAY_TIER.QUICK_JOB,
    status: CAR_BAY_STATUS.CONFIRMED,
    startAt: bayTime(1, 16),
    endAt: bayTime(1, 17, 30),
    customer: 4,
    amountPaid: 1200,
  },
  {
    tier: CAR_BAY_TIER.HOURLY,
    status: CAR_BAY_STATUS.CONFIRMED,
    startAt: bayTime(1, 18),
    endAt: bayTime(1, 20),
    customer: 5,
    amountPaid: 0,
  },
  // A canceled booking that should not block anything.
  {
    tier: CAR_BAY_TIER.HOURLY,
    status: CAR_BAY_STATUS.CANCELED,
    startAt: bayTime(2, 19),
    endAt: bayTime(2, 21),
    customer: 6,
    amountPaid: 3000,
  },
  // Single full day, then a two day full day booking.
  {
    tier: CAR_BAY_TIER.FULL_DAY,
    status: CAR_BAY_STATUS.CONFIRMED,
    startAt: bayHours(3).open,
    endAt: bayHours(3).close,
    customer: 7,
    amountPaid: 2500,
  },
  {
    tier: CAR_BAY_TIER.FULL_DAY,
    status: CAR_BAY_STATUS.CONFIRMED,
    startAt: bayHours(4).open,
    endAt: bayHours(5).close,
    customer: 0,
    amountPaid: 8000,
  },
  // Next week, so the staff schedule has something after paging forward.
  {
    tier: CAR_BAY_TIER.HOURLY,
    status: CAR_BAY_STATUS.CONFIRMED,
    startAt: bayTime(8, 17),
    endAt: bayTime(8, 20),
    customer: 1,
    amountPaid: 4500,
  },
];

const carBayClosures = [
  { startAt: bayTime(2, 16), endAt: bayTime(2, 18), reason: 'Lift inspection' },
  { startAt: bayHours(6).open, endAt: bayHours(6).close, reason: 'Shop event' },
  { startAt: bayTime(9, 16), endAt: bayTime(9, 19), reason: null },
];

/** Fixed ids so the customer pages for each billing state have stable links. */
const DEMO = {
  SUBMITTED: '00000000-0000-4000-8000-000000000001',
  QUOTE: '00000000-0000-4000-8000-000000000002',
  UNPAID: '00000000-0000-4000-8000-000000000003',
  READY_UNPAID: '00000000-0000-4000-8000-000000000004',
  PAID: '00000000-0000-4000-8000-000000000005',
  ORGANIZATION: '00000000-0000-4000-8000-000000000006',
  LEGACY_INVOICE: '00000000-0000-4000-8000-000000000007',
  CANCELED: '00000000-0000-4000-8000-000000000008',
  OVERRUN_BOOKING: '00000000-0000-4000-8000-000000000009',
  OVERRUN_PAYMENT: '00000000-0000-4000-8000-000000000010',
  OVERRUN_PAID: '00000000-0000-4000-8000-000000000011',
  BALANCE: '00000000-0000-4000-8000-000000000012',
  CAR_BAY_TOKEN: '00000000-0000-4000-8000-000000000013',
};

const MEMBER_CUSTOMER = customers[0];
const GUEST_CUSTOMER = customers[1];

type DemoPrint = {
  id: string;
  project: string;
  status: PrintRequestStatus;
  isQuote?: boolean;
  customer?: string[];
  billingCode?: string | null;
  payment?: Pick<SeedPayment, 'organizationId' | 'paymentUrl' | 'squareInvoiceId'> & {
    status: PaymentStatus;
    member?: boolean;
  };
};

async function seedUsers(tx: Transaction) {
  for (const user of users) {
    await tx`INSERT INTO "user" (email, name, picture) VALUES (${user.email}, ${user.name}, '')`;
  }
}

async function seedPrintMaterials(tx: Transaction) {
  for (const m of materials) {
    await tx`
      INSERT INTO print_material (id, name, available, archived, tag_id, vendor, material_type, color_name, color_hex)
      VALUES (${m.id}, ${m.name}, ${m.available}, false, ${m.tagId}, 'Bambu Lab', ${m.type}, ${m.color}, ${m.hex})`;
  }
  await tx`
    INSERT INTO print_material (id, name, available, archived, vendor, material_type)
    VALUES (${randomUUID()}, 'Old Silk PLA - Gold', false, true, 'Generic', 'PLA')`;
}

async function seedSettings(tx: Transaction) {
  await tx`
    INSERT INTO settings (key, value) VALUES
      ('printRequest', ${tx.json({
        isOpen: true,
        announcement: 'Holiday hours: prints may take an extra 2–3 days.',
        announcementUntil: isoDate(30),
        maxUploadMB: 200,
        allowedFileTypes: '.stl, .3mf, .step, .stp',
        discordWebhookUrl: '',
      })}),
      ('printRequestSquare', ${tx.json({ locationId: await sandboxLocationId() })}),
      ('printPricing', ${tx.json(PRINT_PRICING)})`;
}

async function seedOrganizations(tx: Transaction) {
  for (const org of organizations) {
    await tx`INSERT INTO organization (id, name, email) VALUES (${org.id}, ${org.name}, ${org.email})`;
  }
  await tx`INSERT INTO organization (id, name, email, archived) VALUES (${randomUUID()}, 'Old Makers Guild', 'guild@example.com', true)`;
  await tx`UPDATE organization SET access_end_date = ${daysAgo(-60)} WHERE id = ${organizations[0].id}`;
  await tx`UPDATE organization SET access_end_date = ${daysAgo(5)} WHERE id = ${organizations[1].id}`;

  for (const code of billingCodes) {
    await tx`
      INSERT INTO billing_code (id, code, description, organization_id)
      VALUES (${randomUUID()}, ${code.code}, ${code.description}, ${code.org})`;
  }

  for (const [index, org] of organizations.entries()) {
    for (let charge = 0; charge < 2 + index; charge++) {
      const description = `Workshop materials #${charge + 1}`;
      const paymentId = await insertPayment(tx, {
        type: PAYMENT_TYPE.ORG_CHARGE,
        status: charge === 0 ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.PENDING,
        customerName: org.name,
        customerEmail: org.email,
        bill: itemBill(description, 1, 2500 + charge * 1000),
        issuedDaysAgo: charge * 7,
        organizationId: org.id,
      });
      await tx`
        INSERT INTO organization_charge (id, organization_id, creation_date, description, payment_id)
        VALUES (${randomUUID()}, ${org.id}, ${daysAgo(charge * 7)}, ${description}, ${paymentId})`;
    }
  }
}

function printPaymentStatus(status: PrintRequestStatus, isQuote: boolean, index: number) {
  if (status === PRINT_REQUEST_STATUS.PICKED_UP) return PAYMENT_STATUS.PAID;
  if (status === PRINT_REQUEST_STATUS.CANCELED) return PAYMENT_STATUS.CANCELED;
  if (isQuote) return PAYMENT_STATUS.QUOTE;
  return pick(OPEN_PAYMENT_STATUSES, index);
}

async function seedPrintRequests(tx: Transaction) {
  const availableMaterials = materials.filter((m) => m.available);

  for (const [index, project] of projects.entries()) {
    const [customerName, email] = pick(customers, index);
    const status = pick(PRINT_STATUSES, index);
    const id = randomUUID();
    const material = pick(availableMaterials, index);
    const isQuote = index % 4 === 1;
    const billingCode = index % 5 === 2 ? pick(billingCodes, index) : null;
    const buildPlates = 1 + (index % 3);
    const materialCost = 500 + index * 120;

    const paymentId =
      status !== PRINT_REQUEST_STATUS.IN_QUEUE || index % 3 === 0
        ? await insertPayment(tx, {
            type: PAYMENT_TYPE.PRINT_REQUEST,
            status: printPaymentStatus(status, isQuote, index),
            customerName,
            customerEmail: email,
            bill: printRequestBill(material.type, materialCost, buildPlates),
            issuedDaysAgo: index,
            organizationId: billingCode?.org ?? null,
          })
        : null;

    await tx`
      INSERT INTO print_request (id, "submissionDate", "completionDate", email, customer_name, project_name, status,
        is_quote, material, special_requests, billing_code, payment_id, buildplate_count, material_cost)
      VALUES (${id}, ${daysAgo(index * 2 + 1)}, ${status === PRINT_REQUEST_STATUS.PICKED_UP ? daysAgo(index) : null}, ${email},
        ${customerName}, ${project}, ${status}, ${isQuote}, ${material.id}, ${pick(SPECIAL_REQUESTS, index)},
        ${billingCode?.code ?? null}, ${paymentId}, ${buildPlates}, ${paymentId ? materialCost : 0})`;

    await seedPrintFiles(tx, id, project, index);
    await seedPrintComments(tx, id, index);
  }
}

async function seedPrintFiles(tx: Transaction, requestId: string, project: string, index: number) {
  const fileCount = 1 + (index % 4);
  for (let part = 0; part < fileCount; part++) {
    const fileName = `${project.split(' ')[0].toLowerCase()}_part${part + 1}.${part % 2 ? '3mf' : 'stl'}`;
    const key = await writeStorageFile(
      `print_requests/${requestId}/${randomUUID()}`,
      `solid ${fileName}\nendsolid\n`,
    );
    await tx`
      INSERT INTO print_request_file (id, print_request_id, file_name, file_url, quantity)
      VALUES (${randomUUID()}, ${requestId}, ${fileName}, ${key}, ${1 + ((index + part) % 3)})`;
  }
}

async function seedPrintComments(tx: Transaction, requestId: string, index: number) {
  const commentCount = index % 4;
  for (let position = 0; position < commentCount; position++) {
    const commentId = randomUUID();
    await tx`
      INSERT INTO print_request_comment (id, print_request_id, author_email, body, created_date)
      VALUES (${commentId}, ${requestId}, ${pick(users, index + position).email},
        ${pick(COMMENTS, index + position)}, ${daysAgo(index - position * 0.2)})`;

    if (position === 1) {
      const key = await writeStorageFile(
        `print_requests/${requestId}/comments/${randomUUID()}.3mf`,
        'placeholder slicer project',
      );
      await tx`
        INSERT INTO print_request_comment_file (id, comment_id, file_name, file_url)
        VALUES (${randomUUID()}, ${commentId}, 'profile_v2.3mf', ${key})`;
    }
  }
}

async function seedCustomerViews(tx: Transaction, organization: Organization) {
  const material = materials[0];
  const prints: DemoPrint[] = [
    { id: DEMO.SUBMITTED, project: 'Demo - Just Submitted', status: PRINT_REQUEST_STATUS.IN_QUEUE },
    {
      id: DEMO.QUOTE,
      project: 'Demo - Quote Awaiting Approval',
      status: PRINT_REQUEST_STATUS.IN_QUEUE,
      isQuote: true,
      customer: MEMBER_CUSTOMER,
      payment: { status: PAYMENT_STATUS.QUOTE, member: true },
    },
    {
      id: DEMO.UNPAID,
      project: 'Demo - Printing, Unpaid',
      status: PRINT_REQUEST_STATUS.PRINTING,
      payment: { status: PAYMENT_STATUS.PENDING },
    },
    {
      id: DEMO.READY_UNPAID,
      project: 'Demo - Ready for Pickup, Unpaid',
      status: PRINT_REQUEST_STATUS.DONE,
      customer: MEMBER_CUSTOMER,
      payment: { status: PAYMENT_STATUS.PENDING, member: true },
    },
    {
      id: DEMO.PAID,
      project: 'Demo - Paid',
      status: PRINT_REQUEST_STATUS.DONE,
      payment: { status: PAYMENT_STATUS.PAID },
    },
    {
      id: DEMO.ORGANIZATION,
      project: 'Demo - Billed to Organization',
      status: PRINT_REQUEST_STATUS.PRINTING,
      billingCode: billingCodes[0].code,
      payment: { status: PAYMENT_STATUS.PENDING, organizationId: organization.id },
    },
    {
      id: DEMO.LEGACY_INVOICE,
      project: 'Demo - Old Square Invoice',
      status: PRINT_REQUEST_STATUS.PRINTING,
      payment: {
        status: PAYMENT_STATUS.PENDING,
        squareInvoiceId: 'legacy-invoice',
        paymentUrl: 'https://squareupsandbox.com/pay-invoice/legacy-invoice',
      },
    },
    {
      id: DEMO.CANCELED,
      project: 'Demo - Canceled',
      status: PRINT_REQUEST_STATUS.CANCELED,
      payment: { status: PAYMENT_STATUS.CANCELED },
    },
  ];

  for (const print of prints) {
    const [customerName, email] = print.customer ?? GUEST_CUSTOMER;
    const { member, ...payment } = print.payment ?? {};
    const paymentId = print.payment
      ? await insertPayment(tx, {
          type: PAYMENT_TYPE.PRINT_REQUEST,
          status: print.payment.status,
          customerName,
          customerEmail: email,
          bill: printRequestBill(material.type, 1250, 3, member),
          issuedDaysAgo: 1,
          ...payment,
        })
      : null;

    await tx`
      INSERT INTO print_request (id, "submissionDate", email, customer_name, project_name, status,
        is_quote, material, special_requests, billing_code, payment_id, buildplate_count, material_cost)
      VALUES (${print.id}, ${daysAgo(2)}, ${email}, ${customerName}, ${print.project}, ${print.status},
        ${print.isQuote ?? false}, ${material.id}, '', ${print.billingCode ?? null}, ${paymentId},
        ${paymentId ? 3 : 1}, ${paymentId ? 1250 : 0})`;
    await tx`
      INSERT INTO print_request_file (id, print_request_id, file_name, file_url, quantity)
      VALUES (${randomUUID()}, ${print.id}, 'bracket.3mf', ${`print_requests/${print.id}/bracket`}, 2)`;
  }

  const [customerName, customerEmail] = GUEST_CUSTOMER;
  const overrunEnd = bayTime(-4, 19);
  await tx`
    INSERT INTO car_bay_booking (id, tier, status, start_at, end_at, blocked_until, is_member,
      customer_name, customer_email, customer_phone, created_by_email, booking_token, created_date)
    VALUES (${DEMO.OVERRUN_BOOKING}, ${CAR_BAY_TIER.HOURLY}, ${CAR_BAY_STATUS.CONFIRMED},
      ${bayTime(-4, 17).toISO()}, ${overrunEnd.toISO()}, ${CAR_BAY_RULES.blockedUntil(overrunEnd).toISO()},
      false, ${customerName}, ${customerEmail}, '555-0100', ${DEV_USER_EMAIL}, ${DEMO.CAR_BAY_TOKEN},
      ${daysAgo(5)})`;

  const overruns = [
    { id: DEMO.OVERRUN_PAYMENT, status: PAYMENT_STATUS.PENDING, quantity: 2 },
    { id: DEMO.OVERRUN_PAID, status: PAYMENT_STATUS.PAID, quantity: 1 },
  ];
  for (const overrun of overruns) {
    await insertPayment(tx, {
      id: overrun.id,
      type: PAYMENT_TYPE.CAR_BAY_OVERRUN,
      status: overrun.status,
      customerName,
      customerEmail,
      bill: itemBill('Car Bay - Overrun (Non-member)', overrun.quantity, 2000),
      issuedDaysAgo: 3,
    });
    await tx`
      INSERT INTO car_bay_overrun (id, booking_id, payment_id, created_date)
      VALUES (${randomUUID()}, ${DEMO.OVERRUN_BOOKING}, ${overrun.id}, ${daysAgo(3)})`;
  }

  await insertPayment(tx, {
    id: DEMO.BALANCE,
    type: PAYMENT_TYPE.BALANCE,
    status: PAYMENT_STATUS.PENDING,
    customerName: organization.name,
    customerEmail: organization.email,
    bill: itemBill('Organization Balance Payment', 1, 6000),
    issuedDaysAgo: 1,
    organizationId: organization.id,
  });
}

async function seedInventory(tx: Transaction) {
  const inventory = [
    ['Bambu PLA Basic 1kg', 'Bambu Lab', 'Standard filament spool'],
    ['Isopropyl Alcohol 99%', 'Amazon', 'Bed cleaning'],
    ['Glue Stick 6-pack', 'Elmers', 'Bed adhesion'],
    ['0.4mm Hardened Nozzle', 'Bambu Lab', 'Replacement nozzle for X1C'],
    ['Laser Plywood 3mm (10pk)', 'Ocooch', '12x20 birch sheets'],
    ['Soldering Tips', 'Hakko', 'T18-D16 chisel tips'],
    ['M3 Screw Assortment', 'McMaster-Carr', 'Socket head, 6–20mm'],
    ['Vinyl Roll - Black', 'Oracal', '651 permanent vinyl'],
    ['Shop Towels', 'Scott', 'Blue shop towels'],
    ['Resin - Grey 1L', 'Elegoo', 'Standard photopolymer resin'],
  ].map(([name, vendor, description]) => ({ id: randomUUID(), name, vendor, description }));

  for (const item of inventory) {
    await tx`
      INSERT INTO inventory_item (id, name, vendor, url, description)
      VALUES (${item.id}, ${item.name}, ${item.vendor}, 'https://example.com/product', ${item.description})`;
  }
  for (const [index, item] of inventory.slice(0, 4).entries()) {
    await tx`
      INSERT INTO purchase_list (id, inventory_item_id, added_date)
      VALUES (${randomUUID()}, ${item.id}, ${daysAgo(index)})`;
  }
}

async function seedMembers(tx: Transaction) {
  for (const [index, scenario] of memberScenarios.entries()) {
    const memberId = randomUUID();
    const joined = daysAgo(30 + index * 9);
    await tx`
      INSERT INTO member (id, email, name, pass_token, onboarding_token, created_date)
      VALUES (${memberId}, ${scenario.email}, ${scenario.name}, ${randomUUID()}, ${randomUUID()}, ${joined})`;

    if (scenario.waiver) {
      const waiverId = randomUUID();
      const key = await writeStorageFile(
        `waivers/${scenario.name.replace(/\W+/g, '_')}_${isoDate(-index * 9)}_${waiverId}`,
        SIGNATURE_SVG,
      );
      await tx`
        INSERT INTO waiver (id, member_id, name, email, signature_url, signed_date, is_adult, source)
        VALUES (${waiverId}, ${memberId}, ${scenario.name}, ${scenario.email}, ${key}, ${joined}, true,
          ${index % 3 === 0 ? WAIVER_SOURCE.KIOSK : WAIVER_SOURCE.WEB})`;
    }

    if (scenario.subscription) {
      const sub = scenario.subscription;
      await tx`
        INSERT INTO member_subscription (id, member_id, plan_variation_id, plan_name, status, start_date,
          charged_through_date, canceled_date, access_ended_date, refunded_payment_id, updated_date)
        VALUES (${`sandbox-sub-${index}`}, ${memberId}, 'sandbox-plan', ${sub.planName}, ${sub.status},
          ${isoDate(-90)}, ${isoDate(14)}, ${sub.canceled ? isoDate(14) : null},
          ${sub.refunded ? daysAgo(2) : null}, ${sub.refunded ? `sandbox-payment-${index}` : null}, now())`;
      await tx`
        INSERT INTO member_email (id, member_id, type, trigger, sent_date)
        VALUES (${randomUUID()}, ${memberId}, ${MEMBER_EMAIL_TYPE.ONBOARDING},
          ${MEMBER_EMAIL_TRIGGER.SUBSCRIPTION}, ${daysAgo(90)})`;
    }

    if (scenario.organization !== undefined) {
      await tx`
        INSERT INTO organization_member (id, organization_id, member_id, added_date)
        VALUES (${randomUUID()}, ${organizations[scenario.organization].id}, ${memberId}, ${daysAgo(40)})`;
      await tx`
        INSERT INTO member_email (id, member_id, type, trigger, sent_date)
        VALUES (${randomUUID()}, ${memberId}, ${MEMBER_EMAIL_TYPE.ONBOARDING},
          ${MEMBER_EMAIL_TRIGGER.ORGANIZATION}, ${daysAgo(40)})`;
    }

    for (const [passIndex, usedDaysAgo] of (scenario.dayPasses ?? []).entries()) {
      await tx`
        INSERT INTO day_pass (id, member_id, square_order_id, purchased_date, used_date)
        VALUES (${`sandbox-order-${index}:${passIndex}`}, ${memberId}, ${`sandbox-order-${index}`},
          ${daysAgo(20)}, ${usedDaysAgo === null ? null : isoDate(-usedDaysAgo)})`;
    }

    for (let visit = 0; visit < (scenario.visits ?? 0); visit++) {
      await tx`
        INSERT INTO visit (id, member_id, scanned_date, source, access_basis, outcome)
        VALUES (${randomUUID()}, ${memberId}, ${daysAgo(visit * 2 + index / 10)},
          ${visit % 5 === 4 ? VISIT_SOURCE.STAFF : VISIT_SOURCE.KIOSK},
          ${scenario.visitBasis ?? ACCESS_BASIS.NONE},
          ${scenario.visitBasis ? VISIT_OUTCOME.ADMITTED : VISIT_OUTCOME.DENIED_NO_ACCESS})`;
    }
  }
}

async function seedClasses(tx: Transaction) {
  const catalog = [
    {
      name: 'Intro to 3D Printing',
      description: 'Learn slicing, printer setup and how to get a great first print.',
      price: 4500,
    },
    {
      name: 'Laser Cutting Basics',
      description: 'Design and cut your first project on the laser cutter.',
      price: 5500,
    },
    {
      name: 'Soldering 101',
      description: 'Build a small kit while learning through-hole soldering.',
      price: 3500,
    },
    {
      name: 'CNC Router Safety',
      description: 'Required safety class before using the CNC router.',
      price: 0,
    },
  ].map((entry) => ({ ...entry, id: randomUUID() }));

  for (const entry of catalog) {
    await tx`
      INSERT INTO class_catalog (id, name, description, price, created_date)
      VALUES (${entry.id}, ${entry.name}, ${entry.description}, ${entry.price}, now())`;
  }

  const recurrenceGroupId = randomUUID();
  const instanceOffsets = [-10, -3, 1, 2, 4, 7, 9, 11, 14, 16, 21, 28];
  for (const [index, offset] of instanceOffsets.entries()) {
    const instanceId = randomUUID();
    const entry = pick(catalog, index);
    const isRecurring = entry === catalog[0];
    const status = index === 5 ? CLASS_INSTANCE_STATUS.CANCELED : CLASS_INSTANCE_STATUS.SCHEDULED;
    await tx`
      INSERT INTO class_instance (id, class_id, teacher_email, date, start_time, duration_minutes, seats, status, recurrence_group_id, created_date)
      VALUES (${instanceId}, ${entry.id}, ${pick(users, index).email}, ${isoDate(offset)},
        ${pick(['10:00', '13:30', '18:00'], index)}, ${pick([60, 90, 120], index)}, ${pick([6, 8, 10], index)},
        ${status}, ${isRecurring ? recurrenceGroupId : null}, now())`;

    for (let booking = 0; booking < index % 4; booking++) {
      const [customerName, customerEmail] = pick(customers, index + booking);
      const canceled = booking === 2;
      const quantity = 1 + (booking % 2);
      const paymentId =
        entry.price > 0
          ? await insertPayment(tx, {
              type: PAYMENT_TYPE.CLASS_BOOKING,
              status: canceled ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PAID,
              customerName,
              customerEmail,
              bill: itemBill(entry.name, quantity, entry.price),
              issuedDaysAgo: 2,
            })
          : null;
      await tx`
        INSERT INTO class_booking (id, instance_id, customer_name, customer_email, customer_phone, status,
          booking_token, quantity, payment_id, created_date)
        VALUES (${randomUUID()}, ${instanceId}, ${customerName}, ${customerEmail}, '555-0100',
          ${canceled ? CLASS_BOOKING_STATUS.CANCELED : CLASS_BOOKING_STATUS.CONFIRMED}, ${randomUUID()},
          ${quantity}, ${paymentId}, now())`;
    }
  }
}

async function seedCarBay(tx: Transaction) {
  for (const booking of carBayBookings) {
    const [customerName, customerEmail] = pick(customers, booking.customer);
    const isMember = booking.customer % 2 === 0;
    const lineItem: BillingLineItem = {
      name: `Car Bay - ${CAR_BAY_TIER_NAMES[booking.tier]} (${isMember ? 'Member' : 'Non-member'})`,
      quantity: 1,
      unitAmount: booking.amountPaid,
    };
    const paymentId =
      booking.amountPaid > 0
        ? await insertPayment(tx, {
            type: PAYMENT_TYPE.CAR_BAY_BOOKING,
            status: PAYMENT_STATUS.PAID,
            customerName,
            customerEmail,
            bill: buildBill([lineItem]),
            issuedDaysAgo: 3,
          })
        : null;
    await tx`
      INSERT INTO car_bay_booking (id, tier, status, start_at, end_at, blocked_until, is_member,
        customer_name, customer_email, customer_phone, payment_id, created_by_email, booking_token, created_date)
      VALUES (${randomUUID()}, ${booking.tier}, ${booking.status}, ${booking.startAt.toISO()},
        ${booking.endAt.toISO()}, ${CAR_BAY_RULES.blockedUntil(booking.endAt).toISO()},
        ${isMember}, ${customerName}, ${customerEmail}, '555-0100',
        ${paymentId}, ${paymentId ? null : DEV_USER_EMAIL}, ${randomUUID()},
        ${daysAgo(3)})`;
  }

  for (const closure of carBayClosures) {
    await tx`
      INSERT INTO car_bay_closure (id, start_at, end_at, reason, created_by_email, created_date)
      VALUES (${randomUUID()}, ${closure.startAt.toISO()}, ${closure.endAt.toISO()}, ${closure.reason},
        ${DEV_USER_EMAIL}, ${daysAgo(1)})`;
  }
}

function printCustomerViews() {
  const views = [
    ['Print: just submitted, no price yet', `/print_request/status/${DEMO.SUBMITTED}`],
    ['Print: quote awaiting approval (member)', `/print_request/status/${DEMO.QUOTE}`],
    ['Print: printing, unpaid', `/print_request/status/${DEMO.UNPAID}`],
    ['Print: ready for pickup, unpaid (member)', `/print_request/status/${DEMO.READY_UNPAID}`],
    ['Print: paid', `/print_request/status/${DEMO.PAID}`],
    ['Print: billed to organization', `/print_request/status/${DEMO.ORGANIZATION}`],
    ['Print: old Square invoice', `/print_request/status/${DEMO.LEGACY_INVOICE}`],
    ['Print: canceled', `/print_request/status/${DEMO.CANCELED}`],
    ['Print: old quote email link', `/print_request/quote?id=${DEMO.QUOTE}`],
    ['Car bay overrun: unpaid', `/pay/${DEMO.OVERRUN_PAYMENT}`],
    ['Car bay overrun: paid', `/pay/${DEMO.OVERRUN_PAID}`],
    ['Organization balance: unpaid', `/pay/${DEMO.BALANCE}`],
    ['Car bay booking with overruns', `/car_bay/booking/${DEMO.CAR_BAY_TOKEN}`],
  ];
  console.log('Customer billing views:');
  for (const [label, path] of views) console.log(`  ${label}: ${FRONTEND_URL}${path}`);
}

async function seed() {
  await sql.begin(async (tx) => {
    await tx`
      TRUNCATE "user", print_request, print_request_file, print_request_comment,
        print_request_comment_file, payment, print_material, settings, billing_code,
        organization, organization_charge, inventory_item, purchase_list, member, waiver,
        member_subscription, day_pass, organization_member, visit, member_email,
        class_catalog, class_instance, class_booking, car_bay_booking, car_bay_overrun, car_bay_closure
      CASCADE`;

    await seedUsers(tx);
    await seedPrintMaterials(tx);
    await seedSettings(tx);
    await seedOrganizations(tx);
    await seedPrintRequests(tx);
    await seedCustomerViews(tx, organizations[0]);
    await seedInventory(tx);
    await seedMembers(tx);
    await seedClasses(tx);
    await seedCarBay(tx);
  });
}

try {
  await seed();
  console.log(`Seeded database. Dev login: ${DEV_USER_EMAIL}`);
  printCustomerViews();
} finally {
  await sql.end();
}
