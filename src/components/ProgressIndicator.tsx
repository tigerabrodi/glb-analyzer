import { Loader2, FileSearch, Cpu, Package } from 'lucide-react';

export interface ProgressIndicatorProps {
  stage: 'parsing' | 'analyzing' | 'extracting' | null;
}

const stages = [
  { key: 'parsing', label: 'Parsing GLB', icon: FileSearch },
  { key: 'analyzing', label: 'Analyzing Mesh', icon: Cpu },
  { key: 'extracting', label: 'Extracting Problems', icon: Package },
] as const;

export function ProgressIndicator({ stage }: ProgressIndicatorProps) {
  if (!stage) return null;

  const currentIndex = stages.findIndex((s) => s.key === stage);

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />

      <div className="flex items-center gap-2">
        {stages.map((s, index) => {
          const Icon = s.icon;
          const isActive = s.key === stage;
          const isComplete = index < currentIndex;
          const isPending = index > currentIndex;

          return (
            <div key={s.key} className="flex items-center">
              <div
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all duration-300
                  ${isActive ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50' : ''}
                  ${isComplete ? 'bg-emerald-500/20 text-emerald-400' : ''}
                  ${isPending ? 'bg-zinc-800 text-zinc-500' : ''}
                `}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {index < stages.length - 1 && (
                <div
                  className={`w-8 h-0.5 mx-1 transition-colors duration-300 ${
                    isComplete ? 'bg-emerald-500' : 'bg-zinc-700'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <p className="text-zinc-400 text-sm animate-pulse">
        {stage === 'parsing' && 'Reading GLB file structure...'}
        {stage === 'analyzing' && 'Computing mesh diagnostics...'}
        {stage === 'extracting' && 'Extracting problem geometry...'}
      </p>
    </div>
  );
}
