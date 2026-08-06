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
}

/** 一個方法／建構式 */
export interface MethodDecl {
  name: string
  params: FieldDecl[]
  body: SemanticNode[]
}

export class StructRegistry {
  private types = new Map<string, FieldDecl[]>()
  private methods = new Map<string, Map<string, MethodDecl>>()
  private ctors = new Map<string, MethodDecl>()

  declare(name: string, fields: FieldDecl[], methods: MethodDecl[] = [], ctor?: MethodDecl): void {
    this.types.set(name, fields)
    this.methods.set(name, new Map(methods.map((m) => [m.name, m])))
    if (ctor) this.ctors.set(name, ctor)
  }

  /** 找一個方法。找不到回 undefined——呼叫端要出聲，不得靜默略過 */
  method(structName: string, methodName: string): MethodDecl | undefined {
    return this.methods.get(structName)?.get(methodName)
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

  /** 建一個實例並跑它的建構式（若有）。沒有語言套件安裝 runner 時，只建不跑 */
  async construct(name: string, args: SemanticNode[]): Promise<RuntimeValue> {
    const obj = this.instantiate(name)
    const ctor = this.ctors.get(name)
    if (ctor && this.runner) await this.runner(obj, ctor, args)
    return obj
  }

  has(name: string): boolean {
    return this.types.has(name)
  }

  /**
   * 建一個實例，欄位取得預設值。
   *
   * 巢狀結構遞迴建立。`seen` 擋住自我參照（`struct A { A a; }`）——
   * 那在 C++ 本來就不合法，而少了這道防線這裡會無限遞迴，
   * 症狀是瀏覽器整個卡住而不是一則錯誤訊息。
   */
  instantiate(name: string, seen: Set<string> = new Set()): RuntimeValue {
    const fields = this.types.get(name)
    if (!fields) return defaultValue(name)
    if (seen.has(name)) {
      throw new Error(`結構 ${name} 直接或間接包含自己——那在 C++ 不合法（要用指標）`)
    }
    const next = new Set(seen).add(name)
    const map: ObjectFields = new Map()
    for (const f of fields) {
      map.set(f.name, this.has(f.type) ? this.instantiate(f.type, next) : defaultValue(f.type))
    }
    return { type: 'object', value: map, structName: name }
  }
}
