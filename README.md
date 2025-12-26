# GLB Analyzer

Drop a GLB file, instantly see what's wrong with your mesh.

## What it does

- **Topology checks** - holes, non-manifold edges, pinch points
- **Quality metrics** - self-intersections, T-junctions, degenerate triangles
- **3D visualization** - see problems highlighted right on your model
- **Wireframe mode** - inspect the actual triangles
- **100% client-side** - your files never leave your browser

## Run it

```bash
bun install
bun run dev
```

## Build it

```bash
bun run build
```

## Test it

```bash
bun test
```

## Stack

- React + TypeScript + Vite
- Three.js + React Three Fiber
- gltf-transform for GLB parsing
- Tailwind CSS
- Web Workers for off-thread analysis

## How it works

1. You drop a GLB file (or paste a URL)
2. A web worker parses and analyzes the mesh
3. Results show up with a quality score and detailed breakdown
4. Toggle overlays to see exactly where problems are

That's it. No servers, no uploads, no nonsense.
