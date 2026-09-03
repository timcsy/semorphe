/**
 * **課文要有出口**——`lessons/` 的 66 課產生成靜態頁（vision「🔜 下一步」那一格）。
 *
 * ## 🔴 為什麼有這個
 *
 * `src/core/load-lessons.ts:8` 逐字：「⚠️ 課文（`lesson.md`）**不在這裡**」。
 * 於是 129,368 字的課文**在產品裡沒有讀者**——唯二讀它的是測試，而它們讀完就丟。
 *
 * > **一句「這一刀不做 X」的註解，如果沒有人接手 X，它會變成「X 不做」。**
 *
 * ## 它產出什麼
 *
 * ```
 * dist/lessons/index.html                     全部軌道
 * dist/lessons/<軌道>/index.html               一條軌道的課表
 * dist/lessons/<軌道>/<課>/index.html          課文（零 JS）
 * ```
 *
 * ## ⚠️ dev server 也要有——而這是實測抓到的
 *
 * 第一版只掛 `closeBundle`（只有 `npm run build` 才產）。使用者打開
 * `localhost:5173/lessons/cpp-beginner/01-印出一句話/`，得到的是 **SPA 的
 * fallback**（`index.html`）→ 應用開始開機 → wasm 從錯的路徑載 → 一片黑底紅字。
 *
 * > **一頁「只在建置後才存在」的東西，在開發時不會 404——
 * > 它會變成【另一頁】，而那一頁還會裝作自己壞了。**
 *
 * 🟢 所以 dev 走 middleware **當場算一頁**（同樣那幾支純函式，沒有第二份實作），
 * 而且順便拿到「改了 `lesson.md` → 重新整理就看得到」。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Plugin } from 'vite'
import { readTracks, readLessonsOf } from './read-lessons'
import { renderIndex, renderTrack, renderLesson } from './render'

const write = (outDir: string, rel: string, html: string): void => {
  const dir = join(outDir, rel)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), html, 'utf8')
}

export function lessonPages(opts: { root?: string } = {}): Plugin {
  const lessonsRoot = resolve(opts.root ?? 'lessons')
  let outDir = 'dist'

  /**
   * 一個網址 → 一頁 HTML（`null` ＝ 不是課文的網址，交回給下一個中介層）。
   *
   * ⚠️ **每一次都重讀檔案**——dev 要的是「存檔就看得到」，
   * 而 66 課的 JSON ＋ Markdown 讀一輪是毫秒級的事。
   */
  const renderPath = (pathname: string): string | null => {
    const m = /^\/lessons\/?(.*?)\/?$/.exec(decodeURIComponent(pathname))
    if (!m) return null
    const parts = m[1] === '' ? [] : m[1].split('/')
    // 🔴 **只接「一頁」的網址，其餘一律讓開**（2026-09-03 實測修）。
    //
    //    第一版接了 `/lessons` 底下的**全部**，於是把
    //    `/lessons/<軌道>/<課>/lesson.json` 也回成 HTML
    //    ——而那 66 個檔正是 `import.meta.glob` 要載的模組。
    //    症狀：應用整個開不起來，主控台 66 行
    //    「Expected a JavaScript-or-Wasm module script but … MIME type "text/html"」。
    //
    // > **一個中介層攔的是【網址的形狀】，不是【網址的前綴】
    // > ——前綴底下住的不只有頁面。**
    if (parts.length > 2) return null
    if (parts.length > 0 && parts[parts.length - 1].includes('.')) return null
    const tracks = readTracks(lessonsRoot)
    if (parts.length === 0) {
      return renderIndex(tracks.map((t) => ({ track: t, count: readLessonsOf(lessonsRoot, t).length })))
    }
    const track = tracks.find((t) => t.id === parts[0])
    if (!track) return null
    const pages = readLessonsOf(lessonsRoot, track)
    if (parts.length === 1) return renderTrack(track, pages)
    const i = pages.findIndex((p) => p.lesson.id === `${parts[0]}/${parts[1]}`)
    return i < 0 ? null : renderLesson(pages[i], { prev: pages[i - 1], next: pages[i + 1] })
  }

  return {
    name: 'semorphe:lesson-pages',
    configResolved(cfg) { outDir = cfg.build.outDir },

    // 🔴 **要排在 SPA fallback 前面**——Vite 的 `configureServer` 預設就是
    //    「內建中介層之前」，所以直接 `use` 即可。排在後面的話 fallback
    //    會先把 `index.html` 送出去，而那正是第一版的症狀。
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0]
        if (!url.startsWith('/lessons')) return next()
        let html: string | null = null
        try { html = renderPath(url) } catch (e) {
          // ⚠️ **課文壞掉要在頁面上說**，不要退回 fallback 假裝沒事
          res.statusCode = 500
          res.setHeader('content-type', 'text/html; charset=utf-8')
          res.end(`<pre>課文產不出來：${String(e)}</pre>`)
          return
        }
        if (html === null) return next()
        res.setHeader('content-type', 'text/html; charset=utf-8')
        res.end(html)
      })
    },
    // ⚠️ 只有 build 走這一步；dev 走上面的中介層——**兩條路同一組函式**。
    closeBundle() {
      const tracks = readTracks(lessonsRoot)
      const counts: { track: ReturnType<typeof readTracks>[number]; count: number }[] = []
      let n = 0
      for (const track of tracks) {
        const pages = readLessonsOf(lessonsRoot, track)
        pages.forEach((p, i) => {
          // ⚠️ 鄰居由**這裡**算——`renderLesson` 不知道它在第幾課，那是清單的知識。
          write(outDir, `lessons/${p.lesson.id}`,
            renderLesson(p, { prev: pages[i - 1], next: pages[i + 1] }))
          n++
        })
        write(outDir, `lessons/${track.id}`, renderTrack(track, pages))
        counts.push({ track, count: pages.length })
      }
      write(outDir, 'lessons', renderIndex(counts))
      // ⚠️ 出聲——**產了幾頁**要看得到。零頁的話上面每一步都「成功」了。
      this.info?.(`課文靜態頁：${tracks.length} 軌 · ${n} 課`)
      console.log(`\n📄 課文靜態頁：${tracks.length} 軌 · ${n} 課 → ${outDir}/lessons/`)
    },
  }
}
