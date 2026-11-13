import { submitWithToast } from '$lib/frontend/form-submit';
import { modalManager } from '$lib/frontend/modal-manager.svelte';
import {
  getServiceRequests,
  updateServiceRequestStatus,
} from '$lib/remotes/endpoints/service.remote';
import type { ServiceRequestStatus } from '$lib/utils/services';
import { STATUS } from './utils';

export type ServiceRequestRow = NonNullable<
  ReturnType<typeof getServiceRequests>['current']
>[number];

export async function changeStatus(row: ServiceRequestRow, status: ServiceRequestStatus) {
  if (status === row.request.status) return false;

  return await submitWithToast(
    () =>
      updateServiceRequestStatus({ id: row.request.id, status }).updates(
        getServiceRequests().withOverride((current) =>
          current.map((item) =>
            item.request.id === row.request.id
              ? { ...item, request: { ...item.request, status } }
              : item,
          ),
        ),
      ),
    { success: 'Request updated', error: 'Failed to update request' },
  );
}

export async function cancelRequest(row: ServiceRequestRow) {
  const confirmed = await modalManager.confirm({
    title: 'Cancel Service Request',
    prompt:
      'Are you sure you want to cancel this request? An unpaid bill is voided and the request cannot be reopened.',
    confirmText: 'Cancel Request',
    cancelText: 'Keep Request',
    variant: 'destructive',
  });
  if (!confirmed) return false;

  return await changeStatus(row, STATUS.CANCELED);
}
