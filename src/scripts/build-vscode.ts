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
  writeFileSync(
    join(OUT, 'README.md'),
    '# Semorphe\n\n唯一真實，各式投影。\n\n' +
      '⚠️ 這是階段 6.13 的**第一刀**：一個面板、一顆積木、一組效能數字。\n' +
      '雙向同步尚未實作。\n',
  )

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

  // 5. 打包。⚠️ `vsce` 以 **cwd** 為擴充根目錄——不切過去的話它會讀到
  //    網頁版那份 `package.json`，而那份沒有 `engines.vscode`。
  run(
    'npx',
    ['vsce', 'package', '--no-dependencies', '--allow-missing-repository', '--skip-license',
     '--out', 'semorphe-vscode.vsix'],
    {},
    OUT,
  )
}


main()
