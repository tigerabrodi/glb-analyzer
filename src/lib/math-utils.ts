import type { Vec3, BoundingBox } from './types';

/**
 * Compute bounding box from positions array.
 * Positions are expected as flat array [x0, y0, z0, x1, y1, z1, ...].
 */
export function computeBoundingBox(positions: Float32Array): BoundingBox {
  if (positions.length < 3) {
    return {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
      size: { x: 0, y: 0, z: 0 },
      diagonal: 0,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  const sizeX = maxX - minX;
  const sizeY = maxY - minY;
  const sizeZ = maxZ - minZ;
  const diagonal = Math.sqrt(sizeX * sizeX + sizeY * sizeY + sizeZ * sizeZ);

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    size: { x: sizeX, y: sizeY, z: sizeZ },
    diagonal,
  };
}

/**
 * Compute center of bounding box.
 * Returns the midpoint between min and max as a Vec3 tuple.
 */
export function computeCenter(bbox: BoundingBox): Vec3 {
  return [
    (bbox.min.x + bbox.max.x) / 2,
    (bbox.min.y + bbox.max.y) / 2,
    (bbox.min.z + bbox.max.z) / 2,
  ];
}

/**
 * Compute max dimension of bounding box.
 * Returns the largest of width, height, or depth.
 */
export function computeMaxDimension(bbox: BoundingBox): number {
  return Math.max(bbox.size.x, bbox.size.y, bbox.size.z);
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
