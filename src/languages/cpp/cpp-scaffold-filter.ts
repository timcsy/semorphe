import type { SemanticNode } from '../../core/types'
// ⚠️ 問**性狀**不問身分——一條 if 一顆元件的話，那幾顆永遠搬不進膠囊。
import { isScaffold, isScaffoldInMain } from './core/node-traits'
// 🔴 「樹裡哪一塊是骨架」由**骨架宣告**回答（2026-08-28）——見 `EntryFunction`
import { skeletonById, canHideScaffold } from '../../core/skeleton'
// ⚠️ 少了它，沒載語言套件的路徑上 `skeletonById` 找不到東西（與 `cpp-scaffold.ts` 同一條）
import './skeletons'
import { buildProgram } from '../../components/cpp/program/lift'
import { isFunctionDefinition } from '../../core/component/traits'

/**
 * Strip scaffold nodes (include, using_namespace, func_def main wrapper, return)
 * from a semantic tree, leaving only the user's body statements.
 * Used for L0 block rendering — blocks only show the user's logic.
 */
/**
 * 🪦 **`cppStripInMainScaffold` 已於 2026-08-28 刪除。**
 *
 * 它是「`ghost` 模式下把 `main` **裡面**的鷹架剝掉」那條路的產物，而使用者否決了它：
 *
 * > 「**我又想彈的那邊也都是積木，只是不能動而已**」
 *
 * 🔴 剝掉＝拖不到＝帶不走，那條路解得掉「`return 0` 被連帶拖走」
 * ——**而代價是學生看不到它**。正解換成了拖曳策略
 * （`src/ui/panels/ghost-drag-strategy.ts`：拖曳開始前把鷹架摘出那一串）。
 *
 * ⚠️ 刪除時它是**零消費者**（只剩 `pack.ts` 的登錄與 `language-packs.ts` 的型別欄位）
 * ——一個沒有人呼叫的過濾器，讀起來像「這條路還在用」。
 */

/**
 * 把鷹架從樹裡剝掉，只留學生自己的語句——`hidden` 模式用的。
 *
 * 🔴 **「哪一顆函式是骨架」問宣告，不是寫死 `'main'`**（2026-08-28）。
 * 使用者要 Arduino 也有鷹架，而 Arduino 的骨架是 `setup` ＋ `loop`
 * ——**兩個**進入點。原本那個 `name === 'main'` 不只是名字錯，數量也錯。
 *
 * 🔴 而**兩個進入點就剝不掉**（`canHideScaffold`）：兩批語句攤平成一串之後
 * 分不回去，那不是「藏起來」，是**把資訊弄丟**。剝不掉時原樣通過
 * ——而選單那側不會把 `hidden` 端出來（`app.ts`）。
 */
export function cppStripScaffoldNodes(tree: SemanticNode, skeletonId = 'main'): SemanticNode {
  const skeleton = skeletonById(skeletonId)
  const body = tree.children.body ?? []
  const userBody: SemanticNode[] = []

  // 🔴 剝不掉的骨架（Arduino）原樣通過——見上面的說明
  if (!canHideScaffold(skeleton)) {
    return buildProgram(body.filter((n) => !isScaffold(n.componentId)))
  }
  const entry = skeleton?.entryFunctions[0]?.name

  for (const node of body) {
    // 鷹架（include／using namespace…）由元件自己宣告
    if (isScaffold(node.componentId)) continue
    // Unwrap 進入點函式 — 取出本體，跳過裡面那些「只有在這裡才是鷹架」的
    if (entry !== undefined && isFunctionDefinition(node.componentId) && node.properties.name === entry) {
      const funcBody = node.children.body ?? []
      for (const stmt of funcBody) {
        // ⚠️ 問**性狀**不問身分。而它是 `scaffoldInMain` 不是 `scaffold`：
        // `return` 只有在 main 裡才是鷹架，在別的函式裡是使用者寫的東西。
        if (isScaffoldInMain(stmt.componentId)) continue
        userBody.push(stmt)
      }
      continue
    }
    // Keep everything else (user-defined functions, etc.)
    userBody.push(node)
  }

  return buildProgram(userBody)
}
