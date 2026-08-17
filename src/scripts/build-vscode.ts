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
import { cpSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
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

  // 2b. 活動列的圖示。⚠️ 與上面那行**理由不同**：Blockly 的 media 是
  //     相依套件的資產（所以要複製而不是簽進版控），而 logo 是
  //     **我們自己的原始資產**——複製只是把它送進封包。
  //
  // 🔴 **必須是 mono 那張**，而理由不是美感，是**渲染機制**。
  //
  // VSCode 1.129.0 的 bundle 裡逐字（`workbench.desktop.main.js`）：
  //
  // ```
  // mask: ${c} no-repeat 50% 50%;
  // mask-size: var(--activity-bar-icon-size, ${this.options.iconSize}px);
  // -webkit-mask: ${c} no-repeat 50% 50%;
  // mask-origin: padding;
  // ```
  //
  // ⚠️ 它是 **CSS 遮罩**——**顏色全部丟掉，只有 alpha 有意義**，
  //    而宿主用 `activityBar.foreground` 自己上色。
  //
  // 於是：
  // ```
  // semorphe-dark.svg    有一個 90×90 的實心圓角矩形 → 遮罩是【一坨實心方塊】🔴
  // semorphe-sakura.svg  有外框矩形                  → 多一個框              ⚠️
  // semorphe-mono.svg    fill="none"，只有筆畫        → 遮罩就是 <Σ> 本身      🟢
  // ```
  //
  // 🔴 而第一版用了 `public/logo.svg`（＝ dark 那張的複本）——**那必定是壞的**，
  //    而它**不會報錯**：一個實心方塊也是一個合法的圖示。
  mkdirSync(join(OUT, 'assets'), { recursive: true })
  cpSync('assets/logo/semorphe-mono.svg', join(OUT, 'assets', 'logo.svg'))

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
  writeFileSync(
    join(OUT, 'dist', 'preview.html'),
    renderHtml({
      scriptSrc: './webview.js',
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
