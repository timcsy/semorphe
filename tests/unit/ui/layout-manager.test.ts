import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { LayoutManager, LayoutMode } from '../../../src/ui/layout/layout-manager'

// Mock matchMedia
function createMockMatchMedia(matches: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = []
  const mql = {
    matches,
    media: '(max-width: 768px)',
    addEventListener: vi.fn((event: string, fn: (e: MediaQueryListEvent) => void) => {
      if (event === 'change') listeners.push(fn)
    }),
    removeEventListener: vi.fn((event: string, fn: (e: MediaQueryListEvent) => void) => {
      const idx = listeners.indexOf(fn)
      if (idx >= 0) listeners.splice(idx, 1)
    }),
    dispatchEvent: vi.fn(),
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  } satisfies MediaQueryList

  return {
    mql,
    listeners,
    triggerChange(newMatches: boolean) {
      mql.matches = newMatches
      for (const fn of listeners) {
        fn({ matches: newMatches, media: mql.media } as MediaQueryListEvent)
      }
    },
  }
}

describe('LayoutManager', () => {
  let mockMM: ReturnType<typeof createMockMatchMedia>
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it('should detect mobile mode when width ≤768px', () => {
    mockMM = createMockMatchMedia(true)
    window.matchMedia = vi.fn().mockReturnValue(mockMM.mql)
    const lm = new LayoutManager()
    expect(lm.getMode()).toBe('mobile')
  })

  it('should detect desktop mode when width ≥769px', () => {
    mockMM = createMockMatchMedia(false)
    window.matchMedia = vi.fn().mockReturnValue(mockMM.mql)
    const lm = new LayoutManager()
    expect(lm.getMode()).toBe('desktop')
  })

  it('should call onModeChange callback when breakpoint changes', () => {
    mockMM = createMockMatchMedia(false)
    window.matchMedia = vi.fn().mockReturnValue(mockMM.mql)
    const lm = new LayoutManager()
    const callback = vi.fn()
    lm.onModeChange(callback)

    mockMM.triggerChange(true)
    expect(callback).toHaveBeenCalledWith('mobile')

    mockMM.triggerChange(false)
    expect(callback).toHaveBeenCalledWith('desktop')
  })

  it('should dispatch resize event after mode change', () => {
    mockMM = createMockMatchMedia(false)
    window.matchMedia = vi.fn().mockReturnValue(mockMM.mql)
    const lm = new LayoutManager()
    lm.onModeChange(() => {})

    const resizeSpy = vi.fn()
    window.addEventListener('resize', resizeSpy)

    mockMM.triggerChange(true)
    expect(resizeSpy).toHaveBeenCalled()

    window.removeEventListener('resize', resizeSpy)
  })

  it('should support multiple onModeChange callbacks', () => {
    mockMM = createMockMatchMedia(false)
    window.matchMedia = vi.fn().mockReturnValue(mockMM.mql)
    const lm = new LayoutManager()
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    lm.onModeChange(cb1)
    lm.onModeChange(cb2)

    mockMM.triggerChange(true)
    expect(cb1).toHaveBeenCalledWith('mobile')
    expect(cb2).toHaveBeenCalledWith('mobile')
  })

  it('should clean up listener on destroy', () => {
    mockMM = createMockMatchMedia(false)
    window.matchMedia = vi.fn().mockReturnValue(mockMM.mql)
    const lm = new LayoutManager()
    lm.destroy()
    expect(mockMM.mql.removeEventListener).toHaveBeenCalled()
  })

  it('should not fire callback if mode does not actually change', () => {
    mockMM = createMockMatchMedia(false)
    window.matchMedia = vi.fn().mockReturnValue(mockMM.mql)
    const lm = new LayoutManager()
    const callback = vi.fn()
    lm.onModeChange(callback)

    // Trigger with same value (desktop → desktop)
    mockMM.triggerChange(false)
    expect(callback).not.toHaveBeenCalled()
  })
})
