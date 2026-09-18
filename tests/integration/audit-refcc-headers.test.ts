/**
 * **護欄：餵給參照編譯器的程式，標頭不得手列。**
 *
 * ## 🔴 它從哪來（2026-09-18，CI 抓到）
 *
 * 本機的參照編譯器是 **Apple clang（libc++）**，CI 上是 **GNU g++（libstdc++）**。
 * 而它們對「哪個標頭遞移帶進哪個」的答案**不一樣**：
 *
 * ```
 * libc++     <set> 帶進 <deque>、<map> 帶進 <queue>／<tuple>
 * libstdc++  不帶
 * ```
 *
 * 於是七支測試**本機全綠、CI 全紅**，訊息是「參照編譯器收不下（測試自己的問題）」
 * ——而那句話是對的，只是它說不出**是哪一台**參照編譯器。
 *
 * > **「參照編譯器」不是一個東西。本機那一台比 CI 那一台寬鬆的地方，
 * > 量不出來的不是缺陷——是【我的判準有多寬】。**
 *
 * ## ⚠️ 而它咬過兩次，第一次的修法讓第二次照樣發生
 *
 * 2026-09-17 加 multiset 那三題時缺 `<set>`，當時補上了那一個標頭，
 * 並在旁邊寫「⚠️ 這一行是【判準的一部分】」。
 * **補一個實例不會讓下一個不發生**——2026-09-18 缺 `<queue>` 與 `<tuple>`。
 *
 * 🟢 這個 repo 本來就有解法：`tests/fixtures/refcc-shim` 的 `bits/stdc++.h`
 *（本機由 `SEMORPHE_REFCC_INCLUDE` 指過去，CI 上用真的 GCC 標頭）。
 *
 * ## 判準
 *
 * 一個**餵東西給參照編譯器**的測試檔，如果它自己拼標頭字串，那它在宣稱
 * 「我列的這幾個，在兩套標準函式庫上都夠」——而那件事**沒有人在檢查**。
 * 棘輪盯著還在這樣做的檔數，只准下降。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { printReport, loadBaseline, writeBaseline, assertRatchet, assertCorpus } from '../helpers/guardrail'

const ROOT = process.cwd()
const GUARD = 'refcc-headers'

/** 所有測試檔。 */
function testFiles(dir = path.join(ROOT, 'tests'), out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) { testFiles(p, out); continue }
    if (p.endsWith('.test.ts') || p.endsWith('.ts')) out.push(p)
  }
  return out
}

/** 這個檔有沒有餵東西給參照編譯器。 */
const feedsCompiler = (s: string): boolean => /runCpp(Detailed|BatchDetailed)\s*\(/.test(s)

/** 這個檔有沒有在字串裡自己拼標頭。 */
const handListsHeaders = (s: string): boolean => /['"`]#include\s*</.test(s)

/** 走墊片那一條（`bits/stdc++.h`）。 */
const usesShim = (s: string): boolean => s.includes('bits/stdc++')

interface Scan { scanned: number; feeders: string[]; handListed: string[] }

function scan(): Scan {
  const feeders: string[] = []
  const handListed: string[] = []
  const files = testFiles().filter((f) => !f.includes('node_modules'))
  for (const f of files) {
    const s = readFileSync(f, 'utf8')
    if (!feedsCompiler(s)) continue
    const rel = path.relative(ROOT, f)
    feeders.push(rel)
    if (handListsHeaders(s) && !usesShim(s)) handListed.push(rel)
  }
  return { scanned: files.length, feeders: feeders.sort(), handListed: handListed.sort() }
}

describe('護欄：餵給參照編譯器的程式，標頭不得手列', () => {
  /**
   * ⚠️ **入口條件**——少了它，一個「掃不到任何測試檔」的實作也會全綠，
   * 而那與「一個問題都沒有」長得一模一樣。
   */
  it('★ 入口條件：真的掃到餵參照編譯器的檔', () => {
    const { scanned, feeders } = scan()
    expect(scanned, '🔴 一個測試檔都沒掃到 → 量測壞了').toBeGreaterThan(100)
    expect(feeders.length, '🔴 一個餵參照編譯器的檔都沒找到 → 判別壞了').toBeGreaterThan(5)
  })

  /**
   * ⚠️ **注入**：判準真的分得出「手列」與「走墊片」嗎。
   * 少了這一條，一個「永遠回 false」的判別也會讓棘輪一路下降。
   */
  it('★ 注入：判準分得出手列與走墊片', () => {
    expect(handListsHeaders("const H = '#include <set>\\n'"), '🔴 認不出手列').toBe(true)
    expect(handListsHeaders("const H = '#include <bits/stdc++.h>\\n'"), '🔴 這也是手列').toBe(true)
    expect(usesShim("const H = '#include <bits/stdc++.h>\\n'"), '🔴 認不出墊片').toBe(true)
    expect(handListsHeaders('// 註解裡寫 #include <set> 不算'), '🔴 註解不該被當成手列').toBe(false)
    expect(feedsCompiler('const r = runCppDetailed(src)'), '🔴 認不出餵參照編譯器').toBe(true)
  })

  it('棘輪：自己拼標頭的檔只准下降', () => {
    const { scanned, feeders, handListed } = scan()
    printReport('餵給參照編譯器的程式，標頭誰列的', [
      `掃描   ${scanned} 個測試檔｜其中 ${feeders.length} 個餵參照編譯器`,
      `手列   ${handListed.length} 個（棘輪）`,
      '⚠️ 手列 ＝ 宣稱「我列的這幾個在兩套標準函式庫上都夠」，而沒有人在檢查那件事',
      ...handListed.map((f) => `  ${f}`),
    ])

    if (!existsSync(path.join(ROOT, 'tests/baselines', `${GUARD}.json`))) {
      writeBaseline(GUARD, {
        _meta: {
          note: '本機是 Apple clang（libc++）、CI 是 GNU g++（libstdc++），'
            + '兩者對「哪個標頭遞移帶進哪個」的答案不同。手列標頭的檔會在 CI 上紅而本機全綠。',
          ratchet: '數字只准下降。調整此檔即為顯式下調，須在 commit 訊息說明原因。',
        },
        scanned: { testFiles: scanned, feeders: feeders.length },
        handListed: handListed.length,
        details: handListed,
      })
      return
    }
    const base = loadBaseline<{ scanned: { testFiles: number; feeders: number }; handListed: number }>(GUARD)
    assertCorpus([
      ['測試檔數', scanned, base.scanned.testFiles],
      ['餵參照編譯器的檔數', feeders.length, base.scanned.feeders],
    ])
    assertRatchet([['自己拼標頭的檔', handListed.length, base.handListed]])
  })
})
