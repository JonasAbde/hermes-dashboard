/**
 * AgentAvatar — Hermes agent's avatar with optional custom image override
 *
 * Usage:
 *   <AgentAvatar size={56} />
 *   <AgentAvatar size={64} className="ml-2" />
 *
 * Shows custom image if stored in localStorage, otherwise falls back
 * to the Living Sigil mascot. Handles image errors gracefully.
 *
 * Note: This is the AGENT's avatar (what represents Hermes), not the user's.
 * The user can customize what their agent looks like via ProfilePage upload.
 */

import React, { useState, useEffect } from 'react'
import { HermesCharacter } from './HermesCharacter'

// localStorage key for custom avatar
export const CUSTOM_AVATAR_KEY = 'hermes_custom_avatar'

/**
 * Read the custom avatar data URL from localStorage
 * @returns {string|null} The stored data URL or null
 */
export function getCustomAvatar() {
  try {
    return localStorage.getItem(CUSTOM_AVATAR_KEY)
  } catch {
    return null
  }
}

/**
 * Store a custom avatar data URL to localStorage
 * @param {string} dataUrl - The base64 data URL of the image
 * @returns {boolean} Success
 */
export function setCustomAvatar(dataUrl) {
  try {
    localStorage.setItem(CUSTOM_AVATAR_KEY, dataUrl)
    return true
  } catch {
    return false
  }
}

/**
 * Remove the custom avatar from localStorage (reset to Living Sigil)
 */
export function clearCustomAvatar() {
  try {
    localStorage.removeItem(CUSTOM_AVATAR_KEY)
  } catch {
    // ignore
  }
}

/**
 * AgentAvatar component
 * @param {number} [props.size=56] - Avatar size in pixels
 * @param {string} [props.className] - Additional CSS classes
 */
export function AgentAvatar({ size = 56, className, statusDot = true }) {
  const [customImageUrl, setCustomImageUrl] = useState(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  // Read custom avatar from localStorage on mount
  useEffect(() => {
    const stored = getCustomAvatar()
    if (stored) {
      setCustomImageUrl(stored)
      setImageLoaded(false)
      setImageError(false)
    }
  }, [])

  // Handle image load success
  const handleLoad = () => {
    setImageLoaded(true)
    setImageError(false)
  }

  // Handle image load error
  const handleError = () => {
    setImageError(true)
    setImageLoaded(false)
  }

  // Show custom avatar if available and successfully loaded
  const showCustomAvatar = customImageUrl && imageLoaded && !imageError

  return (
    <div
      className={className}
      style={{ width: size, height: size }}
    >
      {showCustomAvatar ? (
        <img
          src={customImageUrl}
          alt="Custom avatar"
          onLoad={handleLoad}
          onError={handleError}
          className="w-full h-full rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <HermesCharacter variant="default" size={size} statusDot={statusDot} />
      )}
    </div>
  )
}

export default AgentAvatar
