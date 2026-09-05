/**
 * 課文 → 靜態頁。**零 JavaScript、零外部資源。**
 *
 * 🔴 為什麼要求零 JS：這一整件事的價值是「**秒開、而且搜尋引擎讀得到**」。
 * 一旦有人在這裡 import 了什麼，那個價值就沒了，**而不會有任何測試變紅**
 * ——所以 `audit-lesson-pages` 的第四條直接掃輸出的 HTML 裡有沒有 bundle 名字。
 *
 * ## ⚠️ 而 favicon 是一個【具名的例外】
 *
 * 它是一次外部請求（`/favicon.svg`），與上面那條看起來衝突。留它的理由：
 * 它**不擋任何一格畫面**（瀏覽器拿去畫分頁的圖示，不在渲染路徑上），
 * 而**沒有它的代價是使用者看得見的**——分頁上是一顆地球
 * （使用者 2026-09-03 的截圖：「應該要有 icon 才對」）。
 *
 * 🔴 而它用的是**應用同一個檔**（`public/favicon.svg`）：同一個網域、同一份快取，
 * 改 logo 的時候也不會有第二個地方忘記改。
 *
 * > **「零外部資源」是一條為了【打開就在那裡】而立的規矩——
 * > 一個不在渲染路徑上、而且省下它會讓畫面變差的東西，不是它要擋的對象。**
 */
import MarkdownIt from 'markdown-it'
import type { LessonPage } from './read-lessons'
import { lessonDocHref, type Track } from '../../src/core/lesson'
import { interactionById, type Interaction } from '../../src/core/interactions'

export { lessonDocHref }

/**
 * **站台的正式網址**——`og:*` 與 `canonical` 都要**絕對網址**（規範明文，
 * 相對的會被當成沒有）。⚠️ 與 `public/CNAME` 是同一個網域，改網域時兩邊要一起改。
 */
const SITE = 'https://semorphe.com'

const md = new MarkdownIt({ html: false, linkify: true, breaks: false })

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * 每一頁自己的樣式——**內嵌，不外連**。
 *
 * ⚠️ 一個 `<link rel=stylesheet>` 就是一次額外的往返，而這幾頁的全部賣點
 * 就是「打開就在那裡」。它只有 1KB，內嵌比較誠實。
 */
/**
 * 🪦 **「滑過一行，那塊積木亮起來」那段腳本已於 2026-09-05 退場。**
 *
 * 它做得出來、也很好用，而**課文頁有一條硬性零：不得載入任何 JavaScript**
 * （`audit-lesson-pages` ④，理由是「打開就在那裡」——一旦有人在這裡
 * import 了什麼，秒開就沒了）。我不繞過那條規矩。
 *
 * 🟢 而換來的做法更好：**把行號直接畫進積木旁邊**（見
 * `tools/demo/record-blockmaps.spec.ts` 的 badges）。讀者用編號配對，
 * 那是 split-attention 研究說的 integrated format。
 *
 * > **一個需要滑鼠才成立的對照，在紙上、在手機上、在讀螢幕的人那裡
 * > 都不成立——而編號到處都成立。**
 */

const CSS = `
:root{color-scheme:light dark;--fg:#1a1a1a;--bg:#fff;--muted:#666;--line:#e5e5e5;--accent:#0b6ea8;--code-bg:#f6f8fa}
@media(prefers-color-scheme:dark){:root{--fg:#e6e6e6;--bg:#161719;--muted:#9aa0a6;--line:#2e3033;--accent:#7ec8f0;--code-bg:#1e2023}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.75 -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC","PingFang TC",sans-serif}
main{max-width:44rem;margin:0 auto;padding:1.5rem 1.25rem 5rem}
header{border-bottom:1px solid var(--line)}
/* 站徽貼最左，麵包屑對齊【正文那一欄】的左緣——中間那格與 main 同寬同置中，
   所以兩者的文字起點在同一條線上。
   ⚠️ 這段 CSS 住在 template literal 裡：註解裡【不能出現反引號】，
      它會把字串提前結束（2026-09-03 就這樣紅過一次）。
   ⚠️ 窄畫面沒有那個空間，退回一列排（下面的 @media）。 */
header>div{display:grid;grid-template-columns:1fr minmax(0,44rem) 1fr;align-items:center;padding:.75rem 0}
header .brand{grid-column:1;justify-self:start;padding-left:1.25rem}
header nav{grid-column:2;padding:0 1.25rem}
@media(max-width:64rem){
  header>div{display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;padding:.75rem 1.25rem}
  header .brand,header nav{padding:0}
}
.brand{font-weight:700;text-decoration:none;color:var(--fg);display:inline-flex;gap:.45rem;align-items:center}
.brand svg{width:22px;height:22px;display:block}
nav{color:var(--muted);font-size:.9rem}
nav a{color:var(--muted)}
a{color:var(--accent)}
h1{font-size:1.9rem;line-height:1.3;margin:1.4rem 0 .4rem}
h2{font-size:1.3rem;margin:2.2rem 0 .6rem;padding-top:.6rem;border-top:1px solid var(--line)}
h3{font-size:1.05rem;margin:1.6rem 0 .4rem}
blockquote{margin:1rem 0;padding:.2rem 0 .2rem 1rem;border-left:3px solid var(--line);color:var(--muted)}
pre{background:var(--code-bg);padding:.9rem 1rem;border-radius:6px;overflow-x:auto}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em}
:not(pre)>code{background:var(--code-bg);padding:.15em .35em;border-radius:4px}
table{border-collapse:collapse;width:100%;overflow-x:auto;display:block}
th,td{border:1px solid var(--line);padding:.4rem .6rem;text-align:left}
.meta{color:var(--muted);font-size:.92rem;margin:0 0 1.2rem}
.open{display:inline-block;margin:1.2rem 0 0;padding:.6rem 1.1rem;background:var(--accent);color:#fff;text-decoration:none;border-radius:6px;font-weight:600}
.cards{list-style:none;padding:0;margin:1.2rem 0;display:grid;gap:.6rem}
.cards a{display:block;padding:.8rem 1rem;border:1px solid var(--line);border-radius:8px;text-decoration:none;color:var(--fg)}
.cards a:hover{border-color:var(--accent)}
.cards small{color:var(--muted);display:block;margin-top:.2rem}

/* ─── 同一支程式，兩種看法 ───
 * ⚠️⚠️ **這一整段住在一個模板字串裡——註解裡【一顆反引號都不能有】。**
 *   同一個坑 2026-09-05 踩了兩次：在註解裡用反引號括一個 CSS 名字，
 *   當場把整個字串關掉，而 esbuild 的錯誤指向下一個看起來像語法的東西。
 *   > 一個把字串關掉的字元，它造成的錯誤訊息永遠指著別的地方。
 *   規矩：這裡的註解用「」括名字。 */
.blockmap{margin:1rem 0 1.6rem;padding:.9rem 1.1rem 1.1rem;border:1px solid var(--line);border-radius:10px;background:var(--code-bg)}
/* 🔴 這一張圖破出文字欄：內容欄是 44rem（約 704px），兩欄各 330px
 * ——積木在那個寬度下擠成一團，而「看清楚積木長什麼樣」正是它存在的理由。
 * ⚠️ 只在放得下的時候破，窄螢幕仍然乖乖待在欄內。 */
@media(min-width:1040px){.blockmap{width:min(62rem,calc(100vw - 4rem));margin-left:50%;transform:translateX(-50%)}}
.blockmap h2{font-size:1rem;margin:0 0 .2rem;border:none;padding:0}
.blockmap p.meta{margin:0 0 .9rem}
.bm-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:1rem;align-items:start}
@media(max-width:720px){.bm-grid{grid-template-columns:1fr}}
.bm-code{margin:0;padding:.6rem .2rem;background:var(--bg);border:1px solid var(--line);
  border-radius:8px;overflow-x:auto;font:13px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace}
/* ⚠️ 積木那半也要一塊框：兩邊長得像一對，讀者才會把它們當成同一個東西的兩面。
 * 🪦 底色原本寫死 #fafafa（怕深色模式下亮色積木刺眼），而使用者 2026-09-05：
 *    「後面的背景應該用透明而不是白色」——他是對的：寫死之後那一格在深色模式
 *    是**整頁唯一一塊白**，而應用裡的畫布本來就是深的。 */
.bm-blocks{background:transparent;border:1px solid var(--line);border-radius:8px;padding:.5rem}
.bm-line{display:block;padding:0 .6rem;white-space:pre}
/* 🔴 左邊的號碼與積木上那顆圓點是**同一個編號**——讀者靠它配對。
 * 所以它不是裝飾性的行號：有對到積木的那幾行，號碼要看得出是「可以配對的」。 */
.bm-line i{display:inline-block;width:1.9em;color:var(--muted);font-style:normal;user-select:none}
.bm-line[data-blocks] i{color:var(--fg);font-weight:700}
.bm-blocks svg{width:100%;height:auto;display:block}
.howto{margin:1.6rem 0 0;padding:1rem 1.1rem;border:1px solid var(--line);border-radius:10px;background:var(--code-bg)}
.howto h2{font-size:1rem;margin:0 0 .2rem;border:none;padding:0}
.howto p.meta{margin:0 0 .9rem}
.howto figure{margin:0 0 1rem}
.howto figure:last-child{margin-bottom:0}
.howto video{width:100%;border-radius:8px;border:1px solid var(--line);display:block;background:#1e1e1e}
.howto figcaption{color:var(--muted);font-size:.88rem;margin-top:.35rem}
.lesson-nav{display:grid;grid-template-columns:1fr 1fr;gap:.7rem;margin:2.4rem 0 0}
.lesson-nav a{display:flex;flex-direction:column;gap:.15rem;padding:.8rem 1rem;
  border:1px solid var(--line);border-radius:8px;text-decoration:none;color:var(--fg)}
.lesson-nav a:hover{border-color:var(--accent)}
.lesson-nav .dir{color:var(--muted);font-size:.85rem}
.lesson-nav .next{text-align:right}
.lesson-nav .spacer{border:none}
@media(max-width:34rem){.lesson-nav{grid-template-columns:1fr}.lesson-nav .next{text-align:left}}
footer{border-top:1px solid var(--line);margin-top:3rem}
footer>div{max-width:44rem;margin:0 auto;padding:1.6rem 1.25rem 3rem;color:var(--muted);font-size:.9rem}
footer .tag{font-weight:600;color:var(--fg);display:flex;gap:.5rem;align-items:center}
footer .tag svg{width:20px;height:20px;flex:0 0 auto}
footer .links{margin-top:.9rem;display:flex;gap:.7rem;flex-wrap:wrap}
footer .links a{display:inline-flex;align-items:center;gap:.45rem;padding:.45rem .9rem;
  border:1px solid var(--line);border-radius:999px;text-decoration:none;color:var(--fg);font-weight:500}
footer .links a:hover{border-color:var(--accent);color:var(--accent)}
footer .links svg{width:17px;height:17px;fill:currentColor;flex:0 0 auto}
`.trim()

/**
 * 站徽——**內嵌，不是 `<img src>`**。
 *
 * 🔴 兩個理由：① 課文頁的賣點是「打開就在那裡」，一個 `<img>` 是一次額外往返；
 * ② `audit-lesson-pages` 的第四條**掃 `/assets/`**，外連會當場紅
 * ——那條守的正是「這幾頁不准長出相依」。
 *
 * ⚠️ 來源是 `assets/logo/semorphe-sakura.svg`（淺底用的那一版）。
 * 改 logo 的時候這裡要跟著改——**它是複製過來的**，而複製的代價寫在這裡。
 */
const LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">` +
  `<rect x="5" y="5" width="90" height="90" rx="18" fill="none" stroke="#bae6fd" stroke-width="1.5"/>` +
  `<path d="M29 32 L16 50 L29 68" stroke="#38bdf8" stroke-width="7.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="M63 32 H37 L50 50 L37 68 H63" stroke="#f472b6" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="M71 32 L84 50 L71 68" stroke="#38bdf8" stroke-width="7.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
  `</svg>`

/**
 * ⚠️ 這一份是**複製**的（`src/ui/app-shell.ts:111` 是另一份）。
 * 課文頁不 import `src/ui/`——那會把整個應用的模組圖拖進建置期的產生器裡。
 * 網址變了要兩邊一起改；而它變的機率接近零，所以複製比相依便宜。
 */
const GITHUB_URL = 'https://github.com/timcsy/semorphe'

/**
 * 頁尾那兩顆圖示——**同樣內嵌**（理由見 `LOGO`）。
 * `fill="currentColor"` 讓它們跟著連結的顏色走，hover 時一起變。
 */
const ICON_PLAY = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">` +
  `<path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11.14-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z"/></svg>`

/** GitHub 的官方 mark（octicon `mark-github`）。 */
const ICON_GITHUB = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">` +
  `<path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577` +
  ` 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7` +
  `c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998` +
  `.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22` +
  `-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405` +
  `2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22` +
  ` 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286` +
  ` 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>`

interface Shell {
  title: string
  description: string
  /** 這一頁的路徑（`/lessons/…/`）——`canonical` 與 `og:url` 用它。 */
  path: string
  crumb: string
  body: string
  /**
   * 這一頁的結構化資料（JSON-LD）。
   *
   * 🔴 **只在【說得出實話】的頁面上放**：課文頁是 `Course`，索引不是。
   * 一份與畫面內容不符的結構化資料，Google 的處置是**整站降低信任**，
   * 不是「忽略那一段」。
   */
  jsonLd?: object
}

/**
 * 每一頁的外框。
 *
 * 🔴 `title` 與 `description` **每頁都不一樣**——這是 `audit-lesson-pages`
 * 的第三條，而它是搜尋引擎最常見的失分（全站共用一組等於只有一頁）。
 */
function page(s: Shell): string {
  return `<!doctype html>
<html lang="zh-Hant">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="alternate icon" href="/favicon-32.png">
<title>${esc(s.title)}</title>
<meta name="description" content="${esc(s.description)}">
<link rel="canonical" href="${SITE}${s.path}">
<meta property="og:title" content="${esc(s.title)}">
<meta property="og:description" content="${esc(s.description)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}${s.path}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:locale" content="zh_TW">
<meta name="twitter:card" content="summary_large_image">${s.jsonLd === undefined ? '' :
`\n<script type="application/ld+json">${JSON.stringify(s.jsonLd)}</script>`}
<style>${CSS}</style>
<header><div><a class="brand" href="/">${LOGO}Semorphe</a><nav>${s.crumb}</nav></div></header>
<main>${s.body}</main>
<footer><div>
<div class="tag">${LOGO}<span>Semorphe — 程式碼、流程圖、積木，三邊同步</span></div>
<div class="links">
<a href="/" target="_blank" rel="noopener">${ICON_PLAY}開啟 Semorphe Demo</a>
<a href="${GITHUB_URL}" target="_blank" rel="noopener">${ICON_GITHUB}在 GitHub 給它一顆星</a>
</div>
</div></footer>
</html>
`
}


/**
 * 課文第一段引言當描述——**課文自己已經寫了一句話介紹**：
 * `> 把迴圈的三樣東西寫在同一行。 · ⏱ 約 25 分鐘`
 *
 * ⚠️ 抓不到就退回標題，**不要留空**（空的 description 等於沒有）。
 */
export function descriptionOf(p: LessonPage): string {
  const q = p.md.split('\n').find((l) => l.startsWith('> '))
  const lead = q?.replace(/^>\s*/, '').split(' · ')[0]?.trim()
  return `${p.track.name}：${p.lesson.title}${lead ? `——${lead}` : ''}`
}

/**
 * 上一課／下一課。
 *
 * 🔴 **順序不是這裡發明的**：它是 `readLessonsOf` 的順序，而那個順序來自
 * 資料夾名的 `01-` `02-` 編號（`lessons/README.md` 的〈編號〉那一節）。
 * 在這裡另外排一次的話，網站的順序與課程選單的順序會各走各的。
 *
 * ⚠️ **不跨軌道**：第一課的「上一課」是沒有，不是上一條軌道的最後一課
 * ——軌道是六條**平行**的路，不是一條長隊。
 */
export interface LessonNeighbours {
  readonly prev?: LessonPage
  readonly next?: LessonPage
}

/**
 * 「這一課會用到的操作」——課程宣告哪幾個，這裡把片段插進去。
 *
 * 🔴 **`preload="metadata"` 而不是 `none`**：`none` 連**第一格都不載**，
 * 於是還沒捲到的那幾支在畫面上是**一塊黑色方框**——而那看起來像壞了。
 * `metadata` 只要幾 KB 就換到一張第一格。
 *
 * > **一個為了省流量而不載的東西，如果它不載時長得像壞了，那個流量就沒省到。**
 * ⚠️ 而 `muted autoplay loop playsinline` 是「像 GIF 一樣」的那一組——
 * 少了 `muted`，多數瀏覽器不准自動播；少了 `playsinline`，iOS 會全螢幕接管。
 *
 * 🔴 每一支都要有 `figcaption`：**影片沒有字幕**，那是唯一說得出
 * 「這裡發生了什麼」的地方——也是搜尋引擎唯一讀得到的。
 */
function howToBlock(ids: readonly string[]): string {
  const items = ids
    .map((id) => interactionById(id))
    .filter((i): i is Interaction => i !== undefined)
  if (items.length === 0) return ''
  const figures = items.map((i) =>
    `<figure><video src="${i.clip}" muted autoplay loop playsinline preload="metadata"` +
    ` aria-label="${esc(i.alt)}"></video>` +
    `<figcaption><b>${esc(i.label)}</b>——${esc(i.alt)}</figcaption></figure>`).join('')
  return `<section class="howto"><h2>這一課會用到的操作</h2>` +
    `<p class="meta">看不清楚？每一段都會一直重播。</p>${figures}</section>`
}

/**
 * **同一支程式，兩種看法**——逐行對齊的程式碼 ↔ 積木。
 *
 * ## 🔴 為什麼是「對照」而不是「並排」
 *
 * 多重表徵（Ainsworth 的 DeFT）最反直覺的一條：
 *
 * > **兩個表徵並排放著，不會自己教會任何人它們是同一個東西。**
 *
 * 學習者需要**被支持著做那個翻譯**。所以這一塊做的是：
 * 滑過（或用鍵盤走到）任何一行，**對應的那幾塊積木亮起來**。
 *
 * 🟢 而那正是編輯器裡本來就有的動作（`app.ts` 的 `linkNode`：點一顆積木 →
 * 程式碼那幾行反白）。這一頁**重現的是那個手勢**，不是一張截圖
 * ——讀到這裡的人學會的，是他等一下打開編輯器要做的事。
 *
 * ## ⚠️ 亮哪幾塊：**最內層的那些**
 *
 * 一行程式碼會落在好幾塊積木的範圍裡（`int n = 1;` 在 `main` 裡、
 * `main` 在 `program` 裡）。全部亮的話等於全部沒亮。
 * 所以取**跨度最小**的那些——它們就是「這一行」本身的那幾塊。
 *
 * ## 沒有 JS 的時候
 *
 * 兩邊照樣都在，只是不會互相點亮——⚠️ 它**降級成並排**，而不是空白。
 */
function blockmapBlock(p: LessonPage): string {
  const bm = p.blockmap
  if (bm === undefined || bm.blocks.length === 0) return ''
  const lines = bm.code.split('\n')
  // 🔴 每一行帶著「這一行該亮哪幾塊」——**算在建置期**，頁面上不做這個推導。
  //    ⚠️ 那份跨度的判斷只該有一份；放到頁面的 script 裡就是第二份。
  const rows = lines.map((text, i) => {
    const line = i + 1
    // ⚠️ **只有「號碼印在積木上」的那幾行**才標成可以配對的。
    //    收尾的大括號那幾行也落在某塊積木的範圍裡，而它們沒有自己的號碼
    //    ——標了的話學生會去找一個不存在的圓點。
    // ⚠️ 舊格式的對照沒有這一格——**當成「沒有配對」而不是讓建置死掉**。
    //    「有對照而它是舊格式」由護欄說出是哪幾課（`audit-lesson-blockmaps`）。
    const paired = (bm.badgeLines ?? []).includes(line)
    return `<span class="bm-line"${paired ? ' data-blocks="1"' : ''}>` +
      `<i>${line}</i>${esc(text === '' ? ' ' : text)}</span>`
  }).join('')
  // 🔴 **只說「這是對照，而它是一個參考做法」**（2026-09-05 使用者拍板）。
  //
  //    原本這裡宣告了一句主張（「它們不是兩個東西，是同一個東西的兩種寫法」）
  //    ——而那句話是**課文的工作**（第 1 課有一整節在講它），不是一張圖的圖說。
  //
  // > **一張圖的說明只需要回答「這是什麼、怎麼看」；
  // > 「為什麼重要」是課文的事，寫在圖上只是把它說第二次。**
  //
  // ⚠️ 而「參考做法」是誠實的：同一段程式可以有別的寫法，這張圖是其中一種。
  // ⚠️ **這裡沒有自己的標題**：它坐在〈完成的樣子〉底下，而那就是它的標題。
  //    多一個 h2 會讓同一件事有兩個名字。
  return `<section class="blockmap">` +
    // ⚠️ **不要寫「左邊／右邊」**：手機上它們是上下（見 bm-grid 的斷點）。
    `<p class="meta">這一課的<b>參考做法</b>——程式碼每一行的號碼，` +
    `就印在對應的那塊積木上。</p>` +
    `<div class="bm-grid"><pre class="bm-code">${rows}</pre>` +
    `<div class="bm-blocks">${bm.svg}</div></div>` +
    // 🪦 這裡原本有一行「這張圖是產生的，不是截圖——課文改了它會跟著改」。
    //    使用者 2026-09-05：「**這句話不該給使用者看**」——他是對的：
    //    那是寫給**維護者**的（而它已經寫在 `lessons/README.md` 與這個檔的註解裡）。
    //
    // > **一句話如果它的讀者是「未來要改這個專案的人」，
    // > 那它就不該出現在學生的畫面上——那裡的每一行都要為【學生】服務。**
    `</section>`
}

/**
 * 把「兩種看法」插在**〈完成的樣子〉那段程式碼的正下方**。
 *
 * 🔴 位置就是它的教學意義：讀者剛看完那段程式碼，下一眼就該看到它變成積木。
 * 隔一段距離的話，他要**自己記住上面寫了什麼再往下對**——那正是
 * split-attention（Sweller）說最貴的那件事。
 *
 * ⚠️ 找不到那個標題就**放在最後**，不要安靜地不放。
 */
function withBlockmap(html: string, p: LessonPage): string {
  const block = blockmapBlock(p)
  if (block === '') return html
  const h = html.indexOf('完成的樣子')
  if (h < 0) return html + block
  // 🔴 **取代那個程式碼框，不是插在它後面**（2026-09-05 使用者：「甚至可以合併」）。
  //
  //    〈完成的樣子〉的程式碼與對照左半**現在逐字相同**（鷹架那幾行已經補進課文），
  //    所以並排的結果是**同一支程式在頁面上印兩次**。
  //
  // > **兩個框裡是同一份東西時，第二個框帶來的不是強調，是懷疑
  // > ——讀者會去找它們哪裡不一樣。**
  //
  // ⚠️ 而 `lesson.md` 那一側**不動**：`e2e/lessons.spec.ts` 與產生器都從那個
  //    程式碼框抽程式。合併發生在**呈現**，不在來源。
  const start = html.indexOf('<pre>', h)
  const end = html.indexOf('</pre>', h)
  if (start < 0 || end < 0) return html + block
  return html.slice(0, start) + block + html.slice(end + '</pre>'.length)
}

function navBlock(n: LessonNeighbours): string {
  if (n.prev === undefined && n.next === undefined) return ''
  const cell = (page: LessonPage | undefined, dir: '上一課' | '下一課'): string => {
    if (page === undefined) return '<span class="spacer"></span>'
    const cls = dir === '下一課' ? ' class="next"' : ''
    return `<a href="${lessonDocHref(page.lesson.id)}"${cls}>` +
      `<span class="dir">${dir === '上一課' ? '← ' : ''}${dir}${dir === '下一課' ? ' →' : ''}</span>` +
      `<span>${esc(page.lesson.title)}</span></a>`
  }
  return `<nav class="lesson-nav">${cell(n.prev, '上一課')}${cell(n.next, '下一課')}</nav>`
}

/**
 * 「25 分鐘」→ `PT25M`。
 *
 * ⚠️ 認不出來就**回 undefined**，不要猜——`timeRequired` 寫一個假的時間，
 * 是拿信任換一個欄位（結構化資料與畫面不符，Google 罰的是整站）。
 */
function isoDuration(text: string): string | undefined {
  const m = /(\d+)\s*(分鐘|分|小時)/.exec(text)
  if (!m) return undefined
  return m[2] === '小時' ? `PT${m[1]}H` : `PT${m[1]}M`
}

/**
 * 把「這一課會用到的操作」插進課文的**開頭那一段之後**。
 *
 * ⚠️ 位置要**可預測**：課文的結構是 `# 標題` → `> 一句話` → 其餘，
 * 所以插在第一個 `</blockquote>` 之後；沒有引言就插在 `</h1>` 之後。
 * 🔴 兩個都找不到就**插在最前面**——寧可位置不完美，也不要安靜地不插。
 */
function withHowTo(html: string, ids: readonly string[]): string {
  const block = howToBlock(ids)
  if (block === '') return html
  for (const tag of ['</blockquote>', '</h1>']) {
    const i = html.indexOf(tag)
    if (i >= 0) return html.slice(0, i + tag.length) + block + html.slice(i + tag.length)
  }
  return block + html
}

export function renderLesson(p: LessonPage, neighbours: LessonNeighbours = {}): string {
  const crumb = `<a href="/lessons/">課程</a> › <a href="/lessons/${encodeURIComponent(p.track.id)}/">${esc(p.track.name)}</a>`
  // 🔴 **「在編輯器打開」用的是既有的深連結**（`lessonIdFromQuery`，`core/lesson.ts`）
  //    ——不是新發明一個網址。而 `target=_blank` 是刻意的：讀到一半的人不該被踢走。
  const open = `<a class="open" href="/?lesson=${encodeURIComponent(p.lesson.id)}" target="_blank" rel="noopener">在編輯器打開這一課 →</a>`
  return page({
    title: `${p.lesson.title}｜${p.track.name}｜Semorphe`,
    description: descriptionOf(p),
    path: lessonDocHref(p.lesson.id),
    crumb,
    body: withBlockmap(withHowTo(md.render(p.md), p.lesson.interactions ?? []), p)
      + open + navBlock(neighbours),
    // 🔴 **`Course` 說的每一句都要是實話**：`provider` 是我們、`inLanguage` 是課文的語言，
    //    而 `timeRequired` 只在課程自己宣告了 `estimate` 時才寫（ISO 8601 duration）。
    //    ⚠️ 猜一個時間填進去，是拿信任換一個欄位。
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: p.lesson.title,
      description: descriptionOf(p),
      url: `${SITE}${lessonDocHref(p.lesson.id)}`,
      inLanguage: 'zh-Hant',
      isAccessibleForFree: true,
      provider: { '@type': 'Organization', name: 'Semorphe', url: SITE },
      ...(p.lesson.estimate === undefined ? {} : { timeRequired: isoDuration(p.lesson.estimate) }),
    },
  })
}

export function renderTrack(track: Track, pages: readonly LessonPage[]): string {
  const items = pages.map((p) =>
    `<li><a href="${lessonDocHref(p.lesson.id)}">${esc(p.lesson.title)}` +
    `<small>${esc(p.lesson.estimate ?? '')}</small></a></li>`).join('\n')
  return page({
    title: `${track.name}｜Semorphe 課程`,
    description: `${track.name}：${track.description ?? ''}共 ${pages.length} 課，每一課都可以直接在編輯器裡打開。`,
    path: `/lessons/${encodeURIComponent(track.id)}/`,
    crumb: `<a href="/lessons/">課程</a>`,
    body: `<h1>${esc(track.name)}</h1>` +
      `<p class="meta">${esc(track.description ?? '')} · 共 ${pages.length} 課</p>` +
      `<ul class="cards">${items}</ul>`,
  })
}

/**
 * `sitemap.xml`——**給 Google 的目錄**。
 *
 * 🔴 沒有它的代價不是「排名差」，是「**它得自己慢慢爬**」：一個沒有外部連結的
 * 新站，靠爬蟲自己發現 73 頁要很久，而 sitemap 是 Search Console 那一步的輸入。
 *
 * ⚠️ **`lastmod` 用課文檔案自己的修改時間**，不是建置時間——每次 build 都蓋成
 * 「今天」的話，這個欄位就退化成噪音，而 Google 會學會不看它。
 *
 * > **一個每次都變的「上次修改時間」，說的是建置的時間，不是內容的時間。**
 */
export function renderSitemap(
  entries: ReadonlyArray<{ readonly path: string; readonly lastmod?: Date }>,
): string {
  const url = (e: { path: string; lastmod?: Date }): string =>
    `  <url><loc>${SITE}${e.path}</loc>` +
    (e.lastmod === undefined ? '' : `<lastmod>${e.lastmod.toISOString().slice(0, 10)}</lastmod>`) +
    '</url>'
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.map(url).join('\n') + '\n</urlset>\n'
}

/**
 * `robots.txt`——**它唯一真正的工作是指出 sitemap 在哪**。
 *
 * ⚠️ 不要在這裡 `Disallow` 任何東西：這個站沒有不想被看的頁，
 * 而一條寫錯的 `Disallow` 會安靜地讓整個站消失。
 */
export function renderRobots(): string {
  return ['User-agent: *', 'Allow: /', '', `Sitemap: ${SITE}/sitemap.xml`, ''].join('\n')
}

export function renderIndex(tracks: ReadonlyArray<{ track: Track; count: number }>): string {
  const items = tracks.map(({ track, count }) =>
    `<li><a href="/lessons/${encodeURIComponent(track.id)}/">${esc(track.name)}` +
    `<small>${esc(track.description ?? '')} · ${count} 課</small></a></li>`).join('\n')
  const total = tracks.reduce((n, t) => n + t.count, 0)
  return page({
    title: 'Semorphe 課程',
    description: `${tracks.length} 條軌道、${total} 堂課：C++／Python 入門、Arduino 硬體、進階演算法與語言銜接。每一課都可以直接在編輯器裡打開。`,
    path: '/lessons/',
    crumb: '課程',
    body: `<h1>課程</h1><p class="meta">${tracks.length} 條軌道 · ${total} 堂課</p>` +
      `<ul class="cards">${items}</ul>`,
  })
}
