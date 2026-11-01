import type { Font, PathCommand } from 'opentype.js';
import qrcode from 'qrcode-generator';
import { containsPoint, Mesh, signedArea, type Point, type Polygon } from './mesh';
import { build3mf } from './three-mf';

export const CARD_WIDTH = 40;
export const CARD_HEIGHT = 60;
export const CARD_THICKNESS = 2;
export const CARD_CORNER_RADIUS = 3;
const CORNER_SEGMENTS = 8;

const INLAY_HEIGHT = 0.6;
const QR_MARGIN = 4;
const QR_SIZE = CARD_WIDTH - 2 * QR_MARGIN;
const QR_ERROR_CORRECTION = 'Q';
const QR_ALPHANUMERIC = /^[0-9A-Z $%*+\-./:]*$/;

const TEXT_SIZE = 8;
const TEXT_MARGIN = 2;
const TEXT_MAX_WIDTH = CARD_WIDTH - 2 * QR_MARGIN;
const TEXT_TOP = CARD_HEIGHT / 2 - QR_MARGIN - QR_SIZE - TEXT_MARGIN;
const TEXT_BOTTOM = -CARD_HEIGHT / 2 + TEXT_MARGIN;
const TEXT_MAX_HEIGHT = TEXT_TOP - TEXT_BOTTOM;
const TEXT_CENTER_Y = (TEXT_TOP + TEXT_BOTTOM) / 2;
const TEXT_LINE_SPACING = 1.2;
const TEXT_SHRINK_STEP = 0.95;
const CURVE_SEGMENTS = 6;
const MIN_POINT_DISTANCE = 1e-4;

export const BODY_FILAMENT = 1;
export const INLAY_FILAMENT = 2;

export type FilamentCard = { qrData: string; label: string };

function roundedRectangle(width: number, height: number, radius: number): Point[] {
  const corners: [number, number, number][] = [
    [width / 2 - radius, -height / 2 + radius, -Math.PI / 2],
    [width / 2 - radius, height / 2 - radius, 0],
    [-width / 2 + radius, height / 2 - radius, Math.PI / 2],
    [-width / 2 + radius, -height / 2 + radius, Math.PI],
  ];

  return corners.flatMap(([cx, cy, start]) =>
    Array.from({ length: CORNER_SEGMENTS + 1 }, (_, i): Point => {
      const angle = start + (i / CORNER_SEGMENTS) * (Math.PI / 2);
      return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
    }),
  );
}

export function qrMatrix(data: string): boolean[][] {
  const qr = qrcode(0, QR_ERROR_CORRECTION);
  qr.addData(data, QR_ALPHANUMERIC.test(data) ? 'Alphanumeric' : 'Byte');
  qr.make();

  const size = qr.getModuleCount();
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => qr.isDark(row, col)),
  );
}

/** Dark modules share welded edges, so walls only appear where a dark module meets a light one. */
function addQr(mesh: Mesh, matrix: boolean[][], zBottom: number, zTop: number) {
  const size = matrix.length;
  const moduleSize = QR_SIZE / size;
  const left = -QR_SIZE / 2;
  const bottom = CARD_HEIGHT / 2 - QR_MARGIN - QR_SIZE;
  const isDark = (row: number, col: number) => matrix[row]?.[col] ?? false;

  matrix.forEach((cells, row) =>
    cells.forEach((dark, col) => {
      if (!dark) return;

      const x0 = left + col * moduleSize;
      const y0 = bottom + (size - 1 - row) * moduleSize;
      const [x1, y1] = [x0 + moduleSize, y0 + moduleSize];
      const corners: Point[] = [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ];
      const neighbors = [
        [row + 1, col],
        [row, col + 1],
        [row - 1, col],
        [row, col - 1],
      ];

      const top = corners.map(([x, y]) => mesh.vertex(x, y, zTop));
      const base = corners.map(([x, y]) => mesh.vertex(x, y, zBottom));
      mesh.quad(top[0], top[1], top[2], top[3]);
      mesh.quad(base[0], base[3], base[2], base[1]);

      neighbors.forEach(([r, c], side) => {
        if (!isDark(r, c)) mesh.wall(corners[side], corners[(side + 1) % 4], zBottom, zTop);
      });
    }),
  );
}

function pathContours(commands: PathCommand[]): Point[][] {
  const contours: Point[][] = [];
  let contour: Point[] = [];

  const close = () => {
    const distinct = contour.filter(
      ([x, y], i) =>
        Math.hypot(x - contour.at(i - 1)![0], y - contour.at(i - 1)![1]) > MIN_POINT_DISTANCE,
    );
    if (distinct.length >= 3) contours.push(distinct);
    contour = [];
  };

  const curve = (to: Point, at: (t: number, from: Point) => Point) => {
    const from = contour.at(-1)!;
    for (let i = 1; i <= CURVE_SEGMENTS; i++) contour.push(at(i / CURVE_SEGMENTS, from));
    contour[contour.length - 1] = to;
  };

  for (const command of commands) {
    switch (command.type) {
      case 'M':
        close();
        contour = [[command.x, -command.y]];
        break;
      case 'L':
        contour.push([command.x, -command.y]);
        break;
      case 'Q': {
        const [cx, cy] = [command.x1, -command.y1];
        curve([command.x, -command.y], (t, [fx, fy]) => {
          const u = 1 - t;
          return [
            u * u * fx + 2 * u * t * cx + t * t * command.x,
            u * u * fy + 2 * u * t * cy - t * t * command.y,
          ];
        });
        break;
      }
      case 'C': {
        const [c1x, c1y, c2x, c2y] = [command.x1, -command.y1, command.x2, -command.y2];
        curve([command.x, -command.y], (t, [fx, fy]) => {
          const u = 1 - t;
          return [
            u * u * u * fx + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * command.x,
            u * u * u * fy + 3 * u * u * t * c1y + 3 * u * t * t * c2y - t * t * t * command.y,
          ];
        });
        break;
      }
      case 'Z':
        close();
        break;
    }
  }

  close();
  return contours;
}

/** Contours nested an even number of times are outlines; odd ones are holes in their parent. */
export function contoursToPolygons(contours: Point[][]): Polygon[] {
  const bySize = [...contours].sort((a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)));
  const parents = bySize.map((contour, i) =>
    bySize.slice(0, i).filter((other) => containsPoint(other, contour[0])),
  );

  const polygons = new Map<Point[], Polygon>();
  bySize.forEach((contour, i) => {
    const ancestors = parents[i];
    if (ancestors.length % 2 === 0) {
      polygons.set(contour, { outer: contour, holes: [] });
    } else {
      polygons.get(ancestors.at(-1)!)?.holes.push(contour);
    }
  });

  return [...polygons.values()];
}

function wrapWords(font: Font, words: string[], size: number): string[] {
  return words.reduce<string[]>((lines, word) => {
    const candidate = lines.length ? `${lines.at(-1)} ${word}` : word;
    if (lines.length && font.getAdvanceWidth(candidate, size) <= TEXT_MAX_WIDTH) {
      lines[lines.length - 1] = candidate;
    } else {
      lines.push(word);
    }
    return lines;
  }, []);
}

/** Wraps on spaces at the largest size where every line fits the card width and the block fits under the QR code. */
export function layoutText(font: Font, text: string): { lines: string[]; size: number } {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  const fits = (lines: string[], size: number) =>
    lines.length * size * TEXT_LINE_SPACING <= TEXT_MAX_HEIGHT &&
    lines.every((line) => font.getAdvanceWidth(line, size) <= TEXT_MAX_WIDTH);

  let size = TEXT_SIZE;
  let lines = wrapWords(font, words, size);
  while (!fits(lines, size)) {
    size *= TEXT_SHRINK_STEP;
    lines = wrapWords(font, words, size);
  }
  return { lines, size };
}

function textPolygons(font: Font, text: string): Polygon[] {
  const { lines, size } = layoutText(font, text);

  const laidOut = lines.map((line, index) => {
    const baseline = index * size * TEXT_LINE_SPACING;
    const path = font.getPath(line, -font.getAdvanceWidth(line, size) / 2, baseline, size);
    return pathContours(path.commands);
  });

  const points = laidOut.flat(2);
  if (points.length === 0) return [];

  const ys = points.map(([, y]) => y);
  const offsetY = TEXT_CENTER_Y - (Math.min(...ys) + Math.max(...ys)) / 2;

  return contoursToPolygons(
    laidOut.flat().map((contour) => contour.map(([x, y]): Point => [x, y + offsetY])),
  );
}

export function buildCardParts(font: Font, card: FilamentCard) {
  const body = new Mesh();
  body.extrude(
    { outer: roundedRectangle(CARD_WIDTH, CARD_HEIGHT, CARD_CORNER_RADIUS), holes: [] },
    0,
    CARD_THICKNESS,
  );

  const inlay = new Mesh();
  const inlayTop = CARD_THICKNESS + INLAY_HEIGHT;
  addQr(inlay, qrMatrix(card.qrData), CARD_THICKNESS, inlayTop);
  for (const polygon of textPolygons(font, card.label)) {
    inlay.extrude(polygon, CARD_THICKNESS, inlayTop);
  }

  return [
    { name: 'Card', mesh: body, filament: BODY_FILAMENT },
    { name: 'QR and Text', mesh: inlay, filament: INLAY_FILAMENT },
  ];
}

export function filamentCard3mf(font: Font, card: FilamentCard): Promise<ArrayBuffer> {
  return build3mf(`Filament Card ${card.qrData}`, buildCardParts(font, card));
}
