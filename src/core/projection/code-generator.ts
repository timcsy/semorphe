import type { SemanticNode, StylePreset } from '../types'
import type { DependencyResolver } from '../dependency-resolver'
import type { ProgramScaffold, ScaffoldConfig } from '../program-scaffold'
import { TemplateGenerator } from './template-generator'

export type NodeGenerator = (node: SemanticNode, ctx: GeneratorContext) => string

export type LanguageGeneratorFactory = (style: StylePreset) => Map<string, NodeGenerator>

export interface CodeMapping {
  nodeId: string
  startLine: number
  endLine: number
}

export interface BlockMapping {
  nodeId: string
  blockId: string
}

export interface GeneratorContext {
  indent: number
  style: StylePreset
  language: string
  generators: Map<string, NodeGenerator>
  templateGenerator?: TemplateGenerator
  isExpression?: boolean
  _mappings?: CodeMapping[]
  _lineCount?: number
  /** Optional dependency resolver for auto-include resolution */
  dependencyResolver?: DependencyResolver
  /** Optional program scaffold for boilerplate management */
  programScaffold?: ProgramScaffold
  /** Scaffold configuration (cognitive level, manual imports, pinned items) */
  scaffoldConfig?: ScaffoldConfig
}

// ─── Language module registry ───

const languageFactories = new Map<string, LanguageGeneratorFactory>()
let globalTemplateGenerator: TemplateGenerator | null = null
let globalDependencyResolver: DependencyResolver | null = null
let globalProgramScaffold: ProgramScaffold | null = null
let globalScaffoldConfig: ScaffoldConfig | null = null

/** Set the JSON-driven template generator engine */
export function setTemplateGenerator(tg: TemplateGenerator): void {
  globalTemplateGenerator = tg
}

/** Set the dependency resolver for auto-include resolution */
export function setDependencyResolver(resolver: DependencyResolver): void {
  globalDependencyResolver = resolver
}

/** Set the program scaffold for boilerplate management */
export function setProgramScaffold(scaffold: ProgramScaffold): void {
  globalProgramScaffold = scaffold
}

/** Set the scaffold configuration (cognitive level, etc.) */
export function setScaffoldConfig(config: ScaffoldConfig): void {
  globalScaffoldConfig = config
}

export function registerLanguage(language: string, factory: LanguageGeneratorFactory): void {
  languageFactories.set(language, factory)
}

// ─── Meta-concept generators ───

/** Register generators for meta-concepts (raw_code, unresolved, comment, doc_comment, block_comment) */
export function registerMetaConceptGenerators(generators: Map<string, NodeGenerator>): void {
  generators.set('raw_code', (node, ctx) => {
    const raw = String(node.metadata?.rawCode ?? node.properties.code ?? '')
    const indented = raw.startsWith('#') ? raw : indent(ctx) + raw
    return indented.endsWith('\n') ? indented : indented + '\n'
  })

  generators.set('unresolved', (node, _ctx) => {
    const raw = String(node.metadata?.rawCode ?? '')
    return raw.endsWith('\n') ? raw : raw + '\n'
  })

  generators.set('comment', (node, ctx) => {
    return `${indent(ctx)}// ${node.properties.text}\n`
  })

  generators.set('doc_comment', (node, ctx) => {
    const ind = indent(ctx)
    let result = `${ind}/**\n`
    if (node.properties.brief) {
      const briefText = String(node.properties.brief)
      const hasTags = node.properties.param_0_name !== undefined || node.properties.return_desc !== undefined
      if (briefText.includes('\n') && !hasTags) {
        for (const line of briefText.split('\n')) {
          result += `${ind} * ${line}\n`
        }
      } else if (briefText.includes('\n')) {
        const lines = briefText.split('\n')
        result += `${ind} * @brief ${lines[0]}\n`
        for (let j = 1; j < lines.length; j++) {
          result += `${ind} * ${lines[j]}\n`
        }
      } else {
        result += `${ind} * @brief ${briefText}\n`
      }
    }
    let i = 0
    while (node.properties[`param_${i}_name`] !== undefined) {
      const name = node.properties[`param_${i}_name`]
      const desc = node.properties[`param_${i}_desc`] ?? ''
      result += `${ind} * @param ${name}${desc ? ' ' + desc : ''}\n`
      i++
    }
    if (node.properties.return_desc) {
      result += `${ind} * @return ${node.properties.return_desc}\n`
    }
    result += `${ind} */\n`
    return result
  })

  generators.set('block_comment', (node, ctx) => {
    const text = String(node.properties.text ?? '')
    if (text.includes('\n')) {
      const lines = text.split('\n')
      let result = `${indent(ctx)}/*\n`
      for (const line of lines) {
        result += `${indent(ctx)} * ${line.trim()}\n`
      }
      result += `${indent(ctx)} */\n`
      return result
    }
    return `${indent(ctx)}/* ${text} */\n`
  })
}

// ─── Public API ───

export function generateCode(tree: SemanticNode, language: string, style: StylePreset): string {
  const factory = languageFactories.get(language)
  const generators = factory ? factory(style) : new Map<string, NodeGenerator>()
  registerMetaConceptGenerators(generators)
  const ctx: GeneratorContext = { indent: 0, style, language, generators }
  if (globalDependencyResolver) ctx.dependencyResolver = globalDependencyResolver
  if (globalProgramScaffold) ctx.programScaffold = globalProgramScaffold
  if (globalScaffoldConfig) ctx.scaffoldConfig = globalScaffoldConfig
  wireTemplateFallbacks(ctx)
  return generateNode(tree, ctx).trim()
}

export function generateCodeWithMapping(
  tree: SemanticNode,
  language: string,
  style: StylePreset,
): { code: string; mappings: CodeMapping[] } {
  const factory = languageFactories.get(language)
  const generators = factory ? factory(style) : new Map<string, NodeGenerator>()
  registerMetaConceptGenerators(generators)
  const mappings: CodeMapping[] = []
  const ctx: GeneratorContext = { indent: 0, style, language, generators, _mappings: mappings, _lineCount: 0 }
  if (globalDependencyResolver) ctx.dependencyResolver = globalDependencyResolver
  if (globalProgramScaffold) ctx.programScaffold = globalProgramScaffold
  if (globalScaffoldConfig) ctx.scaffoldConfig = globalScaffoldConfig
  wireTemplateFallbacks(ctx)
  const code = generateNode(tree, ctx).trim()
  return { code, mappings }
}

/** Wire hand-written generators as fallback for template generator's expression/body generation */
function wireTemplateFallbacks(ctx: GeneratorContext): void {
  const tg = ctx.templateGenerator ?? globalTemplateGenerator
  if (!tg) return
  tg.setExpressionFallback((node, _tgCtx) => {
    const generator = ctx.generators.get(node.concept)
    if (!generator) return null
    // Hand-written expression generators return just the expression text
    return generator(node, ctx)
  })
  tg.setBodyFallback((node, tgCtx) => {
    const generator = ctx.generators.get(node.concept)
    if (!generator) return null
    const bodyCtx = { ...ctx, indent: tgCtx.indent }
    return generator(node, bodyCtx)
  })
}

export function generateNode(node: SemanticNode, ctx: GeneratorContext): string {
  const nodeId = node.id
  const tracking = ctx._mappings && nodeId

  const lineCountBefore = ctx._lineCount ?? 0
  let startLine = 0
  if (tracking) {
    startLine = lineCountBefore
  }

  let result: string

  // Try JSON-driven template generator first
  const tg = ctx.templateGenerator ?? globalTemplateGenerator
  const templateResult = tg?.generate(node, { indent: ctx.indent, style: ctx.style }) ?? null

  if (templateResult !== null) {
    result = templateResult.endsWith('\n') ? templateResult : templateResult + '\n'
  } else {
    // Fall back to hand-written generators (including meta-concept generators)
    const generator = ctx.generators.get(node.concept)
    if (generator) {
      result = generator(node, ctx)
    } else {
      result = `/* unknown concept: ${node.concept} */\n`
    }
  }

  // Append inline annotations as trailing comments
  if (node.annotations?.length) {
    const inlineComments = node.annotations.filter(a => a.position === 'inline')
    if (inlineComments.length > 0) {
      const commentText = inlineComments.map(a => a.text).join('; ')
      // Insert trailing comment before the final newline
      if (result.endsWith('\n')) {
        result = result.slice(0, -1).trimEnd() + ' // ' + commentText + '\n'
      } else {
        result = result.trimEnd() + ' // ' + commentText
      }
    }
  }

  // Update line count — use lineCountBefore + totalNewlines to avoid double-counting
  // when child generateNode calls already incremented _lineCount during the generator
  if (ctx._mappings !== undefined) {
    const newlines = countNewlines(result)
    ctx._lineCount = lineCountBefore + newlines

    if (tracking) {
      ctx._mappings.push({
        nodeId: nodeId!,
        startLine,
        endLine: ctx._lineCount - 1,
      })
    }
  }

  return result
}

/**
 * Call from compound generators (func_def, if, while, etc.) to update _lineCount
 * for header text BEFORE generating child nodes via generateBody/generateNode.
 * This ensures children see the correct starting line number.
 */
export function trackOwnText(ctx: GeneratorContext, text: string): void {
  if (ctx._lineCount !== undefined) {
    ctx._lineCount += countNewlines(text)
  }
}

function countNewlines(s: string): number {
  let count = 0
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 10) count++
  }
  return count
}

export function generateExpression(node: SemanticNode, ctx: GeneratorContext): string {
  if (!node) return ''

  // Try JSON-driven template generator first
  const tg = ctx.templateGenerator ?? globalTemplateGenerator
  const templateResult = tg?.generate(node, { indent: ctx.indent, style: ctx.style }) ?? null
  if (templateResult !== null) return templateResult

  const exprCtx = ctx.isExpression ? ctx : { ...ctx, isExpression: true }
  const generator = exprCtx.generators.get(node.concept)
  if (generator) return generator(node, exprCtx)
  if (node.concept === 'raw_code') return node.metadata?.rawCode ?? ''
  if (node.concept === 'unresolved') return node.metadata?.rawCode ?? ''
  return `/* ${node.concept} */`
}

export function indent(ctx: GeneratorContext): string {
  return ' '.repeat(ctx.indent * ctx.style.indent_size)
}

export function indented(ctx: GeneratorContext): GeneratorContext {
  return { ...ctx, indent: ctx.indent + 1 }
}

export function generateBody(nodes: SemanticNode[], ctx: GeneratorContext): string {
  return nodes.map(n => generateNode(n, ctx)).join('')
}
