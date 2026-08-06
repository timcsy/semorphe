import type { SemanticNode } from './types'
import { CURRENT_VERSION } from './storage-version'

const STORAGE_KEY = 'semorphe-state'
const MAX_SIZE = 5 * 1024 * 1024 // 5MB limit

/**
 * 濾掉值為 `undefined` 的欄位。
 *
 * 直接展開的話，「這次沒提供」（`undefined`）會覆蓋掉「上次存的值」——
 * 那是換一種方式丟資料。
 */
function definedOnly<T extends object>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v
  return out as Partial<T>
}

export interface SavedState {
  version: number
  tree: SemanticNode | null
  blocklyState: object
  code: string
  language: string
  styleId: string
  topicId?: string
  enabledBranches?: string[]
  lastModified: string
  blockStyleId?: string
  locale?: string
}

export class StorageService {
  private defaultLanguage: string

  constructor(defaultLanguage = 'cpp') {
    this.defaultLanguage = defaultLanguage
  }

  /**
   * Save state to localStorage.
   *
   * 合併用**展開**而不是逐欄位列舉。列舉表與型別宣告是兩份東西，選填欄位漏
   * 列舉時編譯器不會發現——`blockStyleId` 與 `locale` 就是這樣被丟了。展開
   * 之後，漏欄位在結構上不可能發生。
   *
   * 見 specs/052-storage-integrity-gate/research.md F5（消除，不是偵測）
   */
  save(state: Partial<SavedState>): boolean {
    try {
      const existing = this.load()
      const defaults: SavedState = {
        version: CURRENT_VERSION,
        tree: null,
        blocklyState: {},
        code: '',
        language: this.defaultLanguage,
        styleId: 'apcs',
        lastModified: '',
      }
      const merged: SavedState = {
        ...defaults,
        ...(existing ?? {}), // 未知欄位一併帶下去（FR-017）
        ...definedOnly(state), // 值為 undefined 的欄位不得覆蓋既有值
        version: CURRENT_VERSION,
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
