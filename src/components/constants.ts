import type { OverlayVisibility } from '../lib/types'

/**
 * Default overlay visibility settings.
 */
export const defaultOverlayVisibility: OverlayVisibility = {
  wireframe: false,
  boundaryEdges: false,
  nonManifoldEdges: false,
  pinchPoints: false,
  selfIntersections: false,
  tJunctions: false,
}
