/**
 * GLB Test Fixture Generator
 * Generates minimal GLB files for testing mesh diagnostics.
 *
 * Usage: bun run src/test/fixtures/generate-fixtures.ts
 */

import { Document, NodeIO, Accessor, Primitive } from '@gltf-transform/core';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = __dirname;

/**
 * Helper to create a mesh from positions and indices
 */
function createMesh(
  doc: Document,
  name: string,
  positions: number[],
  indices: number[]
): void {
  const buffer = doc.createBuffer();

  const positionAccessor = doc.createAccessor()
    .setType(Accessor.Type.VEC3)
    .setArray(new Float32Array(positions))
    .setBuffer(buffer);

  const indexAccessor = doc.createAccessor()
    .setType(Accessor.Type.SCALAR)
    .setArray(new Uint32Array(indices))
    .setBuffer(buffer);

  const primitive = doc.createPrimitive()
    .setAttribute('POSITION', positionAccessor)
    .setIndices(indexAccessor)
    .setMode(Primitive.Mode.TRIANGLES);

  const mesh = doc.createMesh(name).addPrimitive(primitive);
  const node = doc.createNode(name).setMesh(mesh);
  const scene = doc.createScene().addChild(node);
  doc.getRoot().setDefaultScene(scene);
}

/**
 * 1. cube-watertight.glb - Perfect closed cube, no issues
 * A cube with 8 vertices and 12 triangles (2 per face)
 */
async function generateCubeWatertight(io: NodeIO): Promise<void> {
  const doc = new Document();

  // 8 vertices of a unit cube centered at origin
  const positions = [
    // Front face (z = 0.5)
    -0.5, -0.5,  0.5,  // 0
     0.5, -0.5,  0.5,  // 1
     0.5,  0.5,  0.5,  // 2
    -0.5,  0.5,  0.5,  // 3
    // Back face (z = -0.5)
    -0.5, -0.5, -0.5,  // 4
     0.5, -0.5, -0.5,  // 5
     0.5,  0.5, -0.5,  // 6
    -0.5,  0.5, -0.5,  // 7
  ];

  // 12 triangles with consistent CCW winding (outward-facing)
  const indices = [
    // Front face
    0, 1, 2,  0, 2, 3,
    // Back face
    4, 6, 5,  4, 7, 6,
    // Top face
    3, 2, 6,  3, 6, 7,
    // Bottom face
    0, 5, 1,  0, 4, 5,
    // Right face
    1, 5, 6,  1, 6, 2,
    // Left face
    0, 3, 7,  0, 7, 4,
  ];

  createMesh(doc, 'watertight-cube', positions, indices);
  await io.write(join(FIXTURES_DIR, 'cube-watertight.glb'), doc);
  console.log('Generated: cube-watertight.glb');
}

/**
 * 2. cube-open.glb - Cube missing one face (boundary edges)
 * Same as watertight cube but without the front face
 */
async function generateCubeOpen(io: NodeIO): Promise<void> {
  const doc = new Document();

  const positions = [
    -0.5, -0.5,  0.5,  // 0
     0.5, -0.5,  0.5,  // 1
     0.5,  0.5,  0.5,  // 2
    -0.5,  0.5,  0.5,  // 3
    -0.5, -0.5, -0.5,  // 4
     0.5, -0.5, -0.5,  // 5
     0.5,  0.5, -0.5,  // 6
    -0.5,  0.5, -0.5,  // 7
  ];

  // Missing front face - will create 4 boundary edges
  const indices = [
    // NO Front face - this creates boundary edges
    // Back face
    4, 6, 5,  4, 7, 6,
    // Top face
    3, 2, 6,  3, 6, 7,
    // Bottom face
    0, 5, 1,  0, 4, 5,
    // Right face
    1, 5, 6,  1, 6, 2,
    // Left face
    0, 3, 7,  0, 7, 4,
  ];

  createMesh(doc, 'open-cube', positions, indices);
  await io.write(join(FIXTURES_DIR, 'cube-open.glb'), doc);
  console.log('Generated: cube-open.glb');
}

/**
 * 3. bowtie.glb - Two triangles sharing only a vertex (non-manifold vertex/pinch point)
 * Classic bowtie configuration where triangles share a single vertex but no edge
 */
async function generateBowtie(io: NodeIO): Promise<void> {
  const doc = new Document();

  // Two triangles that share only vertex 2 (the center point)
  const positions = [
    // First triangle
    -1, 0, 0,    // 0
    0, 1, 0,     // 1
    0, 0, 0,     // 2 - shared vertex (pinch point)
    // Second triangle
    0, -1, 0,    // 3
    1, 0, 0,     // 4
  ];

  // Two triangles sharing only vertex 2
  const indices = [
    0, 1, 2,  // First triangle
    2, 3, 4,  // Second triangle (shares vertex 2 only)
  ];

  createMesh(doc, 'bowtie', positions, indices);
  await io.write(join(FIXTURES_DIR, 'bowtie.glb'), doc);
  console.log('Generated: bowtie.glb');
}

/**
 * 4. flipped-face.glb - Cube with one face having reversed winding
 * Same as watertight cube but with one face having CW instead of CCW winding
 */
async function generateFlippedFace(io: NodeIO): Promise<void> {
  const doc = new Document();

  const positions = [
    -0.5, -0.5,  0.5,  // 0
     0.5, -0.5,  0.5,  // 1
     0.5,  0.5,  0.5,  // 2
    -0.5,  0.5,  0.5,  // 3
    -0.5, -0.5, -0.5,  // 4
     0.5, -0.5, -0.5,  // 5
     0.5,  0.5, -0.5,  // 6
    -0.5,  0.5, -0.5,  // 7
  ];

  // Front face has FLIPPED winding (CW instead of CCW)
  // This will cause 4 edges to have inconsistent winding
  const indices = [
    // Front face - FLIPPED WINDING
    0, 2, 1,  0, 3, 2,  // Reversed from: 0,1,2 and 0,2,3
    // Back face - normal
    4, 6, 5,  4, 7, 6,
    // Top face - normal
    3, 2, 6,  3, 6, 7,
    // Bottom face - normal
    0, 5, 1,  0, 4, 5,
    // Right face - normal
    1, 5, 6,  1, 6, 2,
    // Left face - normal
    0, 3, 7,  0, 7, 4,
  ];

  createMesh(doc, 'flipped-face-cube', positions, indices);
  await io.write(join(FIXTURES_DIR, 'flipped-face.glb'), doc);
  console.log('Generated: flipped-face.glb');
}

/**
 * 5. duplicate-vertices.glb - Geometry with coincident vertices
 * Two triangles that should share an edge but have duplicate vertices instead
 */
async function generateDuplicateVertices(io: NodeIO): Promise<void> {
  const doc = new Document();

  // Two triangles with duplicate vertices at positions 2,3 and 5,4
  // Vertices 2 and 4 are at the same position
  // Vertices 3 and 5 are at the same position
  const positions = [
    // First triangle
    0, 0, 0,     // 0
    1, 0, 0,     // 1
    1, 1, 0,     // 2 - same position as vertex 4
    0, 1, 0,     // 3 - same position as vertex 5
    // Second triangle (duplicated edge vertices)
    1, 1, 0,     // 4 - duplicate of vertex 2
    0, 1, 0,     // 5 - duplicate of vertex 3
    0, 2, 0,     // 6
    1, 2, 0,     // 7
  ];

  // Two quads (4 triangles) with duplicate vertices on shared edges
  const indices = [
    // First quad
    0, 1, 2,
    0, 2, 3,
    // Second quad - uses different indices for same positions
    4, 7, 6,
    4, 6, 5,
  ];

  createMesh(doc, 'duplicate-vertices', positions, indices);
  await io.write(join(FIXTURES_DIR, 'duplicate-vertices.glb'), doc);
  console.log('Generated: duplicate-vertices.glb');
}

/**
 * 6. self-intersecting.glb - Two intersecting triangles
 * Two triangles that cross through each other
 */
async function generateSelfIntersecting(io: NodeIO): Promise<void> {
  const doc = new Document();

  // Two triangles that intersect in space
  // First triangle is in XY plane
  // Second triangle crosses through it at an angle
  const positions = [
    // First triangle - lies in XY plane at z=0
    -1, -1, 0,   // 0
     1, -1, 0,   // 1
     0,  1, 0,   // 2
    // Second triangle - crosses through first
    0, 0, -1,    // 3
    0, 0,  1,    // 4
    1, 0.5, 0,   // 5
  ];

  const indices = [
    0, 1, 2,  // First triangle
    3, 4, 5,  // Second triangle (intersects first)
  ];

  createMesh(doc, 'self-intersecting', positions, indices);
  await io.write(join(FIXTURES_DIR, 'self-intersecting.glb'), doc);
  console.log('Generated: self-intersecting.glb');
}

/**
 * Main function to generate all fixtures
 */
async function main(): Promise<void> {
  console.log('Generating GLB test fixtures...\n');

  const io = new NodeIO();

  await generateCubeWatertight(io);
  await generateCubeOpen(io);
  await generateBowtie(io);
  await generateFlippedFace(io);
  await generateDuplicateVertices(io);
  await generateSelfIntersecting(io);

  console.log('\nAll fixtures generated successfully!');
}

main().catch(console.error);
