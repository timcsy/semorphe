import type { BlockRegistry } from '../../core/block-registry'
import type { BlockSpec } from '../../core/types'
import type { CppLanguageAdapter } from './adapter'

interface BlockJSON {
  type: string
  id?: string
  fields?: Record<string, unknown>
  inputs?: Record<string, { block: BlockJSON }>
  next?: { block: BlockJSON }
}

interface WorkspaceJSON {
  blocks: {
    languageVersion: number
    blocks: BlockJSON[]
  }
}

interface GenerateResult {
  code: string
  order: number
}

export class CppGenerator {
  private registry: BlockRegistry
  private collectedImports: Set<string> = new Set()
  private adapter: CppLanguageAdapter | null = null

  constructor(registry: BlockRegistry, adapter?: CppLanguageAdapter) {
    this.registry = registry
    this.adapter = adapter ?? null

    // Wire fallback so adapter can delegate non-u_* blocks back to generator
    if (this.adapter) {
      this.adapter.setFallbackCodeGen({
        statement: (block, indent) => {
          const result = this.generateBlock(block, indent)
          let code = result.code
          const trimmed = code.trimEnd()
          if (trimmed && !trimmed.endsWith(';') && !trimmed.endsWith('}') &&
              !trimmed.startsWith('#') && !trimmed.startsWith('//')) {
            code = trimmed + ';'
          }
          return code
        },
        expression: (block) => {
          const result = this.generateExpression(block, 0)
          return result.code
        },
      })
    }
  }

  getLanguageId(): string {
    return 'cpp'
  }

  generate(workspace: WorkspaceJSON): string {
    this.collectedImports = new Set()

    const topBlocks = workspace.blocks?.blocks ?? []
    const bodyParts: string[] = []

    for (const block of topBlocks) {
      const code = this.generateStatementChain(block, 0)
      if (code) bodyParts.push(code)
    }

    const body = bodyParts.join('\n')

    // Build imports section (auto-collected from codeTemplate.imports)
    const autoImports = Array.from(this.collectedImports).sort()
    const importLines = autoImports.map(h => `#include <${h}>`).join('\n')

    // Check if the body already has explicit #include directives
    // If so, don't duplicate them
    const existingIncludes = new Set<string>()
    const bodyLines = body.split('\n')
    for (const line of bodyLines) {
      const match = line.match(/^#include\s*<(.+?)>/)
      if (match) existingIncludes.add(match[1])
    }

    const filteredImports = autoImports
      .filter(h => !existingIncludes.has(h))
      .map(h => `#include <${h}>`)
      .join('\n')

    if (filteredImports) {
      return filteredImports + '\n\n' + body
    }

    return body
  }

  private generateStatementChain(block: BlockJSON, indent: number): string {
    const parts: string[] = []
    let current: BlockJSON | undefined = block

    while (current) {
      const code = this.generateBlock(current, indent)
      if (code.code) {
        let line = code.code
        const trimmed = line.trimEnd()
        // Auto-add semicolon for expression blocks used as statements
        if (trimmed && !trimmed.endsWith(';') && !trimmed.endsWith('}') &&
            !trimmed.startsWith('#') && !trimmed.startsWith('//')) {
          line = trimmed + ';'
          if (indent > 0) line = this.indent(line, 0) // preserve original indent
        }
        parts.push(line)
      }
      current = current.next?.block
    }

    return parts.join('\n')
  }

  private generateBlock(block: BlockJSON, indent: number): GenerateResult {
    const spec = this.registry.get(block.type)
    if (!spec) {
      return { code: this.indent(`/* unknown block: ${block.type} */`, indent), order: 0 }
    }

    // Universal blocks: delegate to adapter
    if (!spec.codeTemplate && this.adapter) {
      const code = this.adapter.generateCode(block.type, block as import('../../core/types').BlockJSON, indent)
      // Collect imports from adapter
      for (const imp of this.adapter.getAndClearImports()) {
        this.collectedImports.add(imp)
      }
      return { code, order: 0 }
    }

    if (!spec.codeTemplate) {
      return { code: this.indent(`/* universal block: ${block.type} */`, indent), order: 0 }
    }

    // Collect imports
    for (const imp of spec.codeTemplate.imports) {
      this.collectedImports.add(imp)
    }

    const pattern = spec.codeTemplate.pattern
    const code = this.substituteTemplate(pattern, block, spec, indent)

    return { code: this.indent(code, indent), order: spec.codeTemplate.order }
  }

  private generateExpression(block: BlockJSON, parentOrder: number): GenerateResult {
    const spec = this.registry.get(block.type)
    if (!spec) {
      return { code: `/* unknown: ${block.type} */`, order: 0 }
    }

    // Universal blocks: delegate to adapter
    if (!spec.codeTemplate && this.adapter) {
      const code = this.adapter.generateCode(block.type, block as import('../../core/types').BlockJSON, 0).trim()
      for (const imp of this.adapter.getAndClearImports()) {
        this.collectedImports.add(imp)
      }
      return { code, order: 20 } // atoms — no parens needed
    }

    if (!spec.codeTemplate) {
      return { code: `/* universal: ${block.type} */`, order: 0 }
    }

    // Collect imports
    for (const imp of spec.codeTemplate.imports) {
      this.collectedImports.add(imp)
    }

    const pattern = spec.codeTemplate.pattern
    const code = this.substituteTemplate(pattern, block, spec, 0)
    const order = spec.codeTemplate.order

    if (order <= parentOrder && order > 0 && order < 20) {
      return { code: `(${code})`, order }
    }

    return { code, order }
  }

  private substituteTemplate(pattern: string, block: BlockJSON, spec: BlockSpec, indent: number): string {
    return pattern.replace(/\$\{(\w+)\}/g, (_match, name: string) => {
      // Check fields first
      if (block.fields && name in block.fields) {
        return String(block.fields[name])
      }

      // Check inputs (value inputs and statement inputs)
      if (block.inputs && name in block.inputs) {
        const inputBlock = block.inputs[name].block
        if (inputBlock) {
          // Determine if this is a statement input (contains \n in the pattern after ${NAME})
          if (this.isStatementInput(pattern, name)) {
            return this.generateStatementChain(inputBlock, 1)
          } else {
            // Value input - generate as expression
            const result = this.generateExpression(inputBlock, spec.codeTemplate?.order ?? 0)
            // Strip trailing semicolon when a statement block is used as a value input
            let code = result.code
            if (code.endsWith(';')) code = code.slice(0, -1)
            return code
          }
        }
      }

      // Default: empty string for missing inputs
      return ''
    })
  }

  private isStatementInput(pattern: string, inputName: string): boolean {
    // A statement input is one where the placeholder is on its own line or preceded by \n
    const placeholder = '${' + inputName + '}'
    const idx = pattern.indexOf(placeholder)
    if (idx === -1) return false

    // Check if there's a \n before the placeholder
    const before = pattern.substring(0, idx)
    return before.endsWith('\n')
  }

  private indent(code: string, level: number): string {
    if (level === 0) return code
    const prefix = '    '.repeat(level)
    return code.split('\n').map(line => line ? prefix + line : line).join('\n')
  }
}
