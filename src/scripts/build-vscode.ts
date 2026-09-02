/**
 * 建擴充：兩個 Vite 目標 → 寫 manifest → 複製 media → `vsce package`。
 *
 * ## 🔴 Blockly 的 media 為什麼是「複製」而不是「簽進版控」
 *
 * 與 `vite.config.ts:23-32` 同一條理由，逐字：
 *
 * > 簽進去的話，升級 Blockly 時圖示會**默默停在舊版**——而那與上面那個
 * > 缺陷是同一族（安靜地不對）。從 `node_modules` 複製**在構造上不可能失同步**。
 *
 * ## 順帶產出一個 `preview.html`
 *
 * ⚠️ 它**不是**給使用者的，是給 Chromium 預檢用的（`quickstart.md` 第三節）：
 * 同一份 `webview.js`，同一份 HTML 產生器，只是把 webview URI 換成相對路徑。
 *
 * 🔴 **而 Chromium 的數字不是 Arduino IDE 的結論**——
 * 那正是 `history/076` 那個錯的形狀（在 A 環境驗、宣稱 B 環境成立）。
 */
import { cpSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { buildManifest } from '../vscode/manifest'
import { csp, renderHtml } from '../vscode/webview-html'

const OUT = 'build/vscode'
const run = (cmd: string, args: string[], env: NodeJS.ProcessEnv = {}, cwd?: string): void => {
  execFileSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env }, cwd })
}

function main(): void {
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(join(OUT, 'dist'), { recursive: true })

  // 1. 兩個 Vite 目標。⚠️ webview 先跑（它 emptyOutDir），extension 後跑。
  const vite = ['vite', 'build', '--config', 'vite.vscode.config.ts']
  run('npx', vite, { SEMORPHE_VSCODE_TARGET: 'webview' })
  run('npx', vite, { SEMORPHE_VSCODE_TARGET: 'extension' })

  // 2. Blockly 的圖示與音效——見檔頭。
  cpSync('node_modules/blockly/media', join(OUT, 'dist', 'media'), { recursive: true })

  // 2b. 指令的圖示。⚠️ 與上面那行**理由不同**：Blockly 的 media 是
  //     相依套件的資產（所以要複製而不是簽進版控），而 logo 是
  //     **我們自己的原始資產**——複製只是把它送進封包。
  //
  // 🔴 **兩個檔，因為 VSCode 有兩種截然不同的圖示機制**：
  //
  // ```
  // 活動列的容器圖示   CSS 遮罩 → 顏色【全部丟掉】，宿主自己上色 → 一個檔就夠
  // 指令的圖示         當【圖片】渲染 → 依主題在 light/dark 兩個檔之間切換
  // ```
  //
  // 遮罩那條的逐字出處（VSCode 1.129.0 `workbench.desktop.main.js`）：
  // `mask: <url> no-repeat 50% 50%; mask-size: var(--activity-bar-icon-size, …)`
  //
  // ⚠️ 本輪用的是**後者**（面板改成編輯器分頁之後就沒有活動列容器了），
  //    所以**顏色會真的顯示出來**：
  //
  // ```
  // light 主題 → semorphe-mono.svg        (#334155 深板岩)
  // dark  主題 → semorphe-mono-light.svg  (#c5c5c5 淺灰)
  // ```
  //
  // 🔴 而更早的一版用了 `public/logo.svg`（＝ `semorphe-dark.svg` 的複本，
  //    有一個 90×90 的實心圓角矩形）。在遮罩機制下它是**一坨實心方塊**
  //    ——而它**不會報錯**：一個實心方塊也是一個合法的圖示。
  mkdirSync(join(OUT, 'assets'), { recursive: true })
  cpSync('assets/logo/semorphe-mono.svg', join(OUT, 'assets', 'logo-light-theme.svg'))
  cpSync('assets/logo/semorphe-mono-light.svg', join(OUT, 'assets', 'logo-dark-theme.svg'))
  // 🔴 **擴充圖示**——市集清單上那一格。與上面兩個指令圖示是不同的東西，
  //    而它**必須是 PNG**（市集不吃 SVG，且下限 128×128）。
  cpSync('assets/logo/semorphe-dark-256.png', join(OUT, 'assets', 'icon.png'))

  // 2c. tree-sitter 的 wasm —— `code → blocks` 要用它。
  //
  // ⚠️ **不從 CDN 抓**：第四十五條護欄守的是「執行期零外部請求」，
  //    而 Webview 的 CSP 也會擋掉。封包因此從約 470 KB 長到約 4 MB
  //    ——**那是預期之內的代價**，寫在 spec 139 的 Complexity Tracking。
  //
  // 🔴 而它需要 CSP 的 `'wasm-unsafe-eval'`（見 `webview-html.ts`）：
  //    沒有它 `WebAssembly.compile` 會丟一個**可被 catch 的 CompileError**。
  for (const w of ['tree-sitter-cpp.wasm', 'web-tree-sitter.wasm']) {
    cpSync(join('public', w), join(OUT, 'dist', w))
  }

  // 2d. 工具列的 logo。
  //
  // ⚠️ `ui/app-shell.ts` 的工具列寫的是**相對路徑** `logo.svg`——網頁版靠
  //    頁面的 base URL 解析。而在這裡頁面的位置是 `dist/`，所以檔案要在那裡。
  //
  // 🔴 **刻意不改 app-shell** ——那會動到網頁版，而這一刀的硬條件是
  //    「網頁版一個像素都不能變」。**把檔案放到它找得到的地方，比改它去找檔案安全。**
  cpSync('public/logo.svg', join(OUT, 'dist', 'logo.svg'))

  // 3. 擴充的宣告。
  //
  // 🔴 版本號來自 `manifest.ts` 自己的 `EXTENSION_VERSION`，**不是根 package.json**。
  //    第一版用了根的，而那讓「改了 contributes 卻沒換版本」變成可能
  //    ——後果是 VSCode 上的活動列圖示**沒有更新而且不報錯**。理由寫在那個檔裡。
  writeFileSync(join(OUT, 'package.json'), JSON.stringify(buildManifest(), null, 2) + '\n')
  // vsce 沒有 README 會擋下來（不是警告，是錯誤）。
  //
  // 🔴 **而這一份【就是市集頁面的正文】**，不是一個湊數的檔案。
  //
  // 2026-08-31 上架前量到的：它當時是 168 位元組，逐字寫著
  // 「⚠️ 這是階段 6.13 的第一刀……**雙向同步尚未實作**」
  // ——那句話寫於 2026-08-17，而雙向同步早就是這個專案的主打。
  //
  // > **一份「先湊著、之後再說」的 README，在上架的那一天
  // > 會變成公開頁面上唯一有人讀的東西。**
  //
  // ⚠️ 圖片**必須用絕對網址**：市集不會去解析相對路徑
  //    （`vsce` 沒有 `--baseContentUrl` 時直接擋下來）。
  writeFileSync(join(OUT, 'README.md'), marketplaceReadme())
  // 🔴 `license: 'MIT'` 在 manifest 裡宣告了兩個月，而**倉庫裡沒有那個檔**
  //    ——所以打包一直靠 `--skip-license` 繞過去，而市集頁面的 License 那一欄
  //    會是空的。2026-08-31 補上根目錄的 `LICENSE` 之後，那個旗標可以拿掉。
  cpSync('LICENSE', join(OUT, 'LICENSE'))

  // 4. Chromium 預檢頁——同一份 HTML 產生器，相對路徑。
  //
  // 🔴 **假宿主**：讓 `acquireVsCodeApi()` 在 Chromium 裡也存在，
  //    把送出去的訊息記在 `window.__SENT__`。
  //    沒有它的話 `postToHost` 靜靜地不做事，而預檢會把
  //    **「積木 → 程式碼 完全沒送出去」顯示成一切正常**。
  //    ⚠️ 這個檔【只寫進預檢頁】——真面板的 HTML 不含它。
  writeFileSync(
    join(OUT, 'dist', 'host-stub.js'),
    readFileSync('src/vscode/webview/host-stub.js', 'utf8'),
  )
  writeFileSync(
    join(OUT, 'dist', 'preview.html'),
    renderHtml({
      preScripts: ['./host-stub.js'],
      scriptSrc: './webview.js',
      styleSrc: './webview.css',
      mediaSrc: './media/',
      // 🔴 **用同一個 `csp()` 函式**，只把來源換成 `'self'`。
      //
      // 第一版這裡自己寫了一條寬鬆的 CSP，結果預檢頁噴滿
      // 「Applying inline style violates…」——**而真面板不會**（它有
      // `style-src 'unsafe-inline'`）。兩份 CSP ＝ 兩個真相，
      // 而預檢頁的意義正是「先在這裡撞到，不要到 IDE 才撞」。
      //
      // ⚠️ 那次噴錯本身是有價值的：它**實測證實**了 Blockly 確實注入行內樣式，
      //    所以 `style-src 'unsafe-inline'` 不是推論，是量到的。
      csp: csp(`'self'`),
    }),
  )
  // ⚠️ **每一種視窗各一份預檢頁**（2026-09-01）——`data-view` 是 HTML 上的
  //    屬性，而模組一載入就讀它，所以「開好之後再改」來不及。
  //
  // > **一個在啟動時就被讀走的參數，測試環境必須在【啟動之前】給它。**
  // 🔴 `'state'` 拆成 `'console'`／`'variables'`（2026-09-02，spec 171 第二刀）
  //    ——它們是宿主 panel 區的**兩個原生分頁**。
  for (const view of ['flow', 'console', 'variables'] as const) {
    writeFileSync(
      join(OUT, 'dist', `preview-${view}.html`),
      renderHtml({
        preScripts: ['./host-stub.js'],
        scriptSrc: './webview.js',
        styleSrc: './webview.css',
        mediaSrc: './media/',
        csp: csp(`'self'`),
        view,
      }),
    )
  }

  // 5. 打包。⚠️ `vsce` 以 **cwd** 為擴充根目錄——不切過去的話它會讀到
  //    網頁版那份 `package.json`，而那份沒有 `engines.vscode`。
  run(
    'npx',
    ['vsce', 'package', '--no-dependencies', '--out', 'semorphe-vscode.vsix'],
    {},
    OUT,
  )
}

/**
 * 市集頁面的正文。
 *
 * 🔴 **與根 `README.md` 刻意不同**——那一份的讀者是「路過 GitHub 的人」，
 * 這一份的讀者**已經在編輯器裡了**：他要知道的是「裝了之後按哪裡」。
 *
 * ⚠️ 圖片一律絕對網址（見呼叫端的理由），而且**不可以是 SVG**：
 * `vsce` 直接擋下來（`SVGs are restricted in README.md`）——不是警告，是錯誤。
 * 根 `README.md` 用的是 SVG，所以從那裡抄過來的第一版打不出包。
 */
function marketplaceReadme(): string {
  const RAW = 'https://raw.githubusercontent.com/timcsy/semorphe/main'
  return `<p align="center">
  <img src="${RAW}/assets/logo/semorphe-dark-256.png" width="112" height="112" alt="Semorphe">
</p>

<h1 align="center">Semorphe</h1>

<p align="center">
  <strong>同一支程式，三種看法——程式碼、流程圖、積木。改哪一邊都算數。</strong>
</p>

---

把真的 C++ 或 Python 貼進去，它變成積木；拖一塊積木，程式碼跟著變；
切到流程圖，它畫的是同一支程式。**三邊都可以編輯，三邊即時同步。**

<p align="center">
  <img src="${RAW}/assets/demo.gif" width="820" alt="打字 → 積木長出來 → 在積木上改一個字 → 程式碼跟著變">
</p>

## 裝好之後按哪裡

1. 開一個 \`.cpp\`、\`.py\` 或 \`.ino\`（新檔案也行，把語言選成 C++ 就會出現）
2. 編輯器右上角的 \`<Σ>\` 圖示，或命令面板 → **Semorphe: 開啟積木面板**
3. 面板在**編輯器區域**開起來，跟你的檔案並排——改哪一邊都會同步到另一邊

狀態列上還有目標、風格、積木外觀、語言四個切換，以及 ▷ 執行。

## 它跟別的積木工具差在哪

多數積木工具是**單向**的：積木能變成程式碼，而程式碼變不回積木。
少數做到雙向的，走出它支援的子集就回不去。

| | |
|---|---|
| **三個畫面都能編輯** | 程式碼、流程圖、積木——不是「一個能改 ＋ 兩個唯讀」 |
| **吃的是真的程式碼** | 貼一段你手邊的 \`.cpp\` 或 \`.py\` 進去，不是玩具子集 |
| **接不住的時候它會說** | 認不出來的語法**不會被丟掉，也不會被猜**——它變成一顆灰色積木，原文一字不動地放在裡面 |

第三點聽起來不像賣點，而它是：**它保證這個工具不會安靜地弄壞你的檔案。**

## 還有這些

- **由淺入深**——66 堂課、6 條軌道（C++ 入門／進階、C 銜接、Python 入門／銜接、Arduino 專題）。工具箱只給這一堂該有的積木
- **骨架看得到、拆不壞**——\`#include\`、\`int main()\` 這些「不是你寫的」那幾行，可以藏起來、可以淡淡地顯示（看得到而拖不動）、也可以整個交給學生
- **多種程式碼風格**——APCS（\`cout\`/\`cin\`）、競賽（\`printf\`/\`scanf\`）、Google、Python 一鍵切換
- **硬體**——8 塊板子（Uno／Nano／ESP32 家族／D1 mini…），各有自己的腳位、常數與函式庫標頭
- **離線可用**——跑起來之後**不會向外要任何東西**（有一條測試守著）

## ⚠️ 現在做不到什麼

- **語言**只有 C++（含 C 方言）與 Python
- **認不出來的語法會降級成灰色積木**。它跑得動、來回轉換不會壞，但它在積木上就是一塊灰的
- **Arduino IDE 沒有自動更新**——它把擴充市集對使用者關掉了，只能手動放 \`.vsix\`
- **流程圖是新的**（2026-08），它的編輯能力還在長

## 不想裝？

<https://semorphe.com/> — 同一套東西，開瀏覽器就能用。

---

MIT · [原始碼與問題回報](https://github.com/timcsy/semorphe)
`
}


main()
