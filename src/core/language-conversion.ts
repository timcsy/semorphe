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
  /** Python → C++：印浮點數（Python 的 repr 與 cout 的預設寫法不同） */
  | 'float-print'
  /** Python → C++：程式讀輸入而沒有輸入可用（型別要在一份輸入上觀察） */
  | 'needs-input'
