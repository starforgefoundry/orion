import { env as publicEnv } from '$env/dynamic/public';
import { CAR_BAY_EMAIL } from '$lib/utils/car_bay';

export type EmailSender = { from: string; replyTo: string };

const CLASS_EMAIL = 'classes@starforgefoundry.com';
const CONTACT_EMAIL = 'contact@starforgefoundry.com';

function sender(name: string, address: string): EmailSender {
  return { from: `${name} <${address}>`, replyTo: address };
}

/** The print address comes from the environment, so those senders are built when read. */
export const SENDERS = {
  carBay: sender('Starforge Car Bay', CAR_BAY_EMAIL),
  classes: sender('Starforge Classes', CLASS_EMAIL),
  members: sender('Starforge Foundry', CONTACT_EMAIL),
  get print() {
    return sender('Starforge 3D Prints', publicEnv.PUBLIC_PRINT_REQUEST_EMAIL);
  },
  get foundry() {
    return sender('Starforge Foundry', publicEnv.PUBLIC_PRINT_REQUEST_EMAIL);
  },
} satisfies Record<string, EmailSender>;
