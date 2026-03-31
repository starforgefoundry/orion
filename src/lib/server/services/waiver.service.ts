import type { SearchWaiversDto, SubmitWaiverDto } from '$lib/remotes/dtos/waiver.dto';
import { BaseService } from '$lib/server/services/base.service';

export class WaiverService extends BaseService {
  async submitWaiver(dto: SubmitWaiverDto) {
    const waiver = await this.waiverRepository.submit(dto, dto.signature);

    return {
      status: 'success',
      waiverId: waiver.id,
    };
  }

  async getWaivers(dto: SearchWaiversDto) {
    return await this.waiverRepository.getAll({
      query: dto.query ?? '',
      page: dto.page ?? 1,
      pageSize: dto.pageSize ?? 25,
    });
  }

  async getWaiverById(id: string) {
    return await this.waiverRepository.getById(id);
  }
}

export const waiverService = new WaiverService();
