/**
 * **formalize 的契約：引擎給元件的能力 ＋ 元件向引擎註冊的形狀**（第 389 刀）。
 *
 * formalize 是**元件自己的動詞**（使用者 2026-10-20：「元件只剩 render／lift ＋ formalize」）：
 * 一顆元件怎麼翻成 Cella 的程式 JSON，住在它自己的膠囊（`src/components/<scope>/<name>/formalize.ts`），
 * 像 `generate.ts` 那樣。引擎（`src/providers/cella/formalize/`）只留**共用的**——作用域走訪、型別解析、
 * 洞、呼叫的組法——並用 glob 收集每顆元件的註冊、查表分派；查不到照舊回 unknown（不送、不猜，P6）。
 *
 * 🔴 這個檔**只放型別**。元件只 import 它，不 import `src/providers/`（核心不認提供者，膠囊也不該）。
 *
 * ⚠️ 引擎與元件之間**不交換身分**：引擎要知道的「這顆是整數字面」「這顆定義了一個型別名」
 * 「這顆在初值串列裡長什麼樣」，都由元件自己註冊——消費者問性狀，不問身分（同 `node-traits` 的處置）。
 */
import type { SemanticNode } from './types'

/** Cella 程式 JSON 的一個節點：`{"k": 建構子, <參數名>: 值}`（`deriving Json`）。 */
export type CellaJson = { k: string; [field: string]: unknown }

/** 引擎提供給元件的能力。每一個都是引擎在一次 formalize 裡的閉包——元件不持有狀態。 */
export interface FormalizeContext {
  /** 建一個 Cella 節點。 */
  k(name: string, fields?: Record<string, unknown>): CellaJson
  /** 把一顆節點翻成運算式（查不到 → 洞＋unknown）。 */
  expr(n: SemanticNode): CellaJson
  /** 把一顆節點翻成敘述（可能展開成多句；查不到 → `sHole`＋unknown）。 */
  stmt(n: SemanticNode): CellaJson[]
  /** 把一顆宣告翻成敘述層（`global = false`）或頂層（`true`）的宣告；沒註冊的照通用宣告子的形狀。 */
  decl(n: SemanticNode, global: boolean): CellaJson[]
  /** 槽裡的第一顆。 */
  one(n: SemanticNode, slot: string): SemanticNode | undefined
  /** 槽裡第一顆的運算式；空槽是洞（`<id>#<slot>`）。 */
  exprOf(n: SemanticNode, slot: string): CellaJson
  /** 一個敘述清單槽 → `sBlock`。 */
  block(n: SemanticNode, slot: string): CellaJson
  /** 大括號初值串列的一項。 */
  initOf(c: SemanticNode): CellaJson
  /** 一個槽的大括號初值串列 → `iL`。 */
  braceList(n: SemanticNode, slot: string): CellaJson
  /** 型別文字 → Cella 的型別；認不得 → unknown 記在 `at`，回 null。 */
  type(t: unknown, at: SemanticNode): CellaJson | null
  /** 翻不了：記一筆 unknown，回運算式洞。 */
  miss(n: SemanticNode, reason: string): CellaJson
  /** 函式呼叫：引數依槽的順序，沒填的選擇性引數不送。 */
  call(n: SemanticNode, f: string, slots: string[]): CellaJson
  /** 方法呼叫，接收者是文字屬性 `obj`（宣告過 → eVar；板子的全域物件 → eConst）。 */
  mcall(n: SemanticNode, f: string, slots: string[]): CellaJson
  /** 二元運算（`properties.operator`、`left`／`right` 兩槽）；運算子認不得 → unknown。 */
  binary(n: SemanticNode): CellaJson
  /** 運算式敘述：`sExpr`（標籤 `<id>/stmt`）包住這顆的運算式。 */
  exprStmt(n: SemanticNode): CellaJson[]
  /**
   * 同一個子運算式要在程式裡出現第二次時，用這一支複製：每個節點標籤 `n` 後面加 `/<tag>`（宣告指向 `x` 不動）。
   * 🔴 cella（2026-10-31）：**運算式的標籤必須彼此不同**——共用時模型裡以節點命名的暫時物件會互相覆蓋，判決靜默出錯。
   */
  copy(json: CellaJson, tag: string): CellaJson
  /** 帶初值的宣告：`iVar`（頂層）或 `sDecl`；初值取 `initializer` 槽。 */
  declVar(n: SemanticNode, t: CellaJson, global: boolean): CellaJson[]
  /** 宣告，初值已備好：`iVar`／`sDecl`。 */
  declInit(n: SemanticNode, t: CellaJson, init: CellaJson | null, global: boolean): CellaJson[]
  /** 建構式宣告：`iVarC`／`sDeclC`。 */
  declCtor(n: SemanticNode, t: CellaJson, args: CellaJson[], global: boolean): CellaJson[]
  /** 函式庫物件（`DHT dht(2, DHT11);`）：類別 `cls`，建構引數取 `initializer` 槽。 */
  libraryObject(n: SemanticNode, cls: string, global: boolean): CellaJson[]
  /** 這顆是編譯期的非負整數字面嗎——是就回值（由元件以 `constInt` 宣告）。 */
  constInt(n: SemanticNode | undefined): number | null
  /** 作用域走訪的結果：參照節點（或 `<id>#obj`）→ 宣告節點。 */
  declOf(key: string): string | undefined
  /**
   * 物件巨集（`#define N 10`）——**前端展開**（cella 2026-11-01：巨集是前處理器的事，語意樹上不該出現；判決的位置照展開處）。
   * 值認得（某顆元件登記了「這種字面量的文字是我的」）才有：`expr(usageId)` 是展開在使用處的運算式，`int` 是編譯期整數（陣列長度用）。
   */
  macro(name: string): { expr(usageId: string): CellaJson; int: number | null } | undefined
  /** 這段文字是不是一個認得的型別（不記 unknown）——型別巨集 `#define ll long long` 用（spec 199） */
  isTypeText(text: string): boolean
  /** 整支程式裡有沒有用到這幾顆元件之一（spec 199：關掉 stdio 同步只在混用 printf／scanf 時才改變輸出） */
  programUses(componentIds: readonly string[]): boolean
  /** 當一句敘述翻：有敘述的翻法就用它，否則包成運算式敘述（`sExpr`）——`a, b;` 等於 `a; b;` 時用（spec 199） */
  asStatement(n: SemanticNode): CellaJson[]
  /** 照 id 找語義樹的節點（`declOf` 給的是宣告的 id；要看那個宣告的內容時用——spec 199：`const int N = 100; int a[N];`） */
  nodeById(id: string): SemanticNode | undefined
  /** 當一個類別成員翻（成員函式 → `mbMethod`）；沒有註冊的記 unknown、回 null（spec 201） */
  member(n: SemanticNode): CellaJson | null
  /** 這個宣告是不是某個 struct／class 的欄位——成員函式裡的裸名字指到它時是 `eSelf`（隱含的 this，spec 201） */
  isMemberField(declId: string): boolean
  /** C 的跳脫序列 → 真正的字元（語義樹存的是寫法，Cella 要的是值）。 */
  unescapeC(s: string): string
  /** C 的二元運算子符號 → Cella 的運算子建構子。 */
  binOp(op: string): string | undefined
  /** 純量型別名 → Cella 的型別建構子。 */
  scalar(name: string): string | undefined
  /** 這個名字是程式裡定義過的型別（struct）嗎。 */
  isStructName(name: string): boolean
  /** 這次 formalize 的目標。 */
  options: { board?: string; lang?: 'c' | 'cpp'; isC: boolean }
}

/** 作用域走訪給元件的能力（`resolveScopes`）。 */
export interface ScopeWalker {
  walkSlot(n: SemanticNode, slot: string): void
  /** 走過每一個槽；敘述清單槽各開一層。 */
  walkSlots(n: SemanticNode, skip?: ReadonlySet<string>): void
  inScope(f: () => void): void
  declare(name: string, nodeId: string): void
  /** 解析一個名字的參照：指得到 → 記進 declOf；指不到 → 列進 unresolved。 */
  resolve(refId: string, name: string): void
}

/** 元件向引擎註冊的形狀。一顆元件可以在多個位置註冊；**每一個身分只能是它自己資料夾的**（引擎會核對）。 */
export interface FormalizeRegistrar {
  /** 運算式位置。 */
  expr(id: string, fn: (n: SemanticNode, f: FormalizeContext) => CellaJson): void
  /** 敘述位置。 */
  stmt(id: string, fn: (n: SemanticNode, f: FormalizeContext) => CellaJson[]): void
  /** 頂層（翻譯單元的項）。 */
  item(id: string, fn: (n: SemanticNode, f: FormalizeContext) => CellaJson[]): void
  /** 類別成員（struct／class 的 members 裡、不是欄位的那幾顆：成員函式、運算子多載——spec 201）。 */
  member(id: string, fn: (n: SemanticNode, f: FormalizeContext) => CellaJson): void
  /** 宣告：敘述與頂層兩處都用它（除非另註冊了 stmt／item），也是別人的宣告子（`int a, b[3];`）。 */
  decl(id: string, fn: (n: SemanticNode, f: FormalizeContext, global: boolean) => CellaJson[]): void
  /** 大括號初值串列裡的一項（沒註冊的是 `iE` 包運算式）。 */
  init(id: string, fn: (n: SemanticNode, f: FormalizeContext) => CellaJson): void
  /** 編譯期的非負整數字面（陣列長度要它）。不是就回 null。`f` 給需要上下文的（例如名字是巨集）。 */
  constInt(id: string, fn: (n: SemanticNode, f: FormalizeContext) => number | null): void
  /** 這顆定義了一個物件巨集（`#define 名字 值`，值是原文）——核心照值展開在使用處（spec 197）。 */
  definesMacro(id: string, fn: (n: SemanticNode) => { name: string; value: string } | null): void
  /** 這種字面量的原文是我的（`10`、`0x1F`…）——巨集展開時，核心用登記了的元件把值翻出來（spec 197）。 */
  literal(id: string, test: (text: string) => boolean): void
  /** 這顆定義了一個型別名（不帶關鍵字的 `Node*` 要先認得 `Node`）。 */
  definesType(id: string, fn: (n: SemanticNode) => string): void
  /** 作用域走訪：這顆開不開作用域、宣告什麼、參照什麼（沒註冊的照通用規則）。 */
  scope(id: string, fn: (n: SemanticNode, w: ScopeWalker) => void): void
}

/** 膠囊的 `formalize.ts` 匯出的進入點。 */
export type RegisterFormalize = (r: FormalizeRegistrar) => void
