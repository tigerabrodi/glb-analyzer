/**
 * Mesh topology diagnostics for GLB analysis.
 * Ported from kiln project - pure math, works in browser.
 *
 * Detects:
 * - Holes (boundary edges)
 * - Invalid geometry (non-manifold edges/vertices)
 * - Mesh structure (connected components, Euler characteristic)
 * - Quality issues (degenerate triangles, self-intersections, etc.)
 */

import type { BoundingBox, DistributionStats, MeshDiagnostics } from './types'

// Re-export types for convenience
export type { BoundingBox, DistributionStats, MeshDiagnostics }

/**
 * Maximum vertex index we can safely encode in numeric edge keys.
 * Using 2^26 = 67M which allows encoding two indices in a 52-bit safe integer.
 */
const MAX_VERTEX_FOR_NUMERIC_KEY = 67108864 // 2^26

/**
 * Create a numeric edge key from two vertex indices (order-independent).
 * Encodes as (min << 26) | max for efficient Map lookup without string allocation.
 */
function numericEdgeKey(a: number, b: number): number {
  const min = a < b ? a : b
  const max = a < b ? b : a
  return min * MAX_VERTEX_FOR_NUMERIC_KEY + max
}

/**
 * Create a numeric directed edge key (order-dependent).
 * Encodes as (from << 26) | to.
 */
function numericDirectedEdgeKey(from: number, to: number): number {
  return from * MAX_VERTEX_FOR_NUMERIC_KEY + to
}

/**
 * Detect non-manifold vertices (pinch points / bowtie vertices).
 * A vertex is non-manifold if its incident faces form multiple disconnected fans
 * rather than a single connected disk.
 */
function detectNonManifoldVertices(
  indices: Uint16Array | Uint32Array | number[]
  // _vertexCount: number
): number {
  // Build vertex -> triangles adjacency
  const vertexToTriangles = new Map<number, number[]>()

  for (let i = 0; i < indices.length; i += 3) {
    const triIdx = Math.floor(i / 3)
    const i0 = indices[i]!
    const i1 = indices[i + 1]!
    const i2 = indices[i + 2]!

    if (!vertexToTriangles.has(i0)) {
      vertexToTriangles.set(i0, [])
    }
    if (!vertexToTriangles.has(i1)) {
      vertexToTriangles.set(i1, [])
    }
    if (!vertexToTriangles.has(i2)) {
      vertexToTriangles.set(i2, [])
    }

    vertexToTriangles.get(i0)!.push(triIdx)
    vertexToTriangles.get(i1)!.push(triIdx)
    vertexToTriangles.get(i2)!.push(triIdx)
  }

  let nonManifoldCount = 0

  // Check only vertices that have triangles
  for (const [v, triangles] of vertexToTriangles.entries()) {
    if (triangles.length === 0) {
      continue
    }

    // Build edge graph around this vertex: neighboring vertices connected via edges
    const edgeGraph = new Map<number, Set<number>>()

    for (const triIdx of triangles) {
      const i = triIdx * 3
      const i0 = indices[i]!
      const i1 = indices[i + 1]!
      const i2 = indices[i + 2]!

      // Get the two other vertices in this triangle (not v)
      const others = [i0, i1, i2].filter((vi) => vi !== v)
      if (others.length !== 2) {
        continue
      }

      const [v1, v2] = others as [number, number]

      // These two vertices are connected via an edge around vertex v
      if (!edgeGraph.has(v1)) {
        edgeGraph.set(v1, new Set())
      }
      if (!edgeGraph.has(v2)) {
        edgeGraph.set(v2, new Set())
      }

      edgeGraph.get(v1)!.add(v2)
      edgeGraph.get(v2)!.add(v1)
    }

    if (edgeGraph.size === 0) {
      continue
    }

    // BFS to check if all neighbors are reachable (single connected fan)
    const visited = new Set<number>()
    const startVertex = edgeGraph.keys().next().value as number
    const queue: number[] = [startVertex]
    let head = 0

    while (head < queue.length) {
      const current = queue[head++]!
      if (visited.has(current)) {
        continue
      }
      visited.add(current)

      const neighbors = edgeGraph.get(current)
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            queue.push(neighbor)
          }
        }
      }
    }

    // If we can't reach all neighbors, vertex has disconnected fans = non-manifold
    if (visited.size !== edgeGraph.size) {
      nonManifoldCount++
    }
  }

  return nonManifoldCount
}

/**
 * Detect winding consistency using directed edge analysis.
 */
function detectWindingConsistency(
  indices: Uint16Array | Uint32Array | number[]
): {
  inconsistentEdgeCount: number
  consistencyPercent: number
  skipped?: boolean
} {
  const triangleCount = indices.length / 3

  // Guard against Map size limit
  const MAP_SIZE_LIMIT = 16777216
  const MAX_SAFE_TRIANGLES = Math.floor(MAP_SIZE_LIMIT / 3)

  if (triangleCount > MAX_SAFE_TRIANGLES) {
    return {
      inconsistentEdgeCount: 0,
      consistencyPercent: -1,
      skipped: true,
    }
  }

  const directedEdgeCounts = new Map<number, number>()

  for (let t = 0; t < triangleCount; t++) {
    const i = t * 3
    const v0 = indices[i]!
    const v1 = indices[i + 1]!
    const v2 = indices[i + 2]!

    const e01 = numericDirectedEdgeKey(v0, v1)
    const e12 = numericDirectedEdgeKey(v1, v2)
    const e20 = numericDirectedEdgeKey(v2, v0)

    directedEdgeCounts.set(e01, (directedEdgeCounts.get(e01) ?? 0) + 1)
    directedEdgeCounts.set(e12, (directedEdgeCounts.get(e12) ?? 0) + 1)
    directedEdgeCounts.set(e20, (directedEdgeCounts.get(e20) ?? 0) + 1)
  }

  let manifoldEdgeCount = 0
  let inconsistentEdgeCount = 0

  const checkedEdges = new Set<number>()

  for (const [directedEdgeKey, forwardCount] of directedEdgeCounts.entries()) {
    const from = Math.floor(directedEdgeKey / MAX_VERTEX_FOR_NUMERIC_KEY)
    const to = directedEdgeKey % MAX_VERTEX_FOR_NUMERIC_KEY

    const undirectedKey = numericEdgeKey(from, to)
    if (checkedEdges.has(undirectedKey)) {
      continue
    }
    checkedEdges.add(undirectedKey)

    const oppositeEdgeKey = numericDirectedEdgeKey(to, from)
    const backwardCount = directedEdgeCounts.get(oppositeEdgeKey) ?? 0

    const totalTriangles = forwardCount + backwardCount

    if (totalTriangles < 2) {
      continue
    }

    if (totalTriangles > 2) {
      continue
    }

    manifoldEdgeCount++

    if (forwardCount !== 1 || backwardCount !== 1) {
      inconsistentEdgeCount++
    }
  }

  const consistencyPercent =
    manifoldEdgeCount > 0
      ? ((manifoldEdgeCount - inconsistentEdgeCount) / manifoldEdgeCount) * 100
      : 100

  return { inconsistentEdgeCount, consistencyPercent }
}

/**
 * Compute distribution statistics from an array of numbers.
 */
function computeStats(values: number[]): DistributionStats | null {
  if (values.length === 0) {
    return null
  }

  const sorted = [...values].sort((a, b) => a - b)
  const sum = values.reduce((a, b) => a + b, 0)
  const mean = sum / values.length

  const median =
    values.length % 2 === 0
      ? (sorted[values.length / 2 - 1]! + sorted[values.length / 2]!) / 2
      : sorted[Math.floor(values.length / 2)]!

  const variance =
    values.reduce((acc, val) => acc + (val - mean) ** 2, 0) / values.length
  const stdDev = Math.sqrt(variance)

  return {
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    mean,
    median,
    stdDev,
  }
}

/**
 * Detect duplicate vertices (same position, different index).
 */
function detectDuplicateVertices(positions: Float32Array): number {
  const vertexCount = positions.length / 3
  const tolerance = 1e-6
  const cellSize = tolerance * 10

  const grid = new Map<string, number[]>()

  const getCellKey = (x: number, y: number, z: number): string => {
    const cx = Math.floor(x / cellSize)
    const cy = Math.floor(y / cellSize)
    const cz = Math.floor(z / cellSize)
    return `${cx},${cy},${cz}`
  }

  let duplicateCount = 0

  for (let i = 0; i < vertexCount; i++) {
    const x = positions[i * 3]!
    const y = positions[i * 3 + 1]!
    const z = positions[i * 3 + 2]!
    const key = getCellKey(x, y, z)

    const cell = grid.get(key)
    if (cell) {
      let isDuplicate = false
      for (const j of cell) {
        const jx = positions[j * 3]!
        const jy = positions[j * 3 + 1]!
        const jz = positions[j * 3 + 2]!
        const distSq = (x - jx) ** 2 + (y - jy) ** 2 + (z - jz) ** 2
        if (distSq < tolerance * tolerance) {
          isDuplicate = true
          break
        }
      }
      if (isDuplicate) {
        duplicateCount++
      }
      cell.push(i)
    } else {
      grid.set(key, [i])
    }
  }

  return duplicateCount
}

/**
 * Compute triangle aspect ratio (longest edge / shortest altitude).
 */
function computeAspectRatio(
  v0x: number,
  v0y: number,
  v0z: number,
  v1x: number,
  v1y: number,
  v1z: number,
  v2x: number,
  v2y: number,
  v2z: number
): number {
  const e0 = Math.sqrt((v1x - v0x) ** 2 + (v1y - v0y) ** 2 + (v1z - v0z) ** 2)
  const e1 = Math.sqrt((v2x - v1x) ** 2 + (v2y - v1y) ** 2 + (v2z - v1z) ** 2)
  const e2 = Math.sqrt((v0x - v2x) ** 2 + (v0y - v2y) ** 2 + (v0z - v2z) ** 2)

  const maxEdge = Math.max(e0, e1, e2)

  const s = (e0 + e1 + e2) / 2
  const areaSq = s * (s - e0) * (s - e1) * (s - e2)

  if (areaSq <= 0) {
    return Infinity
  }

  const area = Math.sqrt(areaSq)
  const shortestAltitude = (2 * area) / maxEdge

  if (shortestAltitude < 1e-10) {
    return Infinity
  }

  return maxEdge / shortestAltitude
}

/**
 * Compute valence distribution.
 */
function computeValenceDistribution(
  indices: Uint16Array | Uint32Array | number[],
  vertexCount: number
): Record<number, number> {
  const valences = new Uint32Array(vertexCount)

  for (let i = 0; i < indices.length; i++) {
    const v = indices[i]!
    if (v < vertexCount) {
      valences[v] = (valences[v] ?? 0) + 1
    }
  }

  const distribution: Record<number, number> = {}
  for (let i = 0; i < vertexCount; i++) {
    const val = valences[i]!
    if (val > 0) {
      distribution[val] = (distribution[val] ?? 0) + 1
    }
  }

  return distribution
}

/**
 * Compute axis-aligned bounding box.
 */
function computeBoundingBox(positions: Float32Array): BoundingBox {
  const vertexCount = positions.length / 3

  if (vertexCount === 0) {
    return {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
      size: { x: 0, y: 0, z: 0 },
      diagonal: 0,
    }
  }

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity

  for (let i = 0; i < vertexCount; i++) {
    const x = positions[i * 3]!
    const y = positions[i * 3 + 1]!
    const z = positions[i * 3 + 2]!

    if (x < minX) minX = x
    if (y < minY) minY = y
    if (z < minZ) minZ = z
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
    if (z > maxZ) maxZ = z
  }

  const sizeX = maxX - minX
  const sizeY = maxY - minY
  const sizeZ = maxZ - minZ
  const diagonal = Math.sqrt(sizeX * sizeX + sizeY * sizeY + sizeZ * sizeZ)

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    size: { x: sizeX, y: sizeY, z: sizeZ },
    diagonal,
  }
}

/**
 * Compute face normal for a triangle.
 */
function computeFaceNormal(
  positions: Float32Array,
  i0: number,
  i1: number,
  i2: number
): { x: number; y: number; z: number } {
  const v0x = positions[i0 * 3]!
  const v0y = positions[i0 * 3 + 1]!
  const v0z = positions[i0 * 3 + 2]!
  const v1x = positions[i1 * 3]!
  const v1y = positions[i1 * 3 + 1]!
  const v1z = positions[i1 * 3 + 2]!
  const v2x = positions[i2 * 3]!
  const v2y = positions[i2 * 3 + 1]!
  const v2z = positions[i2 * 3 + 2]!

  const e1x = v1x - v0x,
    e1y = v1y - v0y,
    e1z = v1z - v0z
  const e2x = v2x - v0x,
    e2y = v2y - v0y,
    e2z = v2z - v0z

  return {
    x: e1y * e2z - e1z * e2y,
    y: e1z * e2x - e1x * e2z,
    z: e1x * e2y - e1y * e2x,
  }
}

/**
 * Compute dihedral angle statistics.
 */
function computeDihedralAngles(
  positions: Float32Array,
  indices: Uint16Array | Uint32Array | number[],
  edgeFaceMap: Map<number, number[]>
): {
  sharpEdgeCount: number
  coplanarEdgeCount: number
  dihedralAngleStats: DistributionStats | null
} {
  const SHARP_THRESHOLD = 30
  const COPLANAR_THRESHOLD = 170

  const dihedralAngles: number[] = []
  let sharpEdgeCount = 0
  let coplanarEdgeCount = 0

  const triangleCount = indices.length / 3
  const faceNormals: { x: number; y: number; z: number }[] = []

  for (let t = 0; t < triangleCount; t++) {
    const i = t * 3
    const i0 = indices[i]!
    const i1 = indices[i + 1]!
    const i2 = indices[i + 2]!
    faceNormals.push(computeFaceNormal(positions, i0, i1, i2))
  }

  for (const [, faces] of edgeFaceMap.entries()) {
    if (faces.length !== 2) {
      continue
    }

    const [t1, t2] = faces as [number, number]
    const n1 = faceNormals[t1]!
    const n2 = faceNormals[t2]!

    const len1 = Math.sqrt(n1.x * n1.x + n1.y * n1.y + n1.z * n1.z)
    const len2 = Math.sqrt(n2.x * n2.x + n2.y * n2.y + n2.z * n2.z)

    if (len1 < 1e-10 || len2 < 1e-10) {
      continue
    }

    const nx1 = n1.x / len1,
      ny1 = n1.y / len1,
      nz1 = n1.z / len1
    const nx2 = n2.x / len2,
      ny2 = n2.y / len2,
      nz2 = n2.z / len2

    const dot = nx1 * nx2 + ny1 * ny2 + nz1 * nz2
    const clampedDot = Math.max(-1, Math.min(1, dot))

    const angleBetweenNormals = Math.acos(clampedDot) * (180 / Math.PI)
    const dihedralAngle = 180 - angleBetweenNormals

    dihedralAngles.push(dihedralAngle)

    if (dihedralAngle < SHARP_THRESHOLD) {
      sharpEdgeCount++
    }
    if (dihedralAngle > COPLANAR_THRESHOLD) {
      coplanarEdgeCount++
    }
  }

  return {
    sharpEdgeCount,
    coplanarEdgeCount,
    dihedralAngleStats: computeStats(dihedralAngles),
  }
}

// ============================================================================
// Spatial Hash Grid for acceleration
// ============================================================================

class SpatialHashGrid {
  private cellSize: number
  private grid: Map<string, number[]>

  constructor(cellSize: number) {
    this.cellSize = cellSize
    this.grid = new Map()
  }

  insert(
    triIndex: number,
    minX: number,
    minY: number,
    minZ: number,
    maxX: number,
    maxY: number,
    maxZ: number
  ): void {
    const minCX = Math.floor(minX / this.cellSize)
    const minCY = Math.floor(minY / this.cellSize)
    const minCZ = Math.floor(minZ / this.cellSize)
    const maxCX = Math.floor(maxX / this.cellSize)
    const maxCY = Math.floor(maxY / this.cellSize)
    const maxCZ = Math.floor(maxZ / this.cellSize)

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        for (let cz = minCZ; cz <= maxCZ; cz++) {
          const key = `${cx},${cy},${cz}`
          if (!this.grid.has(key)) {
            this.grid.set(key, [])
          }
          this.grid.get(key)!.push(triIndex)
        }
      }
    }
  }

  query(
    minX: number,
    minY: number,
    minZ: number,
    maxX: number,
    maxY: number,
    maxZ: number
  ): Set<number> {
    const result = new Set<number>()
    const minCX = Math.floor(minX / this.cellSize)
    const minCY = Math.floor(minY / this.cellSize)
    const minCZ = Math.floor(minZ / this.cellSize)
    const maxCX = Math.floor(maxX / this.cellSize)
    const maxCY = Math.floor(maxY / this.cellSize)
    const maxCZ = Math.floor(maxZ / this.cellSize)

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        for (let cz = minCZ; cz <= maxCZ; cz++) {
          const key = `${cx},${cy},${cz}`
          const tris = this.grid.get(key)
          if (tris) {
            for (const t of tris) {
              result.add(t)
            }
          }
        }
      }
    }
    return result
  }
}

// ============================================================================
// Triangle-Triangle Intersection (Möller's algorithm)
// ============================================================================

function trianglesIntersect(
  ax1: number,
  ay1: number,
  az1: number,
  bx1: number,
  by1: number,
  bz1: number,
  cx1: number,
  cy1: number,
  cz1: number,
  ax2: number,
  ay2: number,
  az2: number,
  bx2: number,
  by2: number,
  bz2: number,
  cx2: number,
  cy2: number,
  cz2: number
): boolean {
  const normalX1 = (by1 - ay1) * (cz1 - az1) - (bz1 - az1) * (cy1 - ay1)
  const normalY1 = (bz1 - az1) * (cx1 - ax1) - (bx1 - ax1) * (cz1 - az1)
  const normalZ1 = (bx1 - ax1) * (cy1 - ay1) - (by1 - ay1) * (cx1 - ax1)

  const normalX2 = (by2 - ay2) * (cz2 - az2) - (bz2 - az2) * (cy2 - ay2)
  const normalY2 = (bz2 - az2) * (cx2 - ax2) - (bx2 - ax2) * (cz2 - az2)
  const normalZ2 = (bx2 - ax2) * (cy2 - ay2) - (by2 - ay2) * (cx2 - ax2)

  const d1 = normalX1 * ax1 + normalY1 * ay1 + normalZ1 * az1
  const dist2a = normalX1 * ax2 + normalY1 * ay2 + normalZ1 * az2 - d1
  const dist2b = normalX1 * bx2 + normalY1 * by2 + normalZ1 * bz2 - d1
  const dist2c = normalX1 * cx2 + normalY1 * cy2 + normalZ1 * cz2 - d1

  if (dist2a > 1e-8 && dist2b > 1e-8 && dist2c > 1e-8) return false
  if (dist2a < -1e-8 && dist2b < -1e-8 && dist2c < -1e-8) return false

  const d2 = normalX2 * ax2 + normalY2 * ay2 + normalZ2 * az2
  const dist1a = normalX2 * ax1 + normalY2 * ay1 + normalZ2 * az1 - d2
  const dist1b = normalX2 * bx1 + normalY2 * by1 + normalZ2 * bz1 - d2
  const dist1c = normalX2 * cx1 + normalY2 * cy1 + normalZ2 * cz1 - d2

  if (dist1a > 1e-8 && dist1b > 1e-8 && dist1c > 1e-8) return false
  if (dist1a < -1e-8 && dist1b < -1e-8 && dist1c < -1e-8) return false

  const dirX = normalY1 * normalZ2 - normalZ1 * normalY2
  const dirY = normalZ1 * normalX2 - normalX1 * normalZ2
  const dirZ = normalX1 * normalY2 - normalY1 * normalX2

  const dirLen = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ)
  if (dirLen < 1e-10) {
    return coplanarTrianglesOverlap(
      ax1,
      ay1,
      az1,
      bx1,
      by1,
      bz1,
      cx1,
      cy1,
      cz1,
      ax2,
      ay2,
      az2,
      bx2,
      by2,
      bz2,
      cx2,
      cy2,
      cz2,
      normalX1,
      normalY1,
      normalZ1
    )
  }

  const absX = Math.abs(dirX),
    absY = Math.abs(dirY),
    absZ = Math.abs(dirZ)
  let p1a: number,
    p1b: number,
    p1c: number,
    p2a: number,
    p2b: number,
    p2c: number

  if (absX >= absY && absX >= absZ) {
    p1a = ax1
    p1b = bx1
    p1c = cx1
    p2a = ax2
    p2b = bx2
    p2c = cx2
  } else if (absY >= absZ) {
    p1a = ay1
    p1b = by1
    p1c = cy1
    p2a = ay2
    p2b = by2
    p2c = cy2
  } else {
    p1a = az1
    p1b = bz1
    p1c = cz1
    p2a = az2
    p2b = bz2
    p2c = cz2
  }

  const int1 = computeTriangleInterval(p1a, p1b, p1c, dist1a, dist1b, dist1c)
  const int2 = computeTriangleInterval(p2a, p2b, p2c, dist2a, dist2b, dist2c)

  if (!int1 || !int2) return false

  return int1.max >= int2.min - 1e-8 && int2.max >= int1.min - 1e-8
}

function computeTriangleInterval(
  pa: number,
  pb: number,
  pc: number,
  da: number,
  db: number,
  dc: number
): { min: number; max: number } | null {
  const points: number[] = []

  if (da > 0 !== db > 0 && Math.abs(da - db) > 1e-10) {
    const t = da / (da - db)
    points.push(pa + t * (pb - pa))
  }
  if (db > 0 !== dc > 0 && Math.abs(db - dc) > 1e-10) {
    const t = db / (db - dc)
    points.push(pb + t * (pc - pb))
  }
  if (dc > 0 !== da > 0 && Math.abs(dc - da) > 1e-10) {
    const t = dc / (dc - da)
    points.push(pc + t * (pa - pc))
  }

  if (Math.abs(da) < 1e-8) points.push(pa)
  if (Math.abs(db) < 1e-8) points.push(pb)
  if (Math.abs(dc) < 1e-8) points.push(pc)

  if (points.length < 2) return null

  return { min: Math.min(...points), max: Math.max(...points) }
}

function coplanarTrianglesOverlap(
  ax1: number,
  ay1: number,
  az1: number,
  bx1: number,
  by1: number,
  bz1: number,
  cx1: number,
  cy1: number,
  cz1: number,
  ax2: number,
  ay2: number,
  az2: number,
  bx2: number,
  by2: number,
  bz2: number,
  cx2: number,
  cy2: number,
  cz2: number,
  nx: number,
  ny: number,
  nz: number
): boolean {
  const absX = Math.abs(nx),
    absY = Math.abs(ny),
    absZ = Math.abs(nz)

  let t1: [number, number][], t2: [number, number][]

  if (absZ >= absX && absZ >= absY) {
    t1 = [
      [ax1, ay1],
      [bx1, by1],
      [cx1, cy1],
    ]
    t2 = [
      [ax2, ay2],
      [bx2, by2],
      [cx2, cy2],
    ]
  } else if (absY >= absX) {
    t1 = [
      [ax1, az1],
      [bx1, bz1],
      [cx1, cz1],
    ]
    t2 = [
      [ax2, az2],
      [bx2, bz2],
      [cx2, cz2],
    ]
  } else {
    t1 = [
      [ay1, az1],
      [by1, bz1],
      [cy1, cz1],
    ]
    t2 = [
      [ay2, az2],
      [by2, bz2],
      [cy2, cz2],
    ]
  }

  for (let i = 0; i < 3; i++) {
    const a1 = t1[i]!,
      b1 = t1[(i + 1) % 3]!
    for (let j = 0; j < 3; j++) {
      const a2 = t2[j]!,
        b2 = t2[(j + 1) % 3]!
      if (
        segmentsIntersect2D(
          a1[0],
          a1[1],
          b1[0],
          b1[1],
          a2[0],
          a2[1],
          b2[0],
          b2[1]
        )
      ) {
        return true
      }
    }
  }

  if (
    pointInTriangle2D(
      t1[0]![0],
      t1[0]![1],
      t2[0]![0],
      t2[0]![1],
      t2[1]![0],
      t2[1]![1],
      t2[2]![0],
      t2[2]![1]
    )
  ) {
    return true
  }
  if (
    pointInTriangle2D(
      t2[0]![0],
      t2[0]![1],
      t1[0]![0],
      t1[0]![1],
      t1[1]![0],
      t1[1]![1],
      t1[2]![0],
      t1[2]![1]
    )
  ) {
    return true
  }

  return false
}

function segmentsIntersect2D(
  ax1: number,
  ay1: number,
  bx1: number,
  by1: number,
  ax2: number,
  ay2: number,
  bx2: number,
  by2: number
): boolean {
  const d1x = bx1 - ax1,
    d1y = by1 - ay1
  const d2x = bx2 - ax2,
    d2y = by2 - ay2
  const cross = d1x * d2y - d1y * d2x

  if (Math.abs(cross) < 1e-10) return false

  const dx = ax2 - ax1,
    dy = ay2 - ay1
  const t1 = (dx * d2y - dy * d2x) / cross
  const t2 = (dx * d1y - dy * d1x) / cross

  return t1 > 1e-8 && t1 < 1 - 1e-8 && t2 > 1e-8 && t2 < 1 - 1e-8
}

function pointInTriangle2D(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
): boolean {
  const v0x = cx - ax,
    v0y = cy - ay
  const v1x = bx - ax,
    v1y = by - ay
  const v2x = px - ax,
    v2y = py - ay

  const dot00 = v0x * v0x + v0y * v0y
  const dot01 = v0x * v1x + v0y * v1y
  const dot02 = v0x * v2x + v0y * v2y
  const dot11 = v1x * v1x + v1y * v1y
  const dot12 = v1x * v2x + v1y * v2y

  const denom = dot00 * dot11 - dot01 * dot01
  if (Math.abs(denom) < 1e-10) return false

  const inv = 1 / denom
  const u = (dot11 * dot02 - dot01 * dot12) * inv
  const v = (dot00 * dot12 - dot01 * dot02) * inv

  return u >= 0 && v >= 0 && u + v < 1
}

function trianglesAdjacent(
  i0a: number,
  i1a: number,
  i2a: number,
  i0b: number,
  i1b: number,
  i2b: number
): boolean {
  const setA = new Set([i0a, i1a, i2a])
  let shared = 0
  if (setA.has(i0b)) shared++
  if (setA.has(i1b)) shared++
  if (setA.has(i2b)) shared++
  return shared >= 2
}

/**
 * Detect self-intersecting triangles.
 */
function detectSelfIntersections(
  positions: Float32Array,
  indices: Uint16Array | Uint32Array | number[],
  boundingBox: BoundingBox | null
): { count: number } {
  const triangleCount = indices.length / 3

  const diagonal = Math.max(boundingBox?.diagonal ?? 1, 1e-6)
  const avgEdgeLength = diagonal / Math.sqrt(triangleCount / 2)
  const cellSize = Math.max(avgEdgeLength * 2, 1e-6)

  const triBounds: {
    minX: number
    minY: number
    minZ: number
    maxX: number
    maxY: number
    maxZ: number
  }[] = []
  for (let t = 0; t < triangleCount; t++) {
    const i0 = indices[t * 3]!
    const i1 = indices[t * 3 + 1]!
    const i2 = indices[t * 3 + 2]!

    const x0 = positions[i0 * 3]!,
      y0 = positions[i0 * 3 + 1]!,
      z0 = positions[i0 * 3 + 2]!
    const x1 = positions[i1 * 3]!,
      y1 = positions[i1 * 3 + 1]!,
      z1 = positions[i1 * 3 + 2]!
    const x2 = positions[i2 * 3]!,
      y2 = positions[i2 * 3 + 1]!,
      z2 = positions[i2 * 3 + 2]!

    triBounds.push({
      minX: Math.min(x0, x1, x2),
      minY: Math.min(y0, y1, y2),
      minZ: Math.min(z0, z1, z2),
      maxX: Math.max(x0, x1, x2),
      maxY: Math.max(y0, y1, y2),
      maxZ: Math.max(z0, z1, z2),
    })
  }

  const grid = new SpatialHashGrid(cellSize)
  for (let t = 0; t < triangleCount; t++) {
    const bounds = triBounds[t]!
    grid.insert(
      t,
      bounds.minX,
      bounds.minY,
      bounds.minZ,
      bounds.maxX,
      bounds.maxY,
      bounds.maxZ
    )
  }

  let intersectionCount = 0

  for (let t1 = 0; t1 < triangleCount; t1++) {
    const bounds1 = triBounds[t1]!
    const candidates = grid.query(
      bounds1.minX,
      bounds1.minY,
      bounds1.minZ,
      bounds1.maxX,
      bounds1.maxY,
      bounds1.maxZ
    )

    for (const t2 of candidates) {
      if (t2 <= t1) continue

      const i0a = indices[t1 * 3]!,
        i1a = indices[t1 * 3 + 1]!,
        i2a = indices[t1 * 3 + 2]!
      const i0b = indices[t2 * 3]!,
        i1b = indices[t2 * 3 + 1]!,
        i2b = indices[t2 * 3 + 2]!

      if (trianglesAdjacent(i0a, i1a, i2a, i0b, i1b, i2b)) continue

      const ax1 = positions[i0a * 3]!,
        ay1 = positions[i0a * 3 + 1]!,
        az1 = positions[i0a * 3 + 2]!
      const bx1 = positions[i1a * 3]!,
        by1 = positions[i1a * 3 + 1]!,
        bz1 = positions[i1a * 3 + 2]!
      const cx1 = positions[i2a * 3]!,
        cy1 = positions[i2a * 3 + 1]!,
        cz1 = positions[i2a * 3 + 2]!

      const ax2 = positions[i0b * 3]!,
        ay2 = positions[i0b * 3 + 1]!,
        az2 = positions[i0b * 3 + 2]!
      const bx2 = positions[i1b * 3]!,
        by2 = positions[i1b * 3 + 1]!,
        bz2 = positions[i1b * 3 + 2]!
      const cx2 = positions[i2b * 3]!,
        cy2 = positions[i2b * 3 + 1]!,
        cz2 = positions[i2b * 3 + 2]!

      if (
        trianglesIntersect(
          ax1,
          ay1,
          az1,
          bx1,
          by1,
          bz1,
          cx1,
          cy1,
          cz1,
          ax2,
          ay2,
          az2,
          bx2,
          by2,
          bz2,
          cx2,
          cy2,
          cz2
        )
      ) {
        intersectionCount++
      }
    }
  }

  return { count: intersectionCount }
}

/**
 * Detect T-junctions.
 */
function detectTJunctions(
  positions: Float32Array,
  indices: Uint16Array | Uint32Array | number[],
  boundingBox: BoundingBox | null
): { count: number } {
  const vertexCount = positions.length / 3
  const triangleCount = indices.length / 3

  const diagonal = Math.max(boundingBox?.diagonal ?? 1, 1e-6)
  const tolerance = diagonal * 1e-4
  const toleranceSq = tolerance * tolerance

  const vertexTriangles = new Map<number, Set<number>>()
  for (let t = 0; t < triangleCount; t++) {
    const i0 = indices[t * 3]!
    const i1 = indices[t * 3 + 1]!
    const i2 = indices[t * 3 + 2]!

    if (!vertexTriangles.has(i0)) vertexTriangles.set(i0, new Set())
    if (!vertexTriangles.has(i1)) vertexTriangles.set(i1, new Set())
    if (!vertexTriangles.has(i2)) vertexTriangles.set(i2, new Set())

    vertexTriangles.get(i0)!.add(t)
    vertexTriangles.get(i1)!.add(t)
    vertexTriangles.get(i2)!.add(t)
  }

  const cellSize = Math.max(tolerance * 10, 1e-6)
  const edgeGrid = new Map<string, number[]>()
  const edges: {
    v0: number
    v1: number
    x0: number
    y0: number
    z0: number
    x1: number
    y1: number
    z1: number
  }[] = []
  const edgeSet = new Set<number>()

  for (let t = 0; t < triangleCount; t++) {
    const i0 = indices[t * 3]!
    const i1 = indices[t * 3 + 1]!
    const i2 = indices[t * 3 + 2]!

    const pairs = [
      [i0, i1],
      [i1, i2],
      [i2, i0],
    ] as [number, number][]
    for (const [va, vb] of pairs) {
      const edgeKey = va < vb ? va * vertexCount + vb : vb * vertexCount + va
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey)
        const edgeIdx = edges.length
        const x0 = positions[va * 3]!,
          y0 = positions[va * 3 + 1]!,
          z0 = positions[va * 3 + 2]!
        const x1 = positions[vb * 3]!,
          y1 = positions[vb * 3 + 1]!,
          z1 = positions[vb * 3 + 2]!
        edges.push({ v0: va, v1: vb, x0, y0, z0, x1, y1, z1 })

        const points = [
          [x0, y0, z0],
          [x1, y1, z1],
          [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
        ]
        for (const [px, py, pz] of points) {
          const cx = Math.floor(px! / cellSize)
          const cy = Math.floor(py! / cellSize)
          const cz = Math.floor(pz! / cellSize)
          const cellKey = `${cx},${cy},${cz}`
          if (!edgeGrid.has(cellKey)) edgeGrid.set(cellKey, [])
          const cell = edgeGrid.get(cellKey)!
          if (!cell.includes(edgeIdx)) cell.push(edgeIdx)
        }
      }
    }
  }

  let tJunctionCount = 0

  for (let v = 0; v < vertexCount; v++) {
    const vx = positions[v * 3]!
    const vy = positions[v * 3 + 1]!
    const vz = positions[v * 3 + 2]!
    const adjacentTris = vertexTriangles.get(v)

    const cx = Math.floor(vx / cellSize)
    const cy = Math.floor(vy / cellSize)
    const cz = Math.floor(vz / cellSize)

    const nearbyEdges = new Set<number>()
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const neighborKey = `${cx + dx},${cy + dy},${cz + dz}`
          const cell = edgeGrid.get(neighborKey)
          if (cell) {
            for (const edgeIdx of cell) nearbyEdges.add(edgeIdx)
          }
        }
      }
    }

    for (const edgeIdx of nearbyEdges) {
      const edge = edges[edgeIdx]!

      if (edge.v0 === v || edge.v1 === v) continue

      const ex = edge.x1 - edge.x0
      const ey = edge.y1 - edge.y0
      const ez = edge.z1 - edge.z0
      const edgeLenSq = ex * ex + ey * ey + ez * ez

      if (edgeLenSq < 1e-20) continue

      const pvx = vx - edge.x0
      const pvy = vy - edge.y0
      const pvz = vz - edge.z0
      const t = (pvx * ex + pvy * ey + pvz * ez) / edgeLenSq

      if (t <= 0.01 || t >= 0.99) continue

      const closestX = edge.x0 + t * ex
      const closestY = edge.y0 + t * ey
      const closestZ = edge.z0 + t * ez
      const dx2 = vx - closestX
      const dy2 = vy - closestY
      const dz2 = vz - closestZ
      const distSq = dx2 * dx2 + dy2 * dy2 + dz2 * dz2

      if (distSq < toleranceSq) {
        let isConnected = false
        if (adjacentTris) {
          for (const triIdx of adjacentTris) {
            const ti0 = indices[triIdx * 3]!
            const ti1 = indices[triIdx * 3 + 1]!
            const ti2 = indices[triIdx * 3 + 2]!
            const triVerts = new Set([ti0, ti1, ti2])
            if (triVerts.has(edge.v0) && triVerts.has(edge.v1)) {
              isConnected = true
              break
            }
          }
        }

        if (!isConnected) {
          tJunctionCount++
          break
        }
      }
    }
  }

  return { count: tJunctionCount }
}

/**
 * Detect thin walls.
 */
function detectThinWalls(
  positions: Float32Array,
  indices: Uint16Array | Uint32Array | number[],
  boundingBox: BoundingBox | null,
  thresholdFraction: number = 0.005
): { count: number; threshold: number } {
  const triangleCount = indices.length / 3
  const vertexCount = positions.length / 3

  const diagonal = Math.max(boundingBox?.diagonal ?? 1, 1e-6)
  const absoluteThreshold = diagonal * thresholdFraction
  const thresholdSq = absoluteThreshold * absoluteThreshold

  const cellSize = Math.max(absoluteThreshold * 3, 1e-6)
  const vertexGrid = new Map<string, number[]>()

  for (let v = 0; v < vertexCount; v++) {
    const x = positions[v * 3]!
    const y = positions[v * 3 + 1]!
    const z = positions[v * 3 + 2]!
    const cx = Math.floor(x / cellSize)
    const cy = Math.floor(y / cellSize)
    const cz = Math.floor(z / cellSize)
    const key = `${cx},${cy},${cz}`
    if (!vertexGrid.has(key)) vertexGrid.set(key, [])
    vertexGrid.get(key)!.push(v)
  }

  const vertexTriangles = new Map<number, Set<number>>()
  for (let t = 0; t < triangleCount; t++) {
    const i0 = indices[t * 3]!
    const i1 = indices[t * 3 + 1]!
    const i2 = indices[t * 3 + 2]!

    if (!vertexTriangles.has(i0)) vertexTriangles.set(i0, new Set())
    if (!vertexTriangles.has(i1)) vertexTriangles.set(i1, new Set())
    if (!vertexTriangles.has(i2)) vertexTriangles.set(i2, new Set())

    vertexTriangles.get(i0)!.add(t)
    vertexTriangles.get(i1)!.add(t)
    vertexTriangles.get(i2)!.add(t)
  }

  let thinWallCount = 0
  const thinWallVertices = new Set<number>()

  for (let v = 0; v < vertexCount; v++) {
    if (thinWallVertices.has(v)) continue

    const vx = positions[v * 3]!
    const vy = positions[v * 3 + 1]!
    const vz = positions[v * 3 + 2]!

    const adjTris = vertexTriangles.get(v) ?? new Set()

    const neighborVerts = new Set<number>()
    for (const t of adjTris) {
      neighborVerts.add(indices[t * 3]!)
      neighborVerts.add(indices[t * 3 + 1]!)
      neighborVerts.add(indices[t * 3 + 2]!)
    }

    const cx = Math.floor(vx / cellSize)
    const cy = Math.floor(vy / cellSize)
    const cz = Math.floor(vz / cellSize)

    let foundThinWall = false
    for (let dx = -1; dx <= 1 && !foundThinWall; dx++) {
      for (let dy = -1; dy <= 1 && !foundThinWall; dy++) {
        for (let dz = -1; dz <= 1 && !foundThinWall; dz++) {
          const key = `${cx + dx},${cy + dy},${cz + dz}`
          const nearby = vertexGrid.get(key)
          if (!nearby) continue

          for (const v2 of nearby) {
            if (v2 === v || neighborVerts.has(v2)) continue

            const v2x = positions[v2 * 3]!
            const v2y = positions[v2 * 3 + 1]!
            const v2z = positions[v2 * 3 + 2]!

            const dx2 = vx - v2x
            const dy2 = vy - v2y
            const dz2 = vz - v2z
            const distSq = dx2 * dx2 + dy2 * dy2 + dz2 * dz2

            if (distSq < thresholdSq && distSq > 1e-20) {
              thinWallVertices.add(v)
              thinWallCount++
              foundThinWall = true
              break
            }
          }
        }
      }
    }
  }

  return { count: thinWallCount, threshold: thresholdFraction }
}

/**
 * Detect coincident faces.
 */
function detectCoincidentFaces(
  positions: Float32Array,
  indices: Uint16Array | Uint32Array | number[],
  boundingBox: BoundingBox | null
): { count: number } {
  const triangleCount = indices.length / 3

  const diagonal = Math.max(boundingBox?.diagonal ?? 1, 1e-6)
  const tolerance = diagonal * 1e-5

  const triData: {
    cx: number
    cy: number
    cz: number
    nx: number
    ny: number
    nz: number
    i0: number
    i1: number
    i2: number
  }[] = []

  for (let t = 0; t < triangleCount; t++) {
    const i0 = indices[t * 3]!
    const i1 = indices[t * 3 + 1]!
    const i2 = indices[t * 3 + 2]!

    const x0 = positions[i0 * 3]!,
      y0 = positions[i0 * 3 + 1]!,
      z0 = positions[i0 * 3 + 2]!
    const x1 = positions[i1 * 3]!,
      y1 = positions[i1 * 3 + 1]!,
      z1 = positions[i1 * 3 + 2]!
    const x2 = positions[i2 * 3]!,
      y2 = positions[i2 * 3 + 1]!,
      z2 = positions[i2 * 3 + 2]!

    const cx = (x0 + x1 + x2) / 3
    const cy = (y0 + y1 + y2) / 3
    const cz = (z0 + z1 + z2) / 3

    const e1x = x1 - x0,
      e1y = y1 - y0,
      e1z = z1 - z0
    const e2x = x2 - x0,
      e2y = y2 - y0,
      e2z = z2 - z0
    const nx = e1y * e2z - e1z * e2y
    const ny = e1z * e2x - e1x * e2z
    const nz = e1x * e2y - e1y * e2x

    triData.push({ cx, cy, cz, nx, ny, nz, i0, i1, i2 })
  }

  const cellSize = Math.max(diagonal / Math.sqrt(triangleCount / 10), 1e-6)
  const centroidGrid = new Map<string, number[]>()

  for (let t = 0; t < triangleCount; t++) {
    const { cx, cy, cz } = triData[t]!
    const gx = Math.floor(cx / cellSize)
    const gy = Math.floor(cy / cellSize)
    const gz = Math.floor(cz / cellSize)
    const key = `${gx},${gy},${gz}`
    if (!centroidGrid.has(key)) centroidGrid.set(key, [])
    centroidGrid.get(key)!.push(t)
  }

  let coincidentCount = 0

  for (let t1 = 0; t1 < triangleCount; t1++) {
    const data1 = triData[t1]!
    const gx = Math.floor(data1.cx / cellSize)
    const gy = Math.floor(data1.cy / cellSize)
    const gz = Math.floor(data1.cz / cellSize)

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const key = `${gx + dx},${gy + dy},${gz + dz}`
          const nearby = centroidGrid.get(key)
          if (!nearby) continue

          for (const t2 of nearby) {
            if (t2 <= t1) continue

            const data2 = triData[t2]!

            if (
              data1.i0 === data2.i0 ||
              data1.i0 === data2.i1 ||
              data1.i0 === data2.i2 ||
              data1.i1 === data2.i0 ||
              data1.i1 === data2.i1 ||
              data1.i1 === data2.i2 ||
              data1.i2 === data2.i0 ||
              data1.i2 === data2.i1 ||
              data1.i2 === data2.i2
            ) {
              continue
            }

            const dot =
              data1.nx * data2.nx + data1.ny * data2.ny + data1.nz * data2.nz
            const len1 = Math.sqrt(
              data1.nx * data1.nx + data1.ny * data1.ny + data1.nz * data1.nz
            )
            const len2 = Math.sqrt(
              data2.nx * data2.nx + data2.ny * data2.ny + data2.nz * data2.nz
            )

            if (len1 < 1e-10 || len2 < 1e-10) continue

            const normalizedDot = Math.abs(dot / (len1 * len2))
            if (normalizedDot < 0.999) continue

            const cdx = data1.cx - data2.cx
            const cdy = data1.cy - data2.cy
            const cdz = data1.cz - data2.cz
            const centroidDist = Math.sqrt(cdx * cdx + cdy * cdy + cdz * cdz)

            if (centroidDist > cellSize) continue

            const i0 = data1.i0
            const x0 = positions[i0 * 3]!,
              y0 = positions[i0 * 3 + 1]!,
              z0 = positions[i0 * 3 + 2]!
            const d = data1.nx * x0 + data1.ny * y0 + data1.nz * z0
            const planeDist =
              Math.abs(
                data1.nx * data2.cx +
                  data1.ny * data2.cy +
                  data1.nz * data2.cz -
                  d
              ) / len1

            if (planeDist < tolerance) {
              coincidentCount++
            }
          }
        }
      }
    }
  }

  return { count: coincidentCount }
}

// ============================================================================
// Main Diagnostics Function
// ============================================================================

/**
 * Compute full mesh diagnostics from positions and indices.
 */
export function computeMeshDiagnostics(
  positions: Float32Array,
  indices: Uint16Array | Uint32Array | number[]
): MeshDiagnostics {
  const vertexCount = positions.length / 3
  const triangleCount = indices.length / 3

  // Guard against Map size limit
  const MAP_SIZE_LIMIT = 16777216
  const MAX_SAFE_TRIANGLES = Math.floor(MAP_SIZE_LIMIT / 3)

  if (triangleCount > MAX_SAFE_TRIANGLES) {
    const partialBoundingBox = computeBoundingBox(positions)

    return {
      vertexCount,
      triangleCount,
      edgeCount: -1,
      boundaryEdgeCount: -1,
      nonManifoldEdgeCount: -1,
      nonManifoldVertexCount: -1,
      connectedComponents: -1,
      eulerCharacteristic: -1,
      degenerateTriangleCount: -1,
      windingInconsistentEdgeCount: -1,
      windingConsistencyPercent: -1,
      windingCheckSkipped: true,
      duplicateVertexCount: -1,
      tinyTriangleCount: -1,
      needleTriangleCount: -1,
      edgeLengthStats: null,
      aspectRatioStats: null,
      valenceDistribution: null,
      boundingBox: partialBoundingBox,
      isolatedVertexCount: -1,
      sharpEdgeCount: -1,
      coplanarEdgeCount: -1,
      dihedralAngleStats: null,
      selfIntersectionCount: -1,
      tJunctionCount: -1,
      thinWallCount: -1,
      thinWallThreshold: 0.005,
      coincidentFaceCount: -1,
      isWatertight: false,
      isManifold: false,
      hasNonManifoldVertices: false,
      hasConsistentWinding: false,
    }
  }

  // Build edge map
  const edgeFaceMap = new Map<number, number[]>()

  for (let t = 0; t < triangleCount; t++) {
    const i = t * 3
    const i0 = indices[i]!
    const i1 = indices[i + 1]!
    const i2 = indices[i + 2]!

    const e01 = numericEdgeKey(i0, i1)
    const e12 = numericEdgeKey(i1, i2)
    const e20 = numericEdgeKey(i2, i0)

    if (!edgeFaceMap.has(e01)) edgeFaceMap.set(e01, [])
    if (!edgeFaceMap.has(e12)) edgeFaceMap.set(e12, [])
    if (!edgeFaceMap.has(e20)) edgeFaceMap.set(e20, [])

    edgeFaceMap.get(e01)!.push(t)
    edgeFaceMap.get(e12)!.push(t)
    edgeFaceMap.get(e20)!.push(t)
  }

  const edgeCount = edgeFaceMap.size

  // Count boundary and non-manifold edges
  let boundaryEdgeCount = 0
  let nonManifoldEdgeCount = 0

  for (const faces of edgeFaceMap.values()) {
    const count = faces.length
    if (count === 1) {
      boundaryEdgeCount++
    } else if (count > 2) {
      nonManifoldEdgeCount++
    }
  }

  // Count degenerate triangles
  let degenerateTriangleCount = 0
  let totalEdgeLength = 0
  let sampledEdges = 0
  const sampleLimit = Math.min(triangleCount, 1000)

  for (let t = 0; t < sampleLimit; t++) {
    const i = t * 3
    const i0 = indices[i]!
    const i1 = indices[i + 1]!
    const i2 = indices[i + 2]!

    const v0x = positions[i0 * 3]!
    const v0y = positions[i0 * 3 + 1]!
    const v0z = positions[i0 * 3 + 2]!
    const v1x = positions[i1 * 3]!
    const v1y = positions[i1 * 3 + 1]!
    const v1z = positions[i1 * 3 + 2]!
    const v2x = positions[i2 * 3]!
    const v2y = positions[i2 * 3 + 1]!
    const v2z = positions[i2 * 3 + 2]!

    const e1Len = Math.sqrt(
      (v1x - v0x) ** 2 + (v1y - v0y) ** 2 + (v1z - v0z) ** 2
    )
    const e2Len = Math.sqrt(
      (v2x - v0x) ** 2 + (v2y - v0y) ** 2 + (v2z - v0z) ** 2
    )
    const e3Len = Math.sqrt(
      (v2x - v1x) ** 2 + (v2y - v1y) ** 2 + (v2z - v1z) ** 2
    )

    totalEdgeLength += e1Len + e2Len + e3Len
    sampledEdges += 3
  }

  const avgEdgeLength = sampledEdges > 0 ? totalEdgeLength / sampledEdges : 1
  const expectedAreaSq = 0.1875 * avgEdgeLength * avgEdgeLength
  const areaThresholdSq = expectedAreaSq * 1e-8

  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i]!
    const i1 = indices[i + 1]!
    const i2 = indices[i + 2]!

    const v0x = positions[i0 * 3]!
    const v0y = positions[i0 * 3 + 1]!
    const v0z = positions[i0 * 3 + 2]!
    const v1x = positions[i1 * 3]!
    const v1y = positions[i1 * 3 + 1]!
    const v1z = positions[i1 * 3 + 2]!
    const v2x = positions[i2 * 3]!
    const v2y = positions[i2 * 3 + 1]!
    const v2z = positions[i2 * 3 + 2]!

    const e1x = v1x - v0x,
      e1y = v1y - v0y,
      e1z = v1z - v0z
    const e2x = v2x - v0x,
      e2y = v2y - v0y,
      e2z = v2z - v0z

    const nx = e1y * e2z - e1z * e2y
    const ny = e1z * e2x - e1x * e2z
    const nz = e1x * e2y - e1y * e2x

    const areaSq = 0.25 * (nx * nx + ny * ny + nz * nz)
    if (areaSq < areaThresholdSq) {
      degenerateTriangleCount++
    }
  }

  // Connected components using union-find
  const parent = new Uint32Array(vertexCount)
  for (let i = 0; i < vertexCount; i++) {
    parent[i] = i
  }

  function find(x: number): number {
    if (parent[x] !== x) {
      parent[x] = find(parent[x]!)
    }
    return parent[x]!
  }

  function union(a: number, b: number): void {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) {
      parent[rootA] = rootB
    }
  }

  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i]!
    const i1 = indices[i + 1]!
    const i2 = indices[i + 2]!
    union(i0, i1)
    union(i1, i2)
  }

  const usedVertices = new Set<number>()
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i]!
    if (idx < vertexCount) {
      usedVertices.add(idx)
    }
  }

  const componentRoots = new Set<number>()
  for (const v of usedVertices) {
    componentRoots.add(find(v))
  }
  const connectedComponents = componentRoots.size

  const eulerCharacteristic = usedVertices.size - edgeCount + triangleCount

  // Non-manifold vertices
  const nonManifoldVertexCount = detectNonManifoldVertices(indices)

  // Winding consistency
  const windingResult = detectWindingConsistency(indices)

  // Geometry quality
  const duplicateVertexCount = detectDuplicateVertices(positions)

  const edgeLengths: number[] = []
  const aspectRatios: number[] = []
  let tinyTriangleCount = 0
  let needleTriangleCount = 0

  const triangleAreas: number[] = []
  for (let t = 0; t < triangleCount; t++) {
    const i = t * 3
    const i0 = indices[i]!
    const i1 = indices[i + 1]!
    const i2 = indices[i + 2]!

    const v0x = positions[i0 * 3]!
    const v0y = positions[i0 * 3 + 1]!
    const v0z = positions[i0 * 3 + 2]!
    const v1x = positions[i1 * 3]!
    const v1y = positions[i1 * 3 + 1]!
    const v1z = positions[i1 * 3 + 2]!
    const v2x = positions[i2 * 3]!
    const v2y = positions[i2 * 3 + 1]!
    const v2z = positions[i2 * 3 + 2]!

    const e0 = Math.sqrt((v1x - v0x) ** 2 + (v1y - v0y) ** 2 + (v1z - v0z) ** 2)
    const e1 = Math.sqrt((v2x - v1x) ** 2 + (v2y - v1y) ** 2 + (v2z - v1z) ** 2)
    const e2 = Math.sqrt((v0x - v2x) ** 2 + (v0y - v2y) ** 2 + (v0z - v2z) ** 2)

    edgeLengths.push(e0, e1, e2)

    const ex1 = v1x - v0x,
      ey1 = v1y - v0y,
      ez1 = v1z - v0z
    const ex2 = v2x - v0x,
      ey2 = v2y - v0y,
      ez2 = v2z - v0z
    const nx = ey1 * ez2 - ez1 * ey2
    const ny = ez1 * ex2 - ex1 * ez2
    const nz = ex1 * ey2 - ey1 * ex2
    const area = 0.5 * Math.sqrt(nx * nx + ny * ny + nz * nz)
    triangleAreas.push(area)

    const ar = computeAspectRatio(v0x, v0y, v0z, v1x, v1y, v1z, v2x, v2y, v2z)
    if (isFinite(ar)) {
      aspectRatios.push(ar)
      if (ar > 10) {
        needleTriangleCount++
      }
    }
  }

  const sortedAreas = [...triangleAreas].sort((a, b) => a - b)
  const medianArea =
    sortedAreas.length > 0
      ? sortedAreas[Math.floor(sortedAreas.length / 2)]!
      : 0
  const tinyThreshold = medianArea * 0.01

  for (const area of triangleAreas) {
    if (area < tinyThreshold && area > 0) {
      tinyTriangleCount++
    }
  }

  const edgeLengthStats = computeStats(edgeLengths)
  const aspectRatioStats = computeStats(aspectRatios)
  const valenceDistribution = computeValenceDistribution(indices, vertexCount)
  const boundingBox = computeBoundingBox(positions)
  const isolatedVertexCount = vertexCount - usedVertices.size
  const dihedralResult = computeDihedralAngles(positions, indices, edgeFaceMap)
  const selfIntersectionResult = detectSelfIntersections(
    positions,
    indices,
    boundingBox
  )
  const tJunctionResult = detectTJunctions(positions, indices, boundingBox)
  const thinWallResult = detectThinWalls(positions, indices, boundingBox)
  const coincidentFaceResult = detectCoincidentFaces(
    positions,
    indices,
    boundingBox
  )

  return {
    vertexCount,
    triangleCount,
    edgeCount,
    boundaryEdgeCount,
    nonManifoldEdgeCount,
    nonManifoldVertexCount,
    connectedComponents,
    eulerCharacteristic,
    degenerateTriangleCount,
    windingInconsistentEdgeCount: windingResult.inconsistentEdgeCount,
    windingConsistencyPercent: windingResult.consistencyPercent,
    windingCheckSkipped: windingResult.skipped ?? false,
    duplicateVertexCount,
    tinyTriangleCount,
    needleTriangleCount,
    edgeLengthStats,
    aspectRatioStats,
    valenceDistribution,
    boundingBox,
    isolatedVertexCount,
    sharpEdgeCount: dihedralResult.sharpEdgeCount,
    coplanarEdgeCount: dihedralResult.coplanarEdgeCount,
    dihedralAngleStats: dihedralResult.dihedralAngleStats,
    selfIntersectionCount: selfIntersectionResult.count,
    tJunctionCount: tJunctionResult.count,
    thinWallCount: thinWallResult.count,
    thinWallThreshold: thinWallResult.threshold,
    coincidentFaceCount: coincidentFaceResult.count,
    isWatertight: boundaryEdgeCount === 0,
    isManifold: nonManifoldEdgeCount === 0,
    hasNonManifoldVertices: nonManifoldVertexCount > 0,
    hasConsistentWinding: windingResult.skipped
      ? false
      : windingResult.consistencyPercent >= 99.5,
  }
}

/**
 * Extract positions and indices from a glTF document and compute diagnostics.
 */
export function computeDiagnosticsFromDocument(
  document: import('@gltf-transform/core').Document
): MeshDiagnostics {
  const allPositions: number[] = []
  const allIndices: number[] = []
  let vertexOffset = 0

  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const posAccessor = prim.getAttribute('POSITION')
      const idxAccessor = prim.getIndices()

      if (!posAccessor) continue

      const positions = posAccessor.getArray()
      if (!positions) continue

      for (let i = 0; i < positions.length; i++) {
        allPositions.push(positions[i]!)
      }

      if (idxAccessor) {
        const indices = idxAccessor.getArray()
        if (indices) {
          for (let i = 0; i < indices.length; i++) {
            allIndices.push(indices[i]! + vertexOffset)
          }
        }
      } else {
        const vertCount = positions.length / 3
        for (let i = 0; i < vertCount; i++) {
          allIndices.push(vertexOffset + i)
        }
      }

      vertexOffset += positions.length / 3
    }
  }

  return computeMeshDiagnostics(new Float32Array(allPositions), allIndices)
}

// Also export the edge face map builder for use in problem geometry extraction
export function buildEdgeFaceMap(
  indices: Uint16Array | Uint32Array | number[],
  triangleCount: number
): Map<number, number[]> {
  const edgeFaceMap = new Map<number, number[]>()

  for (let t = 0; t < triangleCount; t++) {
    const i = t * 3
    const i0 = indices[i]!
    const i1 = indices[i + 1]!
    const i2 = indices[i + 2]!

    const e01 = numericEdgeKey(i0, i1)
    const e12 = numericEdgeKey(i1, i2)
    const e20 = numericEdgeKey(i2, i0)

    if (!edgeFaceMap.has(e01)) edgeFaceMap.set(e01, [])
    if (!edgeFaceMap.has(e12)) edgeFaceMap.set(e12, [])
    if (!edgeFaceMap.has(e20)) edgeFaceMap.set(e20, [])

    edgeFaceMap.get(e01)!.push(t)
    edgeFaceMap.get(e12)!.push(t)
    edgeFaceMap.get(e20)!.push(t)
  }

  return edgeFaceMap
}

// Export edge key decoder for problem geometry extraction
export function decodeEdgeKey(key: number): [number, number] {
  const a = Math.floor(key / MAX_VERTEX_FOR_NUMERIC_KEY)
  const b = key % MAX_VERTEX_FOR_NUMERIC_KEY
  return [a, b]
}
