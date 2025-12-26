import type { Vec3, BoundingBox, CameraFrame } from './types';
import { computeCenter, computeMaxDimension } from './math-utils';

/**
 * Calculate camera position and target to frame a bounding box.
 * Uses a simple approach: position camera at distance based on max dimension.
 *
 * @param bbox - The bounding box to frame
 * @param fov - Field of view in degrees (default: 50)
 * @returns CameraFrame with position, target, near, and far values
 */
export function fitCameraToBounds(bbox: BoundingBox, fov: number = 50): CameraFrame {
  const center = computeCenter(bbox);
  const maxDim = computeMaxDimension(bbox);

  // Distance needed to fit the object in view
  const fovRad = (fov * Math.PI) / 180;
  const distance = ((maxDim / 2) / Math.tan(fovRad / 2)) * 1.5; // 1.5x padding

  // Position camera along diagonal for nice 3/4 view
  const position: Vec3 = [
    center[0] + distance * 0.7,
    center[1] + distance * 0.5,
    center[2] + distance * 0.7,
  ];

  // Compute near/far planes based on distance and bounding box diagonal
  const near = Math.max(0.01, distance * 0.01);
  const far = distance * 10 + bbox.diagonal;

  return {
    position,
    target: center,
    near,
    far,
  };
}
