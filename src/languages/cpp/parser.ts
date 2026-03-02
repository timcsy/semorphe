import { Parser, Language, type Tree } from 'web-tree-sitter'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

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
        return resolve(resolvedWasmDir, scriptName)
      },
    })

    this.parser = new Parser()

    const langPath = resolve(resolvedWasmDir, 'tree-sitter-c.wasm')
    const language = await Language.load(langPath)
    this.parser.setLanguage(language)
    this.initialized = true
  }

  async parse(code: string): Promise<Tree> {
    if (!this.parser) {
      throw new Error('Parser not initialized. Call init() first.')
    }
    return this.parser.parse(code)
  }

  private getDefaultWasmDir(): string {
    try {
      const currentFile = fileURLToPath(import.meta.url)
      const currentDir = dirname(currentFile)
      return resolve(currentDir, '../../../public')
    } catch {
      return resolve(process.cwd(), 'public')
    }
  }
}
