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
