import type { SemanticNode } from './types'

/**
 * 換到另一個語言的結果形狀（spec 219，契約 `specs/219-cpp-to-python/contracts/convert-to-language.md`）。
 * 獨立一個檔：`language-packs.ts` 裡的非可選成員會被語言外掛護欄當成「語言必須提供的能力」。
 */
export interface LanguageConversion {
  code: string | null
  converted: number
  kept: number
  reasons: { nodeId: string; line?: number; kind: KeepKind; detail: string }[]
}

/** 保留的原因類別（spec 219 contracts）。 */
export type KeepKind = 'overflow' | 'division' | 'modulo' | 'char' | 'pointer' | 'class' | 'template' | 'outside-subset' | 'needs-types'
  /** Python → C++（spec 225）：型別說不準（聯集、空容器看不出元素、這份輸入下沒跑到） */
  | 'type-uncertain'
  /** Python → C++：程式讀輸入而沒有輸入可用（型別要在一份輸入上觀察） */
  | 'needs-input'

/**
 * 子運算式是二元運算（有 left／right 槽）時加括號——不追優先序，寧可多一層括號。
 * 兩個方向的換寫法共用（C++ → Python、Python → C++）：各自的契約再匯出它，膠囊照舊從自己的契約拿。
 */
export function paren(n: SemanticNode | undefined, ctx: { expr(n: SemanticNode | undefined): string }): string {
  const e = ctx.expr(n)
  return n?.slots?.left && n?.slots?.right ? `(${e})` : e
}

