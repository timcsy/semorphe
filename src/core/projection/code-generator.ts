import type { SemanticNode, StylePreset } from '../types'
import { TemplateGenerator } from './template-generator'

export type NodeGenerator = (node: SemanticNode, ctx: GeneratorContext) => string

export type LanguageGeneratorFactory = (style: StylePreset) => Map<string, NodeGenerator>

export interface SourceMapping {
  blockId: string
  startLine: number
  endLine: number
}

export interface GeneratorContext {
  indent: number
  style: StylePreset
  language: string
  generators: Map<string, NodeGenerator>
  templateGenerator?: TemplateGenerator
  isExpression?: boolean
  _mappings?: SourceMapping[]
  _lineCount?: number
}

// ─── Language module registry ───

const languageFactories = new Map<string, LanguageGeneratorFactory>()
let globalTemplateGenerator: TemplateGenerator | null = null

/** Set the JSON-driven template generator engine */
export function setTemplateGenerator(tg: TemplateGenerator): void {
  globalTemplateGenerator = tg
}

export function registerLanguage(language: string, factory: LanguageGeneratorFactory): void {
  languageFactories.set(language, factory)
}

// ─── Public API ───

export function generateCode(tree: SemanticNode, language: string, style: StylePreset): string {
  const factory = languageFactories.get(language)
  const generators = factory ? factory(style) : new Map<string, NodeGenerator>()
  const ctx: GeneratorContext = { indent: 0, style, language, generators }
  wireTemplateFallbacks(ctx)
  return generateNode(tree, ctx).trim()
}

export function generateCodeWithMapping(
  tree: SemanticNode,
  language: string,
  style: StylePreset,
): { code: string; mappings: SourceMapping[] } {
  const factory = languageFactories.get(language)
  const generators = factory ? factory(style) : new Map<string, NodeGenerator>()
  const mappings: SourceMapping[] = []
  const ctx: GeneratorContext = { indent: 0, style, language, generators, _mappings: mappings, _lineCount: 0 }
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
  const blockId = (node.metadata as Record<string, unknown> | undefined)?.blockId as string | undefined
  const tracking = ctx._mappings && blockId

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
    // Fall back to hand-written generators
    const generator = ctx.generators.get(node.concept)
    if (generator) {
      result = generator(node, ctx)
    } else if (node.concept === 'raw_code') {
      const raw = node.metadata?.rawCode ?? node.properties.code ?? ''
      const indented = raw.startsWith('#') ? raw : indent(ctx) + raw  // Don't indent preprocessor directives
      result = indented.endsWith('\n') ? indented : indented + '\n'
    } else if (node.concept === 'unresolved') {
      const raw = node.metadata?.rawCode ?? ''
      result = raw.endsWith('\n') ? raw : raw + '\n'
    } else if (node.concept === 'comment') {
      result = `${indent(ctx)}// ${node.properties.text}\n`
    } else if (node.concept === 'doc_comment') {
      const ind = indent(ctx)
      result = `${ind}/**\n`
      if (node.properties.brief) {
        const briefText = node.properties.brief
        const hasTags = node.properties.param_0_name !== undefined || node.properties.return_desc !== undefined
        if (briefText.includes('\n') && !hasTags) {
          // Multi-line description without tags: output as plain lines
          for (const line of briefText.split('\n')) {
            result += `${ind} * ${line}\n`
          }
        } else if (briefText.includes('\n')) {
          // Multi-line with tags: first line as @brief, rest as continuation
          const lines = briefText.split('\n')
          result += `${ind} * @brief ${lines[0]}\n`
          for (let j = 1; j < lines.length; j++) {
            result += `${ind} * ${lines[j]}\n`
          }
        } else {
          result += `${ind} * @brief ${briefText}\n`
        }
      }
      // Collect params: param_0_name, param_0_desc, param_1_name, ...
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
    } else if (node.concept === 'block_comment') {
      const text = node.properties.text ?? ''
      if (text.includes('\n')) {
        const lines = text.split('\n')
        result = `${indent(ctx)}/*\n`
        for (const line of lines) {
          result += `${indent(ctx)} * ${line.trim()}\n`
        }
        result += `${indent(ctx)} */\n`
      } else {
        result = `${indent(ctx)}/* ${text} */\n`
      }
    } else {
      result = `/* unknown concept: ${node.concept} */\n`
    }
  }

  // Update line count — use lineCountBefore + totalNewlines to avoid double-counting
  // when child generateNode calls already incremented _lineCount during the generator
  if (ctx._mappings !== undefined) {
    const newlines = countNewlines(result)
    ctx._lineCount = lineCountBefore + newlines

    if (tracking) {
      ctx._mappings.push({
        blockId: blockId!,
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
