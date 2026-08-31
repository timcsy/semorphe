/**
 * **第九十六條護欄**：知識庫裡的相對連結不得指向不存在的東西。
 *
 * ## 它從哪來
 *
 * `knowie-judge` §3 把「死連結」列為每一輪必掃的腐爛之一，而
 * **每一輪都是人（或 AI）手動 grep 一次**。2026-08-31 那輪掃出 23 筆、修到 0。
 *
 * 🔴 而同一天 `audit-dangling-citation` 的檔頭已經記下一件事：
 * 那輪判官掃了 `[](路徑)` 卻**漏掉** `[[名稱]]`，而那個漏掉是在一次
 * 無關的討論裡偶然發現的。**兩半都該機械化，而當時只機械化了一半。**
 *
 * 於是 knowie 自己那條判準又答一次：
 *
 * > 「Keep or cut？→ If cut, could an AI quietly skip it and no one notice?」
 *
 * **會——同一天已經發生過一次了。**
 *
 * ## 自我否證聲明（寫在量測之前）
 *
 * > **如果掃描結果是「掃到 0 個檔」或「解析出 0 條連結」，代表工具壞了，
 * > 不是知識庫沒有連結。而如果報出的死連結裡出現 `http` 或 `#` 開頭的東西，
 * > 代表判準沒有排除外部連結與同檔錨點——那也是工具壞了。**
 *
 * ⚠️ 錨在**掃到幾個檔、解析出幾條連結**（合成量）上，**不是**錨在
 * 「死連結還剩幾條」上——後者會在這條護欄成功的那一天變紅。
 *
 * ## 為什麼是硬性零，不是棘輪
 *
 * 兩個問題分開問（`build-guardrail` §6.8）：
 *
 * - 「留一筆在那裡，這條規範還成立嗎？」——「知識庫的連結不可死」留一筆，
 *   那句話就是假的。**不成立。**
 * - 「修一筆要付多少？」——改個路徑或刪掉連結，**不會改變任何行為**。便宜。
 *
 * 規範成立 ＋ 修法便宜 → **硬性零**。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測連結指得對不對**——指到一個存在的檔 ≠ 指到該指的那個檔。
 * - **不檢測 `[[名稱]]` 形式的具名引用**——那是第九十四條的職責，兩條互補。
 * - **不檢測外部 URL 還活不活**——那要連網，而網路是環境相依的量測工具
 *   （`build-guardrail` §6.8 的第三個問題），會讓基線在不同機器上不一樣。
 * - **不檢測 `#小節` 錨點存不存在**——標題會改寫，而改寫標題是對的事。
 *
 * ## 鍵
 *
 * `來源檔 → 目標路徑`，**不含行號**——行號會因為在上面插一段就整片位移，
 * 那樣報的不是違規是 diff（`build-guardrail` §11）。行號只印在報表裡給人看。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.join(process.cwd(), 'knowledge')

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.name.endsWith('.md')) out.push(p)
  }
  return out
}

/**
 * 圍籬區塊與行內程式碼**整段抹掉**（保留行，行號才對得上）。
 *
 * 🔴 **這一刀是第一次跑逼出來的**，而它是 `build-guardrail` §6.5 那個問題的
 * 標準答案：第一次紅了 2 筆，而**紅的是語料不是世界**——
 *
 * ```
 * knowledge/README.md:78        真正的連結用 `[](相對路徑)`
 * knowledge/experience.md:6469  `](...)` 裡面的一律不碰
 * ```
 *
 * **兩筆都是「在解釋連結語法的時候寫出了連結語法」。**
 * 這與 2026-08-31 那三次「寫『不要寫 X』的時候寫了 X」是同一個形狀。
 *
 * ⚠️ 而這是**切判準**，不是豁免：程式碼區塊裡的 `](x)` 本來就不是連結，
 * 抹掉它是把判準改對。（豁免長這樣：「README.md 這個檔不掃」——那才是作弊。）
 */
function stripCode(lines: readonly string[]): string[] {
  let inFence = false
  return lines.map((l) => {
    if (/^\s*```/.test(l)) {
      inFence = !inFence
      return ''
    }
    return inFence ? '' : l.replace(/`[^`]*`/g, '')
  })
}

export interface Link {
  readonly target: string
  readonly line: number
}

/**
 * 一段 markdown 裡的**相對**連結。
 *
 * ⚠️ 排除四類，而每一類都有理由：
 * `http(s)://`／`mailto:`（外部，不連網）· `#`（同檔錨點）· `<...>`（角括號 URL）
 */
export function relativeLinksIn(text: string): Link[] {
  const out: Link[] = []
  const lines = stripCode(text.split('\n'))
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i].matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const raw = m[1].trim()
      if (!raw) continue
      if (/^(https?:|mailto:|data:|ftp:|#|<)/.test(raw)) continue
      const target = raw.split('#')[0].split('?')[0]
      if (!target) continue
      out.push({ target, line: i + 1 })
    }
  }
  return out
}

/** 這條連結指得到東西嗎？`from` 是**來源檔**的絕對路徑。 */
export function resolves(from: string, target: string): boolean {
  return fs.existsSync(path.resolve(path.dirname(from), decodeURIComponent(target)))
}

interface Dead {
  readonly key: string
  readonly source: string
  readonly target: string
  readonly line: number
}

describe('第九十六條護欄：知識庫的相對連結不得死', () => {
  const files = walk(ROOT)
  const allLinks: { from: string; link: Link }[] = []
  const dead: Dead[] = []

  for (const f of files) {
    for (const link of relativeLinksIn(fs.readFileSync(f, 'utf8'))) {
      allLinks.push({ from: f, link })
      if (!resolves(f, link.target)) {
        const source = path.relative(ROOT, f)
        dead.push({ key: `${source} → ${link.target}`, source, target: link.target, line: link.line })
      }
    }
  }

  it('★ 入口條件——真的掃到知識庫，也真的解析出連結了', () => {
    // 錨在合成量上（掃到幾個檔、幾條連結），見檔頭的自我否證聲明。
    // 🔴 這兩個數字【不會】因為死連結被修好而變小——那正是它們當錨的理由。
    expect(
      files.length,
      `🔴 只掃到 ${files.length} 個 markdown → 路徑錯了或庫是空的，這份報表不算數。` +
        '⚠️ 這【不】代表連結都健康。',
    ).toBeGreaterThan(100)
    expect(
      allLinks.length,
      `🔴 只解析出 ${allLinks.length} 條相對連結 → 正規表示式沒吃到東西，這份報表不算數`,
    ).toBeGreaterThan(200)
  })

  it('★ 注入（會報）：指向不存在的檔要被抓到', () => {
    // ⚠️ 合成路徑，不是真實檔案——真實檔案會被修好，而合成規則不會
    const fakeSource = path.join(ROOT, 'concepts', '__不存在的來源__.md')
    expect(resolves(fakeSource, './__絕對不存在的東西__.md'), '🔴 死連結沒被判為死').toBe(false)
    expect(resolves(fakeSource, '../__也不存在__/x.md'), '🔴 跨目錄的死連結沒被判為死').toBe(false)
  })

  it('★ 注入（不亂報）：指向真的存在的東西不可被判為死', () => {
    // 沒有這一支的話，一個「什麼都報」的掃描器也能通過上一支
    const fromConcepts = path.join(ROOT, 'concepts', 'x.md')
    expect(resolves(fromConcepts, 'README.md'), '🔴 同目錄的真實檔被誤判為死').toBe(true)
    expect(resolves(fromConcepts, '../principles.md'), '🔴 上層的真實檔被誤判為死').toBe(true)
    expect(resolves(fromConcepts, '../draft'), '🔴 指向目錄的連結被誤判為死').toBe(true)
  })

  it('★ 注入：外部連結與同檔錨點不可被當成相對連結', () => {
    // 自我否證聲明的第二句就錨在這裡
    expect(
      relativeLinksIn('[a](https://x.dev) [b](http://y) [c](#小節) [d](mailto:z@w)'),
      '🔴 判準把外部連結或錨點當成相對路徑了',
    ).toEqual([])
    expect(relativeLinksIn('見 [x](../concepts/投影.md#三)').map((l) => l.target)).toEqual([
      '../concepts/投影.md',
    ])
    expect(
      relativeLinksIn('見 [x](./a.md) 與 [y](b/c.md)').map((l) => l.target),
      '🔴 相對連結漏抓',
    ).toEqual(['./a.md', 'b/c.md'])
  })

  it('★ 注入：程式碼裡的連結語法不是連結，而程式碼外的仍要抓到', () => {
    // 🔴 這一支釘的是第一次跑逼出來的那一刀（見 stripCode 的註解）——
    //    兩個方向都要釘，否則「整段抹掉」會連真的連結一起抹
    expect(
      relativeLinksIn('真正的連結用 `[](相對路徑)`，而 `](...)` 裡面的不碰'),
      '🔴 行內程式碼裡的連結語法被當成連結了',
    ).toEqual([])
    expect(
      relativeLinksIn('```\n[x](假的.md)\n```').map((l) => l.target),
      '🔴 圍籬區塊裡的連結語法被當成連結了',
    ).toEqual([])
    expect(
      relativeLinksIn('`程式碼` 之後仍然有 [真的](../concepts/投影.md)').map((l) => l.target),
      '🔴 抹掉程式碼時把真的連結也抹掉了',
    ).toEqual(['../concepts/投影.md'])
    expect(
      relativeLinksIn('a\n```\nb\n```\n見 [x](./y.md)')[0]?.line,
      '🔴 抹掉程式碼時行號跑掉了——報表會指到錯的行',
    ).toBe(5)
  })

  it('🔴 硬性零：一條死連結都不准有', () => {
    if (dead.length) {
      console.log(`\n🔴 死連結 ${dead.length} 筆：`)
      for (const d of dead) console.log(`   ${d.source}:${d.line} → ${d.target}`)
    }
    expect(
      dead.map((d) => d.key),
      '🔴 知識庫有死連結。留一筆，「連結不可死」這句話就是假的——' +
        '所以這一條是硬性零，不是棘輪。修法：改路徑，或把連結拿掉。',
    ).toEqual([])
  })
})
