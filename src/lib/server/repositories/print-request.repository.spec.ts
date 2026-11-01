import { describeWithDatabase, useTestDatabase } from '$test/db';
import { DateTime } from 'luxon';
import { beforeEach, expect, it } from 'vitest';
import { PrintRequestRepository } from './print-request.repository';

describeWithDatabase('PrintRequestRepository.search', () => {
  const database = useTestDatabase('print_request');
  let repository: PrintRequestRepository;
  let material: string;

  beforeEach(async () => {
    repository = new PrintRequestRepository(database.db);
    ({ id: material } = await database.insert.printMaterial());
  });

  async function addRequest(projectName: string, customerName: string, daysAgo: number) {
    return await database.insert.printRequest({
      material,
      projectName,
      customerName,
      email: `${customerName.toLowerCase()}@example.com`,
      submissionDate: DateTime.now().minus({ days: daysAgo }),
    });
  }

  it('matches the project, customer name or email without regard to case', async () => {
    const byProject = await addRequest('Robot Arm', 'Ada', 1);
    const byName = await addRequest('Bracket', 'Robin', 2);
    await addRequest('Vase', 'Grace', 3);

    const { data } = await repository.search({ query: 'rob' });

    expect(data.map(({ id }) => id)).toEqual([byProject.id, byName.id]);
  });

  it('lists everything newest first for an empty query', async () => {
    const older = await addRequest('Vase', 'Grace', 3);
    const newer = await addRequest('Robot Arm', 'Ada', 1);

    const { data } = await repository.search({ query: '  ' });

    expect(data.map(({ id }) => id)).toEqual([newer.id, older.id]);
  });

  it('pages the results and counts every match', async () => {
    await addRequest('One', 'Ada', 1);
    const second = await addRequest('Two', 'Ada', 2);
    await addRequest('Three', 'Ada', 3);

    const { data, pagination } = await repository.search({ query: '', page: 2, pageSize: 1 });

    expect(data.map(({ id }) => id)).toEqual([second.id]);
    expect(pagination).toEqual({ total: 3, page: 2, pageSize: 1, totalPages: 3 });
  });
});
