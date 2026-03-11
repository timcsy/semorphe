import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { LayoutManager } from '../../src/ui/layout/layout-manager'

// Mock matchMedia helper
function createMockMatchMedia(matches: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = []
  const mql = {
    matches,
    media: '(max-width: 768px)',
    addEventListener: vi.fn((_: string, fn: (e: MediaQueryListEvent) => void) => {
      listeners.push(fn)
    }),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  } satisfies MediaQueryList
  return {
    mql,
    triggerChange(newMatches: boolean) {
      mql.matches = newMatches
      for (const fn of listeners) {
        fn({ matches: newMatches, media: mql.media } as MediaQueryListEvent)
      }
    },
  }
}

describe('Responsive Layout Integration', () => {
  let mockMM: ReturnType<typeof createMockMatchMedia>
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it('should switch layout mode across breakpoint', () => {
    mockMM = createMockMatchMedia(false) // start desktop
    window.matchMedia = vi.fn().mockReturnValue(mockMM.mql)

    const lm = new LayoutManager()
    expect(lm.getMode()).toBe('desktop')

    const modes: string[] = []
    lm.onModeChange((mode) => modes.push(mode))

    mockMM.triggerChange(true) // → mobile
    mockMM.triggerChange(false) // → desktop

    expect(modes).toEqual(['mobile', 'desktop'])
  })

  it('should dispatch resize after layout switch', () => {
    mockMM = createMockMatchMedia(false)
    window.matchMedia = vi.fn().mockReturnValue(mockMM.mql)

    const lm = new LayoutManager()
    lm.onModeChange(() => {})

    const resizeEvents: Event[] = []
    const handler = (e: Event) => resizeEvents.push(e)
    window.addEventListener('resize', handler)

    mockMM.triggerChange(true)
    expect(resizeEvents.length).toBeGreaterThanOrEqual(1)

    window.removeEventListener('resize', handler)
  })

  describe('Desktop regression (US4)', () => {
    it('should start in desktop mode and remain stable', () => {
      mockMM = createMockMatchMedia(false)
      window.matchMedia = vi.fn().mockReturnValue(mockMM.mql)

      const lm = new LayoutManager()
      expect(lm.getMode()).toBe('desktop')

      // No mode change should fire when staying desktop
      const changes: string[] = []
      lm.onModeChange((m) => changes.push(m))
      mockMM.triggerChange(false) // still desktop
      expect(changes).toEqual([])
    })

    it('should restore desktop mode after mobile→desktop transition', () => {
      mockMM = createMockMatchMedia(false)
      window.matchMedia = vi.fn().mockReturnValue(mockMM.mql)

      const lm = new LayoutManager()
      const modes: string[] = []
      lm.onModeChange((m) => modes.push(m))

      mockMM.triggerChange(true)  // → mobile
      mockMM.triggerChange(false) // → desktop
      mockMM.triggerChange(true)  // → mobile
      mockMM.triggerChange(false) // → desktop

      expect(modes).toEqual(['mobile', 'desktop', 'mobile', 'desktop'])
      expect(lm.getMode()).toBe('desktop')
    })
  })
})
