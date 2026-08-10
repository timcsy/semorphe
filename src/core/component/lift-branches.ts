/**
 * 「膠囊自己的辨識分支」——**帶真邏輯的那一種**
 *
 * ## 為什麼登錄表不夠
 *
 * `call-concepts`／`method-concepts` 收的是**純資料**：名字 → 身分 ＋ 引數槽名。
 * 而 `lifters/io.ts` 剩下的分支有真的判別邏輯：
 *
 * ```ts
 * if (funcName === 'strncpy' && argChildren.length === 3) { … }   // 依引數個數消歧
 * case 'erase':                                                    // 依引數個數分派給
 *   return argChildren.length === 2 ? 字串版 : 容器版               //   兩顆不同的元件
 * ```
 *
 * 那些**不是資料**，塞不進登錄表。而它們仍然屬於那顆元件——
 * 「`strncpy` 帶三個引數時是我」這句話是元件的知識，不是路由器的知識。
 *
 * > **路由器該知道的是「去問誰」，不是「答案是什麼」。**
 *
 * ## 契約
 *
 * 分支回傳 `null` = 「這一段不是我」，路由器繼續問下一個。
 * 回傳節點 = 認領，路由器立刻返回。
 *
 * ⚠️ **分支之間必須互斥。** 兩個分支都認領同一段語法時，先登錄的贏
 * ——而登錄順序來自 `import.meta.glob` 的檔名排序，**那不是任何人設計的**。
 * 這個專案已經被「後註冊的贏」咬過三次；這裡的處置是
 * `assertNoOverlap()` 由護欄在測試期呼叫，不是靠約定。
 */
import type { AstNode, LiftContext } from '../lift/types'
import type { SemanticNode } from '../types'

/** 自由函式呼叫的分支：`foo(a, b)`。 */
export type CallBranch = (
  funcName: string,
  argChildren: readonly AstNode[],
  ctx: LiftContext,
  argsNode: AstNode | null,
) => SemanticNode | null

/** 方法呼叫的分支：`obj.method(a, b)`。 */
export type MethodBranch = (
  obj: string,
  method: string,
  argChildren: readonly AstNode[],
  ctx: LiftContext,
) => SemanticNode | null

const 函式分支: { 來源: string; fn: CallBranch }[] = []
const 方法分支: { 來源: string; fn: MethodBranch }[] = []

/** @param 來源 誰登錄的——膠囊填自己的資料夾，讓護欄指得出名字 */
export function registerCallBranch(來源: string, fn: CallBranch): void {
  函式分支.push({ 來源, fn })
}

export function registerMethodBranch(來源: string, fn: MethodBranch): void {
  方法分支.push({ 來源, fn })
}

/** 依序問每一個分支。**第一個認領的贏**，其餘不再問。 */
export function tryCallBranches(
  funcName: string,
  argChildren: readonly AstNode[],
  ctx: LiftContext,
  argsNode: AstNode | null,
): SemanticNode | null {
  for (const b of 函式分支) {
    const n = b.fn(funcName, argChildren, ctx, argsNode)
    if (n) return n
  }
  return null
}

export function tryMethodBranches(
  obj: string,
  method: string,
  argChildren: readonly AstNode[],
  ctx: LiftContext,
): SemanticNode | null {
  for (const b of 方法分支) {
    const n = b.fn(obj, method, argChildren, ctx)
    if (n) return n
  }
  return null
}

/** 護欄用：登錄了哪些分支、各是誰。 */
export function liftBranchSources(): { 種類: '函式' | '方法'; 來源: string }[] {
  return [
    ...函式分支.map((b) => ({ 種類: '函式' as const, 來源: b.來源 })),
    ...方法分支.map((b) => ({ 種類: '方法' as const, 來源: b.來源 })),
  ]
}

/**
 * **AST 節點型別的分支**——最一般的一種
 *
 * `core/lifters/{expressions,statements,declarations}.ts` 的形狀是
 * 「一個 AST 型別 → 一個函式 → 好幾顆身分」：
 *
 * ```ts
 * lifter.register('assignment_expression', (node, ctx) => {
 *   if (左邊是下標) return createNode('cpp:array_assign', …)
 *   if (左邊是解參考) return createNode('cpp:pointer_assign', …)
 *   return createNode('cpp:var_assign', …)
 * })
 * ```
 *
 * 那個 if 鏈**不是路由，是四顆元件各自的判別**——「左邊長成下標時是我」
 * 是 `array_assign` 的知識。
 *
 * → 共用檔登錄一次 AST 型別，然後**依序問登錄的分支**；認不得才走它自己的退路。
 *
 * ⚠️ **每個分支自己重新看一次 AST。** 那是重複幾行解析的代價，
 * 換來的是「判別跟著元件走」。共用一份解析結果會逼所有分支同意一個中間表示，
 * 而**那個中間表示會變成第二個要維護的契約**。
 */
export type AstBranch = (node: AstNode, ctx: LiftContext) => SemanticNode | null

const AST分支 = new Map<string, { 來源: string; fn: AstBranch }[]>()

export function registerAstBranch(astType: string, 來源: string, fn: AstBranch): void {
  const arr = AST分支.get(astType) ?? []
  arr.push({ 來源, fn })
  AST分支.set(astType, arr)
}

/** 依序問。**第一個認領的贏**；都不認就回 `null`，共用檔走自己的退路。 */
export function tryAstBranches(astType: string, node: AstNode, ctx: LiftContext): SemanticNode | null {
  for (const b of AST分支.get(astType) ?? []) {
    const n = b.fn(node, ctx)
    if (n) return n
  }
  return null
}

/** 護欄用。 */
export function astBranchSources(): { astType: string; 來源: string }[] {
  return [...AST分支.entries()].flatMap(([t, a]) => a.map((b) => ({ astType: t, 來源: b.來源 })))
}
