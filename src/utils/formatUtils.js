import { formatDistanceToNow } from 'date-fns'

/**
 * Format character count to human-readable bytes (k, M)
 * @param {number} chars - Character count
 * @returns {string} Formatted string
 */
export function formatBytes(chars) {
  if (chars < 1000) return `${chars}`
  if (chars < 1000000) return `${(chars / 1000).toFixed(1)}k`
  return `${(chars / 1000000).toFixed(2)}M`
}

/**
 * Format seconds to human-readable uptime string
 * @param {number} seconds - Seconds
 * @returns {string} Formatted uptime (e.g., "2d 5h", "3h 20m", "45m")
 */
export function formatUptime(seconds) {
  if (!seconds && seconds !== 0) return '—'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/**
 * Format cost value to dollar string
 * @param {number} val - Cost value
 * @returns {string} Formatted cost (e.g., "$12.34", "$0.0056")
 */
export function formatCost(val) {
  if (val == null || val === 0) return '$0.00'
  if (val < 0.01) return `$${val.toFixed(4)}`
  return `$${val.toFixed(2)}`
}

/**
 * Safely format a date string or timestamp to relative time
 * Handles both ISO strings and UNIX timestamps (seconds or ms)
 * @param {string|number} dateStrOrNum - Date string or timestamp
 * @returns {string} Formatted relative time or "—"
 */
export function safeFormatDistance(dateStrOrNum) {
  if (!dateStrOrNum) return '—'
  try {
    let val = dateStrOrNum
    // If it looks like a UNIX timestamp in seconds (10 digits), convert to ms
    if (typeof val === 'number' && val < 5000000000) {
      val = val * 1000
    } else if (
      typeof val === 'string' &&
      !isNaN(val) &&
      val.length <= 10
    ) {
      val = parseFloat(val) * 1000
    }

    const d = new Date(val)
    if (isNaN(d.getTime())) return '—'

    // Additional guard for extreme dates
    const year = d.getFullYear()
    if (year < 1970 || year > 2100) return '—'

    return formatDistanceToNow(d, { addSuffix: true })
  } catch {
    return '—'
  }
}

/**
 * Format relative time with custom labels for today/yesterday
 * @param {Date|string|number} date - Date to format
 * @returns {string} Relative label (Today, Yesterday, or formatted date)
 */
export function formatDayLabel(date) {
  const d = date instanceof Date ? date : new Date(date)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === now.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return new Intl.DateTimeFormat('da-DK', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(d)
}

/**
 * Extract first line of text, truncated
 * @param {string} text - Input text
 * @param {number} maxLength - Maximum length (default 60)
 * @returns {string} Truncated first line
 */
export function firstLine(text, maxLength = 60) {
  if (!text) return 'New chat'
  return (
    text.slice(0, maxLength).replace(/\n/g, ' ').trim() +
    (text.length > maxLength ? '…' : '')
  )
}
