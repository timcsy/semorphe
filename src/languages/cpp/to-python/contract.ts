/**
 * **C++ 元件寫成 Python 的契約**（spec 219，research R7）——每顆元件在自己的膠囊裡寫 `to-python.ts`，匯出 `registerToPython`。
 * 引擎（`../cpp-to-python.ts`）依身分查表；表外的身分記成「子集以外」。
 */
import type { SemanticNode } from '../../../core/types'
import type { KeepKind } from '../../../core/language-packs'

export interface ToPythonContext {
  /** 一顆運算式節點寫成 Python 運算式文字（表外的身分會記保留、回傳佔位） */
  expr(n: SemanticNode | undefined): string
  /** 一串敘述寫成 Python 的行（每行已含縮排）；空的本體寫成 `pass` */
  block(nodes: readonly SemanticNode[] | undefined, depth: number): string[]
  /** 記一筆保留原因（整支程式因此不換），回傳一個佔位文字讓呼叫端照常往下走 */
  keep(n: SemanticNode, kind: KeepKind, detail: string): string
  /** Cella 給的運算式型別（換目標之前那支程式的；拿不到是 undefined） */
  typeOf(n: SemanticNode | undefined): string | undefined
  /** 縮排 */
  indent(depth: number): string
  /** 正在寫 `main` 的本體嗎（攤平到頂層：`return 0` 不寫、其他 return 保留） */
  readonly inMain: boolean
  /** 把 `main` 的本體寫在頂層（depth 0），期間 `inMain` 為真 */
  blockAsMain(nodes: readonly SemanticNode[] | undefined): string[]
  /** 這個名字是程式自己定義的函式嗎（標準函式庫的呼叫第一版不換） */
  isUserFunction(name: string): boolean
  /** 這顆節點產生 bool 嗎（元件自己宣告的，`r.yieldsBool`）——印的時候 C++ 印 0／1、Python 印 True／False */
  yieldsBool(n: SemanticNode | undefined): boolean
  /** 程式需要「跨行讀一個詞」的小工具（同 cin 的讀法）——引擎在檔頭補上 */
  useTokenReader(): string
}

/** 子運算式是二元運算（有 left／right 槽）時加括號——不追優先序，寧可多一層括號 */
export function paren(n: SemanticNode | undefined, py: ToPythonContext): string {
  const e = py.expr(n)
  return n?.slots?.left && n?.slots?.right ? `(${e})` : e
}

/** Python 字串字面量（JSON 的雙引號跳脫在 Python 裡同樣成立） */
export const pyStr = (s: string): string => JSON.stringify(s)

export type ExprFn = (n: SemanticNode, py: ToPythonContext) => string
export type StmtFn = (n: SemanticNode, py: ToPythonContext, depth: number) => string[]

export interface ToPythonRegistrar {
  expr(componentId: string, fn: ExprFn): void
  stmt(componentId: string, fn: StmtFn): void
  /** 這顆元件產生 bool（比較、邏輯）——不靠 Cella 的型別表（它對 C++ 的比較回報 int，見 research R8） */
  yieldsBool(componentId: string): void
}

export type RegisterToPython = (r: ToPythonRegistrar) => void
