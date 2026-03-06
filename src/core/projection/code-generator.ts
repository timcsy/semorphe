import type { SemanticNode, StylePreset } from '../types'

export type NodeGenerator = (node: SemanticNode, ctx: GeneratorContext) => string

export type LanguageGeneratorFactory = (style: StylePreset) => Map<string, NodeGenerator>

export interface GeneratorContext {
  indent: number
  style: StylePreset
  language: string
  generators: Map<string, NodeGenerator>
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

export function generateNode(node: SemanticNode, ctx: GeneratorContext): string {
  const generator = ctx.generators.get(node.concept)
  if (generator) return generator(node, ctx)

  // raw_code fallback
  if (node.concept === 'raw_code') {
    return node.metadata?.rawCode ?? ''
  }

  // comment node
  if (node.concept === 'comment') {
    return `${indent(ctx)}// ${node.properties.text}\n`
  }

  return `/* unknown concept: ${node.concept} */\n`
}

export function generateExpression(node: SemanticNode, ctx: GeneratorContext): string {
  const generator = ctx.generators.get(node.concept)
  if (generator) return generator(node, ctx)
  if (node.concept === 'raw_code') return node.metadata?.rawCode ?? ''
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
