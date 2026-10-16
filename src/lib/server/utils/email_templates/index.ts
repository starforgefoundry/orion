import CAR_BAY_BOOKING_TEMPLATE from './car_bay_booking.html?raw';
import CAR_BAY_REMINDER_TEMPLATE from './car_bay_reminder.html?raw';
import CLASS_BOOKING_TEMPLATE from './class_booking.html?raw';
import MEMBER_ONBOARDING_TEMPLATE from './member_onboarding.html?raw';
import PRINT_PICKUP_TEMPLATE from './print_pickup.html?raw';
import PRINT_QUOTE_TEMPLATE from './print_quote.html?raw';

export type Templates = {
  // print_request_submitted: { customerName: string; projectName: string };
  print_pickup: { projectName: string };
  print_quote: { projectName: string; quotePrice: string; quoteURL: string };
  class_booking: {
    customerName: string;
    className: string;
    classDate: string;
    classTime: string;
    classDuration: string;
    quantity: string;
    amountPaid: string;
    bookingUrl: string;
  };
  car_bay_booking: {
    customerName: string;
    tierName: string;
    bookingWhen: string;
    amountPaid: string;
    bookingUrl: string;
    refundCutoffHours: string;
    storageDays: string;
  };
  car_bay_reminder: {
    customerName: string;
    tierName: string;
    bookingWhen: string;
    bookingUrl: string;
  };
  member_onboarding: { memberName: string; introMessage: string; onboardingUrl: string };
};

export const templates: { [key in keyof Templates]: string } = {
  print_quote: PRINT_QUOTE_TEMPLATE,
  print_pickup: PRINT_PICKUP_TEMPLATE,
  class_booking: CLASS_BOOKING_TEMPLATE,
  car_bay_booking: CAR_BAY_BOOKING_TEMPLATE,
  car_bay_reminder: CAR_BAY_REMINDER_TEMPLATE,
  member_onboarding: MEMBER_ONBOARDING_TEMPLATE,
};
