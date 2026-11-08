/**
 * **C++ 元件寫成 Python 的契約**（spec 219，research R7）——每顆元件在自己的膠囊裡寫 `to-python.ts`，匯出 `registerToPython`。
 * 引擎（`../cpp-to-python.ts`）依身分查表；表外的身分記成「子集以外」。
 */
import type { SemanticNode } from '../../../core/types'
import type { KeepKind } from '../../../core/language-conversion'

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
  /** 這顆函式是骨架宣告的進入點嗎（問骨架宣告，不寫死 `main`——第八十六條之二） */
  isEntryFunction(name: string): boolean
  /** C++ 的名字在 Python 裡的寫法：撞到 Python 的保留字（`from`、`in`、`is`…）就加底線（364：河內塔的參數叫 from，換出來的程式不合法） */
  name(s: string): string
  /** 這個名字是程式自己定義的函式嗎（標準函式庫的呼叫第一版不換） */
  isUserFunction(name: string): boolean
  /** 這顆節點產生 bool 嗎（元件自己宣告的，`r.yieldsBool`）——印的時候 C++ 印 0／1、Python 印 True／False */
  yieldsBool(n: SemanticNode | undefined): boolean
  /** 程式需要引入某個 Python 模組（`math`）——引擎在檔頭補上 `import …`，回傳模組名 */
  useImport(module: string): string
  /** 程式需要「跨行讀一個詞」的小工具（同 cin 的讀法）——引擎在檔頭補上 */
  useTokenReader(): string
}

/** 加括號的判準兩個方向共用（住在核心）——膠囊照舊從這裡拿 */
export { paren } from '../../../core/language-conversion'

/** 這個值是 C++ 的 char 嗎（Cella 的型別表；`const char`、`char &` 也算）——Python 用長度 1 的字串表示它（364） */
export function isChar(t: string | undefined): boolean {
  return (t ?? '').replace(/^const\s+/, '').replace(/\s*&$/, '').trim() === 'char'
}

/** 放進整數變數的值：C++ 會把浮點隱含截斷成整數、Python 不會 ⟹ 值是浮點時包 int()（向零截斷，同 C++；364） */
export function intValue(target: string | undefined, valueType: string | undefined, e: string): string {
  const t = (target ?? '').replace(/^const\s+/, '').trim()
  const v = (valueType ?? '').replace(/^const\s+/, '').replace(/\s*&$/, '').trim()
  return /^(int|long|long long|short)$/.test(t) && /^(double|float|long double)$/.test(v) ? `int(${e})` : e
}

/** Python 字串字面量（JSON 的雙引號跳脫在 Python 裡同樣成立） */
export const pyStr = (s: string): string => JSON.stringify(s)

export type ExprFn = (n: SemanticNode, py: ToPythonContext) => string
export type StmtFn = (n: SemanticNode, py: ToPythonContext, depth: number) => string[]

/**
 * 膠囊登記**自己**的印法——不寫自己的身分（收集器依膠囊所在的目錄對回 component.json 的身分；就近性護欄：身分不多擴散一個檔）
 */
export interface ToPythonRegistrar {
  expr(fn: ExprFn): void
  stmt(fn: StmtFn): void
  /** 這顆元件產生 bool（比較、邏輯）——不靠 Cella 的型別表（它對 C++ 的比較回報 int，見 research R8） */
  yieldsBool(): void
}

export type RegisterToPython = (r: ToPythonRegistrar) => void
