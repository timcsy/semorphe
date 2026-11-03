/**
 * **發到 npm 之前，把套件改成可發布的樣子**——只在 CI 跑（`deploy.yml` 的 `publish-npm`），repo 裡的 package.json 保持 `"private": true`。
 *
 * ## 為什麼
 * 使用者 2026-11-03 定：先發 npm，再讓 semorphe.com 從 jsDelivr 抓大檔（index.js、Monaco、Cella 的 wasm 與語言包）——
 * GitHub Pages 時好時壞（draft〈發到 npm 與套件的拆法〉§〇）。npm 上的版本是 jsDelivr 的來源。
 *
 * ## 它改什麼
 * - `version`：照 cella 的做法用時間戳 `0.1.<YYYYMMDDHHMM>`（UTC）——每一次測試全綠的主線都是一個新版本，不必有人手動遞增
 * - 拿掉 `private`；`files: ["dist"]`——只發建好的站（`dist/`），原始碼與測試不進套件
 *
 * ⚠️ 為什麼不直接把 repo 的 package.json 改成可發布：`private: true` 擋住的是「有人在本機打了 `npm publish`」。發布只該從 CI 的那一步發生。
 *
 * 用法：node tools/prepare-npm-package.mjs [時間（ISO，測試用）]  → 印出版本號
 */
import { readFileSync, writeFileSync } from 'node:fs'

export function npmVersionFor(date) {
  const p = (n) => String(n).padStart(2, '0')
  return `0.1.${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}${p(date.getUTCHours())}${p(date.getUTCMinutes())}`
}

export function publishable(pkg, version) {
  const out = { ...pkg, version, files: ['dist'] }
  delete out.private
  return out
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  const version = npmVersionFor(process.argv[2] ? new Date(process.argv[2]) : new Date())
  writeFileSync('package.json', JSON.stringify(publishable(pkg, version), null, 2) + '\n')
  console.log(version)
}
