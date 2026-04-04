import { env } from '$env/dynamic/private';
import { schema, type PrintMaterial } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';

type Device = {
  name: string;
  dev_id: string;
};

type BBCChangeFilamentRequestCloud = {
  user_id: string;
  auth_token: string;
  printer_id: string;
  filaments: any[];
};

type BBCChangeFilamentRequestLocal = {
  printer_ip: string;
  access_code: string;
  printer_serial: string;
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

  async getCloudPrinters(authToken: string): Promise<CloudPrinter[]> {
    const printers: { devices: Device[] } = (await this._makeRequest(
      authToken,
      'v1/iot-service/api/user/bind',
    )) as any;

    return printers.devices.map((device) => ({
      ...device,
      type: 'cloud',
    }));
  }

  async getLocalPrinters(): Promise<LocalPrinter[]> {
    const printers = await this.db.select().from(schema.localBambuConnectPrinter).execute();
    return printers.map((printer) => ({
      name: printer.name,
      type: 'local',
      local_ip: printer.localIp,
      serial: printer.serial,
      access_code: printer.accessCode,
    }));
  }

  async updateAMSCloud(
    printer: CloudPrinter,
    filamentTags: PrintMaterial[],
    credentials: { userId: string; authKey: string },
  ) {
    if (!env.BAMBU_CONNECT_AUTH_KEY) {
      throw new Error('BAMBU_CONNECT_AUTH_KEY not set in environment variables');
    }

    const request: BBCChangeFilamentRequestCloud = {
      user_id: credentials.userId,
      auth_token: credentials.authKey,
      printer_id: printer.dev_id,
      filaments: filamentTags.map((tag) => JSON.parse(tag.bblTagData ?? '{}')),
    };

    await fetch('https://bambu-connect.starforgefoundry.com/change_filament_cloud', {
      headers: {
        Authorization: `Bearer ${env.BAMBU_CONNECT_AUTH_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      method: 'POST',
    });
  }
  async updateAMSLocal(printer: LocalPrinter, filamentTags: PrintMaterial[]) {
    if (!env.BAMBU_CONNECT_AUTH_KEY) {
      throw new Error('BAMBU_CONNECT_AUTH_KEY not set in environment variables');
    }

    const request: BBCChangeFilamentRequestLocal = {
      printer_ip: printer.local_ip,
      printer_serial: printer.serial,
      access_code: printer.access_code,
      filaments: filamentTags.map((tag) => JSON.parse(tag.bblTagData ?? '{}')),
    };

    await fetch('https://bambu-connect.starforgefoundry.com/change_filament_local', {
      headers: {
        Authorization: `Bearer ${env.BAMBU_CONNECT_AUTH_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      method: 'POST',
    });
  }
}
