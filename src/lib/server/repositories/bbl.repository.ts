import type { PrintMaterial } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { BambuMQTT } from '$lib/server/utils/bbl_mqtt';

type Device = {
  name: string;
  dev_id: string;
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
    const bblClient = new BambuMQTT(credentials.userId, credentials.authKey, printerDeviceId);
    try {
      await bblClient.connect();

      let i = 0;
      for (const tag of filamentTags) {
        const parsedTagData = JSON.parse(tag.bblTagData as string);

        const commandPayload = {
          print: {
            command: 'ams_filament_setting',
            ams_id: 0,
            tray_id: i++,
            ...parsedTagData,
          },
        };

        const completer = bblClient.waitForMessage(
          `device/${printerDeviceId}/report`,
          (message: any) => {
            return message.print && message.print.command === 'ams_filament_setting';
          },
          10000,
        );

        bblClient.command(commandPayload);
        await completer;

        // wait 1 second between commands to avoid overwhelming the printer
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('Error updating AMS settings via BBL MQTT:', error);
      throw new Error('Failed to update AMS settings on printer');
    } finally {
      bblClient.disconnect();
    }
  }
}
