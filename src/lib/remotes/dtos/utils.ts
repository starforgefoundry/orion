import { DateTime } from 'luxon';
import { custom } from 'valibot';

export const luxonDatetime = custom<DateTime>((input) =>
  input instanceof DateTime ? input.isValid : false,
);
