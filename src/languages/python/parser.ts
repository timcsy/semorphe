/**
 * Python 的解析器——與 `languages/cpp/parser.ts` **同一個形狀**。
 *
 * ## 為什麼是複製而不是抽共用
 *
 * 兩個檔今天幾乎一樣，而**第二個消費者剛剛才出現**。
 * `experience` 逐字：「重寫一個沒有第二個消費者的抽象，等於用猜的決定介面。」
 *
 * 🟢 現在有了第二個——**而抽共用是【下一刀】的事**，不是這一刀。
 * 這一刀要買的是「Python 的積木走不走得通」，抽象化會把那個答案埋掉。
 * 差異點已經看得見（只有 `getLanguageId()` 與 wasm 檔名兩處），
 * 那份清單記在 `specs/160-python-first-block/`。
 *
 * ⚠️ **wasm 出貨的理由**：`e2e/shipped-assets.spec.ts` 逐字
 * 「出貨的每一個 wasm，都要有人真的去要它」——**這個檔就是那個人**。
 * 反過來也成立：有人要它的時候它就必須在 `public/`，否則瀏覽器裡拿不到。
 */
import { Parser, Language, type Tree } from 'web-tree-sitter'

export type { Tree }

export class PythonParser {
  private parser: Parser | null = null
  private initialized = false

  getLanguageId(): string {
    return 'python'
  }

  isInitialized(): boolean {
    return this.initialized
  }

  async init(wasmDir?: string): Promise<void> {
    if (this.initialized) return
    const resolvedWasmDir = wasmDir ?? this.getDefaultWasmDir()

    await Parser.init({
      locateFile: (scriptName: string) => this.joinPath(resolvedWasmDir, scriptName),
    })

    this.parser = new Parser()
    const language = await Language.load(this.joinPath(resolvedWasmDir, 'tree-sitter-python.wasm'))
    this.parser.setLanguage(language)
    this.initialized = true
  }

  async parse(code: string): Promise<Tree> {
    if (!this.parser) throw new Error('Parser not initialized. Call init() first.')
    return this.parser.parse(code) as Tree
  }

  /** 與 cpp 同一條：宿主可注入 `__SEMORPHE_ASSET_BASE__`（那是【環境】不是【組態】）。 */
  private getDefaultWasmDir(): string {
    const g = globalThis as Record<string, unknown>
    const injected = g['__SEMORPHE_ASSET_BASE__']
    if (typeof injected === 'string' && injected) return injected
    const proc = g['process'] as { cwd?: () => string } | undefined
    if (!proc?.cwd) return ''
    return proc.cwd() + '/public'
  }

  private joinPath(dir: string, file: string): string {
    if (!dir) return file
    return dir.endsWith('/') ? dir + file : dir + '/' + file
  }
}
