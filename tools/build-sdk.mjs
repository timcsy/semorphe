/**
 * 出貨 `dist-sdk/`：一份可攜的 ESM ＋ 它的型別。
 *
 * ```
 * vite build   膠囊在這一步被靜態展開進產物（import.meta.glob 是 Vite 的轉換）
 * tsc          .d.ts——【型別也是公開介面的一部分】
 * ```
 *
 * 🔴 消費者拿到的是普通 ESM，**用什麼建置工具都行**。
 *    `examples/bring-your-own-view/` 用 esbuild 建它，而那正是這件事的證明。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' })
run('npx', ['vite', 'build', '--config', 'vite.sdk.config.ts'])
run('npx', ['tsc', '-p', 'tsconfig.sdk.json'])
writeFileSync(
  'dist-sdk/semorphe.d.mts',
  '// 由 tools/build-sdk.mjs 產生——型別的門面\nexport * from \'./types/sdk/index\'\n',
)

/**
 * 🔴 **出貨的東西要說得出自己是哪一版**（2026-09-06 補）。
 *
 * 在此之前 `dist-sdk/` 只有 `.mjs` ＋ `.d.mts`——**一份沒有版本號的公開介面**。
 * 而 vision「元件套件管理」的第一個驗收逐字是：
 * 「`dist-sdk` 有版本號，而**破壞性改版說得出破壞了什麼**」。
 *
 * ## ⚠️ 為什麼是根 `package.json`，而不是 `EXTENSION_VERSION`
 *
 * 這個 repo 有**兩個版本號，而它們刻意不同步**：
 *
 * ```
 * package.json         0.1.0     @semorphe/core——【還沒發布過 npm】
 * EXTENSION_VERSION    0.16.0    semorphe-vscode——市集上的那一個
 * ```
 *
 * `EXTENSION_VERSION` 有自己的理由（`src/vscode/manifest.ts`：
 * 「一個宿主用版本號決定『要不要重讀』的東西，就不能拿一個不會變的數字
 * 當版本號」——改了 `contributes` 就要動它）。
 *
 * 🔴 而核心是**另一件產物**：`0.1.0` 是誠實的，因為它真的還沒發布過。
 * 拿 `0.16.0` 出貨會讓消費者以為這個介面已經穩定了十六輪。
 *
 * > **一個版本號說的是「這個東西的歷史」，不是「這個 repo 的歷史」
 * > ——兩個產物共用一個數字，說的就是別人的歷史。**
 *
 * ## 🟢 什麼時候動根 `package.json` 的版本
 *
 * **公開面變了的時候**——而那件事有機械檢查：第一百零六條護欄
 * （`tests/integration/audit-sdk-surface.test.ts`）盯著
 * `src/sdk/index.ts` 的每一個匯出名。它紅的那一刻，就是該動版本的那一刻。
 *
 * ⚠️ 那條護欄**不會自己改版本號**——它只讓你知道現在該想這件事。
 *
 * 🟢 而「破壞了什麼」那一半住在第一百零六條護欄
 * （`tests/integration/audit-sdk-surface.test.ts`）：公開面的每一個名字
 * 記在基線裡，**移除或改名要顯式下調**。
 */
const root = JSON.parse(readFileSync('package.json', 'utf8'))
writeFileSync('dist-sdk/package.json', JSON.stringify({
  name: '@semorphe/core',
  version: root.version,
  description: '唯一真實，各式投影——核心的公開入口',
  type: 'module',
  main: './semorphe.mjs',
  module: './semorphe.mjs',
  types: './semorphe.d.mts',
  exports: { '.': { types: './semorphe.d.mts', import: './semorphe.mjs' } },
  license: root.license ?? 'MIT',
  repository: root.repository,
}, null, 2) + '\n')

console.log(`dist-sdk/semorphe.mjs ＋ semorphe.d.mts ＋ package.json（v${root.version}）完成`)
