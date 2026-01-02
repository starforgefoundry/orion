import { page } from '$app/state';

export const currentUser = () => page.data.user;
