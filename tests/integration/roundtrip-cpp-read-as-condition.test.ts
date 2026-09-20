/**
 * 讀取當迴圈條件——`while (getline(cin, s))` 四個面向都要走得完
 *
 * ## 這支測試在防什麼
 *
 * 語料 **16 支**把讀取當迴圈條件（`while(cin >> n)` 15 支 ＋ `while(getline(cin,s))` 1 支），
 * 而那一族在 2026-09-20 之前有**兩個**缺陷，**兩個都只在 `getline` 身上**：
 *
 * ```
 * ⑤ 跑出來一不一樣  執行器【一個值都不回】 → 條件是 undefined → 迴圈一次都不進去   第 209 刀
 * ③ 載得進工作區嗎  沒有運算式形態 → 渲染挑不到 → 一顆灰色的「直接寫運算式」      第 210 刀
 * ```
 *
 * 🔴 **兩次都是「一族裡只有一個成員沒處理」**：`while (cin >> n)`、
 * `while (cin >> a >> b)`、語句位置的 `getline` **三條最像的路都是對的**
 * ——而兄弟的綠讓這一顆不會被注意到。
 *
 * ⚠️ 第二個是**瀏覽器驗收**抓到的，不是測試：
 * `component.json` **早就宣告了** `positions: ["statement", "expression"]`
 *（`_positions_why` 逐字：「回傳 istream&」），而 `forms/blocks.json` 只做了語句那一個。
 *
 * > **一個宣告說得出、而形態沒做的位置，渲染時不會出聲——它會退成逃生艙。**
 *
 * ## 本檔不檢測什麼
 *
 * - **不檢測執行結果**——那在 `interpreter-matches-compiler`（拿 g++ 當權威），
 *   而這裡連解譯器都不叫。這一支問的是**形狀**。
 * - **不檢測 `cin >>`**——它一直是對的，而它在這裡當**正向錨點**。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { renderToBlocklyState } from '../../src/core/projection/block-renderer'
import { generateCode } from '../../src/core/projection/code-generator'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { BlockSpecRegistry } from '../../src/core/blocks/block-spec-registry'
import { registerCppExtractStrategies } from '../../src/languages/cpp/extractors/extract-strategies'
import { allCppProjections, allCppComponents } from '../../src/languages/cpp/all-declarations'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { isDynamic } from '../../src/core/component/slot-check'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const style: StylePreset = {
  id: 'apcs',
  name: { 'zh-TW': 'APCS', en: 'APCS' },
  io_style: 'cout',
  naming_convention: 'camelCase',
  indent_size: 4,
  brace_style: 'K&R',
  namespace_style: 'using',
  header_style: 'individual',
}

let parser: Parser
let extractor: PatternExtractor
const liftCode = (c: string): SemanticNode =>
  createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode

beforeAll(async () => {
  await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  await setupTestRenderer()
  registerCppLanguage()
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(allCppComponents() as never, allCppProjections() as never)
  extractor = new PatternExtractor()
  extractor.loadBlockSpecs(reg.getAll())
  registerCppExtractStrategies(extractor)
})

/**
 * 這顆積木是不是「逃生艙」——**問產品自己那一份**（`isDynamic`）。
 *
 * 🔴 **第一版自己寫了 `/raw_code|unresolved/`，而它抓不到真正出現的那一個**
 *（2026-09-20 量到）：沒有運算式形態時，渲染退成 **`raw_expression`**
 * ——沒有 `cpp_` 前綴、也不含 `raw_code` 這幾個字。
 * 於是那條負向斷言在缺陷還在的時候**照樣是綠的**。
 *
 * > **一個用名字形狀過濾的探針，會漏掉同一族裡名字不像的那一顆。**
 *
 * 🟢 而第二版列了一張清單，那**只是把同一個問題往後推一格**（清單會過期）。
 * `core/component/slot-check.ts` 的 `isDynamic` 就是產品自己的那個判準，
 * 用它的話，這裡不會與產品分岔。
 * ⚠️ 積木型別是 `cpp_raw_expression` 這種，而 `isDynamic` 吃的是
 * `cpp:raw_expression` 這種——所以要把第一個底線換回冒號。
 */
function isEscapeHatch(blockType: string): boolean {
  return isDynamic(blockType) || isDynamic(blockType.replace('_', ':'))
}

/** 積木狀態裡出現過的每一種型別（深走，含 inputs／next）。 */
function blockTypes(st: unknown, acc: string[] = []): string[] {
  if (!st || typeof st !== 'object') return acc
  const o = st as Record<string, unknown>
  if (typeof o.type === 'string') acc.push(o.type)
  for (const v of Object.values(o)) {
    if (Array.isArray(v)) v.forEach((x) => blockTypes(x, acc))
    else if (v && typeof v === 'object') blockTypes(v, acc)
  }
  return acc
}

function idsOf(n: SemanticNode, acc: string[] = []): string[] {
  acc.push(n.componentId)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids ?? []) idsOf(k, acc)
  return acc
}

const HEAD = '#include <bits/stdc++.h>\nusing namespace std;\n'

/**
 * 四種寫法——**前三種是正向錨點**（它們一直是對的）。
 * 少了它們，一支「整族都退成逃生艙」的迴歸看起來與現況一模一樣。
 */
const CASES: { name: string; code: string; wants: string }[] = [
  { name: '★錨點：while (cin >> n)', wants: 'cpp:input',
    code: `${HEAD}int main(){ int n; while (cin >> n) { cout << n; } return 0; }\n` },
  { name: '★錨點：while (cin >> a >> b)', wants: 'cpp:input',
    code: `${HEAD}int main(){ int a, b; while (cin >> a >> b) { cout << a; } return 0; }\n` },
  { name: '★錨點：語句位置的 getline', wants: 'cpp:input_line',
    code: `${HEAD}int main(){ string s; getline(cin, s); cout << s; return 0; }\n` },
  { name: '🔴 while (getline(cin, s))', wants: 'cpp:input_line',
    code: `${HEAD}int main(){ string s; while (getline(cin, s)) { cout << s; } return 0; }\n` },
]

describe('讀取當迴圈條件：四個面向', () => {
  for (const c of CASES) {
    describe(c.name, () => {
      it('① 認得出來——那顆身分真的在樹裡（否則下面每一條都是空過的）', () => {
        expect(idsOf(liftCode(c.code)), '身分不在 → 這一支量的不是它要量的').toContain(c.wants)
      })

      it('③ 載得進工作區——而且【不是】一顆灰色的逃生艙', () => {
        const types = blockTypes(renderToBlocklyState(liftCode(c.code)))
        expect(types.length, '一顆積木都沒有 → 渲染整個失敗，不是這一支在量的').toBeGreaterThan(3)
        expect(
          types.filter(isEscapeHatch),
          `退成逃生艙了：${JSON.stringify(types)}`,
        ).toEqual([])
      })

      it('④ 走一趟積木回來——抽得出東西，而且沒有掉成 null', () => {
        const st = renderToBlocklyState(liftCode(c.code)) as { blocks: { blocks: unknown[] } }
        const back = st.blocks.blocks.map((b) => extractor.extract(b as never))
        expect(back.length, '一塊頂層積木都沒有').toBeGreaterThan(0)
        expect(back.filter((x) => x == null), '有頂層積木抽出來是 null').toEqual([])
      })

      it('① 產出的程式碼——那一行還在，而且沒有多一個分號', () => {
        const gen = generateCode(liftCode(c.code), 'cpp', style)
        const head = gen.split('\n').find((l) => /while|getline/.test(l)) ?? ''
        expect(head, `產出：\n${gen}`).not.toBe('')
        expect(head, `條件裡多了分號：${head}`).not.toMatch(/;\s*\)/)
      })
    })
  }

  it('🔴 `while (getline(...))` 的條件是【讀一行】那顆積木的運算式形態', () => {
    // ⚠️ 這一條是指名的：上面那條只說「不是逃生艙」，說不出「是對的那一顆」。
    const types = blockTypes(renderToBlocklyState(liftCode(CASES[3].code)))
    expect(types, `積木：${JSON.stringify(types)}`).toContain('cpp_input_line_expression')
  })

  it('★ 自我檢查：`isEscapeHatch` 真的認得出逃生艙', () => {
    // ⚠️ 不可省。它認不出來的話，上面每一條「不是逃生艙」都會空過
    //    ——而那正是這一支測試第一版發生的事（正則漏了 `raw_expression`）。
    // 🟢 這裡**直接餵那三個名字**，不靠「某一段程式碼一定會退化」
    //    ——後者會隨著辨識率提高而失效，而那時它變成一支空過的測試。
    for (const t of ['raw_expression', 'cpp_raw_expression', 'raw_code', 'cpp_raw_code', 'unresolved']) {
      expect(isEscapeHatch(t), `${t} 沒被認出是逃生艙`).toBe(true)
    }
    for (const t of ['cpp_input_line', 'cpp_input_line_expression', 'cpp_loop_while']) {
      expect(isEscapeHatch(t), `${t} 被誤判成逃生艙`).toBe(false)
    }
  })

  it('★ 而語句位置照舊用語句那一顆——兩個形態不得互相蓋掉', () => {
    const types = blockTypes(renderToBlocklyState(liftCode(CASES[2].code)))
    expect(types).toContain('cpp_input_line')
    expect(types, '語句位置不該挑到運算式形態').not.toContain('cpp_input_line_expression')
  })
})
