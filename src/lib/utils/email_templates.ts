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
const ONBOARDING_VARIABLES = {
  memberName: { description: 'Name of the member', example: 'Jane Doe' },
  introMessage: {
    description: 'Opening line, which depends on how the member joined',
    example: 'Thanks for becoming a member of Starforge Foundry!',
  },
  onboardingUrl: {
    description: 'Link to sign the waiver and add the pass',
    example: 'https://orion.starforgefoundry.com/member/onboard/example',
  },
} as const satisfies Record<string, TemplateVariable>;
const PASS_URL: TemplateVariable = {
  description: 'Link to the pass page, where it can be added to Apple or Google Wallet',
  example: 'https://orion.starforgefoundry.com/pass/example',
};
const PASS_QR_IMAGE_URL: TemplateVariable = {
  description: 'Image link for the pass QR code, for use in an <img> tag',
  example: 'https://orion.starforgefoundry.com/api/pass/example/qr',
};
const PASS_LINKS = { passUrl: PASS_URL, passQrImageUrl: PASS_QR_IMAGE_URL };
const CLASS_NAME: TemplateVariable = {
  description: 'Name of the class',
  example: 'Intro to Welding',
};
const CLASS_DATE: TemplateVariable = {
  description: 'Date of the class',
  example: 'Monday, March 2, 2026',
};
const CLASS_TIME: TemplateVariable = { description: 'Start time of the class', example: '6:00 PM' };
const CLASS_QUANTITY: TemplateVariable = { description: 'Number of spots booked', example: '2' };

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
      className: CLASS_NAME,
      classDate: CLASS_DATE,
      classTime: CLASS_TIME,
      classDuration: { description: 'Length of the class in minutes', example: '90' },
      quantity: CLASS_QUANTITY,
      amountPaid: DOLLARS_PAID,
      bookingUrl: BOOKING_URL,
      ...PASS_LINKS,
    },
  },
  class_reminder: {
    name: 'Class Reminder',
    description: 'Sent the day before a booked class.',
    group: EMAIL_TEMPLATE_GROUP.CLASSES,
    variables: {
      customerName: CUSTOMER_NAME,
      className: CLASS_NAME,
      classDate: CLASS_DATE,
      classTime: CLASS_TIME,
      quantity: CLASS_QUANTITY,
      bookingUrl: BOOKING_URL,
      ...PASS_LINKS,
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
      ...PASS_LINKS,
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
      ...PASS_LINKS,
    },
  },
  member_welcome: {
    name: 'New Member Welcome',
    description: 'Sent to new members to sign the waiver and set up their pass.',
    group: EMAIL_TEMPLATE_GROUP.MEMBERS,
    variables: ONBOARDING_VARIABLES,
  },
  member_pass_setup: {
    name: 'Member Pass Setup',
    description: 'Sent to existing members when staff or the member request the pass link.',
    group: EMAIL_TEMPLATE_GROUP.MEMBERS,
    variables: ONBOARDING_VARIABLES,
  },
  day_pass: {
    name: 'Day Pass',
    description: 'Sent when someone buys a day pass.',
    group: EMAIL_TEMPLATE_GROUP.MEMBERS,
    variables: {
      memberName: { description: 'Name of the member', example: 'Jane Doe' },
      ...PASS_LINKS,
    },
  },
  organization_balance: {
    name: 'Organization Balance Due',
    description: "Sent when staff request payment for an organization's outstanding balance.",
    group: EMAIL_TEMPLATE_GROUP.PAYMENTS,
    variables: {
      organizationName: { description: 'Name of the organization', example: 'Acme Robotics' },
      total: DOLLARS_DUE,
      paymentUrl: PAYMENT_URL,
    },
  },
  car_bay_overrun: {
    name: 'Car Bay Overrun Payment',
    description: 'Sent when staff bill a car bay booking for staying past its end time.',
    group: EMAIL_TEMPLATE_GROUP.PAYMENTS,
    variables: {
      customerName: CUSTOMER_NAME,
      bookingEndDate: { description: 'Day the booking was due to end', example: 'March 2' },
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

export type TemplateContent = { subject: string; body: string };

const VARIABLE_PATTERN = /\{\{\s*([^}]*?)\s*\}\}/g;

export function variableToken(name: string) {
  return `{{${name}}}`;
}

export function renderTemplate(text: string, variables: Record<string, string>) {
  return text.replace(VARIABLE_PATTERN, (token, name: string) => variables[name] ?? token);
}

export function templateVariables(key: EmailTemplateKey) {
  const variables: Record<string, TemplateVariable> = EMAIL_TEMPLATE_DEFINITIONS[key].variables;
  return Object.entries(variables).map(([name, variable]) => ({
    ...variable,
    name,
    token: variableToken(name),
  }));
}

export function unknownVariables(key: EmailTemplateKey, content: TemplateContent) {
  const known = Object.keys(EMAIL_TEMPLATE_DEFINITIONS[key].variables);
  const used = [content.subject, content.body].flatMap((text) =>
    [...text.matchAll(VARIABLE_PATTERN)].map(([, name]) => name),
  );
  return [...new Set(used.filter((name) => !known.includes(name)))];
}
