/**
 * 🔴 **每一堂課都要有一頁讀得到的課文。**
 *
 * ## 病歷
 *
 * ```
 * 2026-08-27  load-lessons.ts:8「⚠️ 課文（lesson.md）不在這裡…形式還沒拍板」
 * 2026-09-03  查出來：6 軌 66 課、129,368 字的課文，【產品裡零個讀者】
 *             唯二讀它的是測試，而它們讀完就丟
 * ```
 *
 * > **一句「這一刀不做 X」的註解，如果沒有人接手 X，它會變成「X 不做」。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果登錄表掃到 0 堂課，代表這支測試沒讀到東西——這份報表不算數，
 * > 不是「全部合規」。** 入口條件那一支錨在「掃到幾堂課」（合成量），
 * > 🔴 不是錨在缺陷數。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢查課文寫得好不好**（段落齊不齊由 `audit-lessons` 管）
 * - **不讀 `dist/`**——它跑的是**產生器自己那幾支純函式**，所以不必先 build。
 *   ⚠️ 代價是它看不到「plugin 沒被掛上」，所以下面第 ⑤ 支直接讀 `vite.config.ts`。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readTracks, readLessonsOf, lastmodFromGit } from '../../tools/build-lessons/read-lessons'
import { renderIndex, renderTrack, renderLesson, renderSitemap, renderRobots } from '../../tools/build-lessons/render'
import { lessonDocHref } from '../../src/core/lesson'
import { allLessons } from '../../src/core/load-lessons'

const ROOT = resolve(__dirname, '../..', 'lessons')

/** 產生器那一側看到的所有頁（不碰 `dist/`）。 */
function pages(): { id: string; html: string }[] {
  const out: { id: string; html: string }[] = []
  const counts: Parameters<typeof renderIndex>[0][number][] = []
  for (const track of readTracks(ROOT)) {
    const ps = readLessonsOf(ROOT, track)
    ps.forEach((p, i) =>
      out.push({ id: p.lesson.id, html: renderLesson(p, { prev: ps[i - 1], next: ps[i + 1] }) }))
    out.push({ id: `軌道:${track.id}`, html: renderTrack(track, ps) })
    counts.push({ track, count: ps.length })
  }
  out.push({ id: '索引', html: renderIndex(counts) })
  return out
}

const titleOf = (html: string): string => html.match(/<title>([^<]*)<\/title>/)?.[1] ?? ''
const descOf = (html: string): string =>
  html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? ''

describe('第一百零一條護欄：每一堂課都要有一頁讀得到的課文', () => {
  it('★ 入口條件：登錄表與產生器都真的讀到東西', () => {
    // 🔴 錨在**合成量**：課變多的那天它不該紅
    expect(allLessons().size, '🔴 登錄表是空的 → 下面每一條都不算數').toBeGreaterThan(50)
    expect(pages().length, '🔴 產生器一頁都沒產 → 下面每一條都不算數').toBeGreaterThan(50)
  })

  it('① 硬性零：登錄表裡的每一課，都要有它的頁', () => {
    const made = new Set(pages().map((p) => p.id))
    // ⚠️ 錨在**登錄表**（`import.meta.glob` 那一側），不是寫死的 66
    //    ——兩側用不同的方式拿檔案，這一條就是它們的對帳單。
    const missing = [...allLessons().keys()].filter((id) => !made.has(id))
    expect(missing, '🔴 有課沒有頁——多半是產生器的走法與 glob 不一致').toEqual([])
  })

  it('① 反向：產出的每一頁，都要對得回登錄表', () => {
    const known = new Set(allLessons().keys())
    const extra = pages()
      .filter((p) => !p.id.startsWith('軌道:') && p.id !== '索引' && !known.has(p.id))
    expect(extra.map((p) => p.id), '🔴 產了一頁而登錄表不認得它').toEqual([])
  })

  it('② 硬性零：「在編輯器打開」連到的 lesson id 必須存在', () => {
    const known = new Set(allLessons().keys())
    const bad: string[] = []
    for (const p of pages()) {
      for (const m of p.html.matchAll(/href="\/\?lesson=([^"]+)"/g)) {
        const id = decodeURIComponent(m[1])
        if (!known.has(id)) bad.push(`${p.id} → ${id}`)
      }
    }
    expect(bad, '🔴 那顆按鈕會把人帶到一堂不存在的課').toEqual([])
  })

  it('③ 硬性零：每一頁的 title 與 description 互不相同', () => {
    const seen = new Map<string, string>()
    const dup: string[] = []
    for (const p of pages()) {
      const t = titleOf(p.html)
      expect(t, `🔴 ${p.id} 沒有 title`).not.toBe('')
      expect(descOf(p.html), `🔴 ${p.id} 沒有 description`).not.toBe('')
      if (seen.has(t)) dup.push(`${p.id} 與 ${seen.get(t)}：「${t}」`)
      seen.set(t, p.id)
    }
    // 🔴 全站共用一組 title＝搜尋引擎眼裡只有一頁
    expect(dup, '🔴 兩頁的 title 一樣').toEqual([])
  })

  it('④ 硬性零：課文頁不得載入任何 JavaScript', () => {
    const bad: string[] = []
    for (const p of pages()) {
      // 🔴 **`application/ld+json` 是【資料】不是程式**（2026-09-03 補的具名例外）。
      //
      //    這條規矩要擋的是「會跑的東西 ＋ 會被拖進來的包」，而結構化資料
      //    既不執行也不發請求——它就寫在這一頁裡。
      //    ⚠️ 而例外要窄到只有那一種 type：`<script>` 沒有 type、或 type 是別的，
      //    一律照舊擋（下面那條注入驗過）。
      //
      // > **一條規矩要擋的是它的【理由】所指的東西，不是它的字面。**
      const scripts = [...p.html.matchAll(/<script([^>]*)>/gi)]
        .filter((m) => !/type="application\/ld\+json"/i.test(m[1]))
      if (scripts.length > 0) bad.push(`${p.id}：有 <script>`)
      if (/blockly|monaco|tree-sitter|\/assets\//i.test(p.html)) bad.push(`${p.id}：提到了編輯器的包`)
    }
    // ⚠️ 這一條守的是這件事的**全部價值**：一旦有人在這裡 import 了什麼，
    //    秒開就沒了，而**沒有任何既有測試會紅**。
    expect(bad, '🔴 課文頁載了東西——它就不再是「打開就在那裡」').toEqual([])
  })

  it('④之二 每一頁都要有分頁圖示——沒有的話瀏覽器畫一顆地球', () => {
    // 🔴 使用者 2026-09-03 的截圖：課文那個分頁是一顆地球，而應用那個分頁是我們的 logo。
    //    ⚠️ 它是「零外部資源」那條的**具名例外**（理由寫在 `render.ts` 的檔頭）：
    //    它不在渲染路徑上，而省下它的代價是使用者看得見的。
    const bad = pages().filter((p) => !/<link rel="icon"[^>]*favicon\.svg/.test(p.html))
    expect(bad.map((p) => p.id), '🔴 有頁沒有 favicon').toEqual([])
  })

  it('④之三 上一課／下一課要連得到，而且不跨軌道', () => {
    // 🔴 軌道是六條**平行**的路，不是一條長隊——第一課的「上一課」是沒有，
    //    不是上一條軌道的最後一課。
    const known = new Set(allLessons().keys())
    const bad: string[] = []
    let withNav = 0
    for (const p of pages()) {
      if (p.id.startsWith('軌道:') || p.id === '索引') continue
      const nav = p.html.match(/<nav class="lesson-nav">[\s\S]*?<\/nav>/)?.[0]
      if (nav === undefined) continue
      withNav++
      for (const m of nav.matchAll(/href="\/lessons\/([^"]+)\/"/g)) {
        const id = decodeURIComponent(m[1])
        if (!known.has(id)) bad.push(`${p.id} → ${id}（不存在）`)
        else if (id.split('/')[0] !== p.id.split('/')[0]) bad.push(`${p.id} → ${id}（跨軌道）`)
      }
    }
    // ★ 入口條件：一頁都沒有導覽的話，上面那個迴圈什麼都沒驗
    expect(withNav, '★ 沒有任何一頁有上下課導覽 → 這條不算數').toBeGreaterThan(50)
    expect(bad, '🔴 上一課／下一課連錯了').toEqual([])
  })

  it('④之五 sitemap 要列到每一頁，而 robots 要指得到它', () => {
    // 🔴 sitemap 漏一頁的代價不是「那一頁排名差」，是**Google 可能永遠沒發現它**。
    const known = [...allLessons().keys()]
    const gitTimes = lastmodFromGit('lessons')
    const tracks = readTracks(ROOT)
    const entries: { path: string; lastmod?: Date }[] = [{ path: '/' }, { path: '/lessons/' }]
    for (const t of tracks) {
      entries.push({ path: `/lessons/${encodeURIComponent(t.id)}/` })
      for (const p of readLessonsOf(ROOT, t, gitTimes)) {
        entries.push({ path: lessonDocHref(p.lesson.id), lastmod: p.lastmod })
      }
    }
    const xml = renderSitemap(entries)
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    // ★ 入口條件：錨在合成量（課變多的那天不該紅）
    expect(locs.length, '★ sitemap 是空的 → 這條不算數').toBeGreaterThan(50)
    const missing = known.filter((id) =>
      !locs.some((l) => l.endsWith(lessonDocHref(id))))
    expect(missing, '🔴 有課沒有進 sitemap').toEqual([])
    // 🔴 **首頁一定要在**——它是全站權重最高的一頁，而它不是這個 plugin 產的
    expect(locs, '🔴 首頁不在 sitemap 裡').toContain('https://semorphe.com/')
    // 🔴 **`lastmod` 要是【內容】的時間**——而它有兩種合法結果：
    //
    //    ```
    //    問得到 git   → 每一課各自的最後提交日（會有很多個不同的日期）
    //    問不到       → 一筆 lastmod 都不寫（不是寫「今天」）
    //    ```
    //
    // 🪦 這一條 2026-09-03 在 CI 上紅過一次，而它紅得對：第一版讀的是檔案的
    //    `mtime`，而 `git clone` 之後每個檔的 mtime 都是 **checkout 的時間**
    //    ——於是「每一課的最後修改日」在 CI 上全部變成今天。
    //
    // > **一個在開發機上成立的「檔案什麼時候改的」，在 CI 上量到的是
    // > 「這個 runner 什麼時候把它抓下來的」。**
    const dates = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1])
    const distinct = new Set(dates).size
    expect(dates.length === 0 || distinct > 1,
      `🔴 ${dates.length} 筆 lastmod 卻只有 ${distinct} 種日期——那不是內容的時間，` +
      '是建置／checkout 的時間。問不到就不要寫。').toBe(true)
    expect(renderRobots(), '🔴 robots 沒有指出 sitemap 在哪')
      .toContain('Sitemap: https://semorphe.com/sitemap.xml')
  })

  it('⑤ 產生器要真的被掛上——不然上面全部是空轉', () => {
    const cfg = readFileSync(resolve(__dirname, '../..', 'vite.config.ts'), 'utf8')
    expect(cfg, '🔴 vite.config 沒有掛 lessonPages()——一頁都不會產').toContain('lessonPages(')
  })

  it('⑥之二 硬性零：中介層不得攔到【模組請求】', async () => {
    // 🔴 病歷（2026-09-03，第二次實測）：第一版接了 `/lessons` 底下的**全部**，
    //    於是 `/lessons/<軌道>/<課>/lesson.json` 也被回成 HTML——而那 66 個檔
    //    正是 `import.meta.glob` 要載的模組。**應用整個開不起來。**
    //
    // > **一個中介層攔的是【網址的形狀】，不是【網址的前綴】
    // > ——前綴底下住的不只有頁面。**
    const { lessonPages } = await import('../../tools/build-lessons')
    const plugin = lessonPages()
    const seen: string[] = []
    const use = (fn: (req: { url: string }, res: unknown, next: () => void) => void): void => {
      for (const url of [
        '/lessons/cpp-beginner/01-印出一句話/lesson.json',
        '/lessons/cpp-beginner/track.json',
        '/lessons/cpp-beginner/01-印出一句話/lesson.md',
      ]) {
        let passed = false
        fn({ url }, {
          setHeader: () => {}, end: () => { seen.push(url) }, statusCode: 0,
        }, () => { passed = true })
        if (!passed) seen.push(`攔了：${url}`)
      }
    }
    const cfg = plugin.configureServer as ((s: { middlewares: { use: typeof use } }) => void)
    cfg({ middlewares: { use } })
    expect(seen.filter((s) => s.startsWith('攔了')), '🔴 模組請求被回成 HTML——應用會開不起來').toEqual([])
  })

  it('⑥ dev server 也要供這些頁——不然開發時它會變成【另一頁】', () => {
    // 🔴 病歷（2026-09-03 實測）：第一版只掛 `closeBundle`，於是
    //    `localhost:5173/lessons/…` 落到 SPA 的 fallback → 應用開機 →
    //    wasm 從錯的路徑載 → 一片黑底紅字。
    //
    // > **一頁「只在建置後才存在」的東西，在開發時不會 404
    // > ——它會變成另一頁，而那一頁還會裝作自己壞了。**
    const src = readFileSync(resolve(__dirname, '../..', 'tools/build-lessons/index.ts'), 'utf8')
    expect(src, '🔴 沒有 configureServer——dev 上這些網址會掉進 SPA fallback')
      .toContain('configureServer')
    expect(src, '🔴 沒有 closeBundle——build 產不出東西').toContain('closeBundle')
  })

  it('★ 注入①：少一頁會紅', () => {
    const known = new Set(allLessons().keys())
    const made = new Set(pages().map((p) => p.id))
    made.delete([...known][0])
    expect([...known].filter((id) => !made.has(id)).length).toBeGreaterThan(0)
  })

  it('★ 注入②：兩頁同名會紅', () => {
    const seen = new Map<string, string>()
    const dup: string[] = []
    for (const p of [{ id: 'a', html: '<title>X</title>' }, { id: 'b', html: '<title>X</title>' }]) {
      const t = titleOf(p.html)
      if (seen.has(t)) dup.push(p.id)
      seen.set(t, p.id)
    }
    expect(dup).toEqual(['b'])
  })

  it('★ 注入③：頁面裡有真的 <script> 會紅，而 JSON-LD 不會', () => {
    const scan = (html: string): number => [...html.matchAll(/<script([^>]*)>/gi)]
      .filter((m) => !/type="application\/ld\+json"/i.test(m[1])).length
    expect(scan('<html><script src="x.js"></script>'), '🔴 真的 script 沒被抓到').toBe(1)
    expect(scan('<html><script>alert(1)</script>'), '🔴 內聯 script 沒被抓到').toBe(1)
    expect(scan('<script type="application/ld+json">{}</script>'), '🔴 JSON-LD 被誤殺').toBe(0)
  })

  it('④之四 每一課都要有 Course 的結構化資料，而它說的要是實話', () => {
    const bad: string[] = []
    let n = 0
    for (const p of pages()) {
      if (p.id.startsWith('軌道:') || p.id === '索引') {
        // 🔴 **索引與課表【不放】** `Course`——它們不是一門課。
        if (/application\/ld\+json/.test(p.html)) bad.push(`${p.id}：不是課，卻宣告了 Course`)
        continue
      }
      const m = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(p.html)
      if (m === null) { bad.push(`${p.id}：沒有結構化資料`); continue }
      n++
      const d = JSON.parse(m[1]) as { '@type': string; url: string; name: string }
      if (d['@type'] !== 'Course') bad.push(`${p.id}：型別是 ${d['@type']}`)
      // ⚠️ 與畫面不符的結構化資料，Google 罰的是**整站**——所以這裡逐項對
      if (!p.html.includes(`<link rel="canonical" href="${d.url}">`)) {
        bad.push(`${p.id}：JSON-LD 的 url 與 canonical 不一致`)
      }
      if (!p.html.includes(`>${d.name}<`) && !p.html.includes(d.name)) {
        bad.push(`${p.id}：JSON-LD 的 name 在頁面上找不到`)
      }
    }
    expect(n, '★ 一頁都沒有結構化資料 → 這條不算數').toBeGreaterThan(50)
    expect(bad, '🔴 結構化資料說了畫面上沒有的話').toEqual([])
  })

  it('★ 網址的形狀：中文課名要 encode，而斜線不能被 encode', () => {
    expect(lessonDocHref('cpp-beginner/11-for迴圈'))
      .toBe('/lessons/cpp-beginner/11-for%E8%BF%B4%E5%9C%88/')
  })
})
