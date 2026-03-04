import { Parser, Language, type Tree } from 'web-tree-sitter'
import type { SemanticModel } from '../../core/semantic-model'
import type { CodingStyle } from '../style'
import { CppLanguageAdapter } from './adapter'

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

  /** Parse code into SemanticModel via adapter (T013) */
  async parseToModel(code: string, adapter?: CppLanguageAdapter): Promise<SemanticModel> {
    const tree = await this.parse(code)
    const a = adapter ?? new CppLanguageAdapter()
    const program = a.toSemanticNode(tree.rootNode)
    if (!program) {
      throw new Error('Failed to convert parse tree to semantic model')
    }
    return {
      program,
      metadata: { lineCount: code.split('\n').length },
    }
  }

  /** Detect coding style from code (T013) */
  detectStyle(code: string): Partial<CodingStyle> {
    const result: Partial<CodingStyle> = {}
    if (code.includes('cout') || code.includes('cin')) result.ioPreference = 'iostream'
    if (code.includes('printf') || code.includes('scanf')) result.ioPreference = 'cstdio'
    if (code.includes('#include <bits/')) result.headerStyle = 'bits'
    if (code.includes('#include <iostream>')) result.headerStyle = 'iostream'
    if (code.includes('using namespace std')) result.useNamespaceStd = true
    // Brace style detection
    if (/\)\s*\{/.test(code)) result.braceStyle = 'K&R'
    if (/\)\s*\n\s*\{/.test(code)) result.braceStyle = 'Allman'
    // Indent detection
    const indentMatch = code.match(/\n( +)\S/)
    if (indentMatch) result.indent = indentMatch[1].length
    return result
  }

  private getDefaultWasmDir(): string {
    // Browser environment: WASM files served from root
    const g = globalThis as Record<string, unknown>
    const proc = g['process'] as { cwd?: () => string } | undefined
    if (!proc?.cwd) {
      return ''
    }
    // Node.js / test environment: resolve from project root
    return proc.cwd() + '/public'
  }

  private joinPath(dir: string, file: string): string {
    if (!dir) return file
    return dir.endsWith('/') ? dir + file : dir + '/' + file
  }
}
