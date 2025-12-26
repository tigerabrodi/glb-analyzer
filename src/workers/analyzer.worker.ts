/**
 * Web Worker for GLB analysis.
 *
 * Runs mesh diagnostics off the main thread to keep UI responsive.
 * Uses gltf-transform's WebIO for browser-compatible GLB parsing.
 */

import { WebIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'

import { computeDiagnosticsFromDocument } from '../lib/mesh-diagnostics'
import { extractProblemGeometry } from '../lib/problem-geometry'
import type {
  AnalysisResult,
  WorkerRequest,
  WorkerResponse,
} from '../lib/types'

// Initialize the gltf-transform IO with all extensions
let io: WebIO | null = null

async function getIO(): Promise<WebIO> {
  if (!io) {
    // Wait for meshopt decoder to be ready
    await MeshoptDecoder.ready

    io = new WebIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
    })
  }
  return io
}

/**
 * Post a progress update to the main thread.
 */
function postProgress(
  id: number,
  stage: 'parsing' | 'analyzing' | 'extracting'
): void {
  const response: WorkerResponse = { id, type: 'progress', stage }
  self.postMessage(response)
}

/**
 * Post an error to the main thread.
 */
function postError(id: number, message: string): void {
  const response: WorkerResponse = { id, type: 'error', message }
  self.postMessage(response)
}

/**
 * Post the analysis result to the main thread.
 */
function postResult(id: number, result: AnalysisResult): void {
  const response: WorkerResponse = { id, type: 'result', result }
  self.postMessage(response)
}

/**
 * Handle an analyze request.
 */
async function handleAnalyze(
  id: number,
  arrayBuffer: ArrayBuffer
): Promise<void> {
  const startTime = performance.now()

  try {
    // Stage 1: Parse the GLB
    postProgress(id, 'parsing')

    const webIO = await getIO()
    const document = await webIO.readBinary(new Uint8Array(arrayBuffer))

    // Stage 2: Compute diagnostics
    postProgress(id, 'analyzing')

    const diagnostics = computeDiagnosticsFromDocument(document)

    // Stage 3: Extract problem geometry for visualization
    postProgress(id, 'extracting')

    // Get raw mesh data for problem geometry extraction
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

    const problemGeometry = extractProblemGeometry(
      new Float32Array(allPositions),
      allIndices,
      diagnostics
    )

    const durationMs = Math.round(performance.now() - startTime)
    const fileSizeKb = Math.round(arrayBuffer.byteLength / 1024)

    const result: AnalysisResult = {
      diagnostics,
      problemGeometry,
      fileSizeKb,
      durationMs,
    }

    postResult(id, result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error during analysis'
    postError(id, message)
  }
}

/**
 * Handle incoming messages from the main thread.
 */
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, type, payload } = event.data

  if (type === 'analyze') {
    await handleAnalyze(id, payload.arrayBuffer)
  }
}

// Signal that the worker is ready
self.postMessage({ type: 'ready' })
