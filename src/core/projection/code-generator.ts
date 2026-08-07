import { commentSyntax } from '../comment-syntax'
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
  /** Shared mutable line counter — survives indented(ctx) spread copies */
  _lineBox?: { value: number }
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

  // ── 註解那三個概念的**語法**已搬進語言套件（`src/core/comment-syntax.ts`）
  //
  // 核心層原本自己寫死 `//`、`/** *​/`、`/* *​/`。那違反 P9（拔掉 C++，
  // 核心仍能運作——Python 要 `#`），而**中立性護欄看不見它**：那條護欄找的
  // 是元件身分字串，這裡寫死的是語法符號。
  //
  // 概念身分留在核心（註解是所有語言共有的），語法下沉到語言套件。
  generators.set('comment', (node, ctx) =>
    commentSyntax().line(String(node.properties.text ?? ''), indent(ctx)),
  )

  generators.set('doc_comment', (node, ctx) => commentSyntax().doc(node.properties, indent(ctx)))

  generators.set('block_comment', (node, ctx) =>
    commentSyntax().block(String(node.properties.text ?? ''), indent(ctx)),
  )
}


/**
 * 「產不出來」的標記。
 *
 * **必須是共用常數，不能各處各寫一份。** 059 把它從 `/* … *​/` 改成 `⟨…⟩`
 * （核心不知道任何語言的註解怎麼寫），而介面層有一處用 `expr.startsWith('/*')`
 * 判斷「產生器有沒有回 fallback」——**那個判斷從此永遠為真，再也偵測不到
 * fallback，而沒有任何測試變紅**。
 *
 * 標記是兩個消費者共用的契約：產生它的人與辨認它的人。散成兩份字面就會漂移。
 */
export const UNGENERATABLE_PREFIX = '⟨'

/** 這段輸出是不是「產不出來」的標記？ */
export function isUngeneratable(code: string): boolean {
  return code.trimStart().startsWith(UNGENERATABLE_PREFIX)
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

/**
 * 產生一段**運算式**的程式碼——無分號、無縮排。
 *
 * ⚠️ 與 `generateCode` 的差別**不是格式偏好，是位置**。
 *
 * B 項把六對 statement／expression 雙版本合併成六個身分之後，「這個節點在哪個
 * 位置」不再由**身分**決定，而由呼叫端說。`generateCode` 講的是敘述位置；
 * 需要運算式的地方（例如變數面板的即時預覽）必須用這一個。
 *
 * 合併前那些地方靠的是「這個概念的身分是 `*_expr`」——**那是把位置編碼進身分**，
 * 正是被合併掉的那個雙重身分。
 */
export function generateExpressionCode(node: SemanticNode, language: string, style: StylePreset): string {
  const factory = languageFactories.get(language)
  const generators = factory ? factory(style) : new Map<string, NodeGenerator>()
  registerMetaConceptGenerators(generators)
  const ctx: GeneratorContext = { indent: 0, style, language, generators, isExpression: true }
  if (globalDependencyResolver) ctx.dependencyResolver = globalDependencyResolver
  wireTemplateFallbacks(ctx)
  return generateExpression(node, ctx).trim()
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
  const lineBox = { value: 0 }
  const ctx: GeneratorContext = { indent: 0, style, language, generators, _mappings: mappings, _lineCount: 0, _lineBox: lineBox }
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
    const generator = ctx.generators.get(node.conceptId)
    if (!generator) return null
    // Hand-written expression generators return just the expression text
    return generator(node, ctx)
  })
  tg.setBodyFallback((node, tgCtx) => {
    const generator = ctx.generators.get(node.conceptId)
    if (!generator) return null
    const bodyCtx = { ...ctx, indent: tgCtx.indent }
    return generator(node, bodyCtx)
  })
}

export function generateNode(node: SemanticNode, ctx: GeneratorContext): string {
  const nodeId = node.id
  const tracking = ctx._mappings && nodeId
  const box = ctx._lineBox

  const lineCountBefore = box?.value ?? ctx._lineCount ?? 0
  let startLine = 0
  if (tracking) {
    startLine = lineCountBefore
  }

  let result: string

  // Try JSON-driven template generator first
  const tg = ctx.templateGenerator ?? globalTemplateGenerator
  const templateResult = tg?.generate(node, { indent: ctx.indent, style: ctx.style, isExpression: ctx.isExpression }) ?? null

  if (templateResult !== null) {
    result = templateResult.endsWith('\n') ? templateResult : templateResult + '\n'
  } else {
    // Fall back to hand-written generators (including meta-concept generators)
    const generator = ctx.generators.get(node.conceptId)
    if (generator) {
      result = generator(node, ctx)
    } else {
      // 用語言中立的形式，不用 `/* *​/`——核心不知道任何語言怎麼寫註解
      result = `⟨unknown concept: ${node.conceptId}⟩\n`
    }
  }

  // Append inline annotations as trailing comments
  if (node.annotations?.length) {
    const inlineComments = node.annotations.filter(a => a.position === 'inline')
    if (inlineComments.length > 0) {
      const commentText = inlineComments.map(a => a.text).join('; ')
      // Insert trailing comment before the final newline
      const cs = commentSyntax()
      if (result.endsWith('\n')) {
        result = cs.trailing(result.slice(0, -1).trimEnd(), commentText) + '\n'
      } else {
        result = cs.trailing(result.trimEnd(), commentText)
      }
    }
  }

  // Update line count via shared box (survives indented() spread copies)
  if (ctx._mappings !== undefined) {
    const newlines = countNewlines(result)
    const endCount = lineCountBefore + newlines
    if (box) box.value = endCount
    ctx._lineCount = endCount

    if (tracking) {
      ctx._mappings.push({
        nodeId: nodeId!,
        startLine,
        endLine: endCount - 1,
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
  const n = countNewlines(text)
  if (ctx._lineBox) {
    ctx._lineBox.value += n
  }
  if (ctx._lineCount !== undefined) {
    ctx._lineCount += n
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
  const templateResult = tg?.generate(node, { indent: ctx.indent, style: ctx.style, isExpression: true }) ?? null
  if (templateResult !== null) return templateResult

  const exprCtx = ctx.isExpression ? ctx : { ...ctx, isExpression: true }
  const generator = exprCtx.generators.get(node.conceptId)
  if (generator) return generator(node, exprCtx)
  // Meta-concepts that carry raw code — expression context returns raw value without formatting
  if (node.metadata?.rawCode != null) return String(node.metadata.rawCode)
  return `⟨${node.conceptId}⟩`
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
