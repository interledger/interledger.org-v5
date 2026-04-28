import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals'

const PREFIX = '[wv]'

function shouldEnable(): boolean {
  if (import.meta.env.DEV) return true
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('wv') === '1'
}

function logMetric(metric: Metric) {
  console.info(
    `${PREFIX} ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`,
    metric
  )
}

if (shouldEnable()) {
  onCLS(logMetric)
  onFCP(logMetric)
  onINP(logMetric)
  onLCP(logMetric)
  onTTFB(logMetric)
}
