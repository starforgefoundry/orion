import { query } from '$app/server';
import { HTTP_NOT_FOUND } from '$lib/remotes/utils';
import { passService } from '$lib/server/services/pass.service';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';

const PASS_NOT_FOUND = 'This link is invalid or has expired';

export const getPass = query(v.string(), async (token) => {
  const pass = await passService.getPass(token);
  if (!pass) error(HTTP_NOT_FOUND, PASS_NOT_FOUND);
  return pass;
});
