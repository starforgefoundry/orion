export const EMAIL_TEMPLATE_GROUP = {
  PRINTING: 'printing',
  CLASSES: 'classes',
  CAR_BAY: 'car_bay',
  MEMBERS: 'members',
  PAYMENTS: 'payments',
} as const;
export type EmailTemplateGroup = (typeof EMAIL_TEMPLATE_GROUP)[keyof typeof EMAIL_TEMPLATE_GROUP];

/** `example` fills the variable in the settings preview. */
export type TemplateVariable = { description: string; example: string };

type EmailTemplateDefinition = {
  name: string;
  description: string;
  group: EmailTemplateGroup;
  variables: Record<string, TemplateVariable>;
};

const CUSTOMER_NAME: TemplateVariable = {
  description: 'Name the customer entered',
  example: 'Jane Doe',
};
const PRINT_PROJECT_NAME: TemplateVariable = {
  description: 'Project name from the print request',
  example: 'Robot Arm',
};
const PRINT_STATUS_URL: TemplateVariable = {
  description: 'Link to the print request status page',
  example: 'https://orion.starforgefoundry.com/print_request/status/example',
};
const DOLLARS_DUE: TemplateVariable = {
  description: 'Total due in dollars, without the $ sign',
  example: '12.50',
};
const DOLLARS_PAID: TemplateVariable = {
  description: 'Amount paid in dollars, without the $ sign',
  example: '45.00',
};
const PAYMENT_URL: TemplateVariable = {
  description: 'Link to the page where the customer pays',
  example: 'https://orion.starforgefoundry.com/pay/example',
};
const BOOKING_URL: TemplateVariable = {
  description: 'Link to view or cancel the booking',
  example: 'https://orion.starforgefoundry.com/booking/example',
};
const CAR_BAY_TIER: TemplateVariable = {
  description: 'Booking type (Quick Job, Hourly, Full Day)',
  example: 'Hourly',
};
const CAR_BAY_WHEN: TemplateVariable = {
  description: 'When the booking starts and ends',
  example: 'Saturday, March 7, 1:00 PM – 4:00 PM',
};

export const EMAIL_TEMPLATE_DEFINITIONS = {
  print_submitted: {
    name: 'Print Request Received',
    description: 'Sent when someone submits a print request.',
    group: EMAIL_TEMPLATE_GROUP.PRINTING,
    variables: {
      customerName: CUSTOMER_NAME,
      projectName: PRINT_PROJECT_NAME,
      statusURL: PRINT_STATUS_URL,
    },
  },
  print_quote: {
    name: 'Print Quote',
    description: 'Sent when a print is priced and the customer has to approve the quote.',
    group: EMAIL_TEMPLATE_GROUP.PRINTING,
    variables: {
      customerName: CUSTOMER_NAME,
      projectName: PRINT_PROJECT_NAME,
      quotePrice: { ...DOLLARS_DUE, description: 'Quoted total in dollars, without the $ sign' },
      quoteURL: {
        description: 'Link to the page where the customer approves and pays',
        example: PRINT_STATUS_URL.example,
      },
    },
  },
  print_payment: {
    name: 'Print Payment',
    description: 'Sent when a print is priced and payment is due.',
    group: EMAIL_TEMPLATE_GROUP.PRINTING,
    variables: {
      customerName: CUSTOMER_NAME,
      projectName: PRINT_PROJECT_NAME,
      total: DOLLARS_DUE,
      paymentURL: { ...PAYMENT_URL, example: PRINT_STATUS_URL.example },
    },
  },
  print_pickup: {
    name: 'Ready for Pickup',
    description: 'Sent when staff mark a print as ready for pickup.',
    group: EMAIL_TEMPLATE_GROUP.PRINTING,
    variables: {
      projectName: PRINT_PROJECT_NAME,
      paymentNote: {
        description: 'A sentence about payment: paid, due, or billed to an organization',
        example: 'Your print has been paid for.',
      },
      statusURL: PRINT_STATUS_URL,
    },
  },
  class_booking: {
    name: 'Class Booking Confirmation',
    description: 'Sent when someone books a class.',
    group: EMAIL_TEMPLATE_GROUP.CLASSES,
    variables: {
      customerName: CUSTOMER_NAME,
      className: { description: 'Name of the class', example: 'Intro to Welding' },
      classDate: { description: 'Date of the class', example: 'Monday, March 2, 2026' },
      classTime: { description: 'Start time of the class', example: '6:00 PM' },
      classDuration: { description: 'Length of the class in minutes', example: '90' },
      quantity: { description: 'Number of spots booked', example: '2' },
      amountPaid: DOLLARS_PAID,
      bookingUrl: BOOKING_URL,
    },
  },
  car_bay_booking: {
    name: 'Car Bay Booking Confirmation',
    description: 'Sent when someone books the car bay.',
    group: EMAIL_TEMPLATE_GROUP.CAR_BAY,
    variables: {
      customerName: CUSTOMER_NAME,
      tierName: CAR_BAY_TIER,
      bookingWhen: CAR_BAY_WHEN,
      amountPaid: DOLLARS_PAID,
      bookingUrl: BOOKING_URL,
      refundCutoffHours: {
        description: 'Hours before the start when a full refund is still allowed',
        example: '24',
      },
      storageDays: { description: 'Days a vehicle can stay on the property', example: '7' },
    },
  },
  car_bay_reminder: {
    name: 'Car Bay Reminder',
    description: 'Sent ahead of a car bay booking.',
    group: EMAIL_TEMPLATE_GROUP.CAR_BAY,
    variables: {
      customerName: CUSTOMER_NAME,
      tierName: CAR_BAY_TIER,
      bookingWhen: CAR_BAY_WHEN,
      bookingUrl: BOOKING_URL,
    },
  },
  member_onboarding: {
    name: 'Member Onboarding',
    description: 'Sent when a member needs to sign the waiver and set up their pass.',
    group: EMAIL_TEMPLATE_GROUP.MEMBERS,
    variables: {
      subject: {
        description: 'Suggested subject, which differs for new and existing members',
        example: 'Welcome to Starforge Foundry',
      },
      memberName: { description: 'Name of the member', example: 'Jane Doe' },
      introMessage: {
        description: 'Opening line, which depends on how the member joined',
        example: 'Thanks for becoming a member of Starforge Foundry!',
      },
      setupMessage: {
        description: 'Setup instructions, which differ for new and existing members',
        example: 'Before your first visit, finish setting up your access. It only takes a minute.',
      },
      onboardingUrl: {
        description: 'Link to sign the waiver and add the pass',
        example: 'https://orion.starforgefoundry.com/member/onboard/example',
      },
    },
  },
  payment_request: {
    name: 'Payment Request',
    description: 'Sent for organization balances and car bay overruns.',
    group: EMAIL_TEMPLATE_GROUP.PAYMENTS,
    variables: {
      subject: {
        description:
          'Suggested subject, which differs for organization balances and car bay overruns',
        example: 'Car Bay Overrun Payment',
      },
      customerName: { ...CUSTOMER_NAME, description: 'Name of the customer or organization' },
      description: {
        description: 'What the payment is for',
        example: 'car bay overrun on March 2',
      },
      total: DOLLARS_DUE,
      paymentUrl: PAYMENT_URL,
    },
  },
} as const satisfies Record<string, EmailTemplateDefinition>;

export type EmailTemplateKey = keyof typeof EMAIL_TEMPLATE_DEFINITIONS;

export type Templates = {
  [K in EmailTemplateKey]: Record<
    keyof (typeof EMAIL_TEMPLATE_DEFINITIONS)[K]['variables'],
    string
  >;
};

export const EMAIL_TEMPLATE_KEYS = Object.keys(EMAIL_TEMPLATE_DEFINITIONS) as EmailTemplateKey[];

const VARIABLE_PATTERN = /\{\{\s*([^}]*?)\s*\}\}/g;

export function variableToken(name: string) {
  return `{{${name}}}`;
}

export function renderTemplate(text: string, variables: Record<string, string>) {
  return text.replace(VARIABLE_PATTERN, (token, name: string) => variables[name] ?? token);
}

export function exampleVariables(key: EmailTemplateKey): Record<string, string> {
  const variables: Record<string, TemplateVariable> = EMAIL_TEMPLATE_DEFINITIONS[key].variables;
  return Object.fromEntries(
    Object.entries(variables).map(([name, variable]) => [name, variable.example]),
  );
}

export function unknownVariables(key: EmailTemplateKey, text: string) {
  const known = Object.keys(EMAIL_TEMPLATE_DEFINITIONS[key].variables);
  const used = [...text.matchAll(VARIABLE_PATTERN)].map(([, name]) => name);
  return [...new Set(used.filter((name) => !known.includes(name)))];
}
