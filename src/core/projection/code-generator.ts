import { commentSyntax } from '../comment-syntax'
import { roleOf } from '../component/traits'
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
  /**
   * 這棵樹裡宣告的 struct 名字——**C 目標的型別名要加 `struct` 標籤**。
   * ⚠️ 由語言套件填，核心只是傳遞（中立性：核心不認識 `cpp:struct_declare`）。
   */
  _structNames?: ReadonlySet<string>
  /** Optional dependency resolver for auto-include resolution */
  dependencyResolver?: DependencyResolver
  /** Optional program scaffold for boilerplate management */
  programScaffold?: ProgramScaffold
  /** Scaffold configuration (cognitive level, manual imports, pinned items) */
  scaffoldConfig?: ScaffoldConfig
  /** 目前目標的標頭替換表（spec 150）——⚠️ 省略 ＝ 不換。 */
  headerAliases?: Readonly<Record<string, string>>
}

// ─── Language module registry ───

const languageFactories = new Map<string, LanguageGeneratorFactory>()
let globalTemplateGenerator: TemplateGenerator | null = null
let globalDependencyResolver: DependencyResolver | null = null
let globalProgramScaffold: ProgramScaffold | null = null
let globalScaffoldConfig: ScaffoldConfig | null = null
/** 目前目標的標頭替換表——⚠️ `null` ＝ 不換任何標頭（既有目標的行為）。 */
let globalHeaderAliases: Readonly<Record<string, string>> | null = null

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

/**
 * 目前目標的標頭替換表（spec 150）。
 *
 * 🔴 **`undefined` 要真的清掉**——換到一個沒有替換表的目標時，
 * 上一塊板子的替換**不得留著**。（`setScaffoldConfig` 那一支沒有這個問題，
 * 因為它的參數是必填。）
 */
export function setHeaderAliases(aliases: Readonly<Record<string, string>> | undefined): void {
  globalHeaderAliases = aliases ?? null
}

export function registerLanguage(language: string, factory: LanguageGeneratorFactory): void {
  languageFactories.set(language, factory)
}

// ─── Meta-component generators ───

/** Register generators for meta-components (raw_code, unresolved, comment, doc_comment, block_comment) */
export function registerMetaComponentGenerators(generators: Map<string, NodeGenerator>): void {
  generators.set('raw_code', (node, ctx) => {
    const raw = String(node.metadata?.rawCode ?? node.properties.code ?? '')
    // 🔴 **運算式位置不縮排、不換行**（spec 157）。
    //
    // 原本無條件補 `\n` ＋ 縮排——而降級節點**會落在運算式位置**：
    // Python 的 `print("hi")` 裡，`"hi"` 還沒有元件，於是它是一顆 `raw_code`，
    // 產出變成 `print("hi"\n)`。
    //
    // ⚠️ 積木那一側**早就處理過同一件事**（`block-renderer` 的
    // 「語句位置的降級積木出現在運算式位置時換成運算式版」）
    // ——而**產生器這一側沒有人接**。
    //
    // > **同一個問題在兩個投影上各要處理一次，而修了一邊很容易以為修完了。**
    if (ctx.isExpression) return raw.trim()
    const indented = raw.startsWith('#') ? raw : indent(ctx) + raw
    return indented.endsWith('\n') ? indented : indented + '\n'
  })

  generators.set('unresolved', (node, ctx) => {
    const raw = String(node.metadata?.rawCode ?? '')
    if (ctx.isExpression) return raw.trim()   // 同上
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
  registerMetaComponentGenerators(generators)
  const ctx: GeneratorContext = { indent: 0, style, language, generators }
  if (globalDependencyResolver) ctx.dependencyResolver = globalDependencyResolver
  if (globalProgramScaffold) ctx.programScaffold = globalProgramScaffold
  if (globalScaffoldConfig) ctx.scaffoldConfig = globalScaffoldConfig
  if (globalHeaderAliases) ctx.headerAliases = globalHeaderAliases
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
  registerMetaComponentGenerators(generators)
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
  registerMetaComponentGenerators(generators)
  const mappings: CodeMapping[] = []
  const lineBox = { value: 0 }
  const ctx: GeneratorContext = { indent: 0, style, language, generators, _mappings: mappings, _lineCount: 0, _lineBox: lineBox }
  if (globalDependencyResolver) ctx.dependencyResolver = globalDependencyResolver
  if (globalProgramScaffold) ctx.programScaffold = globalProgramScaffold
  if (globalScaffoldConfig) ctx.scaffoldConfig = globalScaffoldConfig
  if (globalHeaderAliases) ctx.headerAliases = globalHeaderAliases
  wireTemplateFallbacks(ctx)
  const code = generateNode(tree, ctx).trim()
  return { code, mappings }
}

/** Wire hand-written generators as fallback for template generator's expression/body generation */
function wireTemplateFallbacks(ctx: GeneratorContext): void {
  const tg = ctx.templateGenerator ?? globalTemplateGenerator
  if (!tg) return
  tg.setExpressionFallback((node, _tgCtx) => {
    const generator = ctx.generators.get(node.componentId)
    if (!generator) return null
    // Hand-written expression generators return just the expression text
    return generator(node, ctx)
  })
  tg.setBodyFallback((node, tgCtx) => {
    const generator = ctx.generators.get(node.componentId)
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
    // Fall back to hand-written generators (including meta-component generators)
    const generator = ctx.generators.get(node.componentId)
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
      result = `⟨unknown component: ${node.componentId}${contentDigest(node)}⟩\n`
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
  const generator = exprCtx.generators.get(node.componentId)
  if (generator) return generator(node, exprCtx)
  // Meta-components that carry raw code — expression context returns raw value without formatting
  if (node.metadata?.rawCode != null) return String(node.metadata.rawCode)
  return `⟨${node.componentId}⟩`
}

export function indent(ctx: GeneratorContext): string {
  return ' '.repeat(ctx.indent * ctx.style.indent_size)
}

export function indented(ctx: GeneratorContext): GeneratorContext {
  return { ...ctx, indent: ctx.indent + 1 }
}

export function generateBody(nodes: SemanticNode[], ctx: GeneratorContext): string {
  return nodes.map(n => asStatement(n, generateNode(n, ctx), ctx)).join('')
}

/**
 * 🔴 **一個運算式出現在語句位置時，要補上分號與換行。**
 *
 * ## 為什麼（2026-08-17，盲測抓到）
 *
 * `dht.begin();` 的 `begin` 零引數，被 `cpp:container_iter`（迭代器取得）認走
 * ——而那是一顆**運算式**概念，產出是 `dht.begin()`：**沒有分號、沒有換行**。
 * 於是下一句直接黏上來：
 *
 * ```
 * 原始     dht.begin();  lcd.init();
 * 一次產出  "dht.begin()    lcd.init();"      🔴 兩句黏在一起
 * 二次產出  "    dht.begin().init();"         🔴 而第二次把它們合併成方法鏈
 * ```
 *
 * > **一次誤判本來只是「身分不對」，而少了這一層它會變成【產出無效程式碼】
 * > ——而無效的程式碼在下一次 lift 時會被讀成【另一個意思】。**
 *
 * ⚠️ **這不是在掩蓋誤判**：C++ 本來就有**運算式語句**，
 * 一個運算式出現在語句位置**是合法的**，它只是需要一個分號。
 * 誤判本身另外記（`cpp:container_iter` 認走了所有零引數的 `.begin()`）。
 *
 * ## 🔴 而判準是【問宣告】，不是看產出的形狀
 *
 * 第一版寫成「產出沒有以換行結尾 ⟹ 它是運算式」——**而那是猜的，而且錯**：
 * `cpp:loop_do_while` 是**語句**，而它的產出以 `} while (…);` 收尾**沒有換行**，
 * 於是被補了第二個分號（5 支既有測試當場紅）。
 *
 * > **一個「從產出的形狀反推它是什麼」的判準，
 * > 會在那個形狀有例外的時候安靜地做錯事——而宣告不會。**
 *
 * 現在問 `component.json` 的 `role`。⚠️ 認不得的（沒膠囊化、或核心自己的元概念）
 * **原樣放行**——保守的方向是「少補一個分號」，不是「多補一個」。
 *
 * ## ⚠️ 而它只在【縮排大於零】時作用——也就是**函式體裡面**
 *
 * 第二版在最外層也補，於是完備性護欄的 9 筆判定翻掉了：那條護欄把合成節點包進
 * 一個**沒有 `int main` 的** `cpp:program`，所以它的「語句」在**編譯單元層級**
 * ——而在那裡，`-5` 與 `-5;` **都不合法**，補分號救不了它，只是換一條錯誤復原路徑。
 *
 * > **兩種都是壞的合成環境；改動只是換了它壞的方式。**
 *
 * 而那條護欄的檔頭記著「**量測工具的改動也會讓量測變差，而那一樣要被發現**」
 * ——所以**不動它**，改成只在真正需要分號的地方作用。
 * 🔴 判準：**函式體裡的裸運算式是合法的運算式語句，而編譯單元層級的不是。**
 */
function asStatement(node: SemanticNode, text: string, ctx: GeneratorContext): string {
  if (text === '' || text.endsWith('\n') || ctx.indent === 0) return text
  return roleOf(node.componentId) === 'expression' ? `${indent(ctx)}${text};\n` : text
}
