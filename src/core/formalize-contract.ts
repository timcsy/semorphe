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
  /** 把一顆頂層項目翻成 Cella 的項目（namespace 的本體要它；spec 200）。 */
  item(n: SemanticNode): CellaJson[]
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
  /**
   * 記號替換巨集（`#define F first`、`#define pb push_back`）——值是一個識別字時回它，否則原樣回名字（第 205 刀：學生的程式 20 支）。
   * 用在成員名、方法名、函式名：`p.F` → `p.first`、`v.pb(x)` → `v.push_back(x)`。
   */
  identMacro(name: string): string
  /**
   * 這個名字是函式形巨集嗎（`#define SQR(x) ((x)*(x))`）——spec 200：運算式位置的 `SQR(3)` 會被 lift 成一般的函式呼叫，
   * 照送的話 Cella 判 reject「呼叫未宣告的函式」，而真的 C++ 印 9。呼叫端問它，照實標翻不出。
   */
  functionMacro(name: string): boolean
  /** 這個名字被 `#define` 過嗎（物件或函式形都算）——`#ifdef`／`#ifndef` 在前端展開要它（⚠️ 整支程式收一次，不看先後：`#ifdef N` 寫在 `#define N` 之前會判成已定義——罕見，照實記下）。 */
  macroDefined(name: string): boolean
  /**
   * 一段字面量的原文（`3`、`'a'`、`"hi"`）→ 運算式：照登記了 `literal` 的元件翻（spec 203：參數預設值要它）。
   * 沒有任何一顆認得 → undefined（呼叫端照實標翻不出）。核心不認識任何一顆字面元件。
   */
  literalExpr(text: string, id: string): CellaJson | undefined
  /** 這顆自己翻成類別成員嗎（登記了 `member`）——類別／struct 分「欄位」與「自己翻的成員」時問它，不點名身分（spec 203） */
  ownsMember(n: SemanticNode): boolean
  /**
   * 把一句敘述放到「目前正在翻的那一句」前面（第 206 刀：lambda 的 `sLambda` 要在用到它的敘述之前——cella 2026-11-01 給的形狀）。
   * 全域位置沒有「前面的敘述」可放，引擎照實標 unknown。
   */
  hoist(stmt: CellaJson): void
  /** 這段文字是不是一個認得的型別（不記 unknown）——型別巨集 `#define ll long long` 用（spec 199） */
  isTypeText(text: string): boolean
  /** 整支程式裡有沒有一顆元件符合這個條件（spec 199：關掉 stdio 同步只在混用 printf／scanf 時才改變輸出）——條件問性狀，不列身分 */
  programUses(test: (componentId: string) => boolean): boolean
  /** 當一句敘述翻：有敘述的翻法就用它，否則包成運算式敘述（`sExpr`）——`a, b;` 等於 `a; b;` 時用（spec 199） */
  asStatement(n: SemanticNode): CellaJson[]
  /** 照 id 找語義樹的節點（`declOf` 給的是宣告的 id；要看那個宣告的內容時用——spec 199：`const int N = 100; int a[N];`） */
  nodeById(id: string): SemanticNode | undefined
  /** 類別裡的原型（註冊了 `memberKey`）在類別外的那一顆定義；沒有就是 undefined（第 322 刀） */
  outsideDefinition(declared: SemanticNode): SemanticNode | undefined
  /** 類別外的定義（註冊了 `memberKey`、帶類別名）對得上類別裡的原型嗎（第 322 刀） */
  hasInClassDeclaration(defined: SemanticNode): boolean
  /**
   * 類別外定義「寫在這裡」的標記 `iMemberAt { n, cls, x }`（395，cella 2026-11-10 談定）：本體與初值仍掛在類別的成員上，標記只說位置——
   * 本體看得到的全域名字、靜態初值的順序都看定義的位置。`x` 是類別裡那顆宣告的 id；類別裡對不上就是 null。
   */
  memberAt(defined: SemanticNode): CellaJson | null
  /** 同上，給類別外的靜態成員定義（`int A::a = 7;`，名字帶類別） */
  staticMemberAt(defined: SemanticNode): CellaJson | null
  /** 參數預設值（`param_decl.properties.default`，lift 留成原文）的形狀：字面量照登記翻，其餘照實標翻不出；沒有預設值 ⟹ null（395 收成一份，原本五顆各抄一次） */
  defaultArgument(param: SemanticNode | undefined): unknown
  /** 在函式樣板裡翻（397）：這幾個名字是樣板的型別參數，型別位置寫到它們時送 `tParam` */
  withTypeParams<R>(names: string[], body: () => R): R
  /** 當一個類別成員翻（成員函式 → `mbMethod`）；沒有註冊的記 unknown、回 null（spec 201） */
  member(n: SemanticNode): CellaJson | null
  /** 這個宣告是不是某個 struct／class 的欄位——成員函式裡的裸名字指到它時是 `eSelf`（隱含的 this，spec 201） */
  isMemberField(declId: string): boolean
  /** 程式自己定義的函式名（名字當值用時是 `eFunc`——spec 201） */
  isFunctionName(name: string): boolean
  /**
   * 這一顆（呼叫）在某個類別的成員裡，而那個類別有叫這個名字的方法——裸名字的呼叫是隱含的 this：`eMCall { obj: eThis, arrow: true }`
   *（cella 2026-11-03 給的形狀；spec 208）。C++ 先在類別的範圍找名字，所以同名的頂層函式讓位。
   */
  isOwnMethod(nodeId: string, name: string): boolean
  /** 同上，而那個方法是靜態成員函式：回傳它的全名 `C::f`（沒有 this，要送 `eCall`；383）；不是就 undefined */
  ownStaticMethod(nodeId: string, name: string): string | undefined
  /** C 的跳脫序列 → 真正的字元（語義樹存的是寫法，Cella 要的是值）。 */
  unescapeC(s: string): string
  /** C 的二元運算子符號 → Cella 的運算子建構子。 */
  binOp(op: string): string | undefined
  /** 純量型別名 → Cella 的型別建構子。 */
  scalar(name: string): string | undefined
  /** 這個名字是程式裡定義過的型別（struct）嗎。 */
  isStructName(name: string): boolean
  /** `X::m`，X 是程式定義的類別、m 不是靜態方法也不是型別——明確指定類別的成員呼叫（`Base::f(x)`，不走虛擬分派）。 */
  isQualifiedInstanceCall(name: string): boolean
  /**
   * 這個名字是程式裡的**任何一種型別名**嗎——struct／class、union、enum（含 enum class）、前置宣告過的。
   * `isStructName` 只回答 struct；`sizeof(Num)` 這種要問的是「它是不是型別」（2026-11-09：C++ 的 union 名字被當成變數，判錯 reject）。
   */
  isTypeName(name: string): boolean
  /**
   * 類別外的靜態成員定義（`int C::n = 3;`、`L* L::current = nullptr;`）的初值節點——給類別裡的那顆靜態成員用（cella 2026-11-08：
   * 初值併進類別的 mbStatic，類別外的定義本身不另外送）。`member` 是類別裡那顆成員；沒有外面的定義或定義沒有初值 → undefined。
   */
  staticInitOf(member: SemanticNode): SemanticNode | undefined
  /** `C::n` 是程式裡某個類別的成員嗎（類別外的定義要併進去、不另外送時用） */
  isClassMember(qualifiedName: string): boolean
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
  /**
   * 同上，但**指不到不算落空**——函式呼叫的名字（`sort`、`printf`）本來就不是變數，只有指得到變數時才有意義
   * （第 206 刀：裝著 lambda 的變數被呼叫；`sizeof(a)`）。
   */
  resolveIfDeclared(refId: string, name: string): void
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
  /**
   * 這顆定義了一個物件巨集（`#define 名字 值`，值是原文）——核心照值展開在使用處（spec 197）。
   * `function: true` 是函式形巨集（spec 200）：不進物件巨集的展開表，只讓 `functionMacro(name)` 答得出來。
   */
  definesMacro(id: string, fn: (n: SemanticNode) => { name: string; value: string; function?: boolean } | null): void
  /**
   * 這種字面量的原文是我的（`10`、`0x1F`…）——巨集展開時，核心用登記了的元件把值翻出來（spec 197）。
   * `value`：原文 → 這顆元件的 `value` 屬性（字串字面的屬性不帶引號；spec 203）。沒給就是原文本身。
   */
  literal(id: string, test: (text: string) => boolean, value?: (text: string) => string): void
  /** 這顆定義了一個型別名（不帶關鍵字的 `Node*` 要先認得 `Node`）。 */
  definesType(id: string, fn: (n: SemanticNode) => string): void
  /**
   * 這顆**宣告**了一個型別名、但不是定義（前置宣告 `class Helper;`）：型別那一格認得它（`Helper*` 送 tClass），
   * 而 `isStructName` 仍只回答「有定義的」——前置宣告要靠那個問題決定「之後有沒有定義」（cpp_to_tree.py：有定義就不送）。
   */
  declaresType(id: string, fn: (n: SemanticNode) => string): void
  /** 這顆定義了一個列舉型別名（`enum Color {…}` 之後 `Color c` 的 Color）——型別那一格送 `tEnum`（cella 2026-11-03；不是 tClass）。 */
  definesEnum(id: string, fn: (n: SemanticNode) => string): void
  /** 名字不叫 `name` 而定義了一個可呼叫的函式（397，函式樣板的 `func_name`）：`f<int>(1)` 要認得它是函式 */
  definesFunction(id: string, fn: (n: SemanticNode) => string): void
  /** 這顆定義了一個 union 型別名（`union U {…}` 之後 `union U u`／C++ 的 `U u`）——型別那一格送 `tUnion`（cella 2026-11-08）。 */
  definesUnion(id: string, fn: (n: SemanticNode) => string): void
  /**
   * 這顆是**類別成員與它在類別外的定義配對時用的鍵**（第 322 刀，類別外定義成員函式）。
   * 類別裡的原型回 `{ key }`（類別名由引擎從它所在的類別得到）；類別外的定義回 `{ className, key }`。
   * 鍵由元件自己決定（名字 ＋ 參數型別 ＋ const——多載靠它分），兩邊用同一個寫法才配得上。
   * Cella 的參照翻譯：類別外的定義在頂層不送，本體接回類別裡那個成員（cpp_to_tree.py：the class's member takes the definition）。
   */
  memberKey(id: string, fn: (n: SemanticNode) => { className?: string; key: string; isStatic?: boolean }): void
  /** 作用域走訪：這顆開不開作用域、宣告什麼、參照什麼（沒註冊的照通用規則）。 */
  scope(id: string, fn: (n: SemanticNode, w: ScopeWalker) => void): void
}

/** 膠囊的 `formalize.ts` 匯出的進入點。 */
export type RegisterFormalize = (r: FormalizeRegistrar) => void
