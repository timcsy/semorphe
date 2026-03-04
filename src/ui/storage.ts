import type { WorkspaceState, ToolboxLevel } from '../core/types'

const STORAGE_KEY = 'code-blockly-state'
const TOOLBOX_LEVEL_KEY = 'code-blockly-toolbox-level'

export class Storage {
  save(state: WorkspaceState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Storage full or unavailable
    }
  }

  load(): WorkspaceState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!this.isValidState(parsed)) return null
      return parsed as WorkspaceState
    } catch {
      return null
    }
  }

  exportToJson(state: WorkspaceState): string {
    return JSON.stringify(state, null, 2)
  }

  importFromJson(json: string): WorkspaceState | null {
    try {
      const parsed = JSON.parse(json)
      if (!this.isValidState(parsed)) return null
      return parsed as WorkspaceState
    } catch {
      return null
    }
  }

  saveToolboxLevel(level: ToolboxLevel): void {
    try {
      localStorage.setItem(TOOLBOX_LEVEL_KEY, level)
    } catch {
      // Storage full or unavailable
    }
  }

  loadToolboxLevel(): ToolboxLevel | null {
    try {
      const raw = localStorage.getItem(TOOLBOX_LEVEL_KEY)
      if (raw === 'beginner' || raw === 'advanced') return raw
      return null
    } catch {
      return null
    }
  }

  private isValidState(obj: unknown): boolean {
    if (!obj || typeof obj !== 'object') return false
    const s = obj as Record<string, unknown>
    return (
      'blocklyState' in s &&
      typeof s.code === 'string' &&
      typeof s.languageId === 'string' &&
      Array.isArray(s.customBlockSpecs) &&
      typeof s.lastModified === 'string'
    )
  }
}
