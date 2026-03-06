import type { SemanticNode, StylePreset } from '../types'

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
  _mappings?: SourceMapping[]
  _lineCount?: number
}

// ─── Language module registry ───

const languageFactories = new Map<string, LanguageGeneratorFactory>()

export function registerLanguage(language: string, factory: LanguageGeneratorFactory): void {
  languageFactories.set(language, factory)
}

// ─── Public API ───

export function generateCode(tree: SemanticNode, language: string, style: StylePreset): string {
  const factory = languageFactories.get(language)
  const generators = factory ? factory(style) : new Map<string, NodeGenerator>()
  const ctx: GeneratorContext = { indent: 0, style, language, generators }
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
  const code = generateNode(tree, ctx).trim()
  return { code, mappings }
}

export function generateNode(node: SemanticNode, ctx: GeneratorContext): string {
  const blockId = (node.metadata as Record<string, unknown> | undefined)?.blockId as string | undefined
  const tracking = ctx._mappings && blockId

  let startLine = 0
  if (tracking) {
    startLine = ctx._lineCount ?? 0
  }

  let result: string
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
  } else {
    result = `/* unknown concept: ${node.concept} */\n`
  }

  // Update line count
  if (ctx._mappings !== undefined) {
    const newlines = countNewlines(result)
    ctx._lineCount = (ctx._lineCount ?? 0) + newlines

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

function countNewlines(s: string): number {
  let count = 0
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 10) count++
  }
  return count
}

export function generateExpression(node: SemanticNode, ctx: GeneratorContext): string {
  const generator = ctx.generators.get(node.concept)
  if (generator) return generator(node, ctx)
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
