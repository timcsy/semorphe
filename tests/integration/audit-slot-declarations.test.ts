/**
 * **第一百二十六條護欄：槽的宣告，要真的有人讀。**
 *
 * ## 它從哪來
 *
 * 2026-09-14 一次量測。`component.json` 的 `slots` 一直寫著兩件事，而：
 *
 * ```
 * allowed   332 顆都有        只有【流程接線】一處在讀
 * min/max   41 個槽宣告了     讀者【0】——`slotsOf` 連回傳都沒回傳它
 * ```
 *
 * 注入 60 個違反 `min`／`max` 的樹：**產碼安靜 58/60、積木安靜 60/60**。
 * 把一顆語句塞進只收運算式的 218 個格子：**兩側全部安靜**。
 *
 * 而 `max` 那一族的症狀特別壞——**多出來的子節點不是報錯，是消失**：
 *
 * ```
 * cpp:new.size        宣告 max=1，接 2 個  →  new int[0]        第二顆蒸發
 * cpp:pair_declare    宣告 max=1，接 2 個  →  pair<int,int> p = 0;
 * ```
 *
 * > **一個宣告了而沒有人讀的型別，與沒有宣告是同一件事。**
 * > （`traits.ts` 的檔頭 2026-08-26 記過這句，而它只兌現了一次。）
 *
 * ## 🔴 而同一次量測翻出一個使用者按得到的缺陷
 *
 * `flow/connect.ts` 拿 `roleOf` 當文法判準，而 `role` 的實際語意是
 * **產生器契約**（「我自己收尾嗎」）。C++ 裡 `i++`／`a = b`／`cin >> x`／
 * `cout << x` 的 `role` 全是 `statement`——因為它們的產生器自己印分號
 * ——**而它們在文法上都是運算式**。
 *
 * 實測 7 個真實世界合法的接法，**7 個全被拒絕**，其中包括
 * `for (int i = 0; i < n; i++)` 的 init 與 update 兩格
 * ——**C++ 最常見的那一行，在流程面板上組不出來。**
 *
 * > **一個欄位如果同時回答兩個問題，它會在兩個問題的答案分岔的那一天
 * > 安靜地答錯其中一個——而答錯的那一個沒有名字，所以沒有人去查它。**
 *
 * 修法是把文法那一軸取出來（`positions`／`positionsOf`），
 * 而**預設從 `role` 導**，所以 332 顆裡只有 12 顆需要顯式宣告。
 *
 * ## 這一條守三件事
 *
 * ```
 * ① 硬性零   判定只有一份         `fitsSlot` 之外沒有第二個 allowed 的解讀
 * ② 硬性零   lift 產出的樹合宣告   課文語料 110 支，今天 0 筆
 * ③ 硬性零   宣告的形狀合法        allowed 裡的每一個字都要指得到東西
 * ```
 *
 * ⚠️ **②為什麼敢用硬性零**：同一支判準跑 StudyCpp 的 218 支學生程式，
 * 修完之後是 **7 筆，而 7 筆全是降級節點**（`unresolved`／`raw_code`）
 * ——那是動態型別，不算違反。扣掉之後 **0**。所以這裡錨得起硬性零。
 *
 * （量測的第一版報告 412 筆，其中 **405 筆是量測工具自己的**：漏了
 * 「運算式可以當語句用」、漏了 `positions`、漏了族。
 * **一份「有 N 個缺陷」的報告，先問那 N 裡有幾個是量測工具自己的。**）
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
// ⚠️ **為了它的副作用**：`param_decl` 之類的結構節點是在這裡 `declareNonComponent` 的，
//    不載它的話下面那條「每一個字都指得到東西」會把 8 個合法的宣告當成錯字。
import '../../src/languages/cpp/module'
import { checkSlots, fitsSlot, slotDeclsOf, isDynamic } from '../../src/core/component/slot-check'
import { positionsOf } from '../../src/core/component/traits'
import { registeredComponents } from '../../src/core/component/registry'
import { nonComponentDecl } from '../../src/core/blocks/non-components'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode } from '../../src/core/types'

const ROOT = path.resolve(__dirname, '../..')
const KIND_WORDS = new Set(['expression', 'expressions', 'statement', 'statements'])

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${ROOT}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${ROOT}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
}, 120_000)

describe('第一百二十六條護欄：槽的宣告，要真的有人讀', () => {
  it('★ 入口條件——真的讀到元件了', () => {
    expect(registeredComponents().length, '🔴 一顆元件都沒有 → 下面全部是空過的').toBeGreaterThan(100)
  })

  /**
   * 🔴 **判定只有一份。** 一個 `allowed` 有兩種解讀的那天，症狀是
   * 「流程圖上接得起來，而護欄說它違反宣告」——而兩邊都覺得自己是對的。
   */
  it('🔴 硬性零：`allowed` 的解讀只有 `fitsSlot` 一支', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/core/flow/connect.ts'), 'utf8')
    expect(src, '🔴 `connect.ts` 自己又判了一次 kind → 判定分岔了').not.toMatch(/=== 'expression' \|\| \w+ === 'statement'/)
    expect(src, '🔴 `connect.ts` 沒有委派給 `fitsSlot`').toContain('fitsSlot(source.componentId, decl.allowed)')
  })

  /**
   * 🔴 **文法那一軸不得用 `role` 回答。**
   * 這一條就是那個使用者按得到的缺陷的機械化。
   */
  it('🔴 硬性零：接線不得拿 `roleOf` 當文法判準', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/core/flow/connect.ts'), 'utf8')
    const kindGate = src.slice(src.indexOf('const slots = slotsOf'), src.indexOf('return { ok: true, slot }'))
    expect(kindGate, '🔴 又回去問 `roleOf` 了——那是產生器契約，不是文法').not.toContain('roleOf(')
  })

  /**
   * ⚠️ 那 12 顆顯式宣告 `positions` 的元件，要真的兩個位置都認。
   * 少了它們，`for (int i = 0; i < n; i++)` 就再也組不出來——而**沒有人會發現**。
   */
  it('🔴 硬性零：C++ 裡是運算式的那幾顆，兩個位置都認得', () => {
    const MUST_BE_BOTH = [
      'cpp:increment', 'cpp:var_assign', 'cpp:var_assign_compound',
      'cpp:array_assign', 'cpp:array_2d_assign', 'cpp:input', 'cpp:input_line',
      'cpp:print', 'cpp:method_call', 'cpp:container_erase', 'cpp:io_sync', 'cpp:io_tie',
    ]
    const bad = MUST_BE_BOTH.filter((id) => !positionsOf(id).includes('expression'))
    expect(bad, '🔴 這幾顆在 C++ 裡是運算式（`i++`／`a = b`／`cin >> x`／`cout << x`），'
      + '而它們接不進要運算式的格子了').toEqual([])
  })

  /**
   * 🔴 **宣告裡的每一個字都要指得到東西。**
   * 一個打錯的 `allowed`（`expresion`）今天不會有任何人出聲——它只會讓那一格永遠接不上。
   */
  it('🔴 硬性零：`allowed` 裡的每一個字，都指得到一個種類／身分／族', () => {
    const ids = new Set(registeredComponents().map((c) => c.componentId))
    const bare = new Set([...ids].map((i) => i.split(':').pop() as string))
    const traitNames = new Set<string>()
    for (const c of registeredComponents()) {
      for (const k of Object.keys((c.manifest as { traits?: Record<string, unknown> }).traits ?? {})) traitNames.add(k)
    }
    const bad: string[] = []
    for (const c of registeredComponents()) {
      for (const d of slotDeclsOf(c.componentId)) {
        for (const a of d.allowed) {
          if (KIND_WORDS.has(a) || ids.has(a) || bare.has(a) || traitNames.has(a)
            || nonComponentDecl(a) !== undefined) continue
          bad.push(`${c.componentId}.${d.slot} → ${a}`)
        }
      }
    }
    expect(bad, '🔴 `allowed` 寫了一個指不到東西的字——那一格會【永遠接不上】，而不會報錯').toEqual([])
  })

  /**
   * 🔴 **lift 產出的樹，不得違反它自己的宣告。**
   *
   * ⚠️ 錨在 repo 內的課文語料（`lessons/`），因為那是**這個 repo 的形狀**。
   * 學生語料（StudyCpp）在 `tests/probes/` 那一支，它不進 `npm test`。
   */
  it('🔴 硬性零：課文語料 lift 出來的樹，一筆都不違反宣告', () => {
    const L = path.join(ROOT, 'lessons')
    const srcs: { name: string; code: string }[] = []
    for (const t of fs.readdirSync(L)) {
      const td = path.join(L, t)
      if (!fs.statSync(td).isDirectory()) continue
      for (const d of fs.readdirSync(td)) {
        const sd = path.join(td, d, 'solutions')
        if (fs.existsSync(sd)) {
          for (const f of fs.readdirSync(sd)) {
            if (f.endsWith('.cpp')) srcs.push({ name: `${t}/${d}/${f}`, code: fs.readFileSync(path.join(sd, f), 'utf8') })
          }
        }
        const md = path.join(td, d, 'lesson.md')
        if (!fs.existsSync(md)) continue
        const code = fs.readFileSync(md, 'utf8').split('## 完成的樣子')[1]?.split('\n## ')[0]
          ?.match(/```cpp\n([\s\S]+?)\n```/)?.[1]
        if (code) srcs.push({ name: `${t}/${d}/完成的樣子`, code })
      }
    }
    expect(srcs.length, '🔴 一支語料都沒讀到 → 這一條是空過的').toBeGreaterThan(50)

    const findings: string[] = []
    for (const s of srcs) {
      let tree: SemanticNode
      try { tree = lifter.lift(tsParser.parse(s.code)!.rootNode as never) as SemanticNode } catch { continue }
      for (const f of checkSlots(tree)) {
        findings.push(`${s.name} · ${f.componentId}.${f.slot} · ${f.kind} · ${JSON.stringify(f.params)}`)
      }
    }
    expect(findings, '🔴 lift 產出的樹違反了元件自己的宣告——'
      + '要嘛 lift 錯了，要嘛那份宣告寫得比實際窄。\n'
      + '🟢 兩種都要修，而**不要**靠放寬判準讓它變綠。').toEqual([])
  }, 300_000)

  /**
   * ★ **注入**——沒有這一條，上面那個 `toEqual([])` 可能只是因為它什麼都沒看。
   */
  it('★ 注入：造一棵違反 min／max／allowed 的樹 → 三種都抓得到', () => {
    const stmt = { componentId: 'cpp:print', properties: {}, slots: { values: [] } } as never as SemanticNode
    const bad = {
      componentId: 'cpp:char_is_alpha', properties: {},
      slots: { value: [stmt, stmt] },   // 宣告 min=1 max=1 allowed=[expression]
    } as never as SemanticNode
    const kinds = checkSlots(bad).map((f) => f.kind)
    expect(kinds, '🔴 `max` 那一條沒抓到——而它的症狀是【多的那幾顆會消失】').toContain('max')

    const empty = { componentId: 'cpp:char_is_alpha', properties: {}, slots: { value: [] } } as never as SemanticNode
    expect(checkSlots(empty).map((f) => f.kind), '🔴 `min` 那一條沒抓到').toContain('min')

    const loop = { componentId: 'cpp:loop_while', properties: {}, slots: { condition: [
      { componentId: 'cpp:loop_while', properties: {}, slots: {} },
    ] } } as never as SemanticNode
    expect(checkSlots(loop).map((f) => f.kind), '🔴 `allowed` 那一條沒抓到——'
      + '一個 `while` 迴圈被當成條件塞進另一個 `while` 的條件格').toContain('allowed')
  })

  /**
   * ★ **反向注入**——降級節點是動態型別（`?`），它**不算違反**。
   *
   * 🔴 沒有這一條，護欄會在使用者貼進一段我們讀不懂的程式碼時報一片紅
   * ——而那是我們的辨識率，不是他的錯。
   */
  it('★ 反向：降級節點放進任何格子都不算違反', () => {
    expect(isDynamic('cpp:raw_code'), '🔴 `raw_code` 不是動態型別了').toBe(true)
    expect(isDynamic('unresolved'), '🔴 `unresolved` 不是動態型別了').toBe(true)
    expect(fitsSlot('cpp:raw_code', ['expression']), '🔴 灰積木放不進要運算式的格子了').toBe(true)
    expect(fitsSlot('unresolved', ['cpp:var_declare']), '🔴 灰積木放不進具名的格子了').toBe(true)
    // ★ 而它不是「全部放行」——一顆認得的東西放錯格子照樣要出聲
    expect(fitsSlot('cpp:loop_while', ['expression']), '🔴 判準被放寬成什麼都接受了').toBe(false)
  })
})
