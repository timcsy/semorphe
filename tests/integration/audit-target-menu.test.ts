/**
 * **第八十五條護欄**：目標選單的每一項都說得出自己屬於哪一組、排第幾。
 *
 * ## 它從哪來
 *
 * 2026-08-28 使用者看著那份選單問「**這邊能不能重新設計整理一下？**」。
 * 它當時是一列 13 項的平清單，混著**兩個不同的軸**：
 *
 * ```
 * C++（預設）· C 語言教學 · C++ 進階 · Python 入門    語言／軌道（四種後綴，四種寫法）
 * Arduino                                            🔴 沒有板子的那一個
 * Arduino Uno · Nano · ESP32 ×4 · Wemos · NodeMCU     板子
 * ```
 *
 * 🔴 而 `Arduino`（不指定板子）**是一個陷阱**：它的 `board` 是 `null`，
 * 所以 `LED_BUILTIN`／`A0`／`HIGH` 一個都不存在，
 * 而 **Arduino 第一課的第一行就用 `LED_BUILTIN`**（2026-08-27 生教材時撞到）。
 *
 * > **把一個陷阱標示出來，它就變成一個選擇。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果掃到的目標少於 4 個，代表語言套件沒載入——這份報表不算數，
 * > 不是「每個目標都宣告好了」。**
 *
 * 錨在**目標數**（合成量）。🔴 刻意不錨在「缺宣告的目標數」——那正是要推向零的。
 *
 * ## 硬性零
 *
 * ```
 * 留一筆規範還成立嗎？  ❌ 一個沒有組別的目標會掉到清單最末，而沒有人知道為什麼
 * 修一筆要付多少？      便宜——JSON 加兩格
 * 別台機器一樣嗎？      ✅ 純宣告讀取
 * ```
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測選單畫出來對不對**——那要開瀏覽器，住在 `e2e/lesson-pins.spec.ts` 旁邊。
 * - **不檢測組名好不好**——只檢查它存在、而且是已知的那幾個。
 */
import { describe, it, expect } from 'vitest'
import { printReport } from '../helpers/guardrail'
import { findFiles } from '../helpers/find-files'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const LANGS = path.join(ROOT, 'src/languages')
/** 已知的組——多一個組要有人決定它排在哪，所以這裡列著 */
const GROUPS = ['程式語言', '硬體']

interface T { id: string; name: string; group?: string; order?: number; board?: unknown; hint?: string }

function targets(): T[] {
  return findFiles(LANGS, 'targets').map((rel) => JSON.parse(fs.readFileSync(path.join(LANGS, rel), 'utf8')) as T)
}

describe('★ 第八十五條：目標選單的每一項都宣告過組別與順序', () => {
  const all = targets()

  it('入口條件——真的讀到目標宣告了', () => {
    printReport('目標選單', [
      `目標數     ${all.length}`,
      ...GROUPS.map((g) => `  ${g}   ${all.filter((t) => t.group === g).length} 個`),
      `沒有板子的硬體 ${all.filter((t) => t.group === '硬體' && !t.board).map((t) => t.id).join('／') || '（無）'}`,
    ])
    // ⚠️ 錨在**目標數**（合成量）——它不會因為任何缺陷被修好而變小
    expect(all.length, '🔴 一個目標都沒讀到 → 路徑錯了，這份報表不算數').toBeGreaterThanOrEqual(4)
  })

  it('硬性零——每一個目標都有 `group`，而且是已知的組', () => {
    const bad = all.filter((t) => t.group === undefined || !GROUPS.includes(t.group))
      .map((t) => `${t.id} → ${t.group ?? '(沒有)'}`)
    expect(bad, '🔴 這些目標會掉到清單最末，而沒有人知道為什麼：').toEqual([])
  })

  it('硬性零——同一組裡的 `order` 不得重複（重複＝順序其實是碰巧的）', () => {
    const dup: string[] = []
    for (const g of GROUPS) {
      const seen = new Map<number, string>()
      for (const t of all.filter((x) => x.group === g)) {
        if (t.order === undefined) { dup.push(`${t.id} 沒有 order`); continue }
        const prev = seen.get(t.order)
        if (prev) dup.push(`${g}：${prev} 與 ${t.id} 都是 ${t.order}`)
        seen.set(t.order, t.id)
      }
    }
    expect(dup, '🔴 順序其實是碰巧的：').toEqual([])
  })

  it('🔴 硬性零——硬體組裡【沒有板子】的目標必須有 `hint`', () => {
    // 它是陷阱：`LED_BUILTIN`／`A0` 都不存在，而第一課的第一行就用它。
    const silent = all
      .filter((t) => t.group === '硬體' && !t.board && !t.hint)
      .map((t) => t.id)
    expect(
      silent,
      '🔴 一個沒有板子常數的硬體目標，而選單上沒有任何提示——' +
        '學生選了它之後，第一課的第一行就會說「變數尚未宣告」：',
    ).toEqual([])
  })
})

describe('★ 注入——證明它會報，也證明它不亂報', () => {
  const good: T = { id: 'ㄒ', name: 'ㄒ', group: '程式語言', order: 1 }
  const check = (list: T[]): string[] =>
    list.filter((t) => t.group === undefined || !GROUPS.includes(t.group)).map((t) => t.id)

  it('★ 注入：正確的宣告 → 不報', () => expect(check([good])).toEqual([]))
  it('★ 注入：沒有 group → 會報', () =>
    expect(check([{ ...good, group: undefined }])).toEqual(['ㄒ']))
  it('★ 注入：組名不在已知清單裡 → 會報', () =>
    expect(check([{ ...good, group: '別的' }])).toEqual(['ㄒ']))
  it('★ 注入：沒有板子的硬體而沒有 hint → 會報', () => {
    const bad: T = { id: 'ㄒ板', name: 'ㄒ', group: '硬體', order: 1 }
    expect(bad.group === '硬體' && !bad.board && !bad.hint).toBe(true)
  })
})
