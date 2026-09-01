/**
 * 「這個 `~/.vscode/extensions/` 底下的目錄，是不是【我們的】？」
 *
 * 🔴 2026-09-01：`install-ide.mjs` 檔頭那句話第三次以新形狀出現。
 * 第一版用 `entry.startsWith(id + '-')` 比對，而 `id` 是 `publisher.name`
 * ——於是 **publisher 改名那天，它認不出舊的**：
 *
 * ```
 * semorphe.semorphe-vscode-0.10.4   ← 舊 publisher，留在原地沒被刪
 * timcsy.semorphe-vscode-0.11.7     ← 新的
 * ```
 *
 * ⚠️ 而 VSCode **兩個都載**，兩邊註冊同一組指令 id（`semorphe.openBlocks`…）。
 * 它一樣不報錯。
 *
 * > **身分的哪一段會變，哪一段就不能拿來當「認得出自己」的鍵。**
 * > publisher 會變、版本會變，**擴充的 name 不會**——所以只比對 name。
 *
 * ⚠️ 這一支獨立成檔的理由是**可測**：`install-ide.mjs` 頂層就在裝東西，
 * 而且找不到 vsix 會 `process.exit(1)`——import 它會殺掉測試行程。
 */
export function isOurVscodeDir(entry, name) {
  // VSCode 的目錄名是 `publisher.name-version`；publisher 不參與比對。
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|\\.)${escaped}-\\d`).test(entry)
}
