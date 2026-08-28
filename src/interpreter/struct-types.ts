/**
 * 結構／類別的型別登記處。
 *
 * **每個直譯器實例一份。** 用全域 Map 的話，一個測試宣告的結構會漏到下一個
 * 測試——那種洩漏在測試各自跑時看不出來，只在整批跑時偶發，而那正是最難查的
 * 那種失敗。
 */
import type { SemanticNode } from '../core/types'
import type { RuntimeValue, ObjectFields } from './types'
import { defaultValue } from './types'

/** 一個欄位的宣告：名字與型別（型別可能是另一個結構） */
export interface FieldDecl {
  name: string
  type: string
  /**
   * 成員預設值的**表達式**（`class A { int v = 7; };` 的 `7`）。
   *
   * ⚠️ 存的是節點不是值——預設值可以是任意表達式（`int n = f();`），
   * 而它要在**建立實例時**才求值，不是宣告類別時。
   */
  init?: SemanticNode
}

/** 一個方法／建構式 */
export interface MethodDecl {
  name: string
  params: FieldDecl[]
  body: SemanticNode[]
  /**
   * 建構式的**成員初始化列**（`Node(int x) : v(x) {}` 的 `v(x)`），一串賦值。
   *
   * ⚠️ 它與 `body` 分開，因為**順序有語義**：初始化列先跑，本體後跑
   * ——本體裡的 `v = 9` 蓋得掉初始化列，反過來不行。
   */
  inits?: SemanticNode[]
  /** 純虛擬沒有本體——呼叫時要出聲，不得靜默回傳 */
  pure?: boolean
}

/**
 * 把 **elaborated type specifier** 剝成純型別名：`struct Point` → `Point`。
 *
 * 🔴 C 裡面宣告一個結構變數**一定要寫 `struct`**（`struct Point p;`），
 * 而 C++ 可以省略。兩種寫法指的是同一個型別，而登記時用的是純名字。
 *
 * 在此之前只認純名字，於是 C 那一側 `ctx.structs.has("struct Point")`
 * 是 `false` → `defaultValue` 給了一個 `int 0` → 之後 `p.x` 丟出
 * 「**變數 `p`（不是一個結構）尚未宣告**」——**而 `p` 明明宣告過了**。
 *
 * > **一則說「沒宣告」而其實是「型別名沒對上」的錯誤訊息，
 * > 會讓人去找一個不存在的問題。**
 *
 * ⚠️ 這裡認的是 **C 家族的三個關鍵字**，而這個檔本來就是 C++ 的結構登錄表
 * （錯誤訊息裡寫著「那在 C++ 不合法」）——不是核心中立層。
 */
function bareTypeName(name: string): string {
  const m = /^\s*(?:struct|class|union)\s+(.+)$/.exec(name)
  return m ? m[1].trim() : name
}

export class StructRegistry {
  private types = new Map<string, FieldDecl[]>()
  private methods = new Map<string, Map<string, MethodDecl>>()
  private ctors = new Map<string, MethodDecl>()
  private bases = new Map<string, string>()
  private dtors = new Map<string, MethodDecl>()
  /** 靜態成員：由**型別**持有，所有實例共用同一個值 */
  private statics = new Map<string, ObjectFields>()

  declare(
    name: string,
    fields: FieldDecl[],
    methods: MethodDecl[] = [],
    ctor?: MethodDecl,
    opts: { base?: string; statics?: FieldDecl[]; dtor?: MethodDecl } = {},
  ): void {
    this.types.set(name, fields)
    this.methods.set(name, new Map(methods.map((m) => [m.name, m])))
    if (ctor) this.ctors.set(name, ctor)
    if (opts.base) this.bases.set(name, opts.base)
    if (opts.dtor) this.dtors.set(name, opts.dtor)
    if (opts.statics?.length) {
      const map: ObjectFields = new Map()
      for (const s of opts.statics) map.set(s.name, defaultValue(s.type))
      this.statics.set(name, map)
    }
  }

  /** 這個型別（含它的基底鏈）共用的靜態成員表 */
  staticsOf(name: string): ObjectFields | undefined {
    name = bareTypeName(name)
    for (const t of this.chain(name)) {
      const m = this.statics.get(t)
      if (m) return m
    }
    return undefined
  }

  /** 從自己往基底走的型別鏈。**擋住循環繼承**，否則這裡會無限迴圈 */
  chain(name: string): string[] {
    name = bareTypeName(name)
    const out: string[] = []
    const seen = new Set<string>()
    let cur: string | undefined = name
    while (cur && !seen.has(cur)) {
      seen.add(cur)
      out.push(cur)
      cur = this.bases.get(cur)
    }
    return out
  }

  /** 找一個方法。找不到回 undefined——呼叫端要出聲，不得靜默略過 */
  method(structName: string, methodName: string): MethodDecl | undefined {
    structName = bareTypeName(structName)
    // 沿著繼承鏈找——**自己先於基底**，那就是「覆寫蓋掉基底」
    for (const t of this.chain(structName)) {
      const m = this.methods.get(t)?.get(methodName)
      if (m) return m
    }
    return undefined
  }

  /** 解構式——沿繼承鏈找，自己先於基底 */
  destructorOf(structName: string): MethodDecl | undefined {
    for (const t of this.chain(structName)) {
      const d = this.dtors.get(t)
      if (d) return d
    }
    return undefined
  }

  constructorOf(structName: string): MethodDecl | undefined {
    return this.ctors.get(structName)
  }

  /**
   * 「怎麼在一個實例上跑一段方法本體」——由**語言套件**安裝。
   *
   * 核心知道「有建構式」，但不知道怎麼跑它（那牽涉作用域怎麼綁 `this`、
   * 回傳訊號怎麼接），而那些是語言套件的知識。
   *
   * ⚠️ 第一版是讓核心把節點改標成一個假概念 `cpp_ctor_call` 再走執行器。
   * **孤兒實作護欄當場抓到**：那是一個沒有任何概念定義的執行器。編一個假
   * 概念來分派，等於在概念註冊表裡留一個沒有人宣告的東西。
   */
  private runner: ((obj: RuntimeValue, m: MethodDecl, args: SemanticNode[]) => Promise<unknown>) | null = null

  installMethodRunner(fn: (obj: RuntimeValue, m: MethodDecl, args: SemanticNode[]) => Promise<unknown>): void {
    this.runner = fn
  }

  /**
   * 「怎麼求一個表達式的值」——同樣由語言套件安裝，理由與 `runner` 相同。
   *
   * 沒有安裝時成員預設值**不套用**（欄位停在型別預設值）。⚠️ 那是刻意的：
   * 核心不會自己編一個求值器，寧可少做也不要做出一個與語言套件不一致的值。
   */
  private evaluator: ((node: SemanticNode) => Promise<RuntimeValue>) | null = null

  installExprEvaluator(fn: (node: SemanticNode) => Promise<RuntimeValue>): void {
    this.evaluator = fn
  }

  /** 在一個實例上跑一個方法——給運算子多載那類「核心需要回呼」的路徑用 */
  async invoke(obj: RuntimeValue, m: MethodDecl, args: SemanticNode[]): Promise<RuntimeValue | undefined> {
    if (!this.runner) return undefined
    return (await this.runner(obj, m, args)) as RuntimeValue
  }

  /** 建一個實例並跑它的建構式（若有）。沒有語言套件安裝 runner 時，只建不跑 */
  async construct(name: string, args: SemanticNode[]): Promise<RuntimeValue> {
    const obj = this.instantiate(name)
    // **成員預設值先於建構式**——C++ 的順序就是這樣（預設值屬於成員初始化列，
    // 建構式本體在它之後跑），所以建構式指定的值蓋得掉預設值。
    await this.applyFieldInits(obj, name)
    const ctor = this.ctors.get(name)
    if (ctor && this.runner) await this.runner(obj, ctor, args)
    return obj
  }

  /**
   * 套用成員預設值（`class A { int v = 7; };`）。
   *
   * ⚠️ **與 `instantiate` 分開，因為求值是非同步的**——`instantiate` 被巢狀
   * 欄位同步遞迴呼叫，把 `await` 放進去會讓那條路徑全部要改成 async。
   * 這裡走同一條型別鏈再補一次，巢狀物件欄位遞迴。
   */
  private async applyFieldInits(obj: RuntimeValue, name: string, seen: Set<string> = new Set()): Promise<void> {
    if (obj.type !== 'object' || seen.has(name)) return
    const next = new Set(seen).add(name)
    const map = obj.value as ObjectFields
    // 基底先——與 `instantiate` 同序，衍生的同名欄位蓋掉基底的
    for (const t of [...this.chain(name)].reverse()) {
      for (const f of this.types.get(t) ?? []) {
        if (this.has(f.type)) {
          const nested = map.get(f.name)
          if (nested) await this.applyFieldInits(nested, f.type, next)
        }
        if (!f.init || !this.evaluator) continue
        map.set(f.name, await this.evaluator(f.init))
      }
    }
  }

  has(name: string): boolean {
    return this.types.has(bareTypeName(name))
  }

  /**
   * 這個型別（含基底鏈）的欄位，**按宣告順序**。
   *
   * 聚合初始化（`S s = {"a", 90};`）要的就是這個順序——C++ 的規則是
   * 「按成員宣告順序」，基底在前。
   */
  fieldsOf(name: string): FieldDecl[] {
    name = bareTypeName(name)
    const out: FieldDecl[] = []
    for (const t of [...this.chain(name)].reverse()) out.push(...(this.types.get(t) ?? []))
    return out
  }

  /**
   * 建一個實例，欄位取得預設值。
   *
   * 巢狀結構遞迴建立。`seen` 擋住自我參照（`struct A { A a; }`）——
   * 那在 C++ 本來就不合法，而少了這道防線這裡會無限遞迴，
   * 症狀是瀏覽器整個卡住而不是一則錯誤訊息。
   */
  instantiate(name: string, seen: Set<string> = new Set()): RuntimeValue {
    const raw = name
    name = bareTypeName(name)
    if (!this.types.has(name)) return defaultValue(raw)
    if (seen.has(name)) {
      throw new Error(`結構 ${name} 直接或間接包含自己——那在 C++ 不合法（要用指標）`)
    }
    const next = new Set(seen).add(name)
    const map: ObjectFields = new Map()
    // **基底先建**，衍生的同名欄位蓋掉它——與 C++ 的遮蔽一致
    for (const t of [...this.chain(name)].reverse()) {
      for (const f of this.types.get(t) ?? []) {
        map.set(f.name, this.has(f.type) ? this.instantiate(f.type, next) : defaultValue(f.type))
      }
    }
    return { type: 'object', value: map, structName: name }
  }
}
