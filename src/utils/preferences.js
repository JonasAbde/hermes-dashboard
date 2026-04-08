export const BASIC_MODE_STORAGE_KEY = 'hermes_dashboard_basic_mode_v1'
export const BASIC_MODE_EVENT = 'hermes:basic-mode-changed'

export function getBasicMode() {
  try {
    return localStorage.getItem(BASIC_MODE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function setBasicMode(enabled) {
  const value = enabled ? '1' : '0'
  try {
    localStorage.setItem(BASIC_MODE_STORAGE_KEY, value)
  } catch {
    // ignore storage write errors
  }
  try {
    window.dispatchEvent(new CustomEvent(BASIC_MODE_EVENT, { detail: { enabled: Boolean(enabled) } }))
  } catch {
    // ignore event errors
  }
}

