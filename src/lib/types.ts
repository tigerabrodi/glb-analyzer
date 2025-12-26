// ============================================================================
// Vector & Geometry
// ============================================================================

/** 3D vector as tuple for performance (no object allocation) */
export type Vec3 = readonly [number, number, number]

/** Axis-aligned bounding box */
export interface BoundingBox {
  min: { x: number; y: number; z: number }
  max: { x: number; y: number; z: number }
  size: { x: number; y: number; z: number }
  diagonal: number
}

/** Statistics for a numeric distribution */
export interface DistributionStats {
  min: number
  max: number
  mean: number
  median: number
  stdDev: number
}

// ============================================================================
// Mesh Diagnostics (output of analysis)
// ============================================================================

export interface MeshDiagnostics {
  // Basic counts
  vertexCount: number
  triangleCount: number
  edgeCount: number

  // Topology checks
  boundaryEdgeCount: number // Edges with only 1 face = HOLES
  nonManifoldEdgeCount: number // Edges with 3+ faces = invalid geometry
  nonManifoldVertexCount: number // Vertices where face fans are disconnected (pinch points)
  connectedComponents: number // Number of separate pieces
  eulerCharacteristic: number // V - E + F (should be 2 for closed sphere-like mesh)

  // Quality checks
  degenerateTriangleCount: number // Zero-area triangles
  windingInconsistentEdgeCount: number // Edges where adjacent faces have inconsistent winding
  windingConsistencyPercent: number // Percentage of manifold edges with consistent winding (-1 if skipped)
  windingCheckSkipped: boolean // true if mesh was too large for winding analysis

  // Geometry quality
  duplicateVertexCount: number // Vertices at same position but different indices
  tinyTriangleCount: number // Triangles with area < 1% of median
  needleTriangleCount: number // Triangles with aspect ratio > 10:1
  edgeLengthStats: DistributionStats | null // Edge length distribution
  aspectRatioStats: DistributionStats | null // Triangle aspect ratio distribution
  valenceDistribution: Record<number, number> | null // Vertex valence -> count

  // Bounding box and scale
  boundingBox: BoundingBox | null

  // Isolated vertices (not referenced by any triangle)
  isolatedVertexCount: number

  // Dihedral angle analysis (edge sharpness)
  sharpEdgeCount: number // Edges with dihedral angle < 30° (very sharp creases)
  coplanarEdgeCount: number // Edges with dihedral angle > 170° (nearly flat)
  dihedralAngleStats: DistributionStats | null

  // Self-intersections (triangles crossing each other)
  selfIntersectionCount: number

  // T-junctions (vertices on edges but not connected)
  tJunctionCount: number

  // Thin walls (surfaces very close but not touching)
  thinWallCount: number
  thinWallThreshold: number // Threshold as fraction of diagonal

  // Coincident/overlapping faces
  coincidentFaceCount: number

  // Derived status flags
  isWatertight: boolean // boundaryEdgeCount === 0
  isManifold: boolean // nonManifoldEdgeCount === 0
  hasNonManifoldVertices: boolean // nonManifoldVertexCount > 0
  hasConsistentWinding: boolean // windingConsistencyPercent >= 99.5
}

// ============================================================================
// Problem Geometry (for 3D visualization overlays)
// ============================================================================

export interface ProblemGeometry {
  // Line segments as flat Float32Array [x1,y1,z1, x2,y2,z2, ...]
  boundaryEdges: Float32Array
  nonManifoldEdges: Float32Array

  // Points as flat Float32Array [x,y,z, ...]
  nonManifoldVertices: Float32Array
  selfIntersectionCentroids: Float32Array
  tJunctionVertices: Float32Array
}

// ============================================================================
// Analysis Result (combined output from worker)
// ============================================================================

export interface AnalysisResult {
  diagnostics: MeshDiagnostics
  problemGeometry: ProblemGeometry
  fileSizeKb: number
  durationMs: number
}

// ============================================================================
// Worker Protocol
// ============================================================================

export type WorkerRequest = {
  id: number
  type: 'analyze'
  payload: {
    arrayBuffer: ArrayBuffer
    fileName: string
  }
}

export type WorkerProgressStage = 'parsing' | 'analyzing' | 'extracting'

export type WorkerResponse =
  | { id: number; type: 'progress'; stage: WorkerProgressStage }
  | { id: number; type: 'result'; result: AnalysisResult }
  | { id: number; type: 'error'; message: string }

// ============================================================================
// Hook State
// ============================================================================

export type AnalyzerStatus =
  | 'idle'
  | 'loading'
  | 'parsing'
  | 'analyzing'
  | 'extracting'
  | 'done'
  | 'error'

export interface AnalyzerState {
  status: AnalyzerStatus
  result: AnalysisResult | null
  error: string | null
  modelUrl: string | null // Object URL for 3D viewer
}

// ============================================================================
// Viewer Overlay Visibility
// ============================================================================

export interface OverlayVisibility {
  wireframe: boolean
  boundaryEdges: boolean
  nonManifoldEdges: boolean
  pinchPoints: boolean
  selfIntersections: boolean
  tJunctions: boolean
}

// ============================================================================
// Test Fixtures
// ============================================================================

export interface TestFixture {
  name: string
  positions: Float32Array
  indices: Uint32Array
  expected: Partial<MeshDiagnostics>
}

// ============================================================================
// Camera Framing
// ============================================================================

export interface CameraFrame {
  position: Vec3
  target: Vec3
  near: number
  far: number
}
