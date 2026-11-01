import { updateAMSForPrinter } from '$lib/remotes/endpoints/print_materials.remote';
import { PRINTER_LABEL_PREFIX } from '$lib/utils/print_materials';
import type { DetectedBarcode } from 'barqode';
import { toast } from 'svelte-sonner';
import { describe, expect, it, vi } from 'vitest';
import {
  AMS_SLOT_COUNT,
  AmsScanner,
  CODE_TTL_MS,
  SAME_LABEL_DISTANCE_PX,
} from './ams-scanner.svelte';

vi.mock('$lib/remotes/endpoints/print_materials.remote', () => ({
  updateAMSForPrinter: vi.fn(),
}));

vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const CODE_SIZE = 20;
const SLOT_SPACING = 200;
const PRINTER = `${PRINTER_LABEL_PREFIX}X1C`;
const TAGS = ['AAAAAAAA', 'BBBBBBBB', 'CCCCCCCC', 'DDDDDDDD'];
const NOW = 10_000;

function code(rawValue: string, left: number, top = 0) {
  return {
    rawValue,
    boundingBox: { left, top, width: CODE_SIZE, height: CODE_SIZE },
    cornerPoints: [],
  } as unknown as DetectedBarcode;
}

function fullAms() {
  return [
    code(PRINTER, 0, SLOT_SPACING),
    ...TAGS.map((tag, slot) => code(tag, slot * SLOT_SPACING)),
  ];
}

describe(AmsScanner.name, () => {
  it('needs a printer and every slot before updating', () => {
    const scanner = new AmsScanner();

    scanner.see(fullAms().slice(0, AMS_SLOT_COUNT), NOW);
    expect(scanner.printerName).toBe('X1C');
    expect(scanner.canUpdate).toBe(false);

    scanner.see(fullAms(), NOW);
    expect(scanner.hasAllFilaments).toBe(true);
    expect(scanner.canUpdate).toBe(true);
  });

  it('keeps one entry for a label that moves slightly between frames', () => {
    const scanner = new AmsScanner();

    scanner.see([code(TAGS[0], 0)], NOW);
    scanner.see([code(TAGS[0], SAME_LABEL_DISTANCE_PX / 2)], NOW);

    expect(scanner.filaments).toHaveLength(1);
  });

  it('counts the same tag in two places as two labels', () => {
    const scanner = new AmsScanner();

    scanner.see([code(TAGS[0], 0), code(TAGS[0], SLOT_SPACING)], NOW);

    expect(scanner.filaments).toHaveLength(2);
  });

  it('drops labels that leave the frame', () => {
    const scanner = new AmsScanner();
    scanner.see([code(TAGS[0], 0)], NOW);
    scanner.see([code(TAGS[1], SLOT_SPACING)], NOW + CODE_TTL_MS);

    scanner.prune(NOW + CODE_TTL_MS + 1);

    expect(scanner.filaments.map((c) => c.rawValue)).toEqual([TAGS[1]]);
  });

  it('sends the tags left to right', async () => {
    const scanner = new AmsScanner();
    scanner.see(fullAms().reverse(), NOW);

    await scanner.updateAms();

    expect(updateAMSForPrinter).toHaveBeenCalledWith({ printer_id: PRINTER, filaments: TAGS });
    expect(toast.success).toHaveBeenCalled();
    expect(scanner.updating).toBe(false);
  });

  it('reports a failed update', async () => {
    vi.mocked(updateAMSForPrinter).mockRejectedValue(new Error('offline'));
    const scanner = new AmsScanner();
    scanner.see(fullAms(), NOW);

    await scanner.updateAms();

    expect(toast.error).toHaveBeenCalledWith('Failed to update AMS');
  });
});
