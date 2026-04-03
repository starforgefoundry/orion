import CLASS_BOOKING_TEMPLATE from './class_booking.html?raw';
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
};

export const templates: { [key in keyof Templates]: string } = {
  print_quote: PRINT_QUOTE_TEMPLATE,
  print_pickup: PRINT_PICKUP_TEMPLATE,
  class_booking: CLASS_BOOKING_TEMPLATE,
};
