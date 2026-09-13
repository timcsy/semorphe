/**
 * **探針：拿【學生真的寫過的程式】量「宣告有多準」。**
 *
 * ## 它答的問題
 *
 * 第一百二十六條護欄錨的是 repo 內的課文語料（110 支），而那批是**我們自己寫的**
 * ——它會照著我們宣告的形狀長。真正的問題是：
 *
 * > **一份宣告，在遇到不是我們寫的程式時，還準嗎？**
 *
 * ## 量到的（2026-09-14）
 *
 * 語料是使用者交來的學生練習 repo（218 支 `.cpp`、AP325／TIOJ／zeroJudge／APCS）。
 *
 * ```
 * 第一版報告              412 筆
 * ⚠️ 扣掉量測工具自己的    −405    漏了「運算式當語句用」、漏了 positions、漏了族
 * 降級節點算成違反           −7    那是動態型別（`?`），不是違反
 * 補齊 13 顆的 positions   −138    func_call／comma_expr／i++／a = b／cin >> x…
 * 今天                        1
 * ```
 *
 * ## 🟢 而剩下的那 1 筆，是學生程式裡一句【真的什麼都沒做】的話
 *
 * `AP325/3/3_10.cpp:16`：
 *
 * ```cpp
 * for (int i = 1; i <= n; i++) {
 *     cin >> A[i];
 *     cc[A[i]];      // ← 這裡。而第 22 行寫的是 cc[A[i]]++;
 * }
 * ```
 *
 * 它是**合法的 C++**（一個沒有副作用的運算式語句），而它顯然是漏打了 `++`。
 * 編譯器最多給一個 `-Wunused-value`，而多數人不開那個旗標。
 *
 * 🔴 **所以這一筆不修**——它不是宣告錯了，是這份宣告**抓到了一個真的缺陷**。
 *
 * > **一條檢查規則最好的驗收，不是「它在我們的語料上是 0」，
 * > 是「它在別人的語料上剩下的那幾筆，每一筆都講得出為什麼」。**
 *
 * > **一份「有 N 個缺陷」的報告，先問那 N 裡有幾個是量測工具自己的。**
 * > （這次是 405/412。）
 *
 * ## ⚠️ 沒有語料就跳過
 *
 * ```bash
 * git clone https://github.com/core-keeper/StudyCpp /tmp/StudyCpp
 * STUDYCPP_DIR=/tmp/StudyCpp npx vitest run tests/probes/studycpp-slot-declarations
 * ```
 *
 * 🔴 而**判定不在這個檔裡**——它呼叫 `core/component/slot-check.ts` 的 `checkSlots`，
 * 與護欄、與流程接線、與診斷是同一支。這個檔只負責餵語料。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { checkSlots } from '../../src/core/component/slot-check'
import '../../src/languages/cpp/module'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode } from '../../src/core/types'

const ROOT = path.resolve(__dirname, '../..')
const CORPUS = process.env.STUDYCPP_DIR ?? '/tmp/StudyCpp'

let tsParser: Parser
let lifter: Lifter

describe('探針：學生真的寫過的程式，違反宣告的有多少', () => {
  beforeAll(async () => {
    await Parser.init({ locateFile: (s: string) => `${ROOT}/public/${s}` })
    tsParser = new Parser()
    tsParser.setLanguage(await Language.load(`${ROOT}/public/tree-sitter-cpp.wasm`))
    lifter = createTestLifter(); registerCppLanguage()
  }, 120_000)

  it('StudyCpp 218 支', () => {
    if (!fs.existsSync(CORPUS)) { console.log('🔴 沒有語料，跳過'); return }
    const files: string[] = []
    const walk = (d: string): void => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory() && e.name !== '.git') walk(p)
        else if (e.name.endsWith('.cpp')) files.push(p)
      }
    }
    walk(CORPUS)
    const byKind = new Map<string, number>()
    const SAMPLES = new Map<string, string>()
    let n = 0, dirty = 0, total = 0
    for (const f of files) {
      let t: SemanticNode
      try { t = lifter.lift(tsParser.parse(fs.readFileSync(f, 'utf8'))!.rootNode as never) as SemanticNode } catch { continue }
      n++
      const out = checkSlots(t).map((f) => `${f.kind} · ${f.componentId}.${f.slot} · ${JSON.stringify(f.params)}`)
      if (out.length) dirty++
      total += out.length
      for (const v of out) byKind.set(v, (byKind.get(v) ?? 0) + 1)
      if (out.length) SAMPLES.set(out[0], f)
    }
    console.log(`\n═══ 掃了 ${n} 支，${dirty} 支有違反，共 ${total} 筆 ═══`)
    for (const [k, c] of [...byKind].sort((a, b) => b[1] - a[1])) console.log(`  ${String(c).padStart(4)} × ${k}\n         例：${SAMPLES.get(k) ?? ''}`)
    expect(n, '🔴 語料沒讀進來 → 這一支是空過的').toBeGreaterThan(150)
    // ⚠️ 不錨在 0——別人的語料裡本來就會有真的缺陷（見檔頭那一筆）。
    //    錨的是「不得回到量測工具壞掉的那個量級」。
    expect(total, `🔴 違反數暴增到 ${total} 筆——多半是判定或宣告退步了`).toBeLessThan(20)
  }, 300_000)
})
