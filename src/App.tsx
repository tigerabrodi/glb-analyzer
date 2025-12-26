import { useState } from 'react';
import { useGlbAnalyzer } from './hooks';
import {
  DropZone,
  AnalysisPanel,
  OverlayToggle,
  ProgressIndicator,
  ModelViewer,
  defaultOverlayVisibility,
} from './components';
import type { OverlayVisibility } from './lib/types';

function App() {
  const { state, analyzeFile, analyzeUrl, reset, glbObjectUrl } = useGlbAnalyzer();
  const [overlayVisibility, setOverlayVisibility] = useState<OverlayVisibility>(defaultOverlayVisibility);

  const isLoading = state.status === 'loading' || state.status === 'parsing' ||
                    state.status === 'analyzing' || state.status === 'extracting';
  const hasResult = state.status === 'done' && state.result !== null;
  const progressStage = ['parsing', 'analyzing', 'extracting'].includes(state.status)
    ? state.status as 'parsing' | 'analyzing' | 'extracting'
    : null;

  // Compute overlay counts from problem geometry
  const overlayCounts = state.result?.problemGeometry ? {
    boundaryEdges: state.result.problemGeometry.boundaryEdges.length / 6,
    nonManifoldEdges: state.result.problemGeometry.nonManifoldEdges.length / 6,
    nonManifoldVertices: state.result.problemGeometry.nonManifoldVertices.length / 3,
    selfIntersections: state.result.problemGeometry.selfIntersectionCentroids.length / 3,
    tJunctions: state.result.problemGeometry.tJunctionVertices.length / 3,
  } : {
    boundaryEdges: 0,
    nonManifoldEdges: 0,
    nonManifoldVertices: 0,
    selfIntersections: 0,
    tJunctions: 0,
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg" />
            <h1 className="text-xl font-semibold">GLB Analyzer</h1>
          </div>
          {hasResult && (
            <button
              onClick={reset}
              className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Analyze Another
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Initial State - Show DropZone */}
        {state.status === 'idle' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <DropZone
              onFile={analyzeFile}
              onUrl={analyzeUrl}
              isLoading={false}
              error={null}
            />
          </div>
        )}

        {/* Loading State */}
        {isLoading && !hasResult && (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <ProgressIndicator stage={progressStage} />
          </div>
        )}

        {/* Error State */}
        {state.status === 'error' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <DropZone
              onFile={analyzeFile}
              onUrl={analyzeUrl}
              isLoading={false}
              error={state.error}
            />
          </div>
        )}

        {/* Results State */}
        {hasResult && state.result && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 3D Viewer */}
            <div className="lg:col-span-2 space-y-4">
              <div className="h-[500px] rounded-xl overflow-hidden border border-zinc-800">
                <ModelViewer
                  glbUrl={glbObjectUrl}
                  problemGeometry={state.result.problemGeometry}
                  overlayVisibility={overlayVisibility}
                />
              </div>
              <OverlayToggle
                visibility={overlayVisibility}
                onChange={setOverlayVisibility}
                counts={overlayCounts}
              />
            </div>

            {/* Analysis Panel */}
            <div className="lg:col-span-1">
              <AnalysisPanel
                diagnostics={state.result.diagnostics}
                fileSizeKb={state.result.fileSizeKb}
                durationMs={state.result.durationMs}
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-4 mt-auto">
        <div className="max-w-7xl mx-auto text-center text-zinc-500 text-sm">
          Fully client-side mesh analysis. Your files never leave your browser.
        </div>
      </footer>
    </div>
  );
}

export default App;
