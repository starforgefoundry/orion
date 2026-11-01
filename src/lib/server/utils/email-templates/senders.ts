import { env as publicEnv } from '$env/dynamic/public';
import { SPACE_EMAIL, SPACE_NAME } from '$lib/utils/space';

export type EmailSender = { from: string; replyTo: string };

function sender(name: string, address: string): EmailSender {
  return { from: `${name} <${address}>`, replyTo: address };
}

/** The print address comes from the environment, so those senders are built when read. */
export const SENDERS = {
  carBay: sender('Starforge Car Bay', SPACE_EMAIL.CAR_BAY),
  classes: sender('Starforge Classes', SPACE_EMAIL.CLASSES),
  members: sender(SPACE_NAME, SPACE_EMAIL.CONTACT),
  get print() {
    return sender('Starforge 3D Prints', publicEnv.PUBLIC_PRINT_REQUEST_EMAIL);
  },
  get foundry() {
    return sender(SPACE_NAME, publicEnv.PUBLIC_PRINT_REQUEST_EMAIL);
  },
} satisfies Record<string, EmailSender>;
