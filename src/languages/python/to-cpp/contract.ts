/**
 * **Python 元件寫成 C++ 的契約**（spec 225，對稱於 spec 219 的 `to-python`）——每顆 Python 元件在自己的膠囊寫 `to-cpp.ts`，匯出 `registerToCpp`。
 * 引擎（`../python-to-cpp.ts`）依身分查表；表外的身分記成「子集以外」。
 *
 * 型別來自 Cella 在**一份輸入上觀察到的**型別表（`python.observedTypes`，research R1）——不是我們推的。
 */
import type { SemanticNode } from '../../../core/types'
import type { KeepKind } from '../../../core/language-conversion'

/** Cella 的 Python 型別表（2026-11-09 談定）：鍵是我們程式 JSON 的節點 id */
export interface ObservedTypes {
  nodes: Readonly<Record<string, string>>
  basis: Readonly<Record<string, 'observed' | 'unreached'>>
}

export interface ToCppContext {
  /** 一顆運算式節點寫成 C++ 運算式文字 */
  expr(n: SemanticNode | undefined): string
  /** 一串敘述寫成 C++ 的行（每行已含縮排） */
  block(nodes: readonly SemanticNode[] | undefined, depth: number): string[]
  /** 記一筆保留原因（整支程式因此不換），回傳佔位文字讓呼叫端照常往下走 */
  keep(n: SemanticNode, kind: KeepKind, detail: string): string
  /** 這顆節點觀察到的**單一** Python 型別（`int`、`str`、`list[int]`…）；沒觀察到、聯集、空容器 → undefined */
  pyType(n: SemanticNode | undefined): string | undefined
  /** Python 型別 → C++ 型別文字（`int` → `long long`、`list[int]` → `vector<long long>`）；對不上 → undefined */
  cppType(pyType: string | undefined): string | undefined
  /** 程式需要一支補在開頭的小函式（`read_line`、`floor_div`、`floor_mod`）——回傳它的名字 */
  useHelper(name: 'read_line' | 'floor_div' | 'floor_mod'): string
  /** 程式需要一個標頭（`vector`、`algorithm`、`numeric`）——回傳標頭名 */
  useInclude(header: string): string
  /** 這個名字是程式自己定義的函式嗎 */
  isUserFunction(name: string): boolean
  /**
   * 計數 for 的迴圈變數可以直接當 C++ 的迴圈變數嗎——迴圈之後沒有讀它、本體裡也沒有改它。
   * 否則意思不同：Python 迴圈結束時它是**最後一個值**、本體改它不影響下一圈；C++ 的 for 結束時多走了一步、本體改它會改到迭代。
   */
  plainLoopVar(loop: SemanticNode, name: string): boolean
  /** C++ 的保留字與標準名字撞到就加底線 */
  name(s: string): string
  indent(depth: number): string
}

export type ExprFn = (n: SemanticNode, cpp: ToCppContext) => string
export type StmtFn = (n: SemanticNode, cpp: ToCppContext, depth: number) => string[]

export interface ToCppRegistrar {
  expr(fn: ExprFn): void
  stmt(fn: StmtFn): void
}
export type RegisterToCpp = (r: ToCppRegistrar) => void

/** 子運算式是二元運算（有 left／right 槽）時加括號——不追優先序，寧可多一層括號 */
export function paren(n: SemanticNode | undefined, cpp: ToCppContext): string {
  const e = cpp.expr(n)
  return n?.slots?.left && n?.slots?.right ? `(${e})` : e
}

/** C++ 的字串字面量（JSON 的跳脫與 C++ 相容：\"、\\、\n、\t） */
export const cppString = (s: string): string => JSON.stringify(s)
