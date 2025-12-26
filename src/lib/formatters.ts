/**
 * Format a number with commas (e.g., 1,234,567).
 */
export function formatNumber(n: number): string {
  return n.toLocaleString()
}

/**
 * Format file size in B, KB, or MB.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Format duration in ms or s.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

/**
 * Format a value as a percentage string.
 */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

/**
 * Get severity label from score (0-100).
 * - 80-100: good
 * - 50-79: warning
 * - 0-49: error
 */
export function getSeverityLabel(score: number): 'good' | 'warning' | 'error' {
  if (score >= 80) return 'good'
  if (score >= 50) return 'warning'
  return 'error'
}

/**
 * Get severity color class for Tailwind CSS.
 */
export function getSeverityColor(
  severity: 'good' | 'warning' | 'error'
): string {
  switch (severity) {
    case 'good':
      return 'text-green-500'
    case 'warning':
      return 'text-yellow-500'
    case 'error':
      return 'text-red-500'
  }
}
