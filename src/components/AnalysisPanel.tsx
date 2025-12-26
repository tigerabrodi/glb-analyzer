import { useState } from 'react';
import { ChevronDown, ChevronRight, Download, Clock, HardDrive } from 'lucide-react';
import type { MeshDiagnostics } from '../lib/types';
import { StatRow } from './StatRow';

export interface AnalysisPanelProps {
  diagnostics: MeshDiagnostics;
  fileSizeKb: number;
  durationMs: number;
}

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ title, defaultOpen = true, children }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
      >
        <span className="text-zinc-200 font-medium text-sm">{title}</span>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-zinc-400" />
        )}
      </button>
      {isOpen && <div className="p-2">{children}</div>}
    </div>
  );
}

function getQualityScore(diagnostics: MeshDiagnostics): { score: number; label: string; color: string } {
  let score = 100;

  // Deduct for topology issues
  if (!diagnostics.isWatertight) score -= 15;
  if (!diagnostics.isManifold) score -= 20;
  if (diagnostics.hasNonManifoldVertices) score -= 10;
  if (!diagnostics.hasConsistentWinding && !diagnostics.windingCheckSkipped) score -= 10;

  // Deduct for quality issues
  if (diagnostics.degenerateTriangleCount > 0) score -= Math.min(15, diagnostics.degenerateTriangleCount);
  if (diagnostics.selfIntersectionCount > 0) score -= Math.min(20, diagnostics.selfIntersectionCount * 2);
  if (diagnostics.tJunctionCount > 0) score -= Math.min(10, diagnostics.tJunctionCount);
  if (diagnostics.duplicateVertexCount > 0) score -= Math.min(5, Math.floor(diagnostics.duplicateVertexCount / 100));
  if (diagnostics.tinyTriangleCount > 0) score -= Math.min(5, Math.floor(diagnostics.tinyTriangleCount / 10));
  if (diagnostics.needleTriangleCount > 0) score -= Math.min(5, Math.floor(diagnostics.needleTriangleCount / 10));

  score = Math.max(0, Math.min(100, score));

  if (score >= 90) return { score, label: 'Excellent', color: 'text-emerald-400' };
  if (score >= 70) return { score, label: 'Good', color: 'text-blue-400' };
  if (score >= 50) return { score, label: 'Fair', color: 'text-amber-400' };
  return { score, label: 'Poor', color: 'text-red-400' };
}

function getSeverity(value: number, warningThreshold: number = 1, errorThreshold: number = 10): 'good' | 'warning' | 'error' {
  if (value >= errorThreshold) return 'error';
  if (value >= warningThreshold) return 'warning';
  return 'good';
}

export function AnalysisPanel({ diagnostics, fileSizeKb, durationMs }: AnalysisPanelProps) {
  const quality = getQualityScore(diagnostics);

  const handleExport = () => {
    // Placeholder for export functionality
    const data = {
      diagnostics,
      fileSizeKb,
      durationMs,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mesh-analysis.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-md bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-100">Mesh Analysis</h2>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        {/* Quality Score */}
        <div className="flex items-center gap-4 p-3 bg-zinc-800/50 rounded-lg">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-zinc-700"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeDasharray={`${(quality.score / 100) * 176} 176`}
                strokeLinecap="round"
                className={quality.color}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-lg font-bold ${quality.color}`}>{quality.score}</span>
            </div>
          </div>
          <div>
            <p className={`text-xl font-semibold ${quality.color}`}>{quality.label}</p>
            <p className="text-zinc-500 text-sm">Quality Score</p>
          </div>
        </div>

        {/* Meta Info */}
        <div className="flex gap-4 mt-3 text-sm text-zinc-500">
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5" />
            <span>{fileSizeKb.toLocaleString()} KB</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>{durationMs.toLocaleString()} ms</span>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto">
        {/* Basic Counts */}
        <Section title="Geometry" defaultOpen={true}>
          <StatRow label="Vertices" value={diagnostics.vertexCount} />
          <StatRow label="Triangles" value={diagnostics.triangleCount} />
          <StatRow label="Edges" value={diagnostics.edgeCount} />
          <StatRow label="Connected Components" value={diagnostics.connectedComponents} />
          <StatRow
            label="Euler Characteristic"
            value={diagnostics.eulerCharacteristic}
            tooltip="V - E + F. Should be 2 for a closed sphere-like mesh"
          />
        </Section>

        {/* Topology */}
        <Section title="Topology" defaultOpen={true}>
          <StatRow
            label="Watertight"
            value={diagnostics.isWatertight ? 'Yes' : 'No'}
            severity={diagnostics.isWatertight ? 'good' : 'warning'}
            tooltip="No boundary edges (holes)"
          />
          <StatRow
            label="Manifold"
            value={diagnostics.isManifold ? 'Yes' : 'No'}
            severity={diagnostics.isManifold ? 'good' : 'error'}
            tooltip="No edges shared by 3+ faces"
          />
          <StatRow
            label="Consistent Winding"
            value={diagnostics.windingCheckSkipped ? 'Skipped' : diagnostics.hasConsistentWinding ? 'Yes' : 'No'}
            severity={diagnostics.windingCheckSkipped ? undefined : diagnostics.hasConsistentWinding ? 'good' : 'warning'}
            tooltip="Face normals point consistently outward"
          />
          <StatRow
            label="Boundary Edges"
            value={diagnostics.boundaryEdgeCount}
            severity={getSeverity(diagnostics.boundaryEdgeCount, 1, 1)}
            tooltip="Edges with only one face (holes)"
          />
          <StatRow
            label="Non-Manifold Edges"
            value={diagnostics.nonManifoldEdgeCount}
            severity={getSeverity(diagnostics.nonManifoldEdgeCount, 1, 1)}
            tooltip="Edges shared by 3+ faces"
          />
          <StatRow
            label="Non-Manifold Vertices"
            value={diagnostics.nonManifoldVertexCount}
            severity={getSeverity(diagnostics.nonManifoldVertexCount, 1, 5)}
            tooltip="Pinch points where geometry touches itself"
          />
        </Section>

        {/* Quality Metrics */}
        <Section title="Quality Issues" defaultOpen={true}>
          <StatRow
            label="Self-Intersections"
            value={diagnostics.selfIntersectionCount}
            severity={getSeverity(diagnostics.selfIntersectionCount, 1, 5)}
            tooltip="Triangles that pass through each other"
          />
          <StatRow
            label="T-Junctions"
            value={diagnostics.tJunctionCount}
            severity={getSeverity(diagnostics.tJunctionCount, 1, 10)}
            tooltip="Vertices on edges but not connected"
          />
          <StatRow
            label="Degenerate Triangles"
            value={diagnostics.degenerateTriangleCount}
            severity={getSeverity(diagnostics.degenerateTriangleCount, 1, 5)}
            tooltip="Zero-area triangles"
          />
          <StatRow
            label="Tiny Triangles"
            value={diagnostics.tinyTriangleCount}
            severity={getSeverity(diagnostics.tinyTriangleCount, 10, 100)}
            tooltip="Area < 1% of median triangle"
          />
          <StatRow
            label="Needle Triangles"
            value={diagnostics.needleTriangleCount}
            severity={getSeverity(diagnostics.needleTriangleCount, 10, 100)}
            tooltip="Aspect ratio > 10:1"
          />
          <StatRow
            label="Duplicate Vertices"
            value={diagnostics.duplicateVertexCount}
            severity={getSeverity(diagnostics.duplicateVertexCount, 100, 1000)}
            tooltip="Vertices at same position"
          />
          <StatRow
            label="Isolated Vertices"
            value={diagnostics.isolatedVertexCount}
            severity={getSeverity(diagnostics.isolatedVertexCount, 1, 10)}
            tooltip="Vertices not used by any triangle"
          />
        </Section>

        {/* Additional Info */}
        <Section title="Additional Info" defaultOpen={false}>
          <StatRow
            label="Sharp Edges"
            value={diagnostics.sharpEdgeCount}
            tooltip="Dihedral angle < 30 degrees"
          />
          <StatRow
            label="Coplanar Edges"
            value={diagnostics.coplanarEdgeCount}
            tooltip="Dihedral angle > 170 degrees"
          />
          <StatRow
            label="Thin Walls"
            value={diagnostics.thinWallCount}
            severity={getSeverity(diagnostics.thinWallCount, 1, 10)}
            tooltip="Surfaces very close but not touching"
          />
          <StatRow
            label="Coincident Faces"
            value={diagnostics.coincidentFaceCount}
            severity={getSeverity(diagnostics.coincidentFaceCount, 1, 1)}
            tooltip="Overlapping triangles"
          />
          {diagnostics.boundingBox && (
            <>
              <StatRow
                label="Bounding Box Size"
                value={`${diagnostics.boundingBox.size.x.toFixed(2)} x ${diagnostics.boundingBox.size.y.toFixed(2)} x ${diagnostics.boundingBox.size.z.toFixed(2)}`}
              />
              <StatRow
                label="Diagonal"
                value={diagnostics.boundingBox.diagonal.toFixed(2)}
              />
            </>
          )}
        </Section>
      </div>
    </div>
  );
}
