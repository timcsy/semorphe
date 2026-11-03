/**
 * **`: public A` 這一段的解析**——struct 與 class 共用（spec 209）。
 *
 * 原本只有 class 的 lift 讀它，而且讀法有兩個安靜的錯：
 * ① 沒寫存取時記成 public——`class B : A` 是 **private** 繼承（[class.access.base]p2），來回一趟被改成 `: public A`；
 * ② 迴圈把每一個基底蓋過前一個——`: A, C` 只留下 `C`，`virtual` 也被丟掉。
 * struct 那顆則整段沒讀，`struct B : A` 來回一趟變 `struct B`。
 *
 * 回傳：沒有基底 → `null`；一個普通的基底 → 名字與存取（沒寫是 `implicit`，由 struct／class 各自解讀）；
 * 多重或 virtual 繼承 → `'unsupported'`（呼叫者照實降級，不留半套）。
 */
import type { AstNode } from '../../core/lift/types'

export type BaseAccess = 'implicit' | 'public' | 'protected' | 'private'
export type BaseClause = { base: string; access: BaseAccess } | 'unsupported' | null

export function parseBaseClause(node: AstNode): BaseClause {
  const clause = node.namedChildren.find((c) => c.type === 'base_class_clause')
  if (!clause) return null
  const names = clause.namedChildren.filter((c) => c.type === 'type_identifier' || c.type === 'qualified_identifier' || c.type === 'template_type')
  const isVirtual = clause.children.some((c) => c.text === 'virtual')
  if (names.length !== 1 || isVirtual) return 'unsupported'
  const spec = clause.namedChildren.find((c) => c.type === 'access_specifier')?.text.replace(/:$/, '').trim()
  const access: BaseAccess = spec === 'public' || spec === 'protected' || spec === 'private' ? spec : 'implicit'
  return { base: names[0].text, access }
}

/** 產回去：`implicit` 不寫存取 */
export function baseClauseCode(base: string, access: string): string {
  if (!base) return ''
  return access && access !== 'implicit' ? ` : ${access} ${base}` : ` : ${base}`
}

/** 交給 Cella 的存取：`implicit` 依 struct（public）／class（private）解讀 */
export function effectiveAccess(access: string, isClass: boolean): 'public' | 'protected' | 'private' {
  if (access === 'public' || access === 'protected' || access === 'private') return access
  return isClass ? 'private' : 'public'
}
