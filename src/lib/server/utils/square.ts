export type SquareWebhook<T> = {
  merchant_id: string;
  location_id: string;
  type: string;
  event_id: string;
  created_at: string;
  data: {
    type: string;
    id: string;
    object: T;
  };
};

export function stringifySquareObject(obj: any): string {
  return JSON.stringify(obj, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
}
