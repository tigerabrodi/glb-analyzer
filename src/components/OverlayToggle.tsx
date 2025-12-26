import { Grid3X3, GitBranch, CircleDot, Layers, Triangle, Waypoints } from 'lucide-react';
import type { OverlayVisibility } from '../lib/types';

export interface OverlayToggleProps {
  visibility: OverlayVisibility;
  onChange: (visibility: OverlayVisibility) => void;
  counts: {
    boundaryEdges: number;
    nonManifoldEdges: number;
    nonManifoldVertices: number;
    selfIntersections: number;
    tJunctions: number;
  };
}

interface ToggleButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
  activeColor: string;
}

function ToggleButton({
  active,
  onClick,
  icon,
  label,
  count,
  color,
  activeColor,
}: ToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg
        transition-all duration-200
        ${active
          ? `${activeColor} ring-1 ring-current/30`
          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
        }
        ${count === 0 ? 'opacity-50' : ''}
      `}
      title={`${label}: ${count.toLocaleString()}`}
    >
      <span className={active ? color : ''}>{icon}</span>
      <span className="text-sm font-medium hidden lg:inline">{label}</span>
      <span className={`
        text-xs px-1.5 py-0.5 rounded-full
        ${active ? 'bg-white/20' : 'bg-zinc-700'}
      `}>
        {count.toLocaleString()}
      </span>
    </button>
  );
}

export function OverlayToggle({ visibility, onChange, counts }: OverlayToggleProps) {
  const toggle = (key: keyof OverlayVisibility) => {
    onChange({ ...visibility, [key]: !visibility[key] });
  };

  return (
    <div className="flex flex-wrap gap-2 p-3 bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-zinc-800">
      <ToggleButton
        active={visibility.wireframe}
        onClick={() => toggle('wireframe')}
        icon={<Grid3X3 className="w-4 h-4" />}
        label="Wireframe"
        count={0}
        color="text-zinc-300"
        activeColor="bg-zinc-700 text-zinc-100"
      />

      <div className="w-px bg-zinc-700 mx-1" />

      <ToggleButton
        active={visibility.boundaryEdges}
        onClick={() => toggle('boundaryEdges')}
        icon={<GitBranch className="w-4 h-4" />}
        label="Boundary"
        count={counts.boundaryEdges}
        color="text-orange-400"
        activeColor="bg-orange-500/20 text-orange-400"
      />

      <ToggleButton
        active={visibility.nonManifoldEdges}
        onClick={() => toggle('nonManifoldEdges')}
        icon={<Layers className="w-4 h-4" />}
        label="Non-Manifold"
        count={counts.nonManifoldEdges}
        color="text-red-400"
        activeColor="bg-red-500/20 text-red-400"
      />

      <ToggleButton
        active={visibility.pinchPoints}
        onClick={() => toggle('pinchPoints')}
        icon={<CircleDot className="w-4 h-4" />}
        label="Pinch Points"
        count={counts.nonManifoldVertices}
        color="text-purple-400"
        activeColor="bg-purple-500/20 text-purple-400"
      />

      <ToggleButton
        active={visibility.selfIntersections}
        onClick={() => toggle('selfIntersections')}
        icon={<Triangle className="w-4 h-4" />}
        label="Intersections"
        count={counts.selfIntersections}
        color="text-yellow-400"
        activeColor="bg-yellow-500/20 text-yellow-400"
      />

      <ToggleButton
        active={visibility.tJunctions}
        onClick={() => toggle('tJunctions')}
        icon={<Waypoints className="w-4 h-4" />}
        label="T-Junctions"
        count={counts.tJunctions}
        color="text-cyan-400"
        activeColor="bg-cyan-500/20 text-cyan-400"
      />
    </div>
  );
}
