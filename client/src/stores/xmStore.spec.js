import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useXMStore } from './xmStore'

beforeEach(() => {
  const values = new Map()
  vi.stubGlobal('localStorage', {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    clear: () => values.clear()
  })
  setActivePinia(createPinia())
})

afterEach(() => vi.unstubAllGlobals())

describe('preview source-workflow settings', () => {
  it('uses source strengths instead of the old frontend defaults', () => {
    const store = useXMStore()
    expect(store.referenceStrength).toBe(1)
    expect(store.colorMatchStrength).toBe(0.285403)
    expect(store.addScene).toBe(true)
  })

  it('migrates existing settings once and retains a rollback copy', () => {
    localStorage.setItem('xm-referenceStrength', '0.8')
    localStorage.setItem('xm-colorMatchStrength', '0.8')
    const store = useXMStore()
    expect(store.referenceStrength).toBe(1)
    expect(store.colorMatchStrength).toBe(0.285403)
    expect(JSON.parse(localStorage.getItem('xm-preview-settings-before-fidelity-v1'))).toEqual({
      referenceStrength: '0.8', colorMatchStrength: '0.8'
    })
    store.saveReferenceStrength(0.6)
    store.saveColorMatchStrength(0.4)
    setActivePinia(createPinia())
    const reopened = useXMStore()
    expect(reopened.referenceStrength).toBe(0.6)
    expect(reopened.colorMatchStrength).toBe(0.4)
  })

  it('restores original strengths when clearing the workspace', () => {
    const store = useXMStore()
    store.saveReferenceStrength(0.6)
    store.saveColorMatchStrength(0.4)
    store.clearthis()
    expect(store.referenceStrength).toBe(1)
    expect(store.colorMatchStrength).toBe(0.285403)
    setActivePinia(createPinia())
    expect(useXMStore().colorMatchStrength).toBe(0.285403)
  })
})
