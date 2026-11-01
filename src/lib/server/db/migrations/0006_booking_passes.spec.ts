import {
  describeWithDatabase,
  runMigrationFile,
  runMigrationFiles,
  useEmptyDatabase,
} from '$test/db';
import { beforeAll, expect, it } from 'vitest';

describeWithDatabase('booking passes migration', () => {
  const database = useEmptyDatabase('booking_passes_migration');
  const EDITED_BODY = '<p>Our own car bay confirmation</p>';

  async function templateBody(key: string) {
    const [row] = await database.sql<
      { body: string }[]
    >`SELECT body FROM email_template WHERE key = ${key}`;
    return row.body;
  }

  beforeAll(async () => {
    await runMigrationFiles(database.sql, [
      '0000_baseline',
      '0001_car_bay_booking',
      '0002_member_management',
      '0003_car_bay_closure',
      '0004_unified_payments',
      '0005_email_templates',
    ]);
    await database.sql`UPDATE email_template SET body = ${EDITED_BODY} WHERE key = 'car_bay_booking'`;

    await runMigrationFile(database.sql, '0006_booking_passes');
  });

  it('adds the pass to templates staff have not edited', async () => {
    expect(await templateBody('class_booking')).toContain('{{passQrImageUrl}}');
    expect(await templateBody('car_bay_reminder')).toContain('{{passQrImageUrl}}');
  });

  it('keeps templates staff have edited', async () => {
    expect(await templateBody('car_bay_booking')).toBe(EDITED_BODY);
  });
});
