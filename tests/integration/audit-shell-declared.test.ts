/**
 * **第八十六條護欄**：鷹架是一份宣告，而每一段都說得出自己為什麼在那裡。
 *
 * ## 它從哪來
 *
 * 2026-08-28 使用者問「**鷹架應該也不只一個吧？算不算是一種元件？**」。
 * 量完現況，`Target.entryShell` 的值域只有 **`'main'` 與 `'none'`**
 * ——也就是「**有**」跟「**沒有**」，而四段外框寫死在兩個地方：
 *
 * ```
 * cpp-scaffold.ts   'using namespace std;' · 'int main() {' · '    return 0;' · '}'
 * auto-include.ts   'int main() {\n…\n    return 0;\n}'      ← 同一個決定的第二份實作
 * ```
 *
 * 🔴 而 `'none'` **不是「Arduino 的鷹架」，它是「沒有鷹架」**
 * ——`if (entryShell === 'none') return {…全空}`。
 *
 * > **鷹架不是一顆新積木，是「哪幾段組成外框，以及它們為什麼在那裡」。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果註冊的鷹架少於 1 份，代表語言套件沒載入——這份報表不算數，
 * > 不是「鷹架都宣告好了」。**
 *
 * 錨在**註冊了幾份**（合成量）。🔴 刻意不錨在「還寫死幾段」——那正是要推向零的。
 *
 * ## 硬性零
 *
 * ```
 * 留一筆規範還成立嗎？  ❌ 一段沒有理由的鷹架，與一段學生看不懂的雜訊長得一樣
 * 修一筆要付多少？      便宜——JSON 加一句話
 * 別台機器一樣嗎？      ✅ 純宣告讀取
 * ```
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測產出對不對**——那是 `board-library-headers-output` 與 round-trip 那一族。
 * - **不檢測「還有沒有別處寫死」**——那要靜態掃描，而判準會誤報（字串長得像程式碼）。
 */
import { describe, it, expect } from 'vitest'
import { printReport } from '../helpers/guardrail'
import { findFiles } from '../helpers/find-files'
import { parseShell, allShells } from '../../src/core/shell'
import '../../src/core/load-language-packs'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const LANGS = path.join(ROOT, 'src/languages')

describe('★ 第八十六條：鷹架是一份宣告', () => {
  const shells = allShells()
  const targets = findFiles(LANGS, 'targets')
    .map((rel) => {
      const d = JSON.parse(fs.readFileSync(path.join(LANGS, rel), 'utf8')) as { id: string; entryShell?: string; topic: string }
      // 目標的語言由它的主題說——`topic` 檔在 `topics/`
      const t = findFiles(LANGS, 'topics')
        .map((r) => ({ r, j: JSON.parse(fs.readFileSync(path.join(LANGS, r), 'utf8')) as { id: string; language?: string } }))
        .find((x) => x.j.id === d.topic)
      return { ...d, language: t?.j.language }
    })

  it('入口條件——鷹架真的註冊進來了', () => {
    printReport('鷹架宣告', [
      `註冊了       ${shells.size} 份`,
      ...[...shells.values()].map((s) =>
        `  ${s.id.padEnd(6)} ${s.name}　${s.preamble.length}+${s.entryPoint.length}+${s.epilogue.length} 段`),
      `目標數       ${targets.length}`,
    ])
    // ⚠️ 錨在**註冊了幾份**（合成量），不是「還寫死幾段」
    expect(shells.size, '🔴 一份鷹架都沒註冊 → 套件沒載入，這份報表不算數').toBeGreaterThanOrEqual(1)
    expect(targets.length, '🔴 一個目標都沒讀到').toBeGreaterThanOrEqual(1)
  })

  it('硬性零——每一個目標指到的鷹架都存在', () => {
    const bad = targets
      .filter((t) => !shells.has(t.entryShell ?? 'main'))
      .map((t) => `${t.id} → ${t.entryShell ?? 'main'}`)
    expect(
      bad,
      '🔴 目標指向一份沒有登記的外框——產出會是一支少了進入點的程式，' +
        '**而它看起來像 Arduino**：',
    ).toEqual([])
  })

  it('🔴 硬性零——每一段鷹架都有理由', () => {
    const silent: string[] = []
    for (const s of shells.values()) {
      for (const [seg, lines] of [['preamble', s.preamble], ['entryPoint', s.entryPoint], ['epilogue', s.epilogue]] as const) {
        for (const l of lines) if (!l.reason) silent.push(`${s.id}.${seg}：${l.code}`)
      }
    }
    expect(
      silent,
      '🔴 一段沒有理由的鷹架——`ghost` 模式下學生會看到一行看不懂的東西，' +
        '而那正是那個模式存在的意義：',
    ).toEqual([])
  })

  it('🔴 硬性零——每一份鷹架都宣告了 `language`', () => {
    // 少了它，`shellById('none')` 會**跨語言撿到別人的宣告**
    // ——2026-08-28 實測：Python 撿到 C++ 的 `none`，
    // 而症狀是「狀態列那句話碰巧是對的，**而選單裡外框那一組整個不見**」。
    expect(
      [...shells.values()].filter((s) => !s.language).map((s) => s.id),
      '🔴 一份沒有語言的鷹架，在第二個語言進來的那天會安靜地撿到別人的宣告：',
    ).toEqual([])
  })

  it('🔴 硬性零——每一個語言至少有一份鷹架（否則選單那一組會整個不見）', () => {
    const langs = new Set(targets.map((t) => t.language).filter(Boolean))
    const covered = new Set([...shells.values()].map((s) => s.language))
    expect(
      [...langs].filter((l) => !covered.has(l as string)),
      '🔴 這些語言沒有任何鷹架宣告——使用者在那個目標上「外框」那一組是空的：',
    ).toEqual([])
  })

  it('🪦 「沒有外框」是一份【空的宣告】，不是一個特例的 if', () => {
    const none = shells.get('none')
    expect(none, '🔴 `none` 這份宣告不見了').toBeTruthy()
    expect(
      [none!.preamble.length, none!.entryPoint.length, none!.epilogue.length],
      '🔴 `none` 不是空的——那它就不是「沒有外框」了',
    ).toEqual([0, 0, 0])
  })
})

describe('★ 注入——證明它會報，也證明它不亂報', () => {
  const OK = { id: 'ㄒ', name: 'ㄒ', language: 'ㄒ語', preamble: [], entryPoint: [{ code: 'a', reason: 'b' }], epilogue: [] }

  it('★ 注入：正確的宣告 → 讀得出來', () => {
    expect(parseShell(OK).entryPoint[0].code).toBe('a')
  })

  it('★ 注入：缺 language → 丟錯（不然它會跨語言被撿走）', () => {
    const { language: _l, ...noLang } = OK
    expect(() => parseShell(noLang)).toThrow(/language/)
  })

  it('★ 注入：一段沒有理由 → 丟錯', () => {
    expect(() => parseShell({ ...OK, entryPoint: [{ code: 'a' }] })).toThrow(/reason/)
    expect(() => parseShell({ ...OK, entryPoint: [{ code: 'a', reason: '' }] })).toThrow(/reason/)
  })

  it('★ 注入：缺 code → 丟錯', () => {
    expect(() => parseShell({ ...OK, epilogue: [{ reason: 'x' }] })).toThrow(/code/)
  })

  it('★ 注入：某一段不是陣列 → 丟錯', () => {
    expect(() => parseShell({ ...OK, preamble: 'x' })).toThrow(/preamble/)
  })

  it('★ 注入：全空是合法的（那就是「沒有外框」）', () => {
    expect(() => parseShell({ id: 'z', name: 'z', language: 'z語', preamble: [], entryPoint: [], epilogue: [] })).not.toThrow()
  })
})
