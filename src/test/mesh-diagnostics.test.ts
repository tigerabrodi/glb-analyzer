/**
 * Mesh Diagnostics Tests
 *
 * Tests the mesh diagnostics functionality using generated GLB fixtures.
 * Each fixture is designed to trigger specific diagnostic conditions.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { NodeIO } from '@gltf-transform/core';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { computeDiagnosticsFromDocument } from '../lib/mesh-diagnostics';
import type { MeshDiagnostics } from '../lib/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures');

let io: NodeIO;

// Cache for loaded documents
const diagnosticsCache: Map<string, MeshDiagnostics> = new Map();

async function loadDiagnostics(filename: string): Promise<MeshDiagnostics> {
  const cached = diagnosticsCache.get(filename);
  if (cached) return cached;

  const filepath = join(FIXTURES_DIR, filename);
  const doc = await io.read(filepath);
  const diagnostics = computeDiagnosticsFromDocument(doc);
  diagnosticsCache.set(filename, diagnostics);
  return diagnostics;
}

beforeAll(() => {
  io = new NodeIO();
});

describe('mesh-diagnostics', () => {
  describe('cube-watertight.glb', () => {
    test('should have no boundary edges (watertight)', async () => {
      const diag = await loadDiagnostics('cube-watertight.glb');
      expect(diag.boundaryEdgeCount).toBe(0);
      expect(diag.isWatertight).toBe(true);
    });

    test('should be manifold (no non-manifold edges)', async () => {
      const diag = await loadDiagnostics('cube-watertight.glb');
      expect(diag.nonManifoldEdgeCount).toBe(0);
      expect(diag.isManifold).toBe(true);
    });

    test('should have no non-manifold vertices', async () => {
      const diag = await loadDiagnostics('cube-watertight.glb');
      expect(diag.nonManifoldVertexCount).toBe(0);
      expect(diag.hasNonManifoldVertices).toBe(false);
    });

    test('should have consistent winding', async () => {
      const diag = await loadDiagnostics('cube-watertight.glb');
      expect(diag.windingInconsistentEdgeCount).toBe(0);
      expect(diag.hasConsistentWinding).toBe(true);
    });

    test('should have correct geometry counts', async () => {
      const diag = await loadDiagnostics('cube-watertight.glb');
      expect(diag.vertexCount).toBe(8);
      expect(diag.triangleCount).toBe(12);
      // Cube has 18 edges: 12 face edges + 6 internal shared edges = 18 unique edges
      expect(diag.edgeCount).toBe(18);
    });

    test('should be a single connected component', async () => {
      const diag = await loadDiagnostics('cube-watertight.glb');
      expect(diag.connectedComponents).toBe(1);
    });

    test('should have no degenerate triangles', async () => {
      const diag = await loadDiagnostics('cube-watertight.glb');
      expect(diag.degenerateTriangleCount).toBe(0);
    });

    test('should have no self-intersections', async () => {
      const diag = await loadDiagnostics('cube-watertight.glb');
      expect(diag.selfIntersectionCount).toBe(0);
    });
  });

  describe('cube-open.glb', () => {
    test('should have boundary edges (not watertight)', async () => {
      const diag = await loadDiagnostics('cube-open.glb');
      // Missing front face creates 4 boundary edges
      expect(diag.boundaryEdgeCount).toBe(4);
      expect(diag.isWatertight).toBe(false);
    });

    test('should still be manifold', async () => {
      const diag = await loadDiagnostics('cube-open.glb');
      expect(diag.nonManifoldEdgeCount).toBe(0);
      expect(diag.isManifold).toBe(true);
    });

    test('should have consistent winding', async () => {
      const diag = await loadDiagnostics('cube-open.glb');
      expect(diag.hasConsistentWinding).toBe(true);
    });

    test('should have 10 triangles (12 - 2 for missing face)', async () => {
      const diag = await loadDiagnostics('cube-open.glb');
      expect(diag.triangleCount).toBe(10);
    });
  });

  describe('bowtie.glb', () => {
    test('should detect non-manifold vertex (pinch point)', async () => {
      const diag = await loadDiagnostics('bowtie.glb');
      // Vertex 2 is shared by two triangles with no shared edge = pinch point
      expect(diag.nonManifoldVertexCount).toBeGreaterThan(0);
      expect(diag.hasNonManifoldVertices).toBe(true);
    });

    test('should have 2 triangles', async () => {
      const diag = await loadDiagnostics('bowtie.glb');
      expect(diag.triangleCount).toBe(2);
    });

    test('should have boundary edges (open mesh)', async () => {
      const diag = await loadDiagnostics('bowtie.glb');
      // All edges are boundary edges since no edges are shared
      expect(diag.boundaryEdgeCount).toBe(6); // 3 edges per triangle x 2
      expect(diag.isWatertight).toBe(false);
    });
  });

  describe('flipped-face.glb', () => {
    test('should detect inconsistent winding', async () => {
      const diag = await loadDiagnostics('flipped-face.glb');
      // Flipped front face creates inconsistent winding on shared edges
      expect(diag.windingInconsistentEdgeCount).toBeGreaterThan(0);
      expect(diag.hasConsistentWinding).toBe(false);
    });

    test('should still be watertight', async () => {
      const diag = await loadDiagnostics('flipped-face.glb');
      expect(diag.boundaryEdgeCount).toBe(0);
      expect(diag.isWatertight).toBe(true);
    });

    test('should be manifold', async () => {
      const diag = await loadDiagnostics('flipped-face.glb');
      expect(diag.nonManifoldEdgeCount).toBe(0);
      expect(diag.isManifold).toBe(true);
    });
  });

  describe('duplicate-vertices.glb', () => {
    test('should detect duplicate vertices', async () => {
      const diag = await loadDiagnostics('duplicate-vertices.glb');
      // Vertices 2,4 and 3,5 are at same positions
      expect(diag.duplicateVertexCount).toBeGreaterThan(0);
    });

    test('should have more vertices than unique positions', async () => {
      const diag = await loadDiagnostics('duplicate-vertices.glb');
      // 8 vertices but only 6 unique positions
      expect(diag.vertexCount).toBe(8);
    });

    test('should have boundary edges (disconnected quads)', async () => {
      const diag = await loadDiagnostics('duplicate-vertices.glb');
      // The duplicate vertices prevent edge sharing
      expect(diag.boundaryEdgeCount).toBeGreaterThan(0);
    });
  });

  describe('self-intersecting.glb', () => {
    test('should detect self-intersections', async () => {
      const diag = await loadDiagnostics('self-intersecting.glb');
      // Two triangles crossing each other
      expect(diag.selfIntersectionCount).toBeGreaterThan(0);
    });

    test('should have 2 triangles', async () => {
      const diag = await loadDiagnostics('self-intersecting.glb');
      expect(diag.triangleCount).toBe(2);
    });

    test('should have boundary edges (separate triangles)', async () => {
      const diag = await loadDiagnostics('self-intersecting.glb');
      // 6 boundary edges (3 per triangle, no shared edges)
      expect(diag.boundaryEdgeCount).toBe(6);
    });

    test('should have 2 connected components', async () => {
      const diag = await loadDiagnostics('self-intersecting.glb');
      // Two separate triangles = 2 components
      expect(diag.connectedComponents).toBe(2);
    });
  });

  describe('edge cases and general diagnostics', () => {
    test('all fixtures should have valid bounding boxes', async () => {
      const fixtures = [
        'cube-watertight.glb',
        'cube-open.glb',
        'bowtie.glb',
        'flipped-face.glb',
        'duplicate-vertices.glb',
        'self-intersecting.glb',
      ];

      for (const fixture of fixtures) {
        const diag = await loadDiagnostics(fixture);
        expect(diag.boundingBox).not.toBeNull();
        expect(diag.boundingBox!.diagonal).toBeGreaterThan(0);
      }
    });

    test('all fixtures should have edge length stats', async () => {
      const fixtures = [
        'cube-watertight.glb',
        'cube-open.glb',
        'bowtie.glb',
        'flipped-face.glb',
        'duplicate-vertices.glb',
        'self-intersecting.glb',
      ];

      for (const fixture of fixtures) {
        const diag = await loadDiagnostics(fixture);
        expect(diag.edgeLengthStats).not.toBeNull();
        expect(diag.edgeLengthStats!.min).toBeGreaterThan(0);
        expect(diag.edgeLengthStats!.max).toBeGreaterThanOrEqual(diag.edgeLengthStats!.min);
      }
    });

    test('all fixtures should have no isolated vertices', async () => {
      const fixtures = [
        'cube-watertight.glb',
        'cube-open.glb',
        'bowtie.glb',
        'flipped-face.glb',
        'duplicate-vertices.glb',
        'self-intersecting.glb',
      ];

      for (const fixture of fixtures) {
        const diag = await loadDiagnostics(fixture);
        expect(diag.isolatedVertexCount).toBe(0);
      }
    });
  });
});
