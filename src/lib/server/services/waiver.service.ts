import type { SearchWaiversDto, SubmitWaiverDto } from '$lib/remotes/dtos/waiver.dto';
import { BaseService } from '$lib/server/services/base.service';

export class WaiverService extends BaseService {
  async submitWaiver(dto: SubmitWaiverDto) {
    const signatureDataUrl = dto.signature;
    const base64Data = signatureDataUrl.split(',')[1];
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const signatureFile = new File([bytes], 'signature.jpg', { type: 'image/jpeg' });

    const waiver = await this.waiverRepository.submit(dto, signatureFile);

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
