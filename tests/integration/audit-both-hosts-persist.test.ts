/**
 * **第一百零九條護欄：一個面板記得住的東西，兩個宿主都要記得住。**
 *
 * ## 🔴 為什麼需要它（2026-09-06 查證翻出來的）
 *
 * vision 上有一條打了勾的驗收：「**重開後在原位（持久化）**」
 * ——而它**只在網頁版成立**：
 *
 * ```
 * 積木的位置   網頁版 存檔的 blocklyState ｜ VSCode ViewStateStore（workspaceState）
 * 流程的佈局   網頁版 存檔的 flowLayout   ｜ VSCode 【零筆】
 * ```
 *
 * > **一個「已交付」的驗收如果只在一個宿主上驗過，
 * > 它記的是「那個宿主可以」，不是「這件事做完了」。**
 *
 * ## ⚠️ 為什麼它會這樣發生
 *
 * 開發在瀏覽器裡進行。網頁版那側**做完就看得到**，而 IDE 那側要建置、
 * 安裝、重開一個 IDE ——於是「兩個宿主」在當下讀起來像「一個宿主，
 * 而另一個之後再說」。
 *
 * 🔴 而「之後」沒有一個時間點。
 *
 * ## 它是【棘輪】不是硬性零——而那是刻意的
 *
 * 今天真的缺一項（流程佈局在 IDE 那側）。把它寫成硬性零就是把一條
 * 已知的債寫成一次紅——而那條紅每天都在，於是它會被忽略。
 *
 * > **一條每天都紅的護欄，與一條沒有的護欄，
 * > 在第二天之後是同一個東西。**
 *
 * ⚠️ 所以它釘住「**只准變少**」，而**降到 0 的那天要改成硬性零**
 * （自我否證：那一天這支會紅）。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from '../helpers/guardrail'

const read = (f: string): string => fs.readFileSync(path.join(REPO_ROOT, f), 'utf8')

/** 掃一整個目錄底下有沒有提到某個字。 */
function mentions(dir: string, needle: string): boolean {
  const walk = (d: string): boolean => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name)
      if (e.isDirectory()) { if (walk(f)) return true; continue }
      if (!e.name.endsWith('.ts')) continue
      const body = fs.readFileSync(f, 'utf8')
      for (const line of body.split('\n')) {
        const t = line.trim()
        // ⚠️ 註解裡提到不算——否則「解釋這條護欄」的那幾行會讓它自己通過
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue
        if (line.includes(needle)) return true
      }
    }
    return false
  }
  return walk(path.join(REPO_ROOT, dir))
}

/**
 * 每一個「面板記得住的東西」，兩個宿主各自的持久化。
 *
 * ⚠️ 這份清單是**手寫的**——漏掉一項就等於那一項沒有被守。
 * 判準：**它是使用者手做出來的、而且導不出來的東西**（`experience`：
 * 「狀態」與「快取」的差別在它導不導得出來）。
 */
const PERSISTED: [what: string, web: string, ide: string][] = [
  ['積木的擺放', 'blocklyState', 'ViewStateStore'],
  ['流程節點的佈局', 'flowLayout', 'flowLayout'],
]

describe('第一百零九條護欄：兩個宿主都要記得住', () => {
  it('★ 入口條件——兩邊的目錄都在', () => {
    expect(read('src/vscode/panel.ts').length).toBeGreaterThan(100)
    expect(read('src/ui/app.ts').length).toBeGreaterThan(100)
  })

  it('棘輪：只在一個宿主記得住的東西，只准變少', () => {
    const oneSided = PERSISTED
      .filter(([, web, ide]) => mentions('src/ui', web) && !mentions('src/vscode', ide))
      .map(([what, , ide]) => `${what}：網頁版有，而 \`src/vscode/\` 裡找不到 \`${ide}\``)

    // eslint-disable-next-line no-console
    if (oneSided.length > 0) console.log('\n只在一個宿主記得住：\n  ' + oneSided.join('\n  ') + '\n')

    expect(
      oneSided.length,
      '🔴 **又多了一項只在網頁版記得住的東西。**\n' +
        `   目前：${oneSided.join('；')}\n` +
        '   ⚠️ 開發在瀏覽器裡進行——網頁版做完就看得到，而 IDE 那側要建置、\n' +
        '      安裝、重開一個 IDE。於是「兩個宿主」讀起來像「一個宿主，\n' +
        '      而另一個之後再說」——🔴 **而「之後」沒有一個時間點。**',
    ).toBeLessThanOrEqual(1)

    // ★ 自我否證：補齊的那天這一條會紅，而那時要把它改成硬性零
    expect(
      oneSided.length,
      '🟢 **兩個宿主都記得住了**——把這條改成硬性零（`toEqual([])`），\n' +
        '   別讓它停在「只准變少」。',
    ).toBeGreaterThan(0)
  })

  /**
   * ★ **注入**（第四十九條：每一條掃描式護欄都要有）——
   * ⚠️ 沒有它，一個掃錯目錄的護欄會永遠報 0，而 0 讀起來像「兩邊都有」。
   */
  it('★ 注入：合成一項「只有網頁版有」的 → 抓得到', () => {
    const fake: typeof PERSISTED = [
      ['兩邊都有的', 'A', 'A'],
      ['只有網頁版的', 'B', 'B'],
    ]
    const web = new Set(['A', 'B'])
    const ide = new Set(['A'])
    expect(
      fake.filter(([, w, i]) => web.has(w) && !ide.has(i)).map(([what]) => what),
    ).toEqual(['只有網頁版的'])
  })

  it('★ 注入：兩邊都有 → 不得報', () => {
    const fake: typeof PERSISTED = [['x', 'A', 'A']]
    const web = new Set(['A']); const ide = new Set(['A'])
    expect(fake.filter(([, w, i]) => web.has(w) && !ide.has(i))).toEqual([])
  })

  /**
   * ★ **註解裡提到不算**——否則這條護欄會讓自己通過。
   *
   * ⚠️ 這一支自己踩過一次：第一版把要找的字串**寫在 `expect` 那一行上**，
   * 於是掃描器在那一行（一個**程式碼行**）找到它 → 回 `true` → 測試紅。
   *
   * > **一個「驗證掃描器會跳過註解」的測試，
   * > 它的探針字串本身不能出現在程式碼行上——而那正是它最自然的寫法。**
   *
   * 🟢 所以探針**拼起來**：完整的那個字只存在於下面那行註解裡。
   */
  it('★ 註解裡提到不算——否則這條護欄會讓自己通過', () => {
    // 探針：SEMORPHE_COMMENT_ONLY_PROBE
    const probe = 'SEMORPHE_COMMENT' + '_ONLY_PROBE'
    expect(
      mentions('tests/integration', probe),
      '🔴 掃描器把註解也算進去了——那會讓每一份「解釋自己」的檔案變成假的通過',
    ).toBe(false)
  })
})
