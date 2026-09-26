/**
 * **宣告了唯一性的欄位，實際上唯一嗎。**
 *
 * ## 它從哪來：cella 那側送來的一個問句（2026-09-26）
 *
 * > **你拿來回推身分的那個欄位，它本身是身分嗎？**
 *
 * 它在 cella 那邊的實例是 `HashMap` 上的 `.find(|(k,_)| k.local == name)`
 * ——同一份輸入連跑給出 0／8／15／22 個錯誤，而 22 個裡 14 個是假的。
 * 而拿它掃我們這邊，第一個命中是 `core/language-packs.ts` 的
 *
 * ```ts
 * const t = p.topics.find((x) => x.default)      // ← 「那個預設的」
 * ```
 *
 * `default: true` 是一個**內容**欄位，被拿來當**身分**用。
 *
 * ## 🔴 而這一處【已經被咬過一次】，而當時的修法只治了一半
 *
 * 同一個檔的檔頭逐字記著：
 *
 * > 第一版寫 `allLanguagePacks()[0].targets[0]`，而 **glob 的順序**讓它變成 Python。
 * > 而 `default: true` 早就宣告在 topic 上——用它就不必再發明一個排序規則。
 *
 * ⟹ 它把「靠順序」換成「靠宣告」，**而沒有人檢查那個宣告是不是唯一的**。
 *
 * > **一次「從隱含順序換成顯式宣告」的修法，會把問題從「順序不確定」搬成
 * > 「宣告可能不唯一」——而第二個沒有人檢查的時候，它只是換了一個發作的日子。**
 *
 * ⚠️ **而順序那一半確實治好了**（本護欄查證過）：`allLanguagePacks()` 是
 * `[...PACKS.values()].sort((a,b) => a.order - b.order)`，依**宣告的** `order` 排。
 * 而同一個檔還記著那次的彎路：「第一版試著在載入器裡 `Object.keys(mods).sort()`
 * ——**那一行一個效果都沒有**」。⟹ **本護欄守的是唯一性，不是順序。**
 *
 * ## 自我否證聲明（寫在量測之前）
 *
 * > **如果掃到 0 個 topic 宣告，代表工具壞了，不是這個 repo 沒有 topic。
 * > 而如果標了 `default: true` 的是 0 個，那也是錯的——`defaultTarget()` 會掉到
 * > 它的退路（第一個套件的第一個目標），而那正是當年被 glob 順序咬的那條路。**
 *
 * ⚠️ 錨在**掃到幾個 topic**（合成量）上，**不是**錨在「重複幾筆」上
 * ——後者會在這條護欄成功的那一天變紅。
 *
 * ## 為什麼是硬性零，不是棘輪
 *
 * - 「標了預設的恰好一個」留一筆，那句話就是假的 ⟹ **規範不成立**。
 * - 修一筆是把一個 `true` 改成 `false`，**不改變任何行為** ⟹ **便宜**。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測「那一個是不是對的那一個」**——它只檢測「恰好一個」。
 * - **不檢測其他「用內容欄位回推身分」的地方**。那個掃描要人讀
 *   （判準在 `experience`：「你拿來回推身分的那個欄位，它本身是身分嗎」），
 *   而**假裝機械化得到才是這個庫記過最多次的那種假綠**。
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { REPO_ROOT, printReport } from '../helpers/guardrail'

interface Topic { id?: string; language?: string; default?: unknown }

function topics(): { file: string; id: string; lang: string; isDefault: boolean }[] {
  const root = path.join(REPO_ROOT, 'src/languages')
  const out: { file: string; id: string; lang: string; isDefault: boolean }[] = []
  for (const lang of fs.readdirSync(root)) {
    const dir = path.join(root, lang, 'topics')
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Topic
      out.push({ file: `${lang}/topics/${f}`, id: String(d.id ?? ''), lang, isDefault: d.default === true })
    }
  }
  return out
}

describe('宣告了唯一性的欄位，實際上唯一嗎', () => {
  it('★ 入口條件：掃得到 topic 宣告', () => {
    expect(topics().length, '🔴 掃到 0 個 topic → 判別壞了，不是這個 repo 沒有 topic').toBeGreaterThan(2)
  })

  it('⚠️ 注入：判別真的分得出 true 與 false／缺席', () => {
    const t = topics()
    expect(t.some((x) => x.isDefault), '🔴 認不出 default: true').toBe(true)
    expect(t.some((x) => !x.isDefault), '🔴 認不出 default: false').toBe(true)
  })

  it('🔴 硬性零：標了 `default: true` 的 topic 恰好一個', () => {
    const all = topics()
    const marked = all.filter((x) => x.isDefault)
    printReport('宣告的預設 topic', [
      `掃描   ${all.length} 份 topic 宣告（${new Set(all.map((x) => x.lang)).size} 個語言套件）`,
      `標了   ${marked.length} 份：${marked.map((x) => x.file).join('、') || '（無）'}`,
      '⚠️ 本護欄不檢測「那一個是不是【對的】那一個」——只檢測恰好一個。',
    ])
    expect(
      marked.length,
      marked.length === 0
        ? '🔴 一個都沒標 ⟹ `defaultTarget()` 會掉到退路（第一個套件的第一個目標）'
          + '——而那正是當年被 glob 順序咬的那條路。'
        : `🔴 標了 ${marked.length} 份：${marked.map((x) => x.file).join('、')}`
          + '｜`defaultTarget()` 用 `topics.find(x => x.default)` 取【第一個】，'
          + '其餘會被【安靜地忽略】。判準見 experience「你拿來回推身分的那個欄位，它本身是身分嗎」。',
    ).toBe(1)
  })
})
