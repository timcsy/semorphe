/**
 * **改一個宣告的名字，參照要跟著改**（2026-09-02）。
 *
 * ## 🔴 它從哪來
 *
 * 2026-09-01 錄示範時撞到：在流程上把 `int n = 5;` 的名字改成 `total`，
 * 而 `for (int i = 0; i < n; i++)` 裡的 `n` **留在原地**——按執行才炸
 * （「變數 'n' 尚未宣告」）。
 *
 * ⚠️ 而它只有**按執行**才看得到：語義樹與三個投影都覺得自己是對的。
 *
 * > **改名是一次【重構】，而 `properties[key] = value` 只是設一個屬性
 * > ——兩者在畫面上看起來一樣，直到你去跑它。**
 *
 * ## 判準來自宣告，不是一份清單
 *
 * ```
 * 這個屬性裝的是名字嗎     `kind: 'identifier'`      ← 屬性自己說的
 * 這顆是【參照】嗎         `variableRef: true`       ← 元件自己說的
 * ```
 *
 * 🟢 於是「edited 的是定義還是使用」問得出來：**一個 identifier 屬性，
 * 而它所在的元件不是參照 ⟹ 它是定義**。
 *
 * ## ⚠️ 作用域：目前是「最近的那顆函式，否則整棵樹」
 *
 * 🔴 這**不是完整的 C++ 作用域**——區塊裡的遮蔽（`{ int n; }`）沒有處理。
 * 它是一個**說得出範圍的近似**，而近似的邊界寫在這裡而不是留給讀者猜。
 *
 * > **一個近似如果沒有說出它近似在哪裡，使用者會把它當成完整的。**
 */
import { componentTraits, isFunctionDefinition } from './component/traits'
import { registeredComponents } from './component/registry'
import { paramSpecs } from './param-spec'
import type { SemanticNode } from './types'

/**
 * 這顆元件的這個屬性，裝的是**一個名字**嗎（`kind: 'identifier'`）。
 *
 * 🔴 判準來自**屬性自己的宣告**，不是一份「哪些欄位是名字」的清單
 * ——後者會住在視圖層，而且用語言專屬的名字（P9 擋掉的形狀）。
 *
 * ⚠️ 沒膠囊化的元件回 `false`——保守：**寧可少認一個，不要認錯一個**。
 */
export function isIdentifierProperty(componentId: string, key: string): boolean {
  const c = registeredComponents().find((x) => x.componentId === componentId)
  const params = (c?.manifest as { properties?: unknown } | undefined)?.properties
  return paramSpecs(params as never).some((p) => p.name === key && p.kind === 'identifier')
}

/** 這顆元件是「指向一個變數」的那種嗎。沒宣告＝不是（保守）。 */
export function isVariableReference(componentId: string): boolean {
  return componentTraits(componentId)?.variableRef === true
}

/** 走訪：對每一顆節點做一件事。 */
function walk(node: SemanticNode, fn: (n: SemanticNode) => void): void {
  fn(node)
  for (const kids of Object.values(node.children ?? {})) {
    for (const k of (kids ?? []) as SemanticNode[]) if (k) walk(k, fn)
  }
}

/**
 * 從 `root` 往下找，回傳**包含 `target` 的最近那顆函式**；沒有就回 `root`。
 *
 * ⚠️ 用**身分比對**（`===`）而不是 id——樹上可能有兩顆長得一樣的節點。
 */
export function scopeOf(root: SemanticNode, target: SemanticNode): SemanticNode {
  let best: SemanticNode = root
  const visit = (n: SemanticNode, nearestFn: SemanticNode): void => {
    if (n === target) { best = nearestFn; return }
    const next = isFunctionDefinition(n.componentId) ? n : nearestFn
    for (const kids of Object.values(n.children ?? {})) {
      for (const k of (kids ?? []) as SemanticNode[]) if (k) visit(k, next)
    }
  }
  visit(root, root)
  return best
}

/**
 * 把作用域裡指向 `oldName` 的**參照**改成 `newName`。
 *
 * 🔴 只改**參照**——定義那一顆由呼叫端自己改（它才知道是哪個屬性）。
 *
 * @returns 改了幾顆。⚠️ **0 是合法的**（那個變數沒有人用），不是失敗。
 */
export function renameReferences(
  scope: SemanticNode, oldName: string, newName: string,
): number {
  if (oldName === newName || oldName === '') return 0
  let n = 0
  walk(scope, (node) => {
    if (!isVariableReference(node.componentId)) return
    const props = node.properties as Record<string, unknown>
    if (props.name !== oldName) return
    props.name = newName
    n++
  })
  return n
}

/**
 * 這一次編輯**是不是在改一個定義的名字**。
 *
 * ```
 * kind: 'identifier'        這個屬性裝的是名字
 * 而元件不是 variableRef     所以它是【定義】
 * ```
 */
export function isRenamingADefinition(componentId: string, key: string): boolean {
  return isIdentifierProperty(componentId, key) && !isVariableReference(componentId)
}

/**
 * 比對前後兩棵樹，認出**這是不是一次改名**。
 *
 * ## 🔴 為什麼積木那一側需要它
 *
 * ```
 * 流程   就地改一個屬性        ⟹ 改的當下就知道「舊名字是什麼」
 * 積木   整棵樹從工作區重抽    ⟹ 只拿得到「新的那一棵」
 * ```
 *
 * > **同一個缺陷在兩個視圖上，可能需要兩種修法
 * > ——而讓它們看起來一樣的，是症狀，不是原因。**
 *
 * ## 判準：形狀相同，而**恰好一格** identifier 不同
 *
 * 🔴 **多於一格就不猜**。兩個屬性同時變了可能是「改名 ＋ 改別的」，
 * 也可能是「換掉了兩個不相干的東西」——而猜錯的代價是**把別人的變數改掉**。
 *
 * > **一個靠差分推測意圖的機制，在證據不只一種解釋時，
 * > 應該什麼都不做——而不是挑一個看起來對的。**
 *
 * ⚠️ 形狀不同（有人增刪了節點）也一律回 `null`：那不是一次單純的改名。
 */
export function detectRename(
  before: SemanticNode, after: SemanticNode,
): { node: SemanticNode; oldName: string; newName: string } | null {
  const hits: { node: SemanticNode; oldName: string; newName: string }[] = []
  let shapeDiffers = false

  const pair = (a: SemanticNode, b: SemanticNode): void => {
    if (shapeDiffers) return
    if (a.componentId !== b.componentId) { shapeDiffers = true; return }
    const ap = a.properties as Record<string, unknown>
    const bp = b.properties as Record<string, unknown>
    for (const key of new Set([...Object.keys(ap), ...Object.keys(bp)])) {
      if (ap[key] === bp[key]) continue
      // ⚠️ 只有 identifier 屬性算——改一個數字或一段文字不是改名。
      if (!isIdentifierProperty(a.componentId, key)) continue
      hits.push({ node: b, oldName: String(ap[key] ?? ''), newName: String(bp[key] ?? '') })
    }
    const keys = new Set([...Object.keys(a.children ?? {}), ...Object.keys(b.children ?? {})])
    for (const k of keys) {
      const ac = (a.children?.[k] ?? []) as SemanticNode[]
      const bc = (b.children?.[k] ?? []) as SemanticNode[]
      if (ac.length !== bc.length) { shapeDiffers = true; return }
      for (let i = 0; i < ac.length; i++) if (ac[i] && bc[i]) pair(ac[i], bc[i])
    }
  }
  pair(before, after)

  if (shapeDiffers || hits.length !== 1) return null
  const hit = hits[0]
  if (hit.oldName === '' || hit.newName === '') return null
  // 🔴 改一個**參照**的名字不是改名——那是換一個指向。
  if (!isRenamingADefinition(hit.node.componentId, 'name')
    && !isRenamingADefinition(hit.node.componentId, 'NAME')) return null
  return hit
}
