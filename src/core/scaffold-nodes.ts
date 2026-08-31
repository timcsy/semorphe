/**
 * **畫布上哪幾顆節點是骨架**——唯一的一份判定。
 *
 * ## 🔴 它為什麼住在 core
 *
 * 這個判定原本是 `ui/app.ts` 的私有方法，而 2026-08-30 流程視圖也要問同一件事。
 *
 * 「哪一塊是外框」這個決定在 2026-08-28 之前**有六份各自的實作**
 * （[history/188]）——其中一份還是算完就 `void` 掉的死碼。
 * 所以這裡不再種第七份：**兩個消費者呼叫同一支函式。**
 *
 * > **一份宣告如果只說得出「外框印出來長怎樣」，
 * > 那「畫面上哪一塊是外框」就會回去寫死在消費者身上。**
 *
 * ## 這個模組不做什麼
 *
 * - **不決定怎麼畫**——那是每個視圖自己的事（P1：唯一真實，各式投影）。
 *   它只回答「這幾顆是」。
 * - **不看顯示深度**——`hidden`／`ghost`／`editable` 是消費端的決定。
 */
import { componentTraits, isFunctionDefinition } from './component/traits'
import { skeletonById, entryFunctionOf } from './skeleton'

interface Node {
  id: string
  componentId: string
  properties?: Record<string, unknown>
  children?: Record<string, unknown[]>
}

/** 🔴 **問性狀不問身分**——`scaffold` 由元件自己宣告。 */
function isScaffoldComponent(componentId: string): boolean {
  return componentTraits(componentId)?.scaffold === true
}

/** ⚠️ `return` 只有**在進入點函式裡**才是骨架——在別的函式裡是使用者寫的東西。 */
function isScaffoldInEntryComponent(componentId: string): boolean {
  return componentTraits(componentId)?.scaffoldInMain === true
}

function addSubtree(node: Node, out: Set<string>): void {
  out.add(node.id)
  for (const k of Object.keys(node.children ?? {})) {
    for (const c of (node.children![k] ?? []) as Node[]) addSubtree(c, out)
  }
}

/**
 * 這棵樹裡哪幾顆節點是骨架。
 *
 * 🔴 **「哪一顆函式是骨架」問骨架宣告**——寫死 `'main'` 的話，Arduino 上
 * 把顯示切成「淡的」會**什麼都不變**。而它有【兩顆】（`setup`／`loop`），
 * 所以這裡不能只找一顆。
 */
export function scaffoldNodeIds(tree: unknown, skeletonId: string): Set<string> {
  const out = new Set<string>()
  const root = tree as { children?: Record<string, unknown[]> } | null | undefined
  if (!root) return out
  const skeleton = skeletonById(skeletonId)
  for (const node of (root.children?.body ?? []) as Node[]) {
    if (isScaffoldComponent(node.componentId)) { addSubtree(node, out); continue }
    if (isFunctionDefinition(node.componentId) && entryFunctionOf(skeleton, node.properties?.name)) {
      out.add(node.id)
      for (const stmt of (node.children?.body ?? []) as Node[]) {
        // ⚠️ **連它插著的東西一起**——`return 0` 的那個 `0` 也是骨架的一部分。
        //    少了它，一顆實心的 `0` 插在一塊淡的「回傳」上，看起來像
        //    「這個數字是我要改的」——而它不是。
        if (isScaffoldInEntryComponent(stmt.componentId)) addSubtree(stmt, out)
      }
    }
  }
  return out
}

/**
 * 那幾顆骨架**用到哪些元件**。
 *
 * 🔴 它存在的理由是「**課程不必宣告骨架用了什麼**」：在此之前 65 堂課每一堂
 * 都列著 `func_def` 與 `return`，而那張表**同時在驅動工具箱**
 * ——於是第 1 課的工具箱裡有「函式」那一格（[history/190]）。
 */
export function scaffoldComponentIds(tree: unknown, skeletonId: string): Set<string> {
  const ids = scaffoldNodeIds(tree, skeletonId)
  const out = new Set<string>()
  const walk = (n: Node): void => {
    if (n.id !== undefined && ids.has(n.id) && n.componentId) out.add(n.componentId)
    for (const kids of Object.values(n.children ?? {})) {
      for (const k of (kids ?? []) as Node[]) walk(k)
    }
  }
  if (tree) walk(tree as Node)
  return out
}

/**
 * **把某一份骨架的外框拆掉**，把它裡面的語句提到頂層。
 *
 * 🔴 它今天唯一的消費者是**換骨架前的那句問話**：「這個檔案裡除了骨架本身，
 * 還有沒有東西？」——不扣掉框的話，一支空的 `int main(){ return 0; }`
 * 也算「有作品」，於是每一次換骨架都會被問，而那時清掉的其實什麼都不是。
 *
 * > **一句「你的東西會不見」的警告，在其實沒有東西的時候，
 * > 教會使用者的是「這個問句可以無視」。**
 *
 * ⚠️ **它與 `stripScaffoldNodes` 不是同一件事**，而差別是**可不可逆**：
 *
 * ```
 * stripScaffoldNodes   「藏起來」——可逆，所以兩個進入點時它【不做】
 *                        （兩批語句攤平之後分不回去 ＝ 把資訊弄丟）
 * unwrapSkeletonFrame  「換掉」——**單向**，攤平是這個操作的定義
 * ```
 *
 * > **同一個動作在可逆與不可逆的情境下，該有不同的答案。
 * > 把它們合成一個函式，會讓其中一邊永遠拿到另一邊的保守值。**
 *
 * 🟢 `return 0` 這種「只在進入點裡才是骨架」的語句一起拆掉——留著它
 * 會在新骨架裡變成一句學生沒寫過、也看不懂的程式。
 */
export function unwrapSkeletonFrame(tree: unknown, skeletonId: string): unknown {
  const root = tree as { children?: Record<string, Node[]> } | null | undefined
  if (!root?.children?.body) return tree
  const skeleton = skeletonById(skeletonId)
  if (!skeleton || skeleton.entryFunctions.length === 0) return tree
  const body: Node[] = []
  for (const node of root.children.body) {
    // 🔴 **鷹架元件也要扣掉**（`using namespace std;`／`#include`）——它們是骨架
    //    的一部分，換骨架時新的那份會自己補。
    //    ⚠️ 少了這一行，一支【空程式】在「淡的」模式下也算「有作品」
    //    （樹裡有 `using namespace`），於是每次換骨架都跳警告。
    if (isScaffoldComponent(node.componentId)) continue
    if (isFunctionDefinition(node.componentId) && entryFunctionOf(skeleton, node.properties?.name)) {
      for (const stmt of (node.children?.body ?? []) as Node[]) {
        if (isScaffoldInEntryComponent(stmt.componentId)) continue
        body.push(stmt)
      }
      continue
    }
    body.push(node)
  }
  return { ...root, children: { ...root.children, body } }
}
