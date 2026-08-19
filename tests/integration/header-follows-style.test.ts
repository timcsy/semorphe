/**
 * spec 146：**標頭跟著風格走**——C 目標產出的程式碼要編得過。
 *
 * ## 🔴 為什麼既有的測試沒抓到
 *
 * `tests/probes/c-style-parity.test.ts:87` 斷言「C style 產出了 `<iostream>`」
 * 並期望 `.not.toContain('iostream')`——**而它綠著**，因為它的語料**沒有 include 行**，
 * 於是輸出根本沒有標頭。
 *
 * > **一條只驗「不得有 X」的測試，通不出「該有的 Y 在不在」。**
 *
 * ⚠️ 而那正是 `experience.md` 既有的「**護欄常常只問了一個方向**」。
 * 所以這一支**兩個方向都問**。
 *
 * ## 🔴 為什麼「換掉」不是投影改寫真實
 *
 * ```
 * 語義（真實）   這段程式需要【輸出的能力】
 * 投影（標頭）   iostream 或 stdio.h —— 哪一個，由風格決定
 * ```
 *
 * > **`<iostream>` 從來不是語義，語義是「需要輸出」。**
 *
 * 換掉標頭與「把 `cout` 換成 `printf`」是**同一件事**，而後者早就在做了
 * ——真正的不一致是**語句換了風格而它的標頭沒有**。
 *
 * ## ⚠️ 自我否證聲明
 *
 * **如果 C++ 那一支在產生器整個壞掉時也通過，它證明的是「兩邊都是空的」。**
 * 所以每一條前面都有正向錨點：先斷言產出**非空且含 `main`**。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { setDependencyResolver } from '../../src/core/projection/code-generator'
import { createPopulatedRegistry } from '../../src/languages/cpp/std'
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import cStyle from '../../src/languages/cpp/styles/c.json'
import apcsStyle from '../../src/languages/cpp/styles/apcs.json'
import competitiveStyle from '../../src/languages/cpp/styles/competitive.json'
import type { StylePreset } from '../../src/core/types'

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})

function gen(src: string, style: unknown): string {
  const t = lifter.lift(tsParser.parse(src).rootNode as never)
  expect(t, 'lift 回了 null → 這一條空過').not.toBeNull()
  const out = generateCode(t!, 'cpp', style as StylePreset)
  expect(out, '產出是空的 → 這一條空過').toContain('main')
  return out
}

const WITH_INCLUDE = '#include <iostream>\nint main(){ int x = 1; std::cout << x; return 0; }'
const NO_INCLUDE = 'int main(){ int x = 1; std::cout << x; return 0; }'

describe('spec 146 · US1：C 目標的標頭', () => {
  it('🔴 原文有 `<iostream>` → 換成 `<stdio.h>`', () => {
    const out = gen(WITH_INCLUDE, cStyle)
    expect(out, `C 目標仍然吐 iostream：\n${out.slice(0, 90)}`).not.toContain('iostream')
    expect(out, `C 目標沒有 stdio.h：\n${out.slice(0, 90)}`).toContain('#include <stdio.h>')
  })

  it('🔴 原文沒有 include → **補上** `<stdio.h>`', () => {
    // ⚠️ 這一條是既有測試漏掉的那一半——它只問「不得有 iostream」。
    //
    // 🔴 **而它需要相依解析器**：自動補標頭走 `componentRequires()`，
    //    而那條路由 `setDependencyResolver()` 接上（`app.ts:171`）。
    //    **測試不接的話它不會跑**——那不是缺陷，是測試沒把生產路徑接齊。
    setDependencyResolver(createPopulatedRegistry())
    try {
      const out = gen(NO_INCLUDE, cStyle)
      expect(out, `printf 沒有 stdio.h → 隱式宣告：\n${out.slice(0, 90)}`).toContain('#include <stdio.h>')
    } finally { setDependencyResolver(null as never) }
  })

  it('🔴 不得重複', () => {
    const out = gen(WITH_INCLUDE, cStyle)
    expect(out.split('#include <stdio.h>').length - 1, '產生了重複的 include').toBe(1)
  })
})

describe('spec 146 · US2：🔴 C++ 一個字都不能變', () => {
  it('★ 錨點 ＋ 主張：apcs 的輸出含 iostream，不含 stdio', () => {
    const out = gen(WITH_INCLUDE, apcsStyle)
    expect(out).toContain('#include <iostream>')
    expect(out, 'C++ 目標被換成 stdio.h 了').not.toContain('stdio.h')
  })

  it('🔴 原文有 `<stdio.h>` 而目標是 C++ → **不改寫**', () => {
    // 🔄 **規格原本要求「對稱處理」，實作中否決**：
    //    C++ **看得懂 `<stdio.h>`**（它是合法的 C++ 標頭），所以那不是「編不過」
    //    而是「風格不一致」——**而風格不一致不值得改寫使用者寫的東西**。
    //
    // > **這一刀治的是【編不過】，不是【不好看】。**
    const out = gen('#include <stdio.h>\nint main(){ printf("%d", 1); return 0; }', apcsStyle)
    expect(out, 'C++ 目標改寫了一個它看得懂的標頭').toContain('stdio.h')
  })

  it('🔴 `bits` 風格不受影響', () => {
    const out = gen(WITH_INCLUDE, competitiveStyle)
    expect(out, 'bits 風格被動到了').not.toContain('stdio.h')
  })
})

describe('spec 146 · 🔴 與 I/O 無關的標頭完全不動', () => {
  it('`<vector>` 在 C++ 目標下原樣保留', () => {
    const out = gen('#include <vector>\n#include <iostream>\nint main(){ return 0; }', apcsStyle)
    expect(out).toContain('#include <vector>')
  })

  it('`<cmath>` 在 C 目標下換成它的 **C 名字** `<math.h>`', () => {
    // 🔄 **我第一版的期望寫錯了**（以為「不動」才對）。
    //    `<cmath>` 在 C 裡就叫 `<math.h>`——**同一個標頭的兩個名字**，
    //    而那早就由 `header-aliases` 那張表在做。
    //
    // 🔴 而 `<iostream>` → `<stdio.h>` 是**同一個需求的兩個實作**，不同的一件事。
    const out = gen('#include <cmath>\nint main(){ return 0; }', cStyle)
    expect(out).toContain('#include <math.h>')
    expect(out, '被換成了別的標頭').not.toContain('stdio.h')
  })
})

describe('spec 146 · FR-005：🔴 `gcc` 真的編得過', () => {
  // ⚠️ 沒有 gcc 就跳過——⚠️ 而**跳過要出聲**：一個安靜跳過的驗收，
  //    與一個通過的驗收在報表上長得一樣。
  const hasC = (() => {
    try { execSync('gcc --version', { stdio: 'pipe' }); return true } catch { return false }
  })()

  it.skipIf(!hasC)('C 目標的產出，`gcc -x c` 編得過', () => {
    setDependencyResolver(createPopulatedRegistry())
    try {
      for (const [tag, src] of [['原文有 include', WITH_INCLUDE], ['原文沒有', NO_INCLUDE]] as const) {
        const out = gen(src, cStyle)
        const f = join(tmpdir(), `semorphe-146-${tag.length}.c`)
        writeFileSync(f, out)
        // 🔴 `-x c` 強制當 C 編——**副檔名不夠**，而這一條驗的正是「它是不是合法的 C」
        expect(() => execSync(`gcc -x c -fsyntax-only ${f}`, { stdio: 'pipe' }),
          `${tag}：C 目標的產出編不過：\n${out}`).not.toThrow()
      }
    } finally { setDependencyResolver(null as never) }
  })

  it('★ 這一條有沒有真的跑', () => {
    // 🔴 沒有這一支的話，`skipIf` 讓上面那條在沒有 gcc 的機器上**安靜消失**
    //    ——而報表看起來仍然全綠。
    console.log(`  FR-005 的 gcc 驗證：${hasC ? '🟢 跑了' : '⚠️ 跳過（這台機器沒有 gcc）'}`)
    expect(typeof hasC).toBe('boolean')
  })
})
