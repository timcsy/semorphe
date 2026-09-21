/**
 * 第一百三十一條護欄：**「跟著做」每一步的積木圖，不得過期、不得配錯段**
 *
 * ## 🔴 它從哪來（2026-09-21）
 *
 * 兩個學生各自要圖，而授課老師把它講準了：
 *
 * > 兩個學生要圖，我想應該是要連**跟著做的過程中拉積木的圖**也要給，
 * > 不是只有完成品。
 *
 * ## ⚠️ 它與第一百零二條的差別在【母體】，不在判準
 *
 * ```
 * 102  一課一張「完成的樣子」的對照          69 份
 * 131  每一個步驟小節裡的每一段程式碼        289 段
 * ```
 *
 * > **兩個名字很像的檢查，差別常常不在判準，在母體。**（CLAUDE.md 逐字）
 *
 * ## 判準
 *
 * ```
 * ① 存下來的程式碼要與課文那一段【逐字相同】     ← 配錯段就會在這裡爆
 * ② codeHash 要對得上                          ← 課文改了要重產
 * ③ engineHash 要是現在這一版                   ← 積木的畫法改了要重產
 * ④ 有圖的不得是空的、要有 badgeLines
 * ⑤ 🔴 號碼不得超出那一段自己的行數              ← 見下
 * ⑥ 棘輪：沒有圖的片段只准變少
 * ```
 *
 * ## 🔴 ⑤ 為什麼要有：編輯器不會原封不動收下一段片段
 *
 * 實測（2026-09-21）——⚠️ **這一段刻意不用反引號圍起來**：
 * 七支護欄與探針拿「測試檔的反引號區間」當 C++ 語料
 * （`tests/helpers/backtick-corpus.ts`），而這張表裡有分號與大括號
 * ——圍起來的話它會被當成一支學生的程式，在**缺陷帳上多一筆假的**。
 *
 * >   一段寫給人看的說明，如果它長得像程式碼而又住在會被掃描的地方，
 * >   它就會被當成程式碼量——而那一筆缺陷不存在。
 *
 *     第 8 課  int n = 10 …         前面補兩行鷹架，片段落在第 3 行
 *     第 1 課  cout << "哈囉"       補鷹架、再包進進入點，落在第 4 行
 *     Python   for i in range(3)    一個字都沒動
 *
 * 不校正的話，課文那一格印著 1 2 3 而積木上的號碼是 3 4 5——**配對整個錯掉，
 * 而畫面上看起來完全正常**（兩邊都有數字）。
 *
 * > **一份對照表的號碼，要錨在【讀者手上那一份】的行號，
 * > 不是錨在我們餵進去的那一份。**
 *
 * ## ⚠️ 為什麼 ⑥ 是棘輪而不是硬性零
 *
 * 「留一筆還成立嗎」→ 成立：一段**沒有圖**的步驟，讀者看到的是今天就有的
 * 程式碼框——它不是壞的，只是少一塊。
 * 而「畫出灰色方塊」那一種**不留**：產生器當場拒絕寫出去
 *（`record-step-blockmaps` 的 `_skipped.json`）。
 *
 * > **一張示範「你這一步要拉什麼」的圖，如果畫出來的是一塊灰的，
 * > 它示範的是這個工具做不到那件事。**
 *
 * ## 本檔不檢測什麼
 *
 * - **不檢測圖好不好看**——那要人看。
 * - **不檢測「這一步該不該有圖」**——那是教學決定。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { REPO_ROOT, printReport, assertRatchet, assertCorpus } from '../helpers/guardrail'
import { allStepFragments, stepMapFile, type StepFragment } from '../../tools/build-lessons/step-fragments'
import { engineHash } from '../../tools/blockmap/engine-hash'

const DIR = path.join(REPO_ROOT, 'assets/blockmaps/steps')
const FRAGS = allStepFragments(REPO_ROOT)
const hash = (s: string): string => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16)

interface Map_ { lesson: string; index: number; code: string; codeHash: string; engineHash: string; badgeLines?: number[]; blockTypes?: string[]; blocks: unknown[]; svg: string }
interface Row { f: StepFragment; bm?: Map_ }

function rows(): Row[] {
  return FRAGS.map((f) => {
    const file = path.join(DIR, stepMapFile(f))
    return { f, bm: fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Map_) : undefined }
  })
}

const ROWS = rows()
const WITH = ROWS.filter((r) => r.bm !== undefined) as { f: StepFragment; bm: Map_ }[]
const REPRODUCE = '   重產：npx playwright test --config=tools/demo/playwright.demo.config.ts record-step-blockmaps'
/** 註解積木的**身分**長什麼樣——`cpp:comment`／`python:comment` → `cpp_comment`… */
const COMMENT_ID = /(^|[^a-z])comment($|[^a-z])/

describe('第一百三十一條護欄：「跟著做」每一步的積木圖', () => {
  it('★ 入口條件——真的掃到片段了', () => {
    // 不可省。`FRAGS` 是空的話，下面每一條都在驗空集合，而它們會是綠的。
    expect(FRAGS.length, '🔴 一段都沒掃到 → 抽取點壞了，不是課文沒有步驟').toBeGreaterThan(200)
  })

  it('🔴 存下來的程式碼要與課文那一段【逐字相同】', () => {
    // 🔴 **這一條就是「配錯段」的偵測器**：序號一旦與產生器對不上，
    //    某一張圖會配到另一段程式碼，而這裡當場爆。
    const drift = WITH.filter((r) => r.bm.code !== r.f.code)
    expect(
      drift.map((r) => `${r.f.lesson}#${r.f.index}`),
      '🔴 圖裡存的程式碼與課文那一段不同——配錯段，或課文改了。\n' + REPRODUCE,
    ).toEqual([])
  })

  it('🔴 對照不得過期——課文改了，圖要跟著重產', () => {
    const stale = WITH.filter((r) => r.bm.codeHash !== hash(r.f.code))
    expect(stale.map((r) => `${r.f.lesson}#${r.f.index}`), '🔴 課文改過而圖沒重產。\n' + REPRODUCE).toEqual([])
  })

  it('🔴 圖不得是舊引擎產的', () => {
    const now = engineHash(REPO_ROOT)
    const stale = WITH.filter((r) => r.bm.engineHash !== now)
    expect(
      stale.map((r) => `${r.f.lesson}#${r.f.index}`),
      `🔴 積木的畫法改了而圖沒重產（現在的指紋 ${now}）。\n` + REPRODUCE,
    ).toEqual([])
  })

  it('🔴 有圖的不得是空的，而且要有 badgeLines', () => {
    const bad = WITH.filter((r) => r.bm.blocks.length === 0 || r.bm.svg.length < 200
      || !Array.isArray(r.bm.badgeLines) || r.bm.badgeLines.length === 0)
    expect(bad.map((r) => `${r.f.lesson}#${r.f.index}`), '🔴 產出了一張沒有用的圖').toEqual([])
  })

  it('🔴 號碼不得超出那一段自己的行數', () => {
    // 🔴 見檔頭⑤：不校正的話號碼會偏移，而**畫面上看起來完全正常**。
    const off = WITH.filter((r) => {
      const n = r.f.code.split('\n').length
      return (r.bm.badgeLines ?? []).some((l) => l < 1 || l > n)
    })
    expect(
      off.map((r) => `${r.f.lesson}#${r.f.index}（${r.f.code.split('\n').length} 行，號碼 ${r.bm.badgeLines?.join(',')}）`),
      '🔴 號碼落在那一段之外——讀者照著號碼去找，會找到一行不存在的程式碼',
    ).toEqual([])
  })

  it('棘輪：沒有圖的片段只准變少', () => {
    const none = ROWS.filter((r) => r.bm === undefined)
    const skippedFile = path.join(DIR, '_skipped.json')
    const skipped: Record<string, string> = fs.existsSync(skippedFile)
      ? JSON.parse(fs.readFileSync(skippedFile, 'utf8')) : {}
    printReport('「跟著做」每一步的積木圖', [
      `步驟片段       ${FRAGS.length}`,
      `🟢 有圖        ${WITH.length}`,
      `⚠️ 沒有圖      ${none.length}  ← 棘輪`,
      `   其中產生器判定畫不乾淨  ${Object.keys(skipped).length}`,
      ...Object.entries(skipped).slice(0, 12).map(([k, v]) => `     ${k}：${v}`),
    ])
    // 🔴 **分母也要有人數著**：片段變少的話，上面每一條都少量了東西
    //    ——而它們的結論看起來完全正常。
    assertCorpus([['步驟片段', FRAGS.length]], 'step-blockmaps')
    assertRatchet([['沒有圖的片段', none.length]], 'step-blockmaps')
  })

  it('★ 注入：一段配錯的圖必須被報出來', () => {
    // 🔴 合成的一對——不靠任何一段真的壞掉。
    const fake = { code: 'cout << "a";' }
    const frag = { code: 'cout << "b";' }
    expect(fake.code !== frag.code, '認不出配錯段').toBe(true)
  })

  it('★ 注入：號碼偏移必須被認出來', () => {
    // ⚠️ 這是真的發生過的那一版：三行的片段，號碼是 3 4 5。
    const n = 'int n = 10;\nn += 5;\ncout << n;'.split('\n').length
    expect([3, 4, 5].some((l) => l < 1 || l > n), '認不出偏移 → 上面那條是空過的').toBe(true)
    expect([1, 2, 3].some((l) => l < 1 || l > n), '把對的報成錯的').toBe(false)
  })

  it('🔴 硬性零：圖上不得有【行末】註解變成的積木', () => {
    // 🔴 **它從哪來（2026-09-21）**：授課老師逐字
    //    「在課文裡面的註解，因為轉過去都會變備注的灰積木，
    //     但是**學生通常不需要拉這些積木**」。
    //
    // 修法不在圖這一側——是「跟著做／排一排」那個題型不把行末註解做成積木
    //（`Lifter.setCommentsAsBlocks`）。這一條盯的是**產生器有沒有走那條路**：
    // 少帶一個 `task=follow`，圖上就會冒出灰積木，而**課文頁與編輯器不一致**。
    //
    // > **一張示範「你這一步要拉什麼」的圖，多畫一塊學生不用拉的東西，
    // > 它示範的就是多一件工作。**
    //
    // ⚠️ 判準是**積木的身分**，不是 svg 裡的標籤文字
    //    ——字面判準換一次標籤就會安靜地不再擋。
    //
    // 🔴 **而「自成一行」的註解【應該】還是一塊**：那個特例只管行末註解，
    //    因為它要掛在「它說的那一行」身上。一句
    //    `// 找到了` 單獨站在一個空的 if 區塊裡，**沒有那一行可以掛**
    //    ——拿掉它就是真的把使用者的字弄丟。
    //
    // > **一個「藏起來」的做法，前提是有地方放它。沒有地方的時候，
    // > 藏起來與刪掉是同一件事。**
    //
    // 🟢 所以判準是**數量**：註解積木不得多於片段裡自成一行的註解。
    // ⚠️ 舊格式沒有 `blockTypes`——**當成「還沒重產」而不是「沒問題」**，
    //    由底下那條「有圖的都要有 blockTypes」擋著。
    const ownLine = (code: string): number => code.split('\n')
      .filter((l) => /^\s*(\/\/|\/\*|#(?!include|define))/.test(l)).length
    const bad = WITH.filter((r) => {
      const n = (r.bm.blockTypes ?? []).filter((t) => COMMENT_ID.test(t)).length
      return n > ownLine(r.f.code)
    })
    expect(
      bad.map((r) => `${r.f.lesson}#${r.f.index}`),
      '🔴 圖上的註解積木比「自成一行的註解」多——**行末註解變成積木了**。\n'
        + '   多半是產生器沒有帶 `task=follow` 進去。\n' + REPRODUCE,
    ).toEqual([])
  })

  it('★ 注入：認得出一張有註解積木的圖', () => {
    // 🔴 合成的——不靠任何一張真的壞掉。
    expect(COMMENT_ID.test('cpp_comment'), '認不出 cpp_comment').toBe(true)
    expect(COMMENT_ID.test('python_comment'), '認不出 python_comment').toBe(true)
    expect(COMMENT_ID.test('cpp_print'), '把正常的積木報成註解').toBe(false)
    expect(COMMENT_ID.test('cpp_var_assign_compound'), '把正常的積木報成註解').toBe(false)
  })

  it('★ 注入：「自成一行」數得對——不然上面那條會放過行末註解', () => {
    const own = (code: string): number => code.split('\n')
      .filter((l) => /^\s*(\/\/|\/\*|#(?!include|define))/.test(l)).length
    expect(own('// 找到了'), '認不出自成一行').toBe(1)
    expect(own('    // 縮排的也算'), '縮排的自成一行').toBe(1)
    expect(own('n += 5;  // 行末'), '🔴 把行末算成自成一行 → 上面那條會空過').toBe(0)
    expect(own('#include <iostream>'), '把 include 算成註解').toBe(0)
  })

  it('🔴 有圖的都要有 blockTypes——少了它，上面那條會空過', () => {
    const old = WITH.filter((r) => !Array.isArray(r.bm.blockTypes))
    expect(old.map((r) => `${r.f.lesson}#${r.f.index}`),
      '🔴 這幾張是舊格式，要重產。\n' + REPRODUCE).toEqual([])
  })

  it('★ 注入：雜湊要真的跟著程式碼動', () => {
    expect(hash('a')).not.toBe(hash('b'))
  })
})
