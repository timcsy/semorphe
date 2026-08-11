/**
 * **`CodeMapping` 的查詢** —— 語義節點 ↔ 文字投影的座標
 *
 * ⚠️ 這個模組為什麼在 `core/projection/` 而不是在 `ui/panels/monaco-panel.ts` 裡：
 * `CodeMapping` 這個型別本來就住在這一層（`code-generator.ts`），
 * 而**持有**那份對映、決定拿它做什麼的是程式碼視圖。
 *
 * > **定義一個座標系的地方，與住在那個座標系裡的地方，不必是同一個。**
 *
 * （實務上還有一個理由：`monaco-panel.ts` import 了 `monaco-editor`，
 * 而那個套件在 Node 環境解析不了——**一個純函式住在那裡就測不到**。）
 */
import type { CodeMapping } from './code-generator'

/**
 * **斷點（行號）→ 有斷點的語義節點。**
 *
 * ⚠️ 它是一個 export 的純函式而不是私有方法，理由是**它是這條線唯一會算錯的地方**
 * ——其餘都是傳遞。而它要算對三件事：0-based 的對映 vs 1-based 的行號、
 * 區間包含（不是相等）、去重。
 *
 * 判準與它取代的那行等價（原本在 `execution-controller` 裡）：
 *
 * ```ts
 * breakpoints.some(bp => bp >= mapping.startLine + 1 && bp <= mapping.endLine + 1)
 * ```
 *
 * ⚠️ **一個節點的祖先通常也會命中**（`main` 的區間涵蓋所有行）。那不是 bug，
 * 是原本就有的語義——執行走到祖先節點時本來就會停。
 */
export function 斷點對應的節點(mappings: CodeMapping[], 斷點行: Iterable<number>): string[] {
  const bps = [...斷點行]
  const ids = mappings
    .filter((m) => bps.some((bp) => bp >= m.startLine + 1 && bp <= m.endLine + 1))
    .map((m) => m.nodeId)
  return [...new Set(ids)]
}
