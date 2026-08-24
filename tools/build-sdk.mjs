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
import { writeFileSync } from 'node:fs'

const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' })
run('npx', ['vite', 'build', '--config', 'vite.sdk.config.ts'])
run('npx', ['tsc', '-p', 'tsconfig.sdk.json'])
writeFileSync(
  'dist-sdk/semorphe.d.mts',
  '// 由 tools/build-sdk.mjs 產生——型別的門面\nexport * from \'./types/sdk/index\'\n',
)
console.log('dist-sdk/semorphe.mjs ＋ semorphe.d.mts 完成')
