import { BaseRepository } from '$lib/server/repositories/base.repository';

export type BambuddyConfig = {
  serverUrl: string;
  apiKey: string;
};

export type BambuddyUser = {
  username: string;
  email: string | null;
};

export type BambuddyPrinter = {
  id: number;
  name: string;
  model: string;
  is_active: boolean;
};

export type BambuddyAmsSlot = {
  amsId: number;
  trayId: number;
};

export type BambuddySlotFilament = {
  tray_info_idx: string;
  tray_type: string;
  tray_sub_brands: string;
  tray_color: string;
  nozzle_temp_min: number;
  nozzle_temp_max: number;
};

type PrinterStatus = {
  ams: { id: number; tray: { id: number }[] }[] | null;
};

async function readErrorMessage(response: Response, fallback: string) {
  const body = await response.text();

  try {
    const parsed = JSON.parse(body);
    return parsed.detail ?? parsed.message ?? fallback;
  } catch {
    return body.slice(0, 200) || fallback;
  }
}

export class BambuddyRepository extends BaseRepository {
  async getCurrentUser(config: BambuddyConfig): Promise<BambuddyUser> {
    return (await this._request(config, 'api/v1/auth/me')) as BambuddyUser;
  }

  async listPrinters(config: BambuddyConfig): Promise<BambuddyPrinter[]> {
    return (await this._request(config, 'api/v1/printers/')) as BambuddyPrinter[];
  }

  async listAmsSlots(config: BambuddyConfig, printerId: number): Promise<BambuddyAmsSlot[]> {
    const status = (await this._request(
      config,
      `api/v1/printers/${printerId}/status`,
    )) as PrinterStatus;

    return (status.ams ?? [])
      .toSorted((a, b) => a.id - b.id)
      .flatMap((ams) =>
        ams.tray
          .toSorted((a, b) => a.id - b.id)
          .map((tray) => ({ amsId: ams.id, trayId: tray.id })),
      );
  }

  async configureAmsSlot(
    config: BambuddyConfig,
    printerId: number,
    slot: BambuddyAmsSlot,
    filament: BambuddySlotFilament,
  ) {
    const query = new URLSearchParams({
      tray_info_idx: filament.tray_info_idx,
      tray_type: filament.tray_type,
      tray_sub_brands: filament.tray_sub_brands,
      tray_color: filament.tray_color,
      nozzle_temp_min: String(filament.nozzle_temp_min),
      nozzle_temp_max: String(filament.nozzle_temp_max),
    });

    await this._request(
      config,
      `api/v1/printers/${printerId}/slots/${slot.amsId}/${slot.trayId}/configure?${query}`,
      { method: 'POST' },
    );
  }

  async _request(config: BambuddyConfig, endpoint: string, options: RequestInit = {}) {
    if (!config.serverUrl || !config.apiKey) {
      throw new Error('Bambuddy server URL and API key are not configured');
    }

    const response = await fetch(`${config.serverUrl.replace(/\/+$/, '')}/${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, `Bambuddy request failed: ${endpoint}`));
    }

    return await response.json();
  }
}
