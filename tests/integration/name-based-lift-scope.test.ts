/**
 * **靠名字認人的樣式，要先問一句「這個名字被宣告過嗎」。**
 *
 * ## 🔴 它解的是一份判例
 *
 * `cpp:pin_constant` 的 lift 樣式 2026 年被拿掉，理由逐字（那顆膠囊的 `_lift_why`）：
 *
 * > 語料裡有 `enum Level { LOW = -1, MEDIUM = 0, HIGH = 1 };`，
 * > 而 `cout << LOW` 印出 **0** 而不是 **-1**。
 * >
 * > **一個靠「識別字的名字」認人的樣式，會把使用者自己宣告的名字搶走。**
 *
 * 而那份病歷裡的判準是對的：**「沒有人宣告它，它才是環境提供的」**
 * ——它當時只在**執行期**做得到，所以處置是「拿掉樣式」，
 * 代價是「**correctness 贏 round-trip**」。
 *
 * 🟢 這一刀讓那兩者**不再互斥**：樣式照樣認人，而它先問一句。
 *
 * ## ⚠️ 兩個方向都要驗，而反向那個更容易被忘記
 *
 * ```
 * 有人宣告了   → 不准搶      ← 判例本身
 * 沒有人宣告   → 【一定要認】 ← 那是這些樣式存在的理由
 * ```
 *
 * > **一個「不要搶」的修法，如果只驗了不搶那一半，
 * > 那「什麼都不認」也會全綠——而那是把功能刪掉。**
 *
 * ## 🔴 一條【已知的界線】，而它是刻意的
 *
 * 判斷用的是 lift 當下的作用域，而 lift 是**由上而下**的一趟。
 * 所以「宣告寫在使用**之後**」仍然會被搶——⚠️ 那在 C++ 裡本來就不合法
 * （用一個還沒宣告的名字），所以它不是一個真的使用情境。
 *
 * 解掉它要**兩趟掃描**，而那是另一個設計（spec 174 的 Out of Scope）。
 * 這裡把那條界線**釘住**，不然它會被下一個人誤讀成 bug。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { runCella, describeCellaResult, knownCellaGap } from '../helpers/cella-run'
import type { SemanticNode } from '../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const lift = (c: string): SemanticNode | null =>
  createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode | null

const walk = (n: SemanticNode, out: SemanticNode[] = []): SemanticNode[] => {
  out.push(n)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks ?? []) walk(k, out)
  return out
}

/** 這段碼裡，那個名字被 lift 成哪些元件身分。 */
function componentsOf(code: string, name: string): string[] {
  const t = lift(code)
  if (!t) return ['(lift 回 null)']
  return [...new Set(walk(t)
    .filter((n) => String(n.properties?.value ?? n.properties?.name ?? '') === name)
    .map((n) => n.componentId ?? '(無身分)'))]
}

// 🔴 spec 202（重構 6c-2d）：執行判準從 JS 直譯器換成 Cella（`tests/helpers/cella-run.ts`）——判不出、翻不出、判定有錯都丟出說得出原因的錯。
async function run(code: string): Promise<string> {
  const r = await runCella(code)
  if (r.verdict !== 'accept') throw new Error(describeCellaResult(r))
  return r.out
}

const HEAD = '#include <iostream>\nusing namespace std;\n'

describe('靠名字認人的樣式：先問「被宣告過嗎」', () => {
  it('★ 入口條件——lifter 起得來', () => {
    expect(lift('int main() { return 0; }')).not.toBeNull()
  })

  // ─── 反向那一半先寫：沒有人宣告時【一定要認】 ───

  /**
   * 🔴 **這幾條先寫**，理由見檔頭：只驗「不搶」的話，
   * 一個「什麼都不認」的實作會全綠——而那是把功能刪掉。
   */
  describe('沒有人宣告時：那些名字仍然是環境提供的', () => {
    it('`EOF` 是內建常數', () => {
      expect(componentsOf('int main() {\n    int x = EOF;\n    return 0;\n}\n', 'EOF'))
        .toContain('cpp:builtin_constant')
    })

    it('`NULL` 是內建常數', () => {
      expect(componentsOf('int main() {\n    int* p = NULL;\n    return 0;\n}\n', 'NULL'))
        .toContain('cpp:builtin_constant')
    })

    it('🔴 `HIGH` 是腳位常數——那是這一刀重開的那一顆', () => {
      expect(
        componentsOf('void setup() {\n    digitalWrite(13, HIGH);\n}\n', 'HIGH'),
        '🔴 沒有人宣告 HIGH 而它不是腳位常數 → 樣式沒有重開，或它問錯了',
      ).toContain('cpp:pin_constant')
    })

    it('🔴 `OUTPUT` 是腳位常數', () => {
      expect(componentsOf('void setup() {\n    pinMode(13, OUTPUT);\n}\n', 'OUTPUT'))
        .toContain('cpp:pin_constant')
    })
  })

  // ─── 判例那一半：有人宣告了就不准搶 ───

  describe('有人宣告了：不准搶', () => {
    /** 🔴 判例本身——`cout << LOW` 曾經印出 0。 */
    it('🔴 `enum Level { LOW = -1 }` → `cout << LOW` 印出 -1', async () => {
      const out = await run(`${HEAD}enum Level { LOW = -1, MEDIUM = 0, HIGH = 1 };\n`
        + 'int main() {\n    cout << LOW << endl;\n    return 0;\n}\n')
      expect(out.trim(), '🔴 判例回來了——樣式又把使用者宣告的名字搶走了').toBe('-1')
    })

    /**
     * 🔴 spec 202：這一條原本靠 JS 直譯器的輸出（印 -99、不丟「重複宣告」）觀察 lift 有沒有搶走 `EOF`。
     * 換成 Cella 後量到：**這段程式在真的編譯器上不合法**——`<iostream>` 實際上帶進 `EOF` 巨集
     * （Apple clang -std=c++17：`error: expected identifier`，`EOF` 展開成 `(-1)`；libstdc++ 的 `<string>` 也經
     * `<ext/string_conversions.h>` 引入 `<cstdio>`）。所以輸出不再是 lift 的好觀察點：
     * 守 lift 的那一半改成直接看身分（使用處指到使用者的列舉常數，不是內建常數）；執行那一半照 C++ 的答案釘住。
     */
    it('🔴 `enum Marker { EOF = -99 }` → 使用處的 `EOF` 是他宣告的那一個，不是內建常數', () => {
      const ids = componentsOf(`${HEAD}enum Marker { EOF = -99 };\n`
        + 'int main() {\n    cout << EOF << endl;\n    return 0;\n}\n', 'EOF')
      expect(ids, '🔴 判例回來了——樣式把使用者宣告的 EOF 搶走了').not.toContain('cpp:builtin_constant')
      expect(ids).toContain('cpp:var_ref')
    })

    // Cella 判錯（疑似）：`<iostream>` 之下重新宣告 `EOF` 在 libc++ 與 libstdc++ 都編不過（EOF 是巨集），
    // 而 Cella 0.1.202611020258 判 accept 印 -99；同一個 Cella 對「只引入 <iostream> 就用 EOF」判的是
    // unknown「whether the headers included declare EOF depends on the library」——兩者不一致。正確的判決至少不是 accept。
    it('🟡 已知缺陷（修好時這條會紅）：`<iostream>` 之下重新宣告 `EOF` 不是可攜的 C++，不得判 accept', async () => {
      await knownCellaGap(/Cella 判 accept 了一段在 libc\+\+／libstdc\+\+ 都編不過的程式/, async () => {
        const r = await runCella(`${HEAD}enum Marker { EOF = -99 };\n`
          + 'int main() {\n    cout << EOF << endl;\n    return 0;\n}\n')
        if (r.verdict === 'accept') {
          throw new Error(`Cella 判 accept 了一段在 libc++／libstdc++ 都編不過的程式（印出 ${JSON.stringify(r.out)}）`)
        }
      })
    })

    it('宣告了同名的變數：那個名字是他的', () => {
      const ids = componentsOf('int main() {\n    int HIGH = 7;\n    int x = HIGH;\n    return 0;\n}\n', 'HIGH')
      expect(ids, '🔴 使用者的變數被認成腳位常數').not.toContain('cpp:pin_constant')
    })
  })

  // ─── 已知的界線 ───

  /**
   * ⚠️ **釘住一條刻意留下的界線**：宣告寫在使用**之後**時仍然會被搶。
   *
   * 🟢 而它在 C++ 裡本來就不合法（用一個還沒宣告的名字），
   * 所以它不是一個真的使用情境——解掉它要**兩趟掃描**，那是另一個設計。
   *
   * > **一條已知的界線如果沒有被釘住，
   * > 它會在下一個人手上被讀成一個 bug——然後被「修」成一個更大的設計。**
   */
  it('⚠️ 已知界線：宣告寫在使用之後，仍然會被認成環境常數', () => {
    const ids = componentsOf('int main() {\n    int x = HIGH;\n    return 0;\n}\nint HIGH = 7;\n', 'HIGH')
    expect(
      ids,
      '（這一條記的是【今天的界線】，不是一個要求。它變了就更新這裡，\n'
      + ' 而**不要**在沒有兩趟掃描的情況下宣稱它解掉了。）',
    ).toContain('cpp:pin_constant')
  })
})
