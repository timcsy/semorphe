/**
 * **一份參數列排得合不合法**——函式／lambda 的 `params` 那一格（共用的結構節點 `param_decl`）。
 *
 * ## 它為什麼存在（第 428 刀）
 *
 * 瀏覽器實測：`def f(*a, *b)` 判斷說「沒有發現問題」、照跑印出 `1`——而 CPython 給 SyntaxError。
 * tree-sitter 收得下這種參數列，於是它變成一顆合法樣子的函式積木；積木的齒輪也排得出 `*args, *scale`。
 * Cella 收的是語法樹，看不到語法錯誤 ⟹ **這一層不說，就沒有人說**。
 *
 * ## 規則是 `param_decl` 的形狀，不是哪一個語言的
 *
 * ```
 * 名字重複                       Python、C++ 都不收
 * 有預設值的後面接沒有預設值的    Python（* 之前）、C++ 都不收
 * 收集其餘引數的（variadic）      Python 的 * 只能一個、** 必須最後、兩者都不能有預設值
 * ```
 *
 * C++ 的 `param_decl` 沒有 `variadic`，於是後三條對它自然不觸發。⚠️ 名字是空的（`int f(int, int)`）不算重複。
 *
 * ## ⚠️ 只看 `params` 這一格
 *
 * `param_decl` 也被 `a, b = 1, 2` 的左邊借用（`python:var_assign_sequence` 的 `targets`）——
 * 那裡 `a, a = 1, 2` 是合法的，不能拿函式的規則去判。
 */
import { isDynamic } from './slot-check'
import type { SemanticNode } from '../types'

export type ParamListReason = 'duplicate' | 'after_kwargs' | 'variadic_default' | 'second_varargs' | 'default_order'

export interface ParamListFinding {
  /** 錨點是【函式那一顆】：參數是它積木上的欄位，自己沒有積木可以標 */
  nodeId: string
  /** 出問題的那一個參數 */
  paramId: string
  reason: ParamListReason
  params: { name: string }
}

const str = (n: SemanticNode, k: string): string => {
  const v = (n.properties as Record<string, unknown> | undefined)?.[k]
  return typeof v === 'string' ? v : ''
}

/** 一份參數列的第一個問題（一份列只報一則——後面的問題常是同一個錯的連帶） */
export function paramListProblem(ps: readonly SemanticNode[]): { param: SemanticNode; reason: ParamListReason } | null {
  const seen = new Set<string>()
  let sawDefault = false
  let sawList = false
  let sawDict = false
  for (const p of ps) {
    if (p.componentId !== 'param_decl') continue
    const name = str(p, 'name')
    const v = str(p, 'variadic')
    const hasDefault = str(p, 'default') !== ''
    if (name !== '' && seen.has(name)) return { param: p, reason: 'duplicate' }
    if (name !== '') seen.add(name)
    if (sawDict) return { param: p, reason: 'after_kwargs' }
    if (v !== '' && hasDefault) return { param: p, reason: 'variadic_default' }
    if (v === 'list') { if (sawList) return { param: p, reason: 'second_varargs' }; sawList = true; continue }
    if (v === 'dict') { sawDict = true; continue }
    // `*` 之後的是只能用名字指定的參數，有沒有預設值都可以
    if (!sawList) {
      if (!hasDefault && sawDefault) return { param: p, reason: 'default_order' }
      if (hasDefault) sawDefault = true
    }
  }
  return null
}

/** 走過整棵樹，每一份不合法的參數列回報一則。⚠️ 降級節點（灰積木）跳過——沒讀懂的東西不報成「你錯了」 */
export function checkParamLists(tree: SemanticNode): ParamListFinding[] {
  const out: ParamListFinding[] = []
  const walk = (n: SemanticNode): void => {
    if (!isDynamic(n.componentId)) {
      const ps = (n.slots?.params ?? []).filter(Boolean) as SemanticNode[]
      const bad = ps.length > 0 ? paramListProblem(ps) : null
      if (bad) out.push({ nodeId: n.id, paramId: bad.param.id, reason: bad.reason, params: { name: str(bad.param, 'name') } })
    }
    for (const bucket of Object.values(n.slots ?? {})) for (const c of bucket ?? []) walk(c)
  }
  walk(tree)
  return out
}
