/**
 * **C++ → C**：使用者把方言從 C++ 換到 C 時，程式換成 C 的寫法（357，跨語言互轉第一對的反方向）。
 *
 * 與 `c-to-cpp.ts` 對稱，判準也一樣：**換了之後交給 Cella 判，判決、輸出、`assumes` 相同**才算沒有失真；
 * 換不了的照實保留、說出保留了幾行（P6）。
 *
 * ## 誰負責哪一段
 *
 * ```
 * cout／cin → printf／scanf    產生器（C 方言，照判決給的型別；spec 215）
 * 標頭、`using namespace std;`  產生器（C 方言：`<iostream>` 換成 `<stdio.h>`、std 那一句不輸出）
 * new／delete → malloc／free   這裡（樹上的改寫：要看整支程式才知道換不換得了）
 * ```
 *
 * ## new／delete → malloc／free：整支程式全有或全無（與 `mallocAsNew` 同一條）
 *
 * 換的條件（任何一條不成立 ⟹ 整支保留，換錯是 UB——`delete[]` 配到 `free` 沒事，而 `free` 配到 `new` 的東西是 UB）：
 * - 每一個 `new` 都是一個指標宣告的初值、形狀是 `new T` 或 `new T[n]`（沒有建構引數、沒有 `()`／`{}`）
 * - 陣列形式的 T 是積木「乘以 sizeof」下拉選得到的型別（積木上那兩格裝得下；struct 今天整支保留）
 * - 那個名字只宣告一次，只被 `delete` 或透過它取位置（`p[i]`、`*p`、`p->x`）——別名、`p++`、傳出去 ⟹ 保留
 * - 每一個 `delete` 的對象都在名單上，而且陣列形式對得上（`new T[n]` ↔ `delete[]`）
 */
import type { SemanticNode } from '../../core/types'
import { componentTraits, isAddressable } from '../../core/component/traits'
import { newAllocShape, isNew } from '../../components/cpp/new/lift-strategy'
import { deletedPointer } from '../../components/cpp/delete/build'
import { buildFree } from '../../components/cpp/free/lift'
import { buildMalloc, isSizeofChoice } from '../../components/cpp/malloc/lift'
import { buildSizeofType } from '../../components/cpp/sizeof/lift-strategy'
import { varRefName } from '../../components/cpp/var_ref/lift'

export interface CppToCResult {
  tree: SemanticNode
  /** 換了幾處（new／delete 各算一處） */
  converted: number
  /** 保留了幾處（換了會變意思或是 UB） */
  kept: number
}

/** 宣告寫的型別（含元件宣告的型別後綴，例如指標宣告的 `*`） */
function declaredType(d: SemanticNode): string | undefined {
  if (typeof d.properties.type !== 'string') return undefined
  const suffix = componentTraits(d.componentId)?.typeSuffix
  return `${d.properties.type}${typeof suffix === 'string' ? suffix : ''}`
}

const squash = (t: string | undefined): string => String(t ?? '').replace(/\s+/g, '')

export function convertCppToC(root: SemanticNode, _types: Readonly<Record<string, string>> = {}): CppToCResult {
  const allocs = new Map<string, { elem: string; count: SemanticNode | null } | null>()
  const declCount = new Map<string, number>()
  const uses: { name: string; parent: SemanticNode }[] = []
  let news = 0, deletes = 0, ok = true

  const walk = (n: SemanticNode, parent: SemanticNode | null): void => {
    const name = typeof n.properties?.name === 'string' ? n.properties.name : null
    if (name && n.slots?.initializer) declCount.set(name, (declCount.get(name) ?? 0) + 1)
    const init = n.slots?.initializer?.[0]
    if (init && isNew(init) && name) {
      const shape = newAllocShape(init)
      // 宣告的型別要是「指到 T 的指標」，陣列形式的 T 要在下拉裡
      const fits = shape && squash(declaredType(n)) === `${squash(shape.elem)}*` && (shape.count === null || isSizeofChoice(shape.elem))
      allocs.set(name, fits ? shape : null)
      if (!fits) ok = false
    }
    if (isNew(n)) { news++; if (!parent || parent.slots?.initializer?.[0] !== n) ok = false }
    const del = deletedPointer(n)
    if (del) { deletes++; if (!varRefName(del.ptr)) ok = false }
    const ref = varRefName(n)
    if (ref && parent) uses.push({ name: ref, parent })
    for (const kids of Object.values(n.slots ?? {})) kids.forEach((k) => walk(k, n))
  }
  walk(root, null)
  if (news === 0 && deletes === 0) return { tree: root, converted: 0, kept: 0 }

  const names = new Set([...allocs].filter(([, s]) => s).map(([k]) => k))
  if (ok) {
    for (const [name] of allocs) if ((declCount.get(name) ?? 0) !== 1) ok = false
    for (const u of uses) {
      if (!names.has(u.name)) continue
      if (!(deletedPointer(u.parent) || isAddressable(u.parent.componentId))) ok = false
    }
    const checkDeletes = (n: SemanticNode): void => {
      const d = deletedPointer(n)
      if (d) {
        const shape = allocs.get(varRefName(d.ptr) ?? '')
        if (!shape || (shape.count !== null) !== d.isArray) ok = false
      }
      for (const kids of Object.values(n.slots ?? {})) kids.forEach(checkDeletes)
    }
    checkDeletes(root)
  }
  if (!ok || names.size === 0) return { tree: root, converted: 0, kept: news + deletes }

  const rewrite = (n: SemanticNode): SemanticNode => {
    const d = deletedPointer(n)
    if (d) return buildFree(d.ptr)
    const slots: Record<string, SemanticNode[]> = {}
    for (const [slot, kids] of Object.entries(n.slots ?? {})) {
      slots[slot] = kids.map((k) => {
        if (slot === 'initializer' && isNew(k) && typeof n.properties.name === 'string') {
          const shape = allocs.get(n.properties.name)!
          // `new T[n]` → `(T*)malloc(n * sizeof(T))`；`new T` → `(T*)malloc(sizeof(T))`（轉型照 c-bridge 課文的寫法，C 與 C++ 都合法）
          return shape.count
            ? buildMalloc(`${shape.elem}*`, shape.count, shape.elem)
            : buildMalloc(`${shape.elem}*`, buildSizeofType(shape.elem), 'none')
        }
        return rewrite(k)
      })
    }
    return { ...n, slots }
  }
  return { tree: rewrite(root), converted: news + deletes, kept: 0 }
}
