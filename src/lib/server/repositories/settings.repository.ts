import { settingsTable } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { eq } from 'drizzle-orm';

export type SettingsMap = {
  printRequest: {
    maxUploadMB: number;
    allowedFileTypes: string;
  };
  printRequestSquare: {
    locationId: string;
    memberPrintDiscountId: string;
    printRequestItemId: string;
    additionalBuildPlateModifierId: string;
  };
};

const defaults: SettingsMap = {
  printRequest: {
    maxUploadMB: 1000,
    allowedFileTypes: '.stl, .3mf, .obj',
  },
  printRequestSquare: {
    locationId: '',
    memberPrintDiscountId: '',
    printRequestItemId: '',
    additionalBuildPlateModifierId: '',
  },
};

export class SettingsRepository extends BaseRepository {
  async getSetting<K extends keyof SettingsMap>(key: K) {
    const setting = await this.db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, key as string))
      .execute();

    if (setting.length === 0) {
      return defaults[key];
    }

    return setting[0]?.value as SettingsMap[K];
  }

  async setSetting<K extends keyof SettingsMap>(
    key: K,
    value: SettingsMap[K],
  ): Promise<SettingsMap[K]> {
    const updated = await this.db
      .insert(settingsTable)
      .values({
        key: key as string,
        value: value,
      })
      .onConflictDoUpdate({
        target: settingsTable.key,
        set: {
          value: value,
        },
      })
      .returning()
      .execute();

    return updated[0]?.value as SettingsMap[K];
  }
}
