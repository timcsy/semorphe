import { Parser, Language, type Tree } from 'web-tree-sitter'

export type { Tree }

export class CppParser {
  private parser: Parser | null = null
  private initialized = false

  getLanguageId(): string {
    return 'cpp'
  }

  isInitialized(): boolean {
    return this.initialized
  }

  async init(wasmDir?: string): Promise<void> {
    if (this.initialized) return

    const resolvedWasmDir = wasmDir ?? this.getDefaultWasmDir()

    await Parser.init({
      locateFile: (scriptName: string) => {
        return this.joinPath(resolvedWasmDir, scriptName)
      },
    })

    this.parser = new Parser()

    const langPath = this.joinPath(resolvedWasmDir, 'tree-sitter-cpp.wasm')
    const language = await Language.load(langPath)
    this.parser.setLanguage(language)
    this.initialized = true
  }

  async parse(code: string): Promise<Tree> {
    if (!this.parser) {
      throw new Error('Parser not initialized. Call init() first.')
    }
    return this.parser.parse(code) as Tree
  }

  /**
   * 沒有人指定路徑時，去哪裡找 wasm。
   *
   * ```
   * Node（測試）  process.cwd() + '/public'
   * 瀏覽器        ''  → 相對於文件的網址
   * ```
   *
   * 🔴 **而「相對於文件的網址」在嵌入式宿主裡不成立**（2026-08-18 實測）：
   * VSCode 的 Webview 文件有一個**合成的網址**，靜態資源不在它旁邊。
   * 症狀是 `Aborted(both async and sync fetching of the wasm failed)`。
   *
   * ⚠️ 而它**不會在建置期出現**——只有真的去載的時候才炸。
   *
   * 處置：讓宿主可以說「資源在這裡」。
   * 🟢 與 Blockly 的 media 同一個形狀（`ui/app-shell.ts`）——
   * **那是【環境】不是【組態】**：兩個宿主都要有這些檔，只是位置不同。
   */
  private getDefaultWasmDir(): string {
    const g = globalThis as Record<string, unknown>
    const injected = g['__SEMORPHE_ASSET_BASE__']
    if (typeof injected === 'string' && injected) return injected
    const proc = g['process'] as { cwd?: () => string } | undefined
    if (!proc?.cwd) {
      return ''
    }
    return proc.cwd() + '/public'
  }

  private joinPath(dir: string, file: string): string {
    if (!dir) return file
    return dir.endsWith('/') ? dir + file : dir + '/' + file
  }
}
