import { query } from '$app/server';
import { HTTP_NOT_FOUND, INVALID_LINK_MESSAGE } from '$lib/remotes/utils';
import { passService } from '$lib/server/services/pass.service';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';

export const getPass = query(v.string(), async (token) => {
  const pass = await passService.getPass(token);
  if (!pass) error(HTTP_NOT_FOUND, INVALID_LINK_MESSAGE);
  return pass;
});
