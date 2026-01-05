import type { Transport } from '@sveltejs/kit';
import { DateTime } from 'luxon';

export const transport: Transport = {
  DateTime: {
    encode: (value) => {
      return value instanceof DateTime && value.toObject();
    },
    decode: (value) => DateTime.fromObject(value),
  },
};
