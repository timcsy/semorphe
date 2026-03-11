export type LayoutMode = 'mobile' | 'desktop'

const MOBILE_BREAKPOINT = '(max-width: 768px)'

export class LayoutManager {
  private mql: MediaQueryList
  private currentMode: LayoutMode
  private callbacks: Array<(mode: LayoutMode) => void> = []
  private handleChange: (e: MediaQueryListEvent) => void

  constructor() {
    this.mql = window.matchMedia(MOBILE_BREAKPOINT)
    this.currentMode = this.mql.matches ? 'mobile' : 'desktop'

    this.handleChange = (e: MediaQueryListEvent) => {
      const newMode: LayoutMode = e.matches ? 'mobile' : 'desktop'
      if (newMode === this.currentMode) return
      this.currentMode = newMode
      for (const cb of this.callbacks) {
        cb(newMode)
      }
      window.dispatchEvent(new Event('resize'))
    }

    this.mql.addEventListener('change', this.handleChange)
  }

  getMode(): LayoutMode {
    return this.currentMode
  }

  onModeChange(callback: (mode: LayoutMode) => void): void {
    this.callbacks.push(callback)
  }

  destroy(): void {
    this.mql.removeEventListener('change', this.handleChange)
    this.callbacks = []
  }
}
