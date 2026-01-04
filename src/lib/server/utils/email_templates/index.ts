import PRINT_QUOTE_TEMPLATE from './print_quote.html?raw';

export type MailgunTemplates = 'print_quote';
export type TemplateVariables = {
  // print_request_submitted: { customerName: string; projectName: string };
  // print_request_completed: { customerName: string; projectName: string; downloadLink: string };
  print_quote: { projectName: string; quotePrice: string; quoteURL: string };
};

export const templates: { [key in MailgunTemplates]: string } = {
  print_quote: PRINT_QUOTE_TEMPLATE,
};
