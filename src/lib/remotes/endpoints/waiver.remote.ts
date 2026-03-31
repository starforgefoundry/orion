import { command, form, query } from '$app/server';
import { searchWaiversDto, submitWaiverDto } from '$lib/remotes/dtos/waiver.dto';
import { verifyAuth } from '$lib/remotes/utils';
import { waiverService } from '$lib/server/services/waiver.service';
import * as v from 'valibot';

export const submitWaiverForm = form(submitWaiverDto, async (dto) => {
  await waiverService.submitWaiver(dto);
});

export const searchWaivers = query(searchWaiversDto, async (dto) => {
  verifyAuth();
  return await waiverService.getWaivers(dto);
});

export const getWaiverById = query(v.string(), async (id: string) => {
  verifyAuth();
  return await waiverService.getWaiverById(id);
});
