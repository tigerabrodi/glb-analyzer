/**
 * Extract problem geometry for 3D visualization overlays.
 *
 * This module extracts actual vertex/edge positions (not just counts)
 * so they can be rendered as lines and points in the 3D viewer.
 */

import { buildEdgeFaceMap, decodeEdgeKey } from './mesh-diagnostics'
import type { MeshDiagnostics, ProblemGeometry } from './types'

/**
 * Extract problem geometry from mesh data.
 * Returns Float32Arrays of positions for rendering overlays.
 */
export function extractProblemGeometry(
  positions: Float32Array,
  indices: Uint16Array | Uint32Array | number[],
  diagnostics: MeshDiagnostics
): ProblemGeometry {
  const triangleCount = indices.length / 3

  // Build edge-face map for edge classification
  const edgeFaceMap = buildEdgeFaceMap(indices, triangleCount)

  // Extract boundary edges (edges with only 1 face = holes)
  const boundaryEdgePositions: number[] = []

  // Extract non-manifold edges (edges with 3+ faces)
  const nonManifoldEdgePositions: number[] = []

  for (const [edgeKey, faces] of edgeFaceMap.entries()) {
    const [v0, v1] = decodeEdgeKey(edgeKey)

    const x0 = positions[v0 * 3]!
    const y0 = positions[v0 * 3 + 1]!
    const z0 = positions[v0 * 3 + 2]!
    const x1 = positions[v1 * 3]!
    const y1 = positions[v1 * 3 + 1]!
    const z1 = positions[v1 * 3 + 2]!

    if (faces.length === 1) {
      // Boundary edge (hole)
      boundaryEdgePositions.push(x0, y0, z0, x1, y1, z1)
    } else if (faces.length > 2) {
      // Non-manifold edge
      nonManifoldEdgePositions.push(x0, y0, z0, x1, y1, z1)
    }
  }

  // Extract non-manifold vertices (pinch points)
  const nonManifoldVertexPositions: number[] = []

  if (diagnostics.nonManifoldVertexCount > 0) {
    // Detect non-manifold vertices by checking if face fans are disconnected
    const vertexToTriangles = new Map<number, number[]>()

    for (let i = 0; i < indices.length; i += 3) {
      const triIdx = Math.floor(i / 3)
      const i0 = indices[i]!
      const i1 = indices[i + 1]!
      const i2 = indices[i + 2]!

      if (!vertexToTriangles.has(i0)) vertexToTriangles.set(i0, [])
      if (!vertexToTriangles.has(i1)) vertexToTriangles.set(i1, [])
      if (!vertexToTriangles.has(i2)) vertexToTriangles.set(i2, [])

      vertexToTriangles.get(i0)!.push(triIdx)
      vertexToTriangles.get(i1)!.push(triIdx)
      vertexToTriangles.get(i2)!.push(triIdx)
    }

    for (const [v, triangles] of vertexToTriangles.entries()) {
      if (triangles.length === 0) continue

      // Build edge graph around this vertex
      const edgeGraph = new Map<number, Set<number>>()

      for (const triIdx of triangles) {
        const i = triIdx * 3
        const i0 = indices[i]!
        const i1 = indices[i + 1]!
        const i2 = indices[i + 2]!

        const others = [i0, i1, i2].filter((vi) => vi !== v)
        if (others.length !== 2) continue

        const [v1, v2] = others as [number, number]

        if (!edgeGraph.has(v1)) edgeGraph.set(v1, new Set())
        if (!edgeGraph.has(v2)) edgeGraph.set(v2, new Set())

        edgeGraph.get(v1)!.add(v2)
        edgeGraph.get(v2)!.add(v1)
      }

      if (edgeGraph.size === 0) continue

      // BFS to check connectivity
      const visited = new Set<number>()
      const startVertex = edgeGraph.keys().next().value as number
      const queue: number[] = [startVertex]
      let head = 0

      while (head < queue.length) {
        const current = queue[head++]!
        if (visited.has(current)) continue
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

      // Non-manifold if not all neighbors reachable
      if (visited.size !== edgeGraph.size) {
        nonManifoldVertexPositions.push(
          positions[v * 3]!,
          positions[v * 3 + 1]!,
          positions[v * 3 + 2]!
        )
      }
    }
  }

  // Extract self-intersection centroids
  const selfIntersectionCentroids: number[] = []

  if (diagnostics.selfIntersectionCount > 0) {
    // We need to re-run intersection detection to get the actual pairs
    // For now, we'll extract triangle centroids for intersecting pairs
    // This is expensive but only runs if there are intersections
    const intersectingPairs = findIntersectingTrianglePairs(positions, indices)

    for (const [t1, t2] of intersectingPairs) {
      // Get centroid of intersection region (average of both triangle centroids)
      const i1 = t1 * 3
      const i2 = t2 * 3

      const ax1 = positions[indices[i1]! * 3]!
      const ay1 = positions[indices[i1]! * 3 + 1]!
      const az1 = positions[indices[i1]! * 3 + 2]!
      const bx1 = positions[indices[i1 + 1]! * 3]!
      const by1 = positions[indices[i1 + 1]! * 3 + 1]!
      const bz1 = positions[indices[i1 + 1]! * 3 + 2]!
      const cx1 = positions[indices[i1 + 2]! * 3]!
      const cy1 = positions[indices[i1 + 2]! * 3 + 1]!
      const cz1 = positions[indices[i1 + 2]! * 3 + 2]!

      const ax2 = positions[indices[i2]! * 3]!
      const ay2 = positions[indices[i2]! * 3 + 1]!
      const az2 = positions[indices[i2]! * 3 + 2]!
      const bx2 = positions[indices[i2 + 1]! * 3]!
      const by2 = positions[indices[i2 + 1]! * 3 + 1]!
      const bz2 = positions[indices[i2 + 1]! * 3 + 2]!
      const cx2 = positions[indices[i2 + 2]! * 3]!
      const cy2 = positions[indices[i2 + 2]! * 3 + 1]!
      const cz2 = positions[indices[i2 + 2]! * 3 + 2]!

      // Average of both centroids
      const centroidX = (ax1 + bx1 + cx1 + ax2 + bx2 + cx2) / 6
      const centroidY = (ay1 + by1 + cy1 + ay2 + by2 + cy2) / 6
      const centroidZ = (az1 + bz1 + cz1 + az2 + bz2 + cz2) / 6

      selfIntersectionCentroids.push(centroidX, centroidY, centroidZ)
    }
  }

  // Extract T-junction vertices
  const tJunctionVertexPositions: number[] = []

  if (diagnostics.tJunctionCount > 0) {
    const tJunctionVertices = findTJunctionVertices(
      positions,
      indices,
      diagnostics
    )
    for (const v of tJunctionVertices) {
      tJunctionVertexPositions.push(
        positions[v * 3]!,
        positions[v * 3 + 1]!,
        positions[v * 3 + 2]!
      )
    }
  }

  return {
    boundaryEdges: new Float32Array(boundaryEdgePositions),
    nonManifoldEdges: new Float32Array(nonManifoldEdgePositions),
    nonManifoldVertices: new Float32Array(nonManifoldVertexPositions),
    selfIntersectionCentroids: new Float32Array(selfIntersectionCentroids),
    tJunctionVertices: new Float32Array(tJunctionVertexPositions),
  }
}

/**
 * Find intersecting triangle pairs (simplified version for geometry extraction).
 * Returns array of [tri1Index, tri2Index] pairs.
 */
function findIntersectingTrianglePairs(
  positions: Float32Array,
  indices: Uint16Array | Uint32Array | number[]
): [number, number][] {
  const triangleCount = indices.length / 3
  const pairs: [number, number][] = []

  // Simple spatial hash for acceleration
  const cellSize = estimateCellSize(positions, triangleCount)
  const grid = new Map<string, number[]>()

  // Compute triangle bounds and insert into grid
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

    const bounds = {
      minX: Math.min(x0, x1, x2),
      minY: Math.min(y0, y1, y2),
      minZ: Math.min(z0, z1, z2),
      maxX: Math.max(x0, x1, x2),
      maxY: Math.max(y0, y1, y2),
      maxZ: Math.max(z0, z1, z2),
    }
    triBounds.push(bounds)

    // Insert into grid
    const minCX = Math.floor(bounds.minX / cellSize)
    const minCY = Math.floor(bounds.minY / cellSize)
    const minCZ = Math.floor(bounds.minZ / cellSize)
    const maxCX = Math.floor(bounds.maxX / cellSize)
    const maxCY = Math.floor(bounds.maxY / cellSize)
    const maxCZ = Math.floor(bounds.maxZ / cellSize)

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        for (let cz = minCZ; cz <= maxCZ; cz++) {
          const key = `${cx},${cy},${cz}`
          if (!grid.has(key)) grid.set(key, [])
          grid.get(key)!.push(t)
        }
      }
    }
  }

  // Check pairs
  const checked = new Set<string>()

  for (let t1 = 0; t1 < triangleCount; t1++) {
    const bounds1 = triBounds[t1]!

    const minCX = Math.floor(bounds1.minX / cellSize)
    const minCY = Math.floor(bounds1.minY / cellSize)
    const minCZ = Math.floor(bounds1.minZ / cellSize)
    const maxCX = Math.floor(bounds1.maxX / cellSize)
    const maxCY = Math.floor(bounds1.maxY / cellSize)
    const maxCZ = Math.floor(bounds1.maxZ / cellSize)

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        for (let cz = minCZ; cz <= maxCZ; cz++) {
          const key = `${cx},${cy},${cz}`
          const candidates = grid.get(key)
          if (!candidates) continue

          for (const t2 of candidates) {
            if (t2 <= t1) continue

            const pairKey = `${t1},${t2}`
            if (checked.has(pairKey)) continue
            checked.add(pairKey)

            // Check if adjacent (share 2+ vertices)
            const i0a = indices[t1 * 3]!,
              i1a = indices[t1 * 3 + 1]!,
              i2a = indices[t1 * 3 + 2]!
            const i0b = indices[t2 * 3]!,
              i1b = indices[t2 * 3 + 1]!,
              i2b = indices[t2 * 3 + 2]!

            const setA = new Set([i0a, i1a, i2a])
            let shared = 0
            if (setA.has(i0b)) shared++
            if (setA.has(i1b)) shared++
            if (setA.has(i2b)) shared++

            if (shared >= 2) continue // Adjacent, skip

            // Simple intersection test
            if (trianglesIntersectSimple(positions, indices, t1, t2)) {
              pairs.push([t1, t2])
            }
          }
        }
      }
    }
  }

  return pairs
}

/**
 * Simplified triangle intersection test.
 */
function trianglesIntersectSimple(
  positions: Float32Array,
  indices: Uint16Array | Uint32Array | number[],
  t1: number,
  t2: number
): boolean {
  const i1 = t1 * 3
  const i2 = t2 * 3

  const ax1 = positions[indices[i1]! * 3]!
  const ay1 = positions[indices[i1]! * 3 + 1]!
  const az1 = positions[indices[i1]! * 3 + 2]!
  const bx1 = positions[indices[i1 + 1]! * 3]!
  const by1 = positions[indices[i1 + 1]! * 3 + 1]!
  const bz1 = positions[indices[i1 + 1]! * 3 + 2]!
  const cx1 = positions[indices[i1 + 2]! * 3]!
  const cy1 = positions[indices[i1 + 2]! * 3 + 1]!
  const cz1 = positions[indices[i1 + 2]! * 3 + 2]!

  const ax2 = positions[indices[i2]! * 3]!
  const ay2 = positions[indices[i2]! * 3 + 1]!
  const az2 = positions[indices[i2]! * 3 + 2]!
  const bx2 = positions[indices[i2 + 1]! * 3]!
  const by2 = positions[indices[i2 + 1]! * 3 + 1]!
  const bz2 = positions[indices[i2 + 1]! * 3 + 2]!
  const cx2 = positions[indices[i2 + 2]! * 3]!
  const cy2 = positions[indices[i2 + 2]! * 3 + 1]!
  const cz2 = positions[indices[i2 + 2]! * 3 + 2]!

  // Compute normals
  const normalX1 = (by1 - ay1) * (cz1 - az1) - (bz1 - az1) * (cy1 - ay1)
  const normalY1 = (bz1 - az1) * (cx1 - ax1) - (bx1 - ax1) * (cz1 - az1)
  const normalZ1 = (bx1 - ax1) * (cy1 - ay1) - (by1 - ay1) * (cx1 - ax1)

  const d1 = normalX1 * ax1 + normalY1 * ay1 + normalZ1 * az1
  const dist2a = normalX1 * ax2 + normalY1 * ay2 + normalZ1 * az2 - d1
  const dist2b = normalX1 * bx2 + normalY1 * by2 + normalZ1 * bz2 - d1
  const dist2c = normalX1 * cx2 + normalY1 * cy2 + normalZ1 * cz2 - d1

  if (dist2a > 1e-8 && dist2b > 1e-8 && dist2c > 1e-8) return false
  if (dist2a < -1e-8 && dist2b < -1e-8 && dist2c < -1e-8) return false

  const normalX2 = (by2 - ay2) * (cz2 - az2) - (bz2 - az2) * (cy2 - ay2)
  const normalY2 = (bz2 - az2) * (cx2 - ax2) - (bx2 - ax2) * (cz2 - az2)
  const normalZ2 = (bx2 - ax2) * (cy2 - ay2) - (by2 - ay2) * (cx2 - ax2)

  const d2 = normalX2 * ax2 + normalY2 * ay2 + normalZ2 * az2
  const dist1a = normalX2 * ax1 + normalY2 * ay1 + normalZ2 * az1 - d2
  const dist1b = normalX2 * bx1 + normalY2 * by1 + normalZ2 * bz1 - d2
  const dist1c = normalX2 * cx1 + normalY2 * cy1 + normalZ2 * cz1 - d2

  if (dist1a > 1e-8 && dist1b > 1e-8 && dist1c > 1e-8) return false
  if (dist1a < -1e-8 && dist1b < -1e-8 && dist1c < -1e-8) return false

  // Both triangles straddle each other's planes - likely intersecting
  return true
}

/**
 * Find T-junction vertices.
 */
function findTJunctionVertices(
  positions: Float32Array,
  indices: Uint16Array | Uint32Array | number[],
  diagnostics: MeshDiagnostics
): number[] {
  const vertexCount = positions.length / 3
  const triangleCount = indices.length / 3
  const tJunctionVerts: number[] = []

  const diagonal = diagnostics.boundingBox?.diagonal ?? 1
  const tolerance = diagonal * 1e-4
  const toleranceSq = tolerance * tolerance

  // Build vertex-to-triangles
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

  // Build edge list
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
        edges.push({
          v0: va,
          v1: vb,
          x0: positions[va * 3]!,
          y0: positions[va * 3 + 1]!,
          z0: positions[va * 3 + 2]!,
          x1: positions[vb * 3]!,
          y1: positions[vb * 3 + 1]!,
          z1: positions[vb * 3 + 2]!,
        })
      }
    }
  }

  // Check each vertex against edges
  for (let v = 0; v < vertexCount; v++) {
    const vx = positions[v * 3]!
    const vy = positions[v * 3 + 1]!
    const vz = positions[v * 3 + 2]!
    const adjacentTris = vertexTriangles.get(v)

    for (const edge of edges) {
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
      const dx = vx - closestX
      const dy = vy - closestY
      const dz = vz - closestZ
      const distSq = dx * dx + dy * dy + dz * dz

      if (distSq < toleranceSq) {
        // Check if connected
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
          tJunctionVerts.push(v)
          break
        }
      }
    }
  }

  return tJunctionVerts
}

/**
 * Estimate good cell size for spatial hashing.
 */
function estimateCellSize(
  positions: Float32Array,
  triangleCount: number
): number {
  const vertexCount = positions.length / 3

  if (vertexCount === 0) return 1

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

  const avgEdgeLength = diagonal / Math.sqrt(triangleCount / 2)
  return Math.max(avgEdgeLength * 2, 1e-6)
}
