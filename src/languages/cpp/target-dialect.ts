/**
 * **同一個型別在 C 與 C++ 裡的寫法差異。**
 *
 * ## 它從哪來
 *
 * `draft/2026-08-13-C和C++難分難捨.md`§五 的對照實驗：同一棵語義樹，
 * C 風格投影出去餵 `gcc -std=c99` → **6 通過 / 10**。而 4 段失敗**只有兩種**：
 *
 * ```
 * 3 段  use of undeclared identifier 'bool'          C99 的 bool 要 <stdbool.h>
 * 1 段  must use 'struct' tag to refer to type 'Point'  C 要寫 struct Point p;
 * ```
 *
 * ## 🔴 而「這是 C 嗎」這件事，沒有任何既有欄位標得出來
 *
 * 2026-08-17 實測四個風格：
 *
 * ```
 * io: printf          🔴 競賽也是——而它是 C++
 * namespace: explicit 🔴 google 也是——而它是 C++
 * ```
 *
 * > **一個靠既有欄位合取推出來的身分，不是一個身分——
 * > 它只是今天剛好沒有別人命中。**
 *
 * → 所以判準錨在**風格自己的 `id`**（那是一個具名的宣告），
 * 而目標（`Target`）正是「把那個名字綁上可見範圍」的東西。
 *
 * ## ⚠️ 而這是一個【刻意的簡化】
 *
 * 完整設計裡，「C99 提供什麼」是 `provides` 那一格的事
 * （`draft`§三 的四欄之一）。**本輪沒做 `provides`**，
 * 所以這裡直接用 id 判。
 * 🔴 **不得因為這個檔存在就以為 `provides` 已經做了。**
 */
import type { SemanticNode, StylePreset } from '../../core/types'

/** 這個風格產出的是 C，不是 C++。 */
export function isCDialect(style: StylePreset): boolean {
  return style.id === 'c'
}

/**
 * C 沒有內建 `bool`——C99 的 `bool` 由 `<stdbool.h>` 提供。
 * ⚠️ 而 `_Bool` 是內建的，但教學上 `bool` 好讀得多，所以補標頭而不是換型別。
 */
export const C_BOOL_HEADER = 'stdbool.h'

/** 這棵樹裡有沒有用到 `bool`（型別名或字面值）。 */
export function usesBool(root: SemanticNode): boolean {
  if (root.properties?.type === 'bool') return true
  // `true`／`false` 字面值在 C99 也要 <stdbool.h>
  const v = root.properties?.value
  if (v === true || v === false || v === 'true' || v === 'false') return true
  for (const bucket of Object.values(root.children ?? {})) {
    for (const c of bucket ?? []) if (usesBool(c)) return true
  }
  return false
}

/**
 * 一個型別名在 C 裡要不要加標籤。
 *
 * C++ 的 `struct Point { … };` 之後可以直接 `Point p;`，
 * **而 C 必須寫 `struct Point p;`**——那是這兩個世界唯一真正的語義差異
 * （`draft`§一：「其餘全是寫法」）。
 */
export function cTypeName(type: string, structNames: ReadonlySet<string>): string {
  return structNames.has(type) ? `struct ${type}` : type
}

/**
 * 這棵樹裡宣告了哪些 struct 名字。
 *
 * ⚠️ **問性狀不問身分**——用 `structNameOf` 讓元件自己說它宣告了什麼，
 * 而不是在這裡寫死 `cpp:struct_declare`。
 */
export function collectStructNames(root: SemanticNode, acc = new Set<string>()): Set<string> {
  if (root.componentId.endsWith(':struct_declare') && typeof root.properties?.name === 'string') {
    acc.add(root.properties.name)
  }
  for (const bucket of Object.values(root.children ?? {})) {
    for (const c of bucket ?? []) collectStructNames(c, acc)
  }
  return acc
}
