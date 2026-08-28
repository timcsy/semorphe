/**
 * 找出 `<root>/<第一層>/<段>/*.<副檔名>` 的檔案——**不依賴 `fs.globSync`**。
 *
 * ## 為什麼不用 `fs.globSync`
 *
 * 🔴 2026-08-27 用了它，**本機（Node 22 / macOS）綠、CI（Node 24 / Linux）掃到 0**
 * ——`status-bar-language-cell` 的入口條件當場紅，而 CI 從那天起一直是紅的。
 *
 * `fs.globSync` 在 Node 22 是實驗性的，它的 `cwd` 語意在 24 變過。
 * 而這裡要的東西**只是「列兩層目錄」**——那用 `readdirSync` 就夠，
 * 沒有任何版本或平台的變數。
 *
 * > **一個在你機器上綠、在 CI 上紅的測試，
 * > 比一個兩邊都紅的更貴——它會讓人以為問題出在 CI。**
 *
 * ⚠️ 掃不到東西**回空陣列**，而呼叫端要有入口條件斷言
 * （`build-guardrail` 第 9 步）——空陣列與「真的沒有」長得一樣。
 */
import fs from 'node:fs'
import path from 'node:path'

export function findFiles(root: string, segment: string, ext = '.json'): string[] {
  const out: string[] = []
  if (!fs.existsSync(root)) return out
  for (const top of fs.readdirSync(root, { withFileTypes: true })) {
    if (!top.isDirectory()) continue
    const dir = path.join(root, top.name, segment)
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(ext)) out.push(path.join(top.name, segment, f))
    }
  }
  return out.sort()
}
