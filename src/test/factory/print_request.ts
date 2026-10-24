import type { PrintRequestRepository } from '$lib/server/repositories/print_request.repository';
import { printMaterial, printRequest } from './print';

export type PrintRequestDetail = NonNullable<
  Awaited<ReturnType<PrintRequestRepository['getById']>>
>;

export function printRequestDetail(
  overrides: Partial<PrintRequestDetail> = {},
): PrintRequestDetail {
  const material = overrides.material ?? printMaterial();
  return {
    ...printRequest({ material: material.id }),
    organization: null,
    payment: null,
    files: [],
    ...overrides,
    material,
  };
}
