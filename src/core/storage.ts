import type { SemanticNode, CognitiveLevel } from './types'

const STORAGE_KEY = 'semorphe-state'
const MAX_SIZE = 5 * 1024 * 1024 // 5MB limit

export interface SavedState {
  version: number
  tree: SemanticNode | null
  blocklyState: object
  code: string
  language: string
  styleId: string
  level: CognitiveLevel
  lastModified: string
  blockStyleId?: string
  locale?: string
}

export class StorageService {
  private defaultLanguage: string

  constructor(defaultLanguage = 'cpp') {
    this.defaultLanguage = defaultLanguage
  }

  /** Save state to localStorage */
  save(state: Partial<SavedState>): boolean {
    try {
      const existing = this.load()
      const merged: SavedState = {
        version: 1,
        tree: state.tree ?? existing?.tree ?? null,
        blocklyState: state.blocklyState ?? existing?.blocklyState ?? {},
        code: state.code ?? existing?.code ?? '',
        language: state.language ?? existing?.language ?? this.defaultLanguage,
        styleId: state.styleId ?? existing?.styleId ?? 'apcs',
        level: state.level ?? existing?.level ?? 1,
        lastModified: new Date().toISOString(),
      }
      const json = JSON.stringify(merged)
      if (json.length > MAX_SIZE) {
        console.warn('Storage size exceeds limit, not saving')
        return false
      }
      localStorage.setItem(STORAGE_KEY, json)
      return true
    } catch {
      return false
    }
  }

  /** Load state from localStorage */
  load(): SavedState | null {
    try {
      const json = localStorage.getItem(STORAGE_KEY)
      if (!json) return null
      return JSON.parse(json) as SavedState
    } catch {
      return null
    }
  }

  /** Clear saved state */
  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch { /* ignore */ }
  }

  /** Export state as downloadable JSON blob */
  exportToBlob(state: SavedState): Blob {
    const json = JSON.stringify(state, null, 2)
    return new Blob([json], { type: 'application/json' })
  }

  /** Import state from JSON string */
  importFromJSON(json: string): SavedState | null {
    try {
      const parsed = JSON.parse(json) as SavedState
      if (!parsed.version || !parsed.lastModified) return null
      return parsed
    } catch {
      return null
    }
  }

  /** Trigger download of a blob as a file */
  downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
}
