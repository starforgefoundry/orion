import { env } from '$env/dynamic/private';
import type { PrintMaterial } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';

type Device = {
  name: string;
  dev_id: string;
};

type BBCChangeFilamentRequest = {
  user_id: string;
  auth_token: string;
  printer_id: string;
  filaments: any[];
};

export class BambulabRepository extends BaseRepository {
  async _makeRequest(authToken: string, endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`https://api.bambulab.com/${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`BBL API error: ${response.status} ${response.statusText} - ${errorText}`);
      throw new Error(`BBL API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async getPrinters(authToken: string) {
    const printers: { devices: Device[] } = (await this._makeRequest(
      authToken,
      'v1/iot-service/api/user/bind',
    )) as any;

    return printers.devices;
  }

  async updateAMS(
    printerDeviceId: string,
    filamentTags: PrintMaterial[],
    credentials: { userId: string; authKey: string },
  ) {
    if (!env.BAMBU_CONNECT_AUTH_KEY) {
      throw new Error('BAMBU_CONNECT_AUTH_KEY not set in environment variables');
    }

    const request: BBCChangeFilamentRequest = {
      user_id: credentials.userId,
      auth_token: credentials.authKey,
      printer_id: printerDeviceId,
      filaments: filamentTags.map((tag) => JSON.parse(tag.bblTagData ?? '{}')),
    };

    const rq = await fetch('https://bambu-connect.starforgefoundry.com/change_filament', {
      headers: {
        Authorization: `Bearer ${env.BAMBU_CONNECT_AUTH_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      method: 'POST',
    });
  }
}
