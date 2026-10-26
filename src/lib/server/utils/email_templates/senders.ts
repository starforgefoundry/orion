import { env as publicEnv } from '$env/dynamic/public';

export function printSender() {
  return `Starforge 3D Prints <${publicEnv.PUBLIC_PRINT_REQUEST_EMAIL}>`;
}

export function foundrySender() {
  return `Starforge Foundry <${publicEnv.PUBLIC_PRINT_REQUEST_EMAIL}>`;
}
