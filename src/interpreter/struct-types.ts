/**
 * 結構／類別的型別登記處。
 *
 * **每個直譯器實例一份。** 用全域 Map 的話，一個測試宣告的結構會漏到下一個
 * 測試——那種洩漏在測試各自跑時看不出來，只在整批跑時偶發，而那正是最難查的
 * 那種失敗。
 */
import type { RuntimeValue, ObjectFields } from './types'
import { defaultValue } from './types'

/** 一個欄位的宣告：名字與型別（型別可能是另一個結構） */
export interface FieldDecl {
  name: string
  type: string
}

export class StructRegistry {
  private types = new Map<string, FieldDecl[]>()

  declare(name: string, fields: FieldDecl[]): void {
    this.types.set(name, fields)
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
