import {
  describeWithDatabase,
  runMigrationFile,
  runMigrationFiles,
  useEmptyDatabase,
} from '$test/db';
import { beforeAll, expect, it } from 'vitest';

describeWithDatabase('member management migration', () => {
  const database = useEmptyDatabase('member_management_migration');

  beforeAll(async () => {
    await runMigrationFiles(database.sql, ['0000_baseline', '0001_car_bay_booking']);
    await database.sql`
      INSERT INTO waiver (id, name, email, signature_url, signed_date) VALUES
        ('w1', 'Old Name', 'Sam@Example.com ', 'waivers/w1', '2025-01-01T00:00:00Z'),
        ('w2', 'New Name', 'sam@example.com', 'waivers/w2', '2026-01-01T00:00:00Z'),
        ('w3', 'Alex', 'alex@example.com', 'waivers/w3', '2025-06-01T00:00:00Z')
    `;
    await runMigrationFile(database.sql, '0002_member_management');
  });

  it('creates one member per waiver email using the latest name', async () => {
    const members = await database.sql<{ email: string; name: string }[]>`
      SELECT email, name FROM member ORDER BY email
    `;

    expect(members).toEqual([
      { email: 'alex@example.com', name: 'Alex' },
      { email: 'sam@example.com', name: 'New Name' },
    ]);
  });

  it('links every waiver to its member', async () => {
    const rows = await database.sql<{ id: string; email: string }[]>`
      SELECT waiver.id, member.email FROM waiver JOIN member ON member.id = waiver.member_id
      ORDER BY waiver.id
    `;

    expect(rows).toEqual([
      { id: 'w1', email: 'sam@example.com' },
      { id: 'w2', email: 'sam@example.com' },
      { id: 'w3', email: 'alex@example.com' },
    ]);
  });
});
