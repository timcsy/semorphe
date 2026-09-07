/**
 * **第一百一十四條護欄：課文不得用還沒教過的東西，而且要說得出它在畫面上叫什麼。**
 *
 * ## 🔴 它守的是使用者的一句話
 *
 * > 「我發現你似乎沒有先說明註解是什麼就使用註解，
 * > 你能不能**有系統地找出類似的錯誤**定**保證之後不會出現**這錯？」
 * > 「我要說的**還有課文本身的用字**。」
 *
 * 那句「保證之後不會出現」就是這條護欄。
 *
 * ## 兩個維度
 *
 * ```
 * ① 用了沒教過的   課文的程式碼裡的元件，要在這一課或之前被宣告過
 * ② 沒說它叫什麼   一顆元件【第一次】出現的那一課，課文要提到它在畫面上的名字
 * ```
 *
 * ## ⚠️ 三個排除，而每一個都是量出來的
 *
 * ```
 * 骨架的元件        227 → 63    程式的殼由骨架提供，課程刻意不教
 * 提示文字不算      66 課全紅 → 判準太寬（學生認積木靠上面印的字）
 * 沒有中文名的積木  46 顆        那不是缺陷，是它本來就沒有名字可比對
 * ```
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢查教學順序好不好**——它只檢查「有沒有機會知道」
 * - **不管英文那一側**
 * - **不要求沒有中文名的那 46 顆去取名**——那是另一刀
 * - 🔴 **不是硬性零**：今天有 174 筆，而**一條每天都紅的護欄，
 *   與一條沒有的護欄，在第二天之後是同一個東西**。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { assertRatchet, assertCorpus, printReport, REPO_ROOT } from '../helpers/guardrail'
import type { SemanticNode } from '../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${REPO_ROOT}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${REPO_ROOT}/public/tree-sitter-cpp.wasm`))
}, 120_000)

// ─── 積木上的名字 ───

/**
 * 每顆元件在**畫面上**的名字。
 *
 * 🔴 **只收 `*_MSG*`，不收 tooltip**——學生在積木盤上認得那顆積木，
 * 靠的是**上面印的字**，而不是「把滑鼠停在上面才看得到」的說明。
 *
 * ⚠️ 第一版把 tooltip 也算進去，於是 **66 課全部**報「對不上」
 * ——而那不是缺陷，是判準太寬。
 *
 * > **一條護欄漏掉東西的方式，多半是它認得的範圍太窄；
 * > 而它誤報的方式相反：範圍太寬。**
 */
export function screenNames(): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const base = path.join(REPO_ROOT, 'src/components')
  for (const lang of fs.readdirSync(base, { withFileTypes: true })) {
    if (!lang.isDirectory()) continue
    for (const d of fs.readdirSync(path.join(base, lang.name), { withFileTypes: true })) {
      if (!d.isDirectory()) continue
      const cj = path.join(base, lang.name, d.name, 'component.json')
      const lj = path.join(base, lang.name, d.name, 'labels/zh-TW.json')
      if (!fs.existsSync(cj) || !fs.existsSync(lj)) continue
      const id = (JSON.parse(fs.readFileSync(cj, 'utf8')) as { componentId?: string }).componentId
      if (!id) continue
      const all = JSON.parse(fs.readFileSync(lj, 'utf8')) as Record<string, string>
      out.set(id, Object.entries(all)
        .filter(([k]) => /_MSG\d*$/.test(k))
        .map(([, v]) => v)
        .filter((v) => typeof v === 'string'))
    }
  }
  return out
}

/** 一句畫面文字裡的「詞」——去掉佔位符、標點與單字。 */
export function wordsOf(label: string): string[] {
  return label
    .split(/[\s，。：；、（）()「」【】…・,.:;!?"'`%0-9=[\]*+\-/<>]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && /[一-鿿]/.test(w))
}

// ─── 骨架用掉的元件——🔴 導出的，不是列的 ───

/**
 * 骨架宣告的是**程式碼字串**（`int main() {` · `return 0;` ·
 * `using namespace std;`），所以「它用掉哪些元件」要走一次語義結構才知道。
 *
 * ⚠️ 而它們**課程刻意不教**：前三課把骨架藏起來，
 * 第 4 課「程式從哪開始」才是拆開它的那一課。
 *
 * 🔴 **不扣掉它們，這條護欄會報 227 筆而不是 63 筆**
 * ——而報每一課都紅的護欄，與沒有護欄是同一件事。
 */
export function skeletonComponents(): Set<string> {
  const out = new Set<string>()
  const lifter = createTestLifter()
  const dir = path.join(REPO_ROOT, 'src/languages/cpp/skeletons')
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Record<string, unknown>
    const lines: string[] = []
    for (const p of (j['preamble'] ?? []) as { code: string }[]) lines.push(p.code)
    for (const e of (j['entryFunctions'] ?? []) as Record<string, unknown>[]) {
      for (const o of (e['open'] ?? []) as { code: string }[]) lines.push(o.code)
      for (const c of (e['close'] ?? []) as { code: string }[]) lines.push(c.code)
    }
    try {
      collectIds(lifter.lift(parser.parse(lines.join('\n'))!.rootNode as never) as SemanticNode, out)
    } catch { /* 骨架解析不了就少扣一點——⚠️ 那讓護欄【偏嚴】，不會漏 */ }
  }
  // ⚠️ 標頭是 auto-include 加的，同樣屬於骨架（`scaffold` 藏著它）
  out.add('cpp:include')
  return out
}

function collectIds(n: SemanticNode | null | undefined, acc: Set<string>): void {
  if (!n || typeof n !== 'object') return
  if (typeof n.componentId === 'string' && n.componentId.includes(':')) acc.add(n.componentId)
  for (const b of Object.values(n.children ?? {})) for (const c of b ?? []) collectIds(c, acc)
}

// ─── 課程 ───

interface Lesson { id: string; track: string; declared: string[]; md: string; blocks: string[] }

/**
 * 每一軌的**前置軌道**（`track.json` 的 `after`）。
 *
 * 🔴 **沒有它，進階軌的第 1 課會被要求重新介紹「換行」與「建立變數」**
 * ——而那些學生在入門軌早就學過了（2026-09-07 量到 31 筆這種誤報）。
 *
 * ⚠️ 而 `order` 不是它：`order` 是**選單的順序**，
 * 說不出「走完這一軌才走那一軌」。
 */
export function trackAfter(): Map<string, string> {
  const out = new Map<string, string>()
  const base = path.join(REPO_ROOT, 'lessons')
  for (const t of fs.readdirSync(base, { withFileTypes: true })) {
    if (!t.isDirectory()) continue
    const f = path.join(base, t.name, 'track.json')
    if (!fs.existsSync(f)) continue
    const a = (JSON.parse(fs.readFileSync(f, 'utf8')) as { after?: string }).after
    if (typeof a === 'string') out.set(t.name, a)
  }
  return out
}

/** 這一軌之前（含前置鏈上每一軌）教過的一切。⚠️ 前置鏈**不得成環**。 */
function inheritedFrom(track: string, after: ReadonlyMap<string, string>,
  taughtPerTrack: ReadonlyMap<string, Set<string>>): Set<string> {
  const out = new Set<string>()
  const seen = new Set<string>()
  let cur = after.get(track)
  while (cur !== undefined && !seen.has(cur)) {
    seen.add(cur)
    for (const c of taughtPerTrack.get(cur) ?? []) out.add(c)
    cur = after.get(cur)
  }
  return out
}

/** 每一軌宣告過的全部元件——前置繼承要用。 */
function taughtPerTrack(rows: readonly Lesson[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const r of rows) {
    const s = out.get(r.track) ?? new Set<string>()
    out.set(r.track, s)
    for (const c of r.declared) s.add(c)
  }
  return out
}

/** ⚠️ 課程 id 帶編號，所以字典序**就是**課程順序。 */
function lessons(): Lesson[] {
  const out: Lesson[] = []
  const base = path.join(REPO_ROOT, 'lessons')
  for (const t of fs.readdirSync(base, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!t.isDirectory()) continue
    for (const d of fs.readdirSync(path.join(base, t.name), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!d.isDirectory()) continue
      const j = path.join(base, t.name, d.name, 'lesson.json')
      const m = path.join(base, t.name, d.name, 'lesson.md')
      if (!fs.existsSync(j) || !fs.existsSync(m)) continue
      const md = fs.readFileSync(m, 'utf8')
      out.push({
        id: `${t.name}/${d.name}`,
        track: t.name,
        declared: (JSON.parse(fs.readFileSync(j, 'utf8')) as { components?: string[] }).components ?? [],
        md,
        blocks: cppBlocks(md),
      })
    }
  }
  return out
}

function cppBlocks(md: string): string[] {
  const out: string[] = []
  let buf: string[] | null = null
  for (const l of md.split('\n')) {
    if (buf === null) { if (/^```(cpp|c\+\+|arduino)\s*$/.test(l.trim())) buf = []; continue }
    if (l.trim() === '```') { out.push(buf.join('\n')); buf = null; continue }
    buf.push(l)
  }
  return out
}

// ─── 兩個判斷——🟢 匯出，讓注入測試餵得進合成輸入 ───

/** ① 課文的程式碼用了還沒教過的元件。 */
export function untaughtUses(rows: Lesson[], skeleton: ReadonlySet<string>,
  lifter: ReturnType<typeof createTestLifter>, after: ReadonlyMap<string, string> = new Map()): string[] {
  const bad: string[] = []
  const perTrack = taughtPerTrack(rows)
  const byTrack = new Map<string, Set<string>>()
  for (const r of rows) {
    // 🟢 **前置軌教過的算教過**——`after` 說了它接在哪一軌後面
    const taught = byTrack.get(r.track) ?? inheritedFrom(r.track, after, perTrack)
    byTrack.set(r.track, taught)
    for (const c of r.declared) taught.add(c)
    const used = new Set<string>()
    for (const code of r.blocks) {
      try {
        collectIds(lifter.lift(parser.parse(code)!.rootNode as never) as SemanticNode, used)
      } catch { /* 片段解析不了就跳過——⚠️ 偏鬆，而它不會誤報 */ }
    }
    for (const c of [...used].sort()) {
      if (taught.has(c) || skeleton.has(c)) continue
      bad.push(`${r.id}：程式碼用了 ${c}，而它到這一課為止沒有被教過`)
    }
  }
  return bad
}

/** ② 一顆元件第一次出現的那一課，課文沒提它在畫面上叫什麼。 */
export function unnamedFirstUse(rows: Lesson[], names: ReadonlyMap<string, string[]>,
  after: ReadonlyMap<string, string> = new Map()): string[] {
  const bad: string[] = []
  const perTrack = taughtPerTrack(rows)
  const seenByTrack = new Map<string, Set<string>>()
  for (const r of rows) {
    // 🟢 **前置軌介紹過的不必再介紹一次**
    const seen = seenByTrack.get(r.track) ?? inheritedFrom(r.track, after, perTrack)
    seenByTrack.set(r.track, seen)
    for (const c of r.declared) {
      if (seen.has(c)) continue        // 🔴 只看【第一次】——之後的課不必再介紹
      seen.add(c)
      const ws = (names.get(c) ?? []).flatMap(wordsOf)
      if (ws.length === 0) continue    // ⚠️ 畫面上沒有中文名可比對——不是缺陷
      if (!ws.some((w) => r.md.includes(w))) {
        bad.push(`${r.id}：第一次用 ${c}，而課文沒提它在畫面上叫「${ws.join('／')}」`)
      }
    }
  }
  return bad
}

// ─── 護欄 ───

describe('第一百一十四條護欄：課文的用字與還沒教過的東西', () => {
  it('★ 入口條件——真的掃到課與名字了', () => {
    expect(lessons().length, '🔴 一堂課都沒掃到 → 下面每一條都是空過的').toBeGreaterThan(50)
    expect(screenNames().size, '🔴 一個畫面名字都沒掃到').toBeGreaterThan(200)
  })

  it('棘輪：兩個數字只准下降', () => {
    const rows = lessons()
    const names = screenNames()
    const skeleton = skeletonComponents()
    const lifter = createTestLifter()
    const after = trackAfter()
    const untaught = untaughtUses(rows, skeleton, lifter, after)
    const unnamed = unnamedFirstUse(rows, names, after)
    const noName = [...names.values()].filter((ls) => ls.flatMap(wordsOf).length === 0).length

    printReport('課文的用字', [
      ['課數', rows.length],
      ['畫面名字', names.size],
      ['骨架扣掉', skeleton.size],
      ['宣告了前置的軌道', after.size],
      ['沒有中文名（不算違規）', noName],
      ['① 用了沒教過的', untaught.length],
      ['② 首次出現而沒說名字', unnamed.length],
    ], untaught.concat(unnamed))

    assertCorpus([['課數', rows.length], ['畫面名字', names.size]], 'lesson-vocabulary')

    /**
     * 🔴 **硬性零，而它一開始是棘輪。**
     *
     * 建檔那天量到 62 ＋ 109，而本來的計畫是「棘輪，慢慢清」
     * ——理由是「一條每天都紅的護欄與一條沒有的護欄是同一個東西」。
     *
     * 🟢 **而同一天就清到 0 了**，所以它升成硬性零：
     *
     * ```
     * 補上「這一軌接在哪一軌後面」   62 → 24 · 109 → 17   （不是修，是把誤報拿掉）
     * 逐課補課文與宣告               24 → 0  ·  17 → 0
     * ```
     *
     * > **一條護欄該用棘輪還是硬性零，答案在「今天量到幾筆」
     * > ——而那個數字要在【扣掉每一個誤報之後】才算數。**
     */
    expect(
      untaught,
      '🔴 課文的程式碼用了學生到這一課為止沒有機會知道的積木。\n'
        + '🟢 修法：在課文加一段介紹它，或——如果課文其實教了——**補上 `components` 宣告**。\n'
        + '⚠️ 骨架那一批已經扣掉了；前置軌（`track.json` 的 `after`）教過的也算教過。',
    ).toEqual([])
    expect(
      unnamed,
      '🔴 一顆積木第一次出現，而課文沒提它在畫面上叫什麼——學生去積木盤【找不到】。\n'
        + '🟢 修法：在那一課加一句「積木盤上這一顆寫著「…」」。\n'
        + '⚠️ 只有**第一次**要介紹；前置軌介紹過的不必再說一次。',
    ).toEqual([])
  }, 300_000)

  /**
   * 🪦 **「宣告了而用不到」這一條，2026-09-07 兩邊都拿掉了。**
   *
   * 它本來住在 `e2e/lessons.spec.ts`，量的是「完成的樣子」那一段程式碼。
   * 我把它搬過來、把語料放寬成「課文裡每一段」——**而它照樣誤報 26 筆**。
   *
   * ## 🔴 因為那條規則的前提不成立
   *
   * 它假設「**教了 ＝ 程式碼裡有**」。而 `arduino/01` 是**用一段文字**
   * 教註解的（「從下一課起會出現 `//` 開頭的字……」）——課文教了它、
   * 工具箱該讓他拿得到，而那一課的程式碼裡**一行 `//` 都沒有**。
   *
   * > **一條「宣告的東西要在程式碼裡出現」的規則，
   * > 擋掉的是【用文字教的那些】——而那正是入門課最常用的教法。**
   *
   * 🟢 而族二（首次出現要提它在畫面上的名字）是**更好的判準**：
   * 一顆被介紹過的積木不是雜訊，不論它有沒有出現在程式碼裡。
   *
   * ⚠️ 所以「多開的積木是雜訊」這個顧慮**由族二接手**，不另設一條。
   */

  /**
   * 🔴 **硬性零：`labelKey` 指向的鍵一定要有定義，而 `labelFallback` 要一致。**
   *
   * ## 它是怎麼被抓到的
   *
   * `print` 的畫面文字改成「印出」之後，**C++ 那側的圖上還是「輸出」**
   * ——因為 `cpp:print` 的 `labelKey` 是 `U_PRINT_MSG`（不是 `MSG0`），
   * 而它的定義**不在膠囊裡，在共用的 `src/i18n/` 檔裡**。
   *
   * 🪦 **我的第一版診斷寫著「那個鍵從來沒有被定義過」——那是錯的**，
   * 而共用檔那份的值正好是「輸出」，所以症狀一模一樣。
   *
   * > **一個「找不到就用預設值」的機制，與一個「找到了另一份」的機制，
   * > 在畫面上長得一樣——而修法完全不同。**
   *
   * 🟢 真正的形狀：那 4 個鍵**還沒搬進膠囊**（膠囊就近性那條護欄
   * 本來就在等它們）。修法是搬進去 ＋ 把共用檔那份刪掉——
   * **兩份會漂移，而 2026-09-07 它就漂了**。
   *
   * ⚠️ 而這一條仍然要有：**膠囊裡沒有那個鍵**，換語系時它就不會變。
   * 同一天量到 **8 筆**（跨 5 顆元件、兩個語言）。
   */
  it('🔴 硬性零：`labelKey` 有定義，而 `labelFallback` 與它一致', () => {
    const bad: string[] = []
    const base = path.join(REPO_ROOT, 'src/components')
    let checked = 0
    for (const lang of fs.readdirSync(base, { withFileTypes: true })) {
      if (!lang.isDirectory()) continue
      for (const d of fs.readdirSync(path.join(base, lang.name), { withFileTypes: true })) {
        if (!d.isDirectory()) continue
        const bj = path.join(base, lang.name, d.name, 'forms/blocks.json')
        const lj = path.join(base, lang.name, d.name, 'labels/zh-TW.json')
        if (!fs.existsSync(bj) || !fs.existsSync(lj)) continue
        const labels = JSON.parse(fs.readFileSync(lj, 'utf8')) as Record<string, string>
        for (const blk of JSON.parse(fs.readFileSync(bj, 'utf8')) as Record<string, never>[]) {
          const bd = (blk['blockDef'] ?? {}) as Record<string, unknown>
          const k = bd['labelKey']
          if (typeof k !== 'string') continue
          checked++
          const fb = bd['labelFallback']
          const real = labels[k]
          if (real === undefined) {
            bad.push(`${String(blk['componentId'])}：labelKey \`${k}\` 沒有定義`
              + ` → 永遠用 fallback「${String(fb)}」，而換語系不會變`)
          } else if (typeof fb === 'string' && real !== fb) {
            bad.push(`${String(blk['componentId'])}：labels 說「${real}」而 fallback 說「${fb}」`)
          }
        }
      }
    }
    expect(checked, '★ 入口條件——真的掃到帶 labelKey 的積木').toBeGreaterThan(3)
    expect(
      bad,
      '🔴 積木上的字寫死在 `blocks.json` 的 `labelFallback` 裡，而 `labels/` 沒有生效。\n'
        + '⚠️ 症狀是**換語系那顆積木不會變**，而且不會報錯。\n'
        + '🟢 修法：把那個鍵補進 `labels/zh-TW.json` 與 `labels/en.json`，'
        + '並讓 `labelFallback` 與中文那一份一致。',
    ).toEqual([])
  })

  // ─── 注入（第四十九條）——🔴 使用者要的是「保證之後不會出現」 ───

  /**
   * ★ **注入：什麼都沒宣告 → 那段程式碼用到的每一顆都要被報。**
   *
   * ⚠️ **不錨在任何一顆元件的身分上**（第三十五條護欄抓過這裡的第一版：
   * 它斷言 `toContain('cpp:var_declare')`，而那個名字會改）。
   *
   * 🟢 改成**自洽**的：先問「這段程式碼用了什麼」，
   * 再斷言「報出來的正好是那些」——判準不依賴任何一個具體的名字。
   *
   * > **一個錨在真實世界某個名字上的斷言，會在那個名字改的那天紅
   * > ——而它紅的樣子與真的壞掉一模一樣。**
   */
  it('★ 注入：什麼都沒宣告 → 用到的每一顆都被報', () => {
    const lifter = createTestLifter()
    const code = 'int x = 1;'
    const used = new Set<string>()
    collectIds(lifter.lift(parser.parse(code)!.rootNode as never) as SemanticNode, used)
    expect(used.size, '★ 入口條件——這段程式碼真的 lift 出東西了').toBeGreaterThan(0)

    const rows: Lesson[] = [{ id: 'ㄒ/01', track: 'ㄒ', declared: [], md: '略', blocks: [code] }]
    const bad = untaughtUses(rows, new Set(), lifter)
    expect(bad.length, '🔴 一顆都沒宣告，而報出來的筆數與用到的顆數不符').toBe(used.size)
  }, 120_000)

  it('★ 反向：全部宣告過就不得被報', () => {
    const lifter = createTestLifter()
    const code = 'int x = 1;'
    const used = new Set<string>()
    collectIds(lifter.lift(parser.parse(code)!.rootNode as never) as SemanticNode, used)
    const rows: Lesson[] = [{ id: 'ㄒ/01', track: 'ㄒ', declared: [...used], md: '略', blocks: [code] }]
    expect(untaughtUses(rows, new Set(), lifter)).toEqual([])
  }, 120_000)

  it('★ 注入：把首次出現的元件的名字從課文裡拿掉 → 抓得到', () => {
    const names = new Map([['ㄒ:甲', ['印出 %1']]])
    const bad = unnamedFirstUse(
      [{ id: 'ㄒ/01', track: 'ㄒ', declared: ['ㄒ:甲'], md: '這一課什麼都沒說', blocks: [] }], names)
    expect(bad.join('')).toContain('印出')
  })

  it('★ 反向：課文提了那個名字就不得被報', () => {
    const names = new Map([['ㄒ:甲', ['印出 %1']]])
    expect(unnamedFirstUse(
      [{ id: 'ㄒ/01', track: 'ㄒ', declared: ['ㄒ:甲'], md: '把它印出來', blocks: [] }], names)).toEqual([])
  })

  it('★ 反向：第二次出現不必再介紹', () => {
    const names = new Map([['ㄒ:甲', ['印出 %1']]])
    expect(unnamedFirstUse([
      { id: 'ㄒ/01', track: 'ㄒ', declared: ['ㄒ:甲'], md: '把它印出來', blocks: [] },
      { id: 'ㄒ/02', track: 'ㄒ', declared: ['ㄒ:甲'], md: '什麼都沒說', blocks: [] },
    ], names)).toEqual([])
  })

  /**
   * ★ **沒有中文名的積木不得被報**——那不是缺陷，是它本來就沒有名字。
   */
  it('★ 反向：畫面上只有佔位符的積木不算違規', () => {
    const names = new Map([['ㄒ:甲', ['%1 %2 %3']]])
    expect(unnamedFirstUse(
      [{ id: 'ㄒ/01', track: 'ㄒ', declared: ['ㄒ:甲'], md: '略', blocks: [] }], names)).toEqual([])
  })

  it('★ 提示文字不算——只看積木上印的字', () => {
    // 🔴 這一條錨在**取名規則**上，不錨在某一顆元件的現況
    const names = screenNames()
    const anyLabels = [...names.values()].flat()
    expect(anyLabels.length, '★ 入口條件').toBeGreaterThan(100)
    expect(
      anyLabels.some((l) => l.includes('到螢幕上')),
      '🔴 掃到了 tooltip 的文字（「…到螢幕上」是提示不是積木上的字）',
    ).toBe(false)
  })
})
