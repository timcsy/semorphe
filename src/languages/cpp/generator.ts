import type { BlockRegistry } from '../../core/block-registry'
import type { BlockSpec } from '../../core/types'
import type { CppLanguageAdapter } from './adapter'
import type { SemanticModel, SemanticNode } from '../../core/semantic-model'
import type { CodingStyle } from '../style'
// Generator interface fulfilled by generateFromModel method

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

  /** Generator interface: generate from SemanticModel + CodingStyle */
  generateFromModel(model: SemanticModel, style: CodingStyle): string {
    const imports = new Set<string>()
    const program = model.program
    const body = Array.isArray(program.children.body) ? program.children.body : []
    const indent = ' '.repeat(style.indent)

    const parts: string[] = []
    for (const node of body) {
      if (node.concept === 'cpp:include') {
        parts.push(`#include <${node.properties.header}>`)
        continue
      }
      if (node.concept === 'cpp:using_namespace') {
        parts.push(`using namespace ${node.properties.namespace};`)
        continue
      }
      const code = this.genStmt(node, 0, style, indent, imports)
      if (code) parts.push(code)
    }

    // Prepend auto-detected imports
    const existingHeaders = new Set<string>()
    for (const p of parts) {
      const m = p.match(/^#include\s*<(.+?)>/)
      if (m) existingHeaders.add(m[1])
    }
    const autoImports = Array.from(imports)
      .filter(h => !existingHeaders.has(h))
      .sort()
      .map(h => `#include <${h}>`)
    if (autoImports.length > 0) {
      return autoImports.join('\n') + '\n\n' + parts.join('\n')
    }
    return parts.join('\n')
  }

  private genStmt(node: SemanticNode, level: number, style: CodingStyle, ind: string, imports: Set<string>): string {
    const prefix = ind.repeat(level)
    const p = node.properties
    const c = node.children

    switch (node.concept) {
      case 'var_declare': {
        const init = c.initializer && !Array.isArray(c.initializer)
          ? ` = ${this.genExprSem(c.initializer, style, imports)}` : ''
        return `${prefix}${p.type} ${p.name}${init};`
      }
      case 'var_assign':
        return `${prefix}${p.name} = ${c.value && !Array.isArray(c.value) ? this.genExprSem(c.value, style, imports) : ''};`
      case 'if': {
        const cond = c.condition && !Array.isArray(c.condition) ? this.genExprSem(c.condition, style, imports) : ''
        const thenBody = Array.isArray(c.then_body) ? c.then_body : []
        const elseBody = Array.isArray(c.else_body) ? c.else_body : []
        const openBrace = style.braceStyle === 'K&R' ? ' {' : '\n' + prefix + '{'
        let code = `${prefix}if (${cond})${openBrace}\n`
        code += thenBody.map(s => this.genStmt(s, level + 1, style, ind, imports)).join('\n')
        if (elseBody.length > 0) {
          const closeThenBrace = style.braceStyle === 'K&R' ? `\n${prefix}} else${openBrace}\n` : `\n${prefix}}\n${prefix}else${openBrace}\n`
          code += closeThenBrace
          code += elseBody.map(s => this.genStmt(s, level + 1, style, ind, imports)).join('\n')
        }
        code += `\n${prefix}}`
        return code
      }
      case 'count_loop': {
        const varName = p.var_name ?? 'i'
        const from = c.from && !Array.isArray(c.from) ? this.genExprSem(c.from, style, imports) : '0'
        const to = c.to && !Array.isArray(c.to) ? this.genExprSem(c.to, style, imports) : '0'
        const body = Array.isArray(c.body) ? c.body : []
        const openBrace = style.braceStyle === 'K&R' ? ' {' : '\n' + prefix + '{'
        let code = `${prefix}for (int ${varName} = ${from}; ${varName} <= ${to}; ${varName}++)${openBrace}\n`
        code += body.map(s => this.genStmt(s, level + 1, style, ind, imports)).join('\n')
        code += `\n${prefix}}`
        return code
      }
      case 'while_loop': {
        const cond = c.condition && !Array.isArray(c.condition) ? this.genExprSem(c.condition, style, imports) : ''
        const body = Array.isArray(c.body) ? c.body : []
        const openBrace = style.braceStyle === 'K&R' ? ' {' : '\n' + prefix + '{'
        let code = `${prefix}while (${cond})${openBrace}\n`
        code += body.map(s => this.genStmt(s, level + 1, style, ind, imports)).join('\n')
        code += `\n${prefix}}`
        return code
      }
      case 'break':
        return `${prefix}break;`
      case 'continue':
        return `${prefix}continue;`
      case 'func_def': {
        const params = typeof p.params === 'string' ? JSON.parse(p.params) as { type: string; name: string }[] : []
        const paramStr = params.map(pp => `${pp.type} ${pp.name}`).join(', ')
        const body = Array.isArray(c.body) ? c.body : []
        const openBrace = style.braceStyle === 'K&R' ? ' {' : '\n' + prefix + '{'
        let code = `${prefix}${p.return_type} ${p.name}(${paramStr})${openBrace}\n`
        code += body.map(s => this.genStmt(s, level + 1, style, ind, imports)).join('\n')
        code += `\n${prefix}}`
        return code
      }
      case 'func_call':
        return `${prefix}${this.genExprSem(node, style, imports)};`
      case 'return': {
        const val = c.value && !Array.isArray(c.value) ? ` ${this.genExprSem(c.value, style, imports)}` : ''
        return `${prefix}return${val};`
      }
      case 'print': {
        const values = Array.isArray(c.values) ? c.values : []
        if (style.ioPreference === 'cstdio') {
          imports.add('cstdio')
          const parts: string[] = []
          const args: string[] = []
          for (const v of values) {
            if (v.concept === 'endl') {
              parts.push('\\n')
            } else if (v.concept === 'string_literal') {
              parts.push(String(v.properties.value ?? ''))
            } else {
              const expr = this.genExprSem(v, style, imports)
              const fmt = this.inferPrintfFormat(v)
              parts.push(fmt)
              args.push(expr)
            }
          }
          const fmtStr = parts.join('')
          if (args.length > 0) {
            return `${prefix}printf("${fmtStr}", ${args.join(', ')});`
          }
          return `${prefix}printf("${fmtStr}");`
        }
        imports.add('iostream')
        const exprs = values.map(v => this.genExprSem(v, style, imports))
        return `${prefix}cout << ${exprs.join(' << ')};`
      }
      case 'input': {
        const variable = String(p.variable ?? '')
        const vars = variable.split(',').filter(Boolean)
        if (style.ioPreference === 'cstdio') {
          imports.add('cstdio')
          const fmts = vars.map(() => '%d').join('')
          return `${prefix}scanf("${fmts}", ${vars.map(v => `&${v}`).join(', ')});`
        }
        imports.add('iostream')
        return `${prefix}cin >> ${vars.join(' >> ')};`
      }
      case 'array_declare':
        return `${prefix}${p.type} ${p.name}[${p.size}];`
      default:
        return `${prefix}/* ${node.concept} */`
    }
  }

  private genExprSem(node: SemanticNode, style: CodingStyle, imports: Set<string>): string {
    const p = node.properties
    const c = node.children

    switch (node.concept) {
      case 'var_ref':
        return String(p.name ?? '')
      case 'number_literal':
        return String(p.value ?? '0')
      case 'string_literal':
        return `"${p.value ?? ''}"`
      case 'arithmetic':
      case 'compare':
      case 'logic': {
        const left = c.left && !Array.isArray(c.left) ? this.genExprSem(c.left, style, imports) : ''
        const right = c.right && !Array.isArray(c.right) ? this.genExprSem(c.right, style, imports) : ''
        return `${left} ${p.operator} ${right}`
      }
      case 'logic_not': {
        const operand = c.operand && !Array.isArray(c.operand) ? this.genExprSem(c.operand, style, imports) : ''
        return `!${operand}`
      }
      case 'func_call': {
        const args = Array.isArray(c.args) ? c.args.map(a => this.genExprSem(a, style, imports)) : []
        return `${p.name}(${args.join(', ')})`
      }
      case 'array_access': {
        const idx = c.index && !Array.isArray(c.index) ? this.genExprSem(c.index, style, imports) : ''
        return `${p.name}[${idx}]`
      }
      case 'endl':
        return 'endl'
      default:
        return `/* ${node.concept} */`
    }
  }

  /** Infer printf format specifier from a SemanticNode */
  private inferPrintfFormat(node: SemanticNode): string {
    switch (node.concept) {
      case 'string_literal':
        return '%s'
      case 'number_literal': {
        const val = String(node.properties.value ?? '0')
        return val.includes('.') ? '%f' : '%d'
      }
      case 'arithmetic':
      case 'array_access':
      case 'var_ref':
        return '%d'  // default to int for expressions
      case 'func_call':
        return '%d'
      default:
        return '%d'
    }
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

  private substituteTemplate(pattern: string, block: BlockJSON, spec: BlockSpec, _indent: number): string {
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
