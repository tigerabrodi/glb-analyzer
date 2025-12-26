import { useCallback, useEffect, useRef, useState } from 'react'
import type { AnalyzerState, WorkerRequest, WorkerResponse } from '../lib/types'

interface UseGlbAnalyzerReturn {
  state: AnalyzerState
  analyzeFile: (file: File) => Promise<void>
  analyzeUrl: (url: string) => Promise<void>
  reset: () => void
  glbObjectUrl: string | null // For the 3D viewer
}

export function useGlbAnalyzer(): UseGlbAnalyzerReturn {
  // State management
  const [state, setState] = useState<AnalyzerState>({
    status: 'idle',
    result: null,
    error: null,
    modelUrl: null,
  })

  // Keep track of object URLs for cleanup
  const objectUrlRef = useRef<string | null>(null)
  const [glbObjectUrl, setGlbObjectUrl] = useState<string | null>(null)

  // Worker instance - create lazily
  const workerRef = useRef<Worker | null>(null)
  const requestIdRef = useRef(0)

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
    }
  }, [])

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      // Create worker using Vite's worker syntax
      workerRef.current = new Worker(
        new URL('../workers/analyzer.worker.ts', import.meta.url),
        { type: 'module' }
      )

      workerRef.current.onmessage = (
        event: MessageEvent<WorkerResponse | { type: 'ready' }>
      ) => {
        const response = event.data

        if (response.type === 'ready') {
          console.log('Worker ready')
          return
        }

        if (response.type === 'progress') {
          setState((prev) => ({
            ...prev,
            status: response.stage,
          }))
        } else if (response.type === 'result') {
          setState((prev) => ({
            ...prev,
            status: 'done',
            result: response.result,
            error: null,
          }))
        } else if (response.type === 'error') {
          setState((prev) => ({
            ...prev,
            status: 'error',
            result: null,
            error: response.message,
          }))
        }
      }
    }
    return workerRef.current
  }, [])

  const analyzeFile = useCallback(
    async (file: File) => {
      // Cleanup previous object URL
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }

      // Create new object URL for the 3D viewer
      const url = URL.createObjectURL(file)
      objectUrlRef.current = url
      setGlbObjectUrl(url)

      setState({
        status: 'loading',
        result: null,
        error: null,
        modelUrl: url,
      })

      try {
        const arrayBuffer = await file.arrayBuffer()
        const worker = getWorker()
        const id = ++requestIdRef.current

        worker.postMessage(
          {
            id,
            type: 'analyze',
            payload: { arrayBuffer, fileName: file.name },
          } satisfies WorkerRequest,
          [arrayBuffer]
        )
      } catch (error) {
        setState({
          status: 'error',
          result: null,
          error: error instanceof Error ? error.message : 'Failed to read file',
          modelUrl: null,
        })
      }
    },
    [getWorker]
  )

  const analyzeUrl = useCallback(
    async (url: string) => {
      // Cleanup previous object URL
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }

      setState({
        status: 'loading',
        result: null,
        error: null,
        modelUrl: null,
      })

      try {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(
            `Failed to fetch: ${response.status} ${response.statusText}`
          )
        }

        const arrayBuffer = await response.arrayBuffer()

        // Create object URL from fetched data for the viewer
        const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' })
        const objectUrl = URL.createObjectURL(blob)
        objectUrlRef.current = objectUrl
        setGlbObjectUrl(objectUrl)

        setState((prev) => ({
          ...prev,
          modelUrl: objectUrl,
        }))

        const worker = getWorker()
        const id = ++requestIdRef.current

        // Extract filename from URL
        const fileName = url.split('/').pop() || 'model.glb'

        worker.postMessage(
          {
            id,
            type: 'analyze',
            payload: { arrayBuffer, fileName },
          } satisfies WorkerRequest,
          [arrayBuffer]
        )
      } catch (error) {
        setState({
          status: 'error',
          result: null,
          error: error instanceof Error ? error.message : 'Failed to fetch URL',
          modelUrl: null,
        })
      }
    },
    [getWorker]
  )

  const reset = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setGlbObjectUrl(null)
    setState({
      status: 'idle',
      result: null,
      error: null,
      modelUrl: null,
    })
  }, [])

  return {
    state,
    analyzeFile,
    analyzeUrl,
    reset,
    glbObjectUrl,
  }
}
