import { KIOSK_PAIR_PATH } from '$lib/remotes/dtos/kiosk.dto';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// The kiosk iPad app (../kiosk-app). Lets a pairing QR scanned with the iPad camera open in the app, which keeps its own cookies.
const KIOSK_APP_ID = '65AMD2STXG.com.starforgefoundry.kiosk';

export const GET: RequestHandler = () =>
  json({
    applinks: {
      details: [{ appIDs: [KIOSK_APP_ID], components: [{ '/': KIOSK_PAIR_PATH }] }],
    },
  });
