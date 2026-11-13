import { goto } from '$app/navigation';
import { modalManager } from '$lib/frontend/modal-manager.svelte';
import RequestDetailModal from './RequestDetailModal.svelte';

/** Opens a request's detail and records it in the URL so a reload reopens it. */
export function openRequest(requestId: string, focusQuote = false) {
  goto(`?id=${requestId}`, { replaceState: true, noScroll: true, keepFocus: true });
  modalManager.show(RequestDetailModal, { requestId, focusQuote });
}
