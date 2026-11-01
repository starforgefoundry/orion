import { WAIVER_SOURCE } from '$lib/member_enums';
import { factory } from '$test/factory';
import { newTestService, type ServiceMocks } from '$test/utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { WaiverService } from './waiver.service';

const SIGNATURE = new File(['sig'], 'signature.png');
const EMPTY_PAGE = { data: [], pagination: { total: 0, page: 1, pageSize: 10, totalPages: 0 } };

describe(WaiverService.name, () => {
  let sut: WaiverService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(WaiverService));
  });

  describe('submitWaiver', () => {
    const dto = {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      signature: SIGNATURE,
      isAdult: true,
    };

    it('files the waiver under the member with that email', async () => {
      const member = factory.member({ name: dto.name, email: dto.email });
      const waiver = factory.waiver({ memberId: member.id });
      mocks.memberRepository.upsertByEmail.mockResolvedValue(member);
      mocks.waiverRepository.submit.mockResolvedValue(waiver);

      expect(await sut.submitWaiver(dto)).toEqual({ waiverId: waiver.id });
      expect(mocks.memberRepository.upsertByEmail).toHaveBeenCalledWith(dto.name, dto.email);
      expect(mocks.waiverRepository.submit).toHaveBeenCalledWith(dto, member.id, WAIVER_SOURCE.WEB);
    });
  });

  describe('getWaivers', () => {
    beforeEach(() => {
      mocks.waiverRepository.getAll.mockResolvedValue(EMPTY_PAGE);
    });

    it('searches with the requested page', async () => {
      await sut.getWaivers({ query: 'ada', page: 2, pageSize: 10 });

      expect(mocks.waiverRepository.getAll).toHaveBeenCalledWith({
        query: 'ada',
        page: 2,
        pageSize: 10,
      });
    });

    it('lists every waiver from the first page when no search is given', async () => {
      await sut.getWaivers({});

      expect(mocks.waiverRepository.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ query: '', page: 1 }),
      );
    });
  });
});
