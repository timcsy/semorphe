/**
 * **逾時之後不得留下孤兒**——量測工具自己的護欄。
 *
 * ## 它從哪來（2026-09-17）
 *
 * 一輪**正常結束**（exit 0）的語料探針留下 **3 支**孤兒行程，各燒著 90% CPU、
 * 記憶體持續長大。接下來三次「全套測試」與「重跑探針」全部被系統以
 * **記憶體不足**砍掉——而那看起來像是「測試自己太重」，於是我先去調了並行度。
 *
 * 根因是一行選項：`exec('bin < file', { timeout })` 跑的是
 * `/bin/sh -c "bin < file"`，而 Node 的 `timeout` 殺得到的是**那個 shell**。
 * 真正在跑的程式是它的**孫子**，shell 死掉之後它變成孤兒繼續跑。
 *
 * > **一個被殺掉的父行程，不會帶走它的孩子——
 * > 而一支沒有人再看著的孤兒，它的帳會記在下一個人頭上。**
 *
 * ⚠️ **這個缺陷不會讓任何一支測試變紅**。它只會讓【下一次】量測變得不可靠，
 * 而下一次的人會去找一個不存在的原因。
 */
import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { runCppBatchDetailed, runCppDetailed, hasReferenceCompiler } from '../helpers/run-cpp'

/**
 * 現在有幾支**這個行程自己**編出來的程式還在跑。
 *
 * 🔴 **母體要縮到自己**（2026-09-17，這條護欄自己誤報之後才發現）。
 *
 * 第一版數的是系統上所有 `semorphe-refcc` 的行程，而全套用兩個 worker 跑
 * ——**另一支測試檔合法地在跑它自己編的程式**，於是這裡數到它，
 * 判定「留下了孤兒」。單獨跑時綠、全套時紅，而全套結束後一支都不剩。
 *
 * > **一個量測工具如果它量的母體包含別人的東西，
 * > 它會在別人忙的時候誤報——而那種紅看起來與真的缺陷一模一樣。**
 *
 * 🟢 `run-cpp.ts` 把執行檔命名為 `a<pid>_<序號>`，所以「自己的」是問得出來的。
 */
const orphans = (): string[] => {
  try {
    const mine = `a${process.pid}_`
    return execSync('ps -eo pid,comm', { encoding: 'utf-8' })
      .split('\n').filter((l) => l.includes('semorphe-refcc') && l.includes(mine)).map((l) => l.trim())
  } catch { return [] }
}

// 一支永遠跑不完的程式——它只等輸入，而我們什麼都不餵。
const HANGS = `#include <iostream>
int main(){ long long s = 0; for(;;) s++; std::cout << s; return 0; }
`
// 正向錨點：一支跑得完的。**沒有它的話「零孤兒」可能只是【什麼都沒跑】。**
const FINE = `#include <iostream>
int main(){ std::cout << "ok"; return 0; }
`

describe('量測工具：逾時之後不得留下孤兒', () => {
  it.runIf(hasReferenceCompiler())('★ 正向錨點：跑得完的那一支真的跑完了', async () => {
    const [r] = await runCppBatchDetailed([FINE], 1, [''])
    expect(r.ok, `🔴 連跑得完的都失敗 → 下面那條在驗空氣：${r.message ?? ''}`).toBe(true)
    expect(r.output).toBe('ok')
  }, 120_000)

  it.runIf(hasReferenceCompiler())('🔴 跑不完的那一支，逾時之後不得還活著', async () => {
    const before = orphans().length
    const [r] = await runCppBatchDetailed([HANGS], 1, [''])
    expect(r.ok, '🔴 它應該逾時').toBe(false)
    expect(r.stage).toBe('run')
    // 給 kill 一點時間落地——而**不要給太多**：這一條要抓的是「永遠活著」。
    await new Promise((res) => setTimeout(res, 1500))
    const after = orphans()
    expect(after.length,
      `🔴 逾時殺的是 shell，而程式是它的孫子——留下來了：\n  ${after.join('\n  ')}`)
      .toBeLessThanOrEqual(before)
  }, 120_000)
})

/**
 * **餵進去的輸入沒被讀完，不得算成「參照編譯器收不下這一段」**
 *（2026-09-18，CI 紅了第五次之後）。
 *
 * 同步那一路曾經用 `input:` 餵 stdin，而那是一條**管線**——
 * 程式提早結束時那一端關掉，`spawnSync` 拿到 `EPIPE`，
 * `execFileSync` 就丟例外，**即使 stdout 早就完整產出了**。
 *
 * ```
 * 本機（macOS）  小份輸入綠、兩百萬字元紅
 * CI（Linux）    那支語料測試直接紅：spawnSync … EPIPE
 * ```
 *
 * ⚠️ 而它**偽裝成測試自己承認壞掉**（訊息逐字是「參照編譯器收不下這一段
 * （測試自己的問題）」）——於是四次合併都在找程式的毛病。
 *
 * > **兩條路餵同一份輸入而只有一條會 EPIPE，那個差別不在程式，
 * > 在「誰負責把剩下的位元組吞掉」——檔案沒有那個責任，管線有。**
 */
describe('量測工具：輸入沒被讀完不得害死自己', () => {
  // 正向錨點：**讀得完的那一份要對**，否則下面兩條可能只是在驗「什麼都沒餵」。
  it.runIf(hasReferenceCompiler())('★ 正向錨點：輸入剛好讀完', () => {
    const r = runCppDetailed(
      '#include <cstdio>\nint main(){int a,b;scanf("%d %d",&a,&b);printf("%d\\n",a+b);return 0;}',
      '3 4\n')
    expect(r, '🔴 連讀得完的都失敗 → 下面兩條在驗空氣').toEqual({ ok: true, output: '7\n' })
  }, 120_000)

  it.runIf(hasReferenceCompiler())('🔴 程式一個字都不讀，而我們餵了兩百萬', () => {
    const r = runCppDetailed('#include <cstdio>\nint main(){printf("hi\\n");return 0;}',
      'x'.repeat(2_000_000) + '\n')
    expect(r).toEqual({ ok: true, output: 'hi\n' })
  }, 120_000)

  it.runIf(hasReferenceCompiler())('🔴 程式只讀一個數，而我們餵了五十萬行', () => {
    const r = runCppDetailed(
      '#include <cstdio>\nint main(){int a;scanf("%d",&a);printf("%d\\n",a);return 0;}',
      '7\n' + '9\n'.repeat(500_000))
    expect(r).toEqual({ ok: true, output: '7\n' })
  }, 120_000)
})
