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

/**
 * 把節點攜帶的文字摘出來，附在未知概念的標記裡。
 *
 * **只取字串屬性**——數字與布林在標記裡讀不出意義，而字串通常就是使用者
 * 打進去的東西（註解的內容、原始碼片段、字面值）。
 *
 * 沒有字串屬性就什麼都不加，標記維持原樣。
 */
function contentDigest(node: SemanticNode): string {
  const value = Object.values(node.properties ?? {})
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
  return value.length > 0 ? ` | ${value.join(' | ')}` : ''
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
      // 用語言中立的形式，不用 `/* *​/`——核心不知道任何語言怎麼寫註解。
      //
      // ⚠️ **標記必須帶著內容一起出來**（2026-08-11）。
      //
      // 原本只印身分，於是一個認不得的節點**它攜帶的文字整段消失**——
      // 而那正是 FR-014 要擋的事（「註解憑空消失，使用者不會收到任何訊號，
      // 下一次來回轉換它就永遠不見了」）。
      //
      // 那條契約原本靠「核心自己留一份註解產生器」來滿足，而那讓
      // `cpp:comment` 那三顆**永遠搬不進膠囊**——核心必須認得它們。
      //
      // > **不要讓核心認得某一類節點，讓核心不要弄丟任何節點。**
      //
      // 註解是每個語言各自的機制（`//`／`#`／`;`），所以它的產生器屬於語言；
      // 而「沒有語言時不要弄丟內容」是**核心對所有節點的責任**，與註解無關。
      result = `⟨unknown concept: ${node.conceptId}${contentDigest(node)}⟩\n`
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
