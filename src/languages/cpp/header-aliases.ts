/**
 * C-style ↔ C++-style header equivalence mapping.
 *
 * When the user writes `#include <stdio.h>`, auto-include should recognize
 * it as equivalent to `<cstdio>` and not add a duplicate.
 */

/** Map from C-style header to C++-style equivalent (both without angle brackets) */
const C_TO_CPP: Record<string, string> = {
  'stdio.h': 'cstdio',
  'stdlib.h': 'cstdlib',
  'string.h': 'cstring',
  'math.h': 'cmath',
  'ctype.h': 'cctype',
  'time.h': 'ctime',
  'limits.h': 'climits',
  'float.h': 'cfloat',
  'assert.h': 'cassert',
  'errno.h': 'cerrno',
  'signal.h': 'csignal',
  'stddef.h': 'cstddef',
  'stdarg.h': 'cstdarg',
  'stdint.h': 'cstdint',
  'stdbool.h': 'cstdbool',
  'wchar.h': 'cwchar',
  'wctype.h': 'cwctype',
  'setjmp.h': 'csetjmp',
  'locale.h': 'clocale',
}

/** Map from C++-style header to C-style equivalent */
const CPP_TO_C: Record<string, string> = Object.fromEntries(
  Object.entries(C_TO_CPP).map(([c, cpp]) => [cpp, c])
)

/**
 * Given a header name (with or without angle brackets),
 * return the normalized C++-style header in `<cstdio>` format.
 * If the header has no known alias, returns it unchanged (with angle brackets).
 *
 * Examples:
 *   normalizeHeader('<stdio.h>') → '<cstdio>'
 *   normalizeHeader('<cstdio>')  → '<cstdio>'
 *   normalizeHeader('stdio.h')  → '<cstdio>'
 *   normalizeHeader('<vector>') → '<vector>'
 */
export function normalizeHeader(header: string): string {
  const bare = header.replace(/^<|>$/g, '')
  const mapped = C_TO_CPP[bare]
  if (mapped) return `<${mapped}>`
  return header.startsWith('<') ? header : `<${header}>`
}

/**
 * Check if two headers (with or without angle brackets) are equivalent.
 * e.g., `<stdio.h>` and `<cstdio>` are equivalent.
 */
export function headersEquivalent(a: string, b: string): boolean {
  return normalizeHeader(a) === normalizeHeader(b)
}

/**
 * Given a set of header strings (e.g., `<stdio.h>`, `<cstdio>`),
 * return a new set containing all headers plus their C/C++ equivalents.
 * Useful for deduplication: if manual includes contain `<stdio.h>`,
 * the expanded set will also contain `<cstdio>`.
 */
export function expandHeaderAliases(headers: Set<string>): Set<string> {
  const expanded = new Set(headers)
  for (const h of headers) {
    const bare = h.replace(/^<|>$/g, '')
    const cppEquiv = C_TO_CPP[bare]
    if (cppEquiv) expanded.add(`<${cppEquiv}>`)
    const cEquiv = CPP_TO_C[bare]
    if (cEquiv) expanded.add(`<${cEquiv}>`)
  }
  return expanded
}

/**
 * **C++ 名字 → C 名字。**（2026-08-17，階段 6.10）
 *
 * 🔴 **`CPP_TO_C` 那張反向表【本來就在】**（上面 :31）——它是為了辨識等價
 * 而建的，而 C 目標**產出**時要的正是同一份資料。
 * **所以本功能新增的資料是零。**
 *
 * ⚠️ 而 `<iostream>`／`<vector>` 那些**不在這張表裡**，因為它們
 * **在 C 裡根本不存在**——那不是對映問題，是「那個概念在那個世界沒有」，
 * 由**可見範圍**負責（`draft/2026-08-13-C和C++難分難捨.md`§三 的 `visible`）。
 */
export function toCHeader(header: string): string {
  const bare = header.replace(/^<|>$/g, '')
  return CPP_TO_C[bare] ?? bare
}

/**
 * **C 裡用哪個標頭滿足同一個需求**——`<iostream>` → `<stdio.h>`。
 *
 * ## 🔴 為什麼它不是 `toCHeader` 的一筆
 *
 * 我第一版把 `iostream → stdio.h` 寫進 `toCHeader`，而**既有的測試當場抓到**
 * （`tests/unit/c-topic-derivation.test.ts`）：那支用「**名字有沒有被換掉**」
 * 判斷「**C 有沒有這個標頭**」，於是我的改動讓它判成「C 有 iostream」
 * ——而 C **真的沒有**。
 *
 * ```
 * toCHeader        「這個標頭在 C 裡【叫什麼】」   cmath → math.h    同一個標頭的兩個名字
 * ioHeaderFor      「C 裡【什麼標頭】滿足這個需求」 iostream → stdio.h  同一個需求的兩個實作
 * ```
 *
 * > **兩個函式如果回傳同一種型別，很容易被合成一個
 * > ——而它們答的是不同的問題，合起來之後【每一個消費者都會拿到錯的答案】。**
 *
 * ⚠️ 而 `cpp:print`（`requires: <iostream>`）**仍然應該被排除在 C 課程之外**
 * ——學生在 C 裡不該看到 `cout`。那是**可見範圍**的事，與這裡無關。
 *
 * ## 而它為什麼存在
 *
 * `io_style: printf` 已經把 `cout` 換成 `printf` 了，**而標頭沒有跟著換**
 * ——於是 C 目標產出 `#include <iostream>` 配 `printf(...)`，**編不過**（spec 146）。
 *
 * > **`<iostream>` 從來不是語義，語義是「這段程式需要輸出」
 * > ——標頭是那個需求在某個風格下的投影。**
 */
export function cIoHeaderFor(header: string): string | null {
  return header.replace(/^<|>$/g, '') === 'iostream' ? 'stdio.h' : null
}

