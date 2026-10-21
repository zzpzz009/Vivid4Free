import { afterEach, describe, expect, it, vi } from 'vitest'
import { rememberStartupIntro, shouldShowStartupIntro, STARTUP_INTRO_KEY, ISLAND_STARTUP_INTRO_KEY } from './startupIntro.js'

afterEach(() => vi.unstubAllGlobals())

describe('first-launch intro persistence', () => {
  it('remembers each skin separately while preserving the original completion key', () => {
    const entries = new Map([[STARTUP_INTRO_KEY, 'seen']])
    const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) }
    expect(shouldShowStartupIntro(storage, 'original')).toBe(false)
    expect(shouldShowStartupIntro(storage, 'animal-island')).toBe(true)
    expect(rememberStartupIntro(storage, 'animal-island')).toBe(true)
    expect(shouldShowStartupIntro(storage, 'animal-island')).toBe(false)
    expect(entries.get(STARTUP_INTRO_KEY)).toBe('seen')
    expect(entries.get(ISLAND_STARTUP_INTRO_KEY)).toBe('seen')
    entries.delete(STARTUP_INTRO_KEY)
    expect(shouldShowStartupIntro(storage, 'original')).toBe(true)
    expect(shouldShowStartupIntro(storage, 'animal-island')).toBe(false)
  })

  it('plays for a fresh profile and skips after completion across a new storage reader', () => {
    const entries = new Map()
    const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) }
    expect(shouldShowStartupIntro(storage)).toBe(true)
    expect(entries.size).toBe(0)
    expect(rememberStartupIntro(storage)).toBe(true)
    expect(shouldShowStartupIntro({ getItem: key => entries.get(key) ?? null })).toBe(false)
    expect([...entries]).toEqual([[STARTUP_INTRO_KEY, 'seen']])
  })

  it('does not mistake unrelated or incomplete state for a completed intro', () => {
    expect(shouldShowStartupIntro({ getItem: () => 'playing' })).toBe(true)
  })

  it('keeps the app usable when storage is blocked, including access to the storage getter', () => {
    vi.stubGlobal('window', Object.defineProperty({}, 'localStorage', { get() { throw new Error('blocked') } }))
    expect(shouldShowStartupIntro()).toBe(true)
    expect(rememberStartupIntro()).toBe(false)
  })

  it('tolerates full or read-only storage without marking completion', () => {
    const storage = { getItem: () => null, setItem: () => { throw new Error('full') } }
    expect(rememberStartupIntro(storage)).toBe(false)
    expect(shouldShowStartupIntro(storage)).toBe(true)
  })
})
