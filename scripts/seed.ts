import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import postgres from 'postgres';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const LOCAL_HOSTS = ['localhost', '127.0.0.1', 'postgres'];
const databaseHost = new URL(process.env.DATABASE_URL).hostname;
if (!LOCAL_HOSTS.includes(databaseHost)) {
  throw new Error(`Refusing to seed non-local database host "${databaseHost}"`);
}

const DEV_USER_EMAIL = process.env.DEV_LOGIN_EMAIL || 'dev@starforgefoundry.com';
const STORAGE_DIR = resolve(process.env.STORAGE_DIR || 'storage');
const DAY_MS = 24 * 60 * 60 * 1000;

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });

function daysAgo(days: number) {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function isoDate(offsetDays: number) {
  return new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

function pick<T>(items: T[], index: number) {
  return items[index % items.length];
}

async function writeStorageFile(key: string, contents: string) {
  const path = resolve(STORAGE_DIR, key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
  return key;
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
  subscription?: { planName: string; status: string; canceled?: boolean; refunded?: boolean };
  organization?: number;
  /** Days ago each pass was used, null when unused. */
  dayPasses?: (number | null)[];
  visits?: number;
  visitBasis?: string;
};

const memberScenarios: MemberScenario[] = [
  {
    name: 'Jordan Smith',
    email: 'jordan.smith@example.com',
    waiver: true,
    subscription: { planName: 'Monthly Membership', status: 'active' },
    visits: 9,
    visitBasis: 'subscription',
  },
  {
    name: 'Taylor Nguyen',
    email: 'taylor.n@example.com',
    waiver: true,
    subscription: { planName: 'Monthly Membership', status: 'active', canceled: true },
    visits: 4,
    visitBasis: 'subscription',
  },
  {
    name: 'Morgan Patel',
    email: 'mpatel@example.com',
    waiver: true,
    subscription: { planName: 'Student Membership', status: 'active', refunded: true },
    visits: 3,
    visitBasis: 'subscription',
  },
  {
    name: 'Casey Johnson',
    email: 'casey.j@example.com',
    waiver: true,
    organization: 0,
    visits: 6,
    visitBasis: 'organization',
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
    visitBasis: 'day_pass',
  },
  {
    name: 'Quinn Martinez',
    email: 'quinn.m@example.com',
    waiver: true,
    dayPasses: [8],
    visits: 1,
    visitBasis: 'day_pass',
  },
  { name: 'Jamie Lee', email: 'jamie.lee@example.com', waiver: true },
  {
    name: 'Drew Kim',
    email: 'drew.kim@example.com',
    waiver: false,
    subscription: { planName: 'Monthly Membership', status: 'active' },
  },
  { name: 'Pat Morales', email: 'pat.morales@example.com', waiver: false, dayPasses: [null] },
  { name: 'Robin Park', email: 'robin.park@example.com', waiver: false, organization: 0 },
  {
    name: 'Sky Alvarez',
    email: 'sky.alvarez@example.com',
    waiver: true,
    subscription: { planName: 'Monthly Membership', status: 'paused' },
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

const STATUSES = ['in_queue', 'in_queue', 'printing', 'done', 'picked_up', 'canceled'] as const;
const PAYMENT_STATUSES = ['quote', 'pending', 'paid', 'canceled'] as const;

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

async function seed() {
  await sql.begin(async (tx) => {
    await tx`
      TRUNCATE "user", print_request, print_request_file, print_request_comment,
        print_request_comment_file, payment, print_material, settings, billing_code,
        organization, organization_charge, inventory_item, purchase_list, member, waiver,
        member_subscription, day_pass, organization_member, visit, member_email,
        class_catalog, class_instance, class_booking, car_bay_booking
      CASCADE`;

    for (const user of users) {
      await tx`INSERT INTO "user" (email, name, picture) VALUES (${user.email}, ${user.name}, '')`;
    }

    for (const m of materials) {
      await tx`
        INSERT INTO print_material (id, name, available, archived, tag_id, vendor, material_type, color_name, color_hex)
        VALUES (${m.id}, ${m.name}, ${m.available}, false, ${m.tagId}, 'Bambu Lab', ${m.type}, ${m.color}, ${m.hex})`;
    }
    await tx`
      INSERT INTO print_material (id, name, available, archived, vendor, material_type)
      VALUES (${randomUUID()}, 'Old Silk PLA - Gold', false, true, 'Generic', 'PLA')`;

    await tx`
      INSERT INTO settings (key, value) VALUES
        ('printRequest', ${tx.json({
          isOpen: true,
          announcement: 'Holiday hours: prints may take an extra 2–3 days.',
          announcementUntil: isoDate(30),
          maxUploadMB: 200,
          allowedFileTypes: '.stl, .3mf, .step, .stp',
          discordWebhookUrl: '',
        })})`;

    for (const org of organizations) {
      await tx`INSERT INTO organization (id, name, email) VALUES (${org.id}, ${org.name}, ${org.email})`;
    }
    await tx`INSERT INTO organization (id, name, email, archived) VALUES (${randomUUID()}, 'Old Makers Guild', 'guild@example.com', true)`;

    const billingCodes = [
      {
        code: 'ROBOTICS25',
        description: 'Robotics Club sponsored prints',
        org: organizations[0].id,
      },
      { code: 'ENGDEPT', description: 'Engineering coursework', org: organizations[1].id },
      { code: 'MEMBER10', description: 'Member discount', org: null },
    ];
    for (const code of billingCodes) {
      await tx`
        INSERT INTO billing_code (id, code, description, organization_id, discount_id)
        VALUES (${randomUUID()}, ${code.code}, ${code.description}, ${code.org}, ${code.org ? null : 'SQUARE_DISCOUNT_ID'})`;
    }

    for (const [index, project] of projects.entries()) {
      const [customerName, email] = pick(customers, index);
      const status = pick([...STATUSES], index);
      const id = randomUUID();
      const material = pick(
        materials.filter((m) => m.available),
        index,
      );
      const isQuote = index % 4 === 1;
      const billingCode = index % 5 === 2 ? billingCodes[index % billingCodes.length].code : null;

      let paymentId: string | null = null;
      if (status !== 'in_queue' || index % 3 === 0) {
        paymentId = randomUUID();
        const paymentStatus =
          status === 'picked_up'
            ? 'paid'
            : status === 'canceled'
              ? 'canceled'
              : pick([...PAYMENT_STATUSES], index);
        await tx`
          INSERT INTO payment (id, issued_date, payment_date, status, type, total, square_invoice_id)
          VALUES (${paymentId}, ${daysAgo(index)}, ${paymentStatus === 'paid' ? daysAgo(index - 1) : null},
            ${paymentStatus}, 'print_request', ${800 + index * 375}, ${`inv_${index}`})`;
      }

      await tx`
        INSERT INTO print_request (id, "submissionDate", "completionDate", email, customer_name, project_name, status,
          is_quote, material, special_requests, billing_code, payment_id, buildplate_count, material_cost)
        VALUES (${id}, ${daysAgo(index * 2 + 1)}, ${status === 'picked_up' ? daysAgo(index) : null}, ${email},
          ${customerName}, ${project}, ${status}, ${isQuote}, ${material.id}, ${pick(SPECIAL_REQUESTS, index)},
          ${billingCode}, ${paymentId}, ${1 + (index % 3)}, ${paymentId ? 500 + index * 120 : 0})`;

      const fileCount = 1 + (index % 4);
      for (let part = 0; part < fileCount; part++) {
        const fileName = `${project.split(' ')[0].toLowerCase()}_part${part + 1}.${part % 2 ? '3mf' : 'stl'}`;
        const key = await writeStorageFile(
          `print_requests/${id}/${randomUUID()}`,
          `solid ${fileName}\nendsolid\n`,
        );
        await tx`
          INSERT INTO print_request_file (id, print_request_id, file_name, file_url, quantity)
          VALUES (${randomUUID()}, ${id}, ${fileName}, ${key}, ${1 + ((index + part) % 3)})`;
      }

      const commentCount = index % 4;
      for (let position = 0; position < commentCount; position++) {
        const commentId = randomUUID();
        await tx`
          INSERT INTO print_request_comment (id, print_request_id, author_email, body, created_date)
          VALUES (${commentId}, ${id}, ${pick(users, index + position).email},
            ${pick(COMMENTS, index + position)}, ${daysAgo(index - position * 0.2)})`;

        if (position === 1) {
          const key = await writeStorageFile(
            `print_requests/${id}/comments/${randomUUID()}.3mf`,
            'placeholder slicer project',
          );
          await tx`
            INSERT INTO print_request_comment_file (id, comment_id, file_name, file_url)
            VALUES (${randomUUID()}, ${commentId}, 'profile_v2.3mf', ${key})`;
        }
      }
    }

    for (const [index, org] of organizations.entries()) {
      for (let charge = 0; charge < 2 + index; charge++) {
        const paymentId = randomUUID();
        await tx`
          INSERT INTO payment (id, issued_date, status, type, total, organization_id)
          VALUES (${paymentId}, ${daysAgo(charge * 7)}, ${charge === 0 ? 'paid' : 'pending'}, 'org_charge',
            ${2500 + charge * 1000}, ${org.id})`;
        await tx`
          INSERT INTO organization_charge (id, organization_id, creation_date, description, payment_id)
          VALUES (${randomUUID()}, ${org.id}, ${daysAgo(charge * 7)}, ${`Workshop materials #${charge + 1}`}, ${paymentId})`;
      }
    }

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

    await tx`UPDATE organization SET access_end_date = ${daysAgo(-60)} WHERE id = ${organizations[0].id}`;
    await tx`UPDATE organization SET access_end_date = ${daysAgo(5)} WHERE id = ${organizations[1].id}`;

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
            ${index % 3 === 0 ? 'kiosk' : 'web'})`;
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
          VALUES (${randomUUID()}, ${memberId}, 'onboarding', 'subscription', ${daysAgo(90)})`;
      }

      if (scenario.organization !== undefined) {
        await tx`
          INSERT INTO organization_member (id, organization_id, member_id, added_date)
          VALUES (${randomUUID()}, ${organizations[scenario.organization].id}, ${memberId}, ${daysAgo(40)})`;
        await tx`
          INSERT INTO member_email (id, member_id, type, trigger, sent_date)
          VALUES (${randomUUID()}, ${memberId}, 'onboarding', 'organization', ${daysAgo(40)})`;
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
            ${visit % 5 === 4 ? 'staff' : 'kiosk'}, ${scenario.visitBasis ?? 'none'},
            ${scenario.visitBasis ? 'admitted' : 'denied_no_access'})`;
      }
    }

    const catalog = [
      [
        'Intro to 3D Printing',
        'Learn slicing, printer setup and how to get a great first print.',
        4500,
      ],
      ['Laser Cutting Basics', 'Design and cut your first project on the laser cutter.', 5500],
      ['Soldering 101', 'Build a small kit while learning through-hole soldering.', 3500],
      ['CNC Router Safety', 'Required safety class before using the CNC router.', 0],
    ].map(([name, description, price]) => ({ id: randomUUID(), name, description, price }));

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
      await tx`
        INSERT INTO class_instance (id, class_id, teacher_email, date, start_time, duration_minutes, seats, status, recurrence_group_id, created_date)
        VALUES (${instanceId}, ${entry.id}, ${pick(users, index).email}, ${isoDate(offset)},
          ${pick(['10:00', '13:30', '18:00'], index)}, ${pick([60, 90, 120], index)}, ${pick([6, 8, 10], index)},
          ${index === 5 ? 'canceled' : 'scheduled'}, ${isRecurring ? recurrenceGroupId : null}, now())`;

      for (let booking = 0; booking < index % 4; booking++) {
        const [customerName, customerEmail] = pick(customers, index + booking);
        await tx`
          INSERT INTO class_booking (id, instance_id, customer_name, customer_email, customer_phone, status,
            booking_token, quantity, amount_paid, created_date)
          VALUES (${randomUUID()}, ${instanceId}, ${customerName}, ${customerEmail}, '555-0100',
            ${booking === 2 ? 'canceled' : 'confirmed'}, ${randomUUID()}, ${1 + (booking % 2)},
            ${Number(entry.price) * (1 + (booking % 2))}, now())`;
      }
    }
  });
}

try {
  await seed();
  console.log(`Seeded database. Dev login: ${DEV_USER_EMAIL}`);
} finally {
  await sql.end();
}
