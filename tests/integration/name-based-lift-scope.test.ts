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
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
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

async function run(code: string): Promise<string> {
  const interp = new SemanticInterpreter({ maxSteps: 50000 })
  await interp.execute(lift(code) as never)
  return interp.getOutput().join('')
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

    it('🔴 `enum Marker { EOF = -99 }` → 印出 -99，而且不丟錯', async () => {
      let out = ''
      let err = ''
      try {
        out = await run(`${HEAD}enum Marker { EOF = -99 };\n`
          + 'int main() {\n    cout << EOF << endl;\n    return 0;\n}\n')
      } catch (e) { err = (e as Error).message }
      expect(err, '🔴 丟錯了。⚠️ 而它曾經說「重複宣告」——使用者只宣告了一次，'
        + '\n   那個訊息說的是【系統自己也宣告了一份】，而它不該').toBe('')
      expect(out.trim()).toBe('-99')
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
