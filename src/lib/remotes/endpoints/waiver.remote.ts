import { form, query } from '$app/server';
import { HTTP_STATUS } from '$lib/http';
import { searchWaiversDto, submitWaiverDto } from '$lib/remotes/dtos/waiver.dto';
import { exposeUserErrors, verifyAuth } from '$lib/remotes/utils';
import { waiverService } from '$lib/server/services/waiver.service';
import { redirect } from '@sveltejs/kit';
import * as v from 'valibot';

export const submitWaiverForm = form(
  submitWaiverDto,
  exposeUserErrors(async (dto) => {
    await waiverService.submitWaiver(dto);
    redirect(HTTP_STATUS.SEE_OTHER, '/waiver/success');
  }),
);

export const searchWaivers = query(
  searchWaiversDto,
  exposeUserErrors(async (dto) => {
    verifyAuth();
    return await waiverService.getWaivers(dto);
  }),
);

export const getWaiverById = query(
  v.string(),
  exposeUserErrors(async (id: string) => {
    verifyAuth();
    return await waiverService.getWaiverById(id);
  }),
);
