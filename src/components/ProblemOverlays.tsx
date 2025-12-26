import { useMemo } from 'react'
import type { OverlayVisibility, ProblemGeometry } from '../lib/types'

interface ProblemOverlaysProps {
  problemGeometry: ProblemGeometry
  visibility: OverlayVisibility
}

/**
 * Renders problem geometry visualization as Three.js overlays.
 * Shows boundary edges, non-manifold edges/vertices, self-intersections, and T-junctions.
 * Must be used inside a Canvas component.
 */
export function ProblemOverlays({
  problemGeometry,
  visibility,
}: ProblemOverlaysProps) {
  // Memoize geometry arrays to avoid recreating on each render
  const {
    boundaryEdges,
    nonManifoldEdges,
    nonManifoldVertices,
    selfIntersectionCentroids,
    tJunctionVertices,
  } = problemGeometry

  // Check if arrays have any data
  const hasBoundaryEdges = boundaryEdges.length > 0
  const hasNonManifoldEdges = nonManifoldEdges.length > 0
  const hasNonManifoldVertices = nonManifoldVertices.length > 0
  const hasSelfIntersections = selfIntersectionCentroids.length > 0
  const hasTJunctions = tJunctionVertices.length > 0

  return (
    <group name="problem-overlays">
      {/* Boundary edges - Red lines (holes in mesh) */}
      {visibility.boundaryEdges && hasBoundaryEdges && (
        <LineSegmentsOverlay
          positions={boundaryEdges}
          color="#ff0000"
          name="boundary-edges"
        />
      )}

      {/* Non-manifold edges - Orange lines (3+ faces sharing edge) */}
      {visibility.nonManifoldEdges && hasNonManifoldEdges && (
        <LineSegmentsOverlay
          positions={nonManifoldEdges}
          color="#ff8800"
          name="non-manifold-edges"
        />
      )}

      {/* Non-manifold vertices / Pinch points - Yellow points */}
      {visibility.pinchPoints && hasNonManifoldVertices && (
        <PointsOverlay
          positions={nonManifoldVertices}
          color="#ffff00"
          size={0.02}
          name="non-manifold-vertices"
        />
      )}

      {/* Self-intersection centroids - Magenta points */}
      {visibility.selfIntersections && hasSelfIntersections && (
        <PointsOverlay
          positions={selfIntersectionCentroids}
          color="#ff00ff"
          size={0.025}
          name="self-intersection-centroids"
        />
      )}

      {/* T-junction vertices - Cyan points */}
      {visibility.tJunctions && hasTJunctions && (
        <PointsOverlay
          positions={tJunctionVertices}
          color="#00ffff"
          size={0.02}
          name="t-junction-vertices"
        />
      )}
    </group>
  )
}

// ============================================================================
// Internal Components
// ============================================================================

interface LineSegmentsOverlayProps {
  positions: Float32Array
  color: string
  name?: string
}

/**
 * Renders line segments from a flat Float32Array of positions.
 * Format: [x1,y1,z1, x2,y2,z2, x3,y3,z3, x4,y4,z4, ...] where each pair of vertices forms a segment.
 */
function LineSegmentsOverlay({
  positions,
  color,
  name,
}: LineSegmentsOverlayProps) {
  const positionArray = useMemo(() => positions, [positions])
  const vertexCount = positions.length / 3

  if (vertexCount < 2) return null

  return (
    <lineSegments name={name} renderOrder={1}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positionArray, 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial
        color={color}
        linewidth={2}
        depthTest={false}
        transparent
        opacity={0.9}
      />
    </lineSegments>
  )
}

interface PointsOverlayProps {
  positions: Float32Array
  color: string
  size: number
  name?: string
}

/**
 * Renders points from a flat Float32Array of positions.
 * Format: [x,y,z, x,y,z, ...] where each triplet is a point.
 */
function PointsOverlay({ positions, color, size, name }: PointsOverlayProps) {
  const positionArray = useMemo(() => positions, [positions])
  const vertexCount = positions.length / 3

  if (vertexCount < 1) return null

  return (
    <points name={name} renderOrder={2}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positionArray, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={size}
        sizeAttenuation
        depthTest={false}
        transparent
        opacity={0.95}
      />
    </points>
  )
}
