import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import {
  DEFAULT_CAR_BAY_POLICY,
  DEFAULT_CAR_BAY_RATES,
  type CarBayPolicy,
  type CarBayRates,
} from '$lib/utils/car_bay';
import { DEFAULT_PRINT_PRICING, type PrintPricing } from '$lib/utils/print_pricing';
import { eq } from 'drizzle-orm';

export type SettingsMap = {
  printRequest: {
    isOpen: boolean;
    announcement: string;
    announcementUntil: string;
    maxUploadMB: number;
    allowedFileTypes: string;
    discordWebhookUrl: string;
  };
  printRequestSquare: {
    locationId: string;
  };
  printPricing: PrintPricing;
  classSettings: {
    discordWebhookUrl: string;
  };
  bambuddy: {
    serverUrl: string;
    apiKey: string;
  };
  carBayRates: CarBayRates;
  carBayPolicy: CarBayPolicy;
  memberSquare: {
    dayPassItemVariationIds: string[];
  };
  kiosk: {
    deviceToken: string;
  };
};

const defaults: SettingsMap = {
  printRequest: {
    isOpen: true,
    announcement: '',
    announcementUntil: '',
    maxUploadMB: 1000,
    allowedFileTypes: '.stl, .3mf, .step, .stp',
    discordWebhookUrl: '',
  },
  printRequestSquare: {
    locationId: '',
  },
  printPricing: DEFAULT_PRINT_PRICING,
  classSettings: {
    discordWebhookUrl: '',
  },
  bambuddy: {
    serverUrl: '',
    apiKey: '',
  },
  carBayRates: DEFAULT_CAR_BAY_RATES,
  carBayPolicy: DEFAULT_CAR_BAY_POLICY,
  memberSquare: {
    dayPassItemVariationIds: [],
  },
  kiosk: {
    deviceToken: '',
  },
};

export class SettingsRepository extends BaseRepository {
  async getSetting<K extends keyof SettingsMap>(key: K) {
    const [setting] = await this.db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, key as string));

    return {
      ...defaults[key],
      ...(setting?.value as Partial<SettingsMap[K]>),
    };
  }

  async setSetting<K extends keyof SettingsMap>(
    key: K,
    value: SettingsMap[K],
  ): Promise<SettingsMap[K]> {
    const [updated] = await this.db
      .insert(schema.settings)
      .values({
        key: key as string,
        value: value,
      })
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: {
          value: value,
        },
      })
      .returning();

    return updated.value as SettingsMap[K];
  }
}
