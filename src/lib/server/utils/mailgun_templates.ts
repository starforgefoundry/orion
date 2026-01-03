export type MailgunTemplates = 'print_quote';
export type TemplateVariables = {
  // print_request_submitted: { customerName: string; projectName: string };
  // print_request_completed: { customerName: string; projectName: string; downloadLink: string };
  print_quote: { projectName: string; quotePrice: string; quoteURL: string };
};

const PRINT_QUOTE_TEMPLATE = `
Howdy!

Your recently submitted a 3D Print Request titled "{{projectName}}" to Starforge. Your quote is ready for your review. The total quote price is {{quotePrice}}.

To review the details and approve or decline the request, please follow this link:
{{quoteURL}}

If you have any questions or need further assistance, feel free to reply to this email.

Thanks!

The Starforge Foundry Team
`;

export const templates: { [key in MailgunTemplates]: string } = {
  print_quote: PRINT_QUOTE_TEMPLATE,
};
