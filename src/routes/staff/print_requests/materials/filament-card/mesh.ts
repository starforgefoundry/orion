import earcut from 'earcut';

export type Point = [number, number];

export type Polygon = { outer: Point[]; holes: Point[][] };

const VERTEX_KEY_PRECISION = 5;

export function signedArea(ring: Point[]): number {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function withWinding(ring: Point[], counterClockwise: boolean): Point[] {
  return signedArea(ring) > 0 === counterClockwise ? ring : [...ring].reverse();
}

export function containsPoint(ring: Point[], [px, py]: Point): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Indexed triangle mesh with welded vertices, so shared edges stay connected. */
export class Mesh {
  readonly vertices: number[] = [];
  readonly triangles: number[] = [];
  private indexByKey = new Map<string, number>();

  get triangleCount() {
    return this.triangles.length / 3;
  }

  vertex(x: number, y: number, z: number): number {
    const key = [x, y, z].map((v) => v.toFixed(VERTEX_KEY_PRECISION)).join(',');
    const existing = this.indexByKey.get(key);
    if (existing !== undefined) return existing;

    const index = this.vertices.length / 3;
    this.vertices.push(x, y, z);
    this.indexByKey.set(key, index);
    return index;
  }

  triangle(a: number, b: number, c: number) {
    this.triangles.push(a, b, c);
  }

  quad(a: number, b: number, c: number, d: number) {
    this.triangle(a, b, c);
    this.triangle(a, c, d);
  }

  /** Vertical wall along a→b; the solid must be on the left of the edge. */
  wall([ax, ay]: Point, [bx, by]: Point, zBottom: number, zTop: number) {
    this.quad(
      this.vertex(ax, ay, zBottom),
      this.vertex(bx, by, zBottom),
      this.vertex(bx, by, zTop),
      this.vertex(ax, ay, zTop),
    );
  }

  extrude(polygon: Polygon, zBottom: number, zTop: number) {
    const rings = [
      withWinding(polygon.outer, true),
      ...polygon.holes.map((hole) => withWinding(hole, false)),
    ];
    const points = rings.flat();
    const holeIndices: number[] = [];
    for (const ring of rings.slice(0, -1)) {
      holeIndices.push((holeIndices.at(-1) ?? 0) + ring.length);
    }

    const faces = earcut(points.flat(), holeIndices);
    for (let i = 0; i < faces.length; i += 3) {
      let [a, b, c] = [points[faces[i]], points[faces[i + 1]], points[faces[i + 2]]];
      if (signedArea([a, b, c]) < 0) [b, c] = [c, b];

      this.triangle(this.vertex(...a, zTop), this.vertex(...b, zTop), this.vertex(...c, zTop));
      this.triangle(
        this.vertex(...a, zBottom),
        this.vertex(...c, zBottom),
        this.vertex(...b, zBottom),
      );
    }

    for (const ring of rings) {
      ring.forEach((point, i) => this.wall(point, ring[(i + 1) % ring.length], zBottom, zTop));
    }
  }
}
