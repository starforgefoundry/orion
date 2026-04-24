import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { eq } from 'drizzle-orm';

export type SettingsMap = {
  printRequest: {
    isOpen: boolean;
    maxUploadMB: number;
    allowedFileTypes: string;
    discordWebhookUrl: string;
    bblAuthorizationToken: string;
    bblUserId: string;
  };
  printRequestSquare: {
    locationId: string;
    memberPrintDiscountId: string;
    printRequestItemId: string;
    additionalBuildPlateItemId: string;
  };
  classSettings: {
    discordWebhookUrl: string;
  };
};

const defaults: SettingsMap = {
  printRequest: {
    isOpen: true,
    maxUploadMB: 1000,
    allowedFileTypes: '.stl, .3mf, .step, .stp',
    discordWebhookUrl: '',
    bblAuthorizationToken: '',
    bblUserId: '',
  },
  printRequestSquare: {
    locationId: '',
    memberPrintDiscountId: '',
    printRequestItemId: '',
    additionalBuildPlateItemId: '',
  },
  classSettings: {
    discordWebhookUrl: '',
  },
};

export class SettingsRepository extends BaseRepository {
  async getSetting<K extends keyof SettingsMap>(key: K) {
    const setting = await this.db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, key as string))
      .get();

    return {
      ...defaults[key],
      ...(setting?.value as Partial<SettingsMap[K]>),
    };
  }

  async setSetting<K extends keyof SettingsMap>(
    key: K,
    value: SettingsMap[K],
  ): Promise<SettingsMap[K]> {
    const updated = await this.db
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
      .returning()
      .get();

    return updated.value as SettingsMap[K];
  }
}
