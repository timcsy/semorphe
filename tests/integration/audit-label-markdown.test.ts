/**
 * 第一百二十三條護欄：**積木上的字不得留著沒人渲染的標記**
 *
 * ## 自我否證聲明（⚠️ 寫在量測邏輯之前）
 *
 * > **如果這條護欄回報零違規，而下面合成注入的 `**粗體**` 沒有被報出來，
 * > 代表護欄壞了，不是那 349 句標籤都健康。**
 *
 * ## 它從哪來：2026-09-19 的瀏覽器驗收，用眼睛看到的
 *
 * 管線 197 的第六關。滑鼠停在新積木上，tooltip 長這樣：
 *
 * ```
 * 給出移動之後的那個位置，而**原本那個位置不動**。「幾格」留空時就是一格。
 *                          ↑↑              ↑↑
 * ```
 *
 * **Blockly 的 tooltip 是純文字**——它不渲染 markdown，`**` 原樣印出來。
 *
 * 🔴 而量了之後才看出這不是一顆的問題：**349 句 tooltip 裡有 10 句**含 `**`，
 * 而其中多數是同一批新元件留下的（I/O 操縱子、範圍那一族、位置那一族）。
 * 寫元件的人在膠囊的註解裡習慣用 `**` 強調，而**標籤檔就在隔壁**。
 *
 * > **一個在註解裡正確的寫法，搬到隔壁那個檔就變成使用者看得到的雜訊
 * > ——而兩邊都是我寫的，所以沒有人會在寫的時候發現。**
 *
 * ⚠️ 「補一個實例不會讓下一個不發生」（`CLAUDE.md` 逐字，同一個坑咬過兩次之後寫的）
 * ——所以修完 10 句還要有這一條。
 *
 * ## 判準：**硬性零**，而它擔得起
 *
 * 修之前是 10/349，修之後 0/349。⚠️ 沒有基線、沒有棘輪——一條「允許 N 個」的
 * 護欄在這裡沒有意義：`**` 在純文字的 tooltip 裡**永遠**是雜訊。
 *
 * ⚠️ 而**只認 `**`**：`*` 單星號在數學式裡是乘號（`a * b`），
 * `_` 在識別字裡到處都是。一條認得太多的護欄會逼人改沒問題的那些，
 * 而那種護欄會被改成讓它閉嘴的樣子。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'

/** 膠囊自己的標籤檔——它們才是有人讀的那一份（`core/component/labels.ts` 直讀）。 */
const FILES = globSync('src/components/*/*/labels/*.json', { cwd: process.cwd() })

interface Offence { file: string; key: string; text: string }

function scan(entries: [string, string][], file: string): Offence[] {
  const out: Offence[] = []
  for (const [key, value] of entries) {
    if (typeof value !== 'string') continue
    if (value.includes('**')) out.push({ file, key, text: value.slice(0, 80) })
  }
  return out
}

const offences: Offence[] = []
let scanned = 0
for (const f of FILES) {
  const d = JSON.parse(readFileSync(f, 'utf-8')) as Record<string, unknown>
  const entries = Object.entries(d) as [string, string][]
  scanned += entries.length
  offences.push(...scan(entries, f))
}

describe('自我驗證：這條護欄真的量得到東西', () => {
  it('★ 入口條件——標籤檔真的載進來了', () => {
    expect(FILES.length, '🔴 一個標籤檔都沒掃到 ⟹ 下面在驗空氣').toBeGreaterThan(300)
    expect(scanned, '🔴 掃到檔而沒掃到字').toBeGreaterThan(1000)
  })

  it('🔴 注入：合成一句帶 `**` 的標籤，必須被報出來', () => {
    const fake = scan([['X_TOOLTIP', '這裡有**粗體**']], '(合成)')
    expect(fake, '🔴 護欄漏掉了合成的違規——它壞了，不是標籤都健康').toHaveLength(1)
  })

  it('★ 注入：單星號（乘號）不得被誤報', () => {
    expect(scan([['X_MSG0', '%1 * %2']], '(合成)'), '🔴 認得太多會逼人改沒問題的那些').toHaveLength(0)
  })
})

describe('第一百二十三條護欄：積木上的字不得留著沒人渲染的標記', () => {
  it('🔴 硬性零：`**` 在純文字的 tooltip 裡永遠是雜訊', () => {
    const report = offences.map((o) => `  ${o.file} › ${o.key}\n    ${o.text}`).join('\n')
    expect(
      offences.map((o) => `${o.file}:${o.key}`),
      `🔴 這些字會【原樣印在積木上】——Blockly 的訊息與 tooltip 是純文字：\n${report}`,
    ).toEqual([])
  })
})
