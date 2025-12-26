import { Info } from 'lucide-react'

export interface StatRowProps {
  label: string
  value: string | number
  severity?: 'good' | 'warning' | 'error'
  tooltip?: string
}

const severityColors = {
  good: 'text-emerald-400',
  warning: 'text-amber-400',
  error: 'text-red-400',
} as const

export function StatRow({ label, value, severity, tooltip }: StatRowProps) {
  const valueColor = severity ? severityColors[severity] : 'text-zinc-100'

  return (
    <div className="flex items-center justify-between py-2 px-3 hover:bg-zinc-800/50 rounded-md transition-colors">
      <div className="flex items-center gap-2">
        <span className="text-zinc-400 text-sm">{label}</span>
        {tooltip && (
          <div className="group relative">
            <Info className="w-3.5 h-3.5 text-zinc-500 cursor-help" />
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-xl">
              {tooltip}
              <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-zinc-700" />
            </div>
          </div>
        )}
      </div>
      <span className={`font-mono text-sm ${valueColor}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </div>
  )
}
