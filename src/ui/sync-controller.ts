export interface SyncControllerOptions {
  blocksToCode: (workspace: unknown) => string
  codeToBlocks: (code: string) => Promise<unknown>
  setCode: (code: string) => void
  setBlocks: (workspace: unknown) => void
  debounceMs?: number
}

export class SyncController {
  private options: SyncControllerOptions
  private debounceMs: number
  private blocksTimer: ReturnType<typeof setTimeout> | null = null
  private codeTimer: ReturnType<typeof setTimeout> | null = null
  private syncing = false

  constructor(options: SyncControllerOptions) {
    this.options = options
    this.debounceMs = options.debounceMs ?? 300
  }

  onBlocksChanged(workspace: unknown): void {
    if (this.syncing) return

    if (this.blocksTimer) clearTimeout(this.blocksTimer)

    this.blocksTimer = setTimeout(() => {
      this.syncing = true
      try {
        const code = this.options.blocksToCode(workspace)
        this.options.setCode(code)
      } finally {
        this.syncing = false
      }
    }, this.debounceMs)
  }

  onCodeChanged(code: string): void {
    if (this.syncing) return

    if (this.codeTimer) clearTimeout(this.codeTimer)

    this.codeTimer = setTimeout(async () => {
      this.syncing = true
      try {
        const workspace = await this.options.codeToBlocks(code)
        this.options.setBlocks(workspace)
      } finally {
        this.syncing = false
      }
    }, this.debounceMs)
  }

  destroy(): void {
    if (this.blocksTimer) clearTimeout(this.blocksTimer)
    if (this.codeTimer) clearTimeout(this.codeTimer)
  }
}
