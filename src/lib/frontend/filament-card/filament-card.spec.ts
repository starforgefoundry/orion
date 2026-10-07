import JSZip from 'jszip';
import { parse, type Font } from 'opentype.js';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildCardParts,
  CARD_HEIGHT,
  CARD_THICKNESS,
  CARD_WIDTH,
  contoursToPolygons,
  layoutText,
  filamentCard3mf,
  INLAY_FILAMENT,
  qrMatrix,
} from './filament-card';
import type { Mesh, Point } from './mesh';

const font: Font = parse(
  new Uint8Array(readFileSync('src/lib/assets/fonts/arimo-bold.ttf')).buffer,
);
const card = { qrData: 'F78DC324', label: 'Black ASA' };

function square(x: number, y: number, size: number): Point[] {
  return [
    [x, y],
    [x + size, y],
    [x + size, y + size],
    [x, y + size],
  ];
}

function unmatchedEdges(mesh: Mesh): string[] {
  const edges = new Map<string, number>();
  for (let i = 0; i < mesh.triangles.length; i += 3) {
    const [a, b, c] = mesh.triangles.slice(i, i + 3);
    for (const [from, to] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      edges.set(`${from}>${to}`, (edges.get(`${from}>${to}`) ?? 0) + 1);
      edges.set(`${to}>${from}`, (edges.get(`${to}>${from}`) ?? 0) - 1);
    }
  }
  return [...edges].filter(([, balance]) => balance !== 0).map(([edge]) => edge);
}

function volume(mesh: Mesh): number {
  let total = 0;
  for (let i = 0; i < mesh.triangles.length; i += 3) {
    const [a, b, c] = mesh.triangles
      .slice(i, i + 3)
      .map((v) => mesh.vertices.slice(v * 3, v * 3 + 3));
    total +=
      a[0] * (b[1] * c[2] - b[2] * c[1]) -
      a[1] * (b[0] * c[2] - b[2] * c[0]) +
      a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  return total / 6;
}

describe('qrMatrix', () => {
  it('uses the smallest QR version for a short tag id', () => {
    expect(qrMatrix(card.qrData)).toHaveLength(21);
  });
});

describe('contoursToPolygons', () => {
  it('nests holes inside their outline and islands inside holes', () => {
    const outer = square(0, 0, 10);
    const hole = square(2, 2, 6);
    const island = square(4, 4, 2);

    expect(contoursToPolygons([island, hole, outer])).toEqual([
      { outer, holes: [hole] },
      { outer: island, holes: [] },
    ]);
  });
});

describe('layoutText', () => {
  it('breaks a name onto lines at word boundaries', () => {
    expect(layoutText(font, 'Orange PETG').lines).toEqual(['ORANGE', 'PETG']);
  });

  it('keeps short names on one line at full size', () => {
    expect(layoutText(font, 'PLA')).toEqual({ lines: ['PLA'], size: 8 });
  });

  it('shrinks text that would not fit in two lines', () => {
    const { lines, size } = layoutText(font, 'Translucent Orange PETG HF');
    expect(size).toBeLessThan(8);
    expect(lines.join(' ')).toBe('TRANSLUCENT ORANGE PETG HF');
  });
});

describe('buildCardParts', () => {
  const [body, inlay] = buildCardParts(font, card);

  it('produces closed meshes with outward facing triangles', () => {
    expect(unmatchedEdges(body.mesh)).toEqual([]);
    expect(unmatchedEdges(inlay.mesh)).toEqual([]);
    expect(volume(body.mesh)).toBeGreaterThan(0);
    expect(volume(inlay.mesh)).toBeGreaterThan(0);
  });

  it('has no collapsed triangles', () => {
    for (const { mesh } of [body, inlay]) {
      const collapsed = Array.from({ length: mesh.triangleCount }, (_, i) =>
        mesh.triangles.slice(i * 3, i * 3 + 3),
      ).filter((vertices) => new Set(vertices).size < 3);
      expect(collapsed).toEqual([]);
    }
  });

  it('builds a card with rounded corners', () => {
    const cornerLoss = (4 - Math.PI) * 3 ** 2 * CARD_THICKNESS;
    expect(volume(body.mesh)).toBeCloseTo(
      CARD_WIDTH * CARD_HEIGHT * CARD_THICKNESS - cornerLoss,
      0,
    );
  });

  it('places the inlay on top of the card', () => {
    const zs = inlay.mesh.vertices.filter((_, i) => i % 3 === 2);
    expect(Math.min(...zs)).toBeCloseTo(CARD_THICKNESS);
  });

  it('adds text below the QR code', () => {
    const [, withoutText] = buildCardParts(font, { ...card, label: '' });
    const ys = inlay.mesh.vertices.filter((_, i) => i % 3 === 1);

    expect(inlay.mesh.triangleCount).toBeGreaterThan(withoutText.mesh.triangleCount);
    expect(Math.min(...ys)).toBeLessThan(-CARD_HEIGHT / 4);
  });

  it('keeps long text within the card', () => {
    const [, wide] = buildCardParts(font, { qrData: 'A', label: 'Translucent Orange' });
    const xs = wide.mesh.vertices.filter((_, i) => i % 3 === 0);
    expect(Math.max(...xs.map(Math.abs))).toBeLessThan(CARD_WIDTH / 2);
  });
});

describe('filamentCard3mf', () => {
  it('assigns the inlay to the second filament', async () => {
    const zip = await JSZip.loadAsync(await filamentCard3mf(font, card));
    const settings = await zip.file('Metadata/model_settings.config')!.async('string');

    expect(settings).toContain(
      `<metadata key="name" value="QR and Text"/>\n      <metadata key="extruder" value="${INLAY_FILAMENT}"/>`,
    );
    expect(zip.file('3D/3dmodel.model')).not.toBeNull();
  });
});
