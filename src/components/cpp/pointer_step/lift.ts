/**
 * `cpp:pointer_step` 的 **lift** 路——**一個帶真邏輯的分支**（引數個數是判別的一部分）。
 *
 * 🔴 **兩個名字、一顆身分**：`prev` 與 `next` 各自帶自己的 `direction`。
 * 形狀抄同族的「加到尾端」那顆（它用兩個方法名對一顆身分）。
 */
import type { SemanticNode } from '../../../core/types'
import { registerCallBranch } from '../../../core/component/lift-branches'
import { createNode } from '../../../core/semantic-tree'

/** 函式名 → 方向。⚠️ `std::` 前綴的寫法也要收（語料裡有 `std::` 的習慣）。 */
const NAMES = new Map<string, 'prev' | 'next'>([
  ['prev', 'prev'], ['std::prev', 'prev'],
  ['next', 'next'], ['std::next', 'next'],
])

export function registerLift(): void {
  registerCallBranch('cpp/pointer_step', (funcName, argChildren, ctx, _argsNode): SemanticNode | null => {
    const direction = NAMES.get(funcName)
    if (!direction) return null
    /**
     * 🔴 **一個或兩個引數**——C++ 的簽名是 `prev(it, n = 1)`。
     *
     * ⚠️ **第二個引數原本刻意不做**（探索報告③：語料 0 處，而同族的「移除」
     * 那顆做了一個常態留空的插槽、瀏覽器驗收時它刺眼）。
     * 而 2026-09-19 的**資訊隔離盲測**十支裡有**兩支**用了 `prev(it, 2)`。
     *
     * > **一個「語料 0 處」的讀數量到的是【這批語料的人怎麼寫】，
     * > 不是【這個寫法有多常見】。**
     *
     * 🔴 **三個以上就不是我**——`prev`／`next` 都是**很短的名字，使用者自己
     * 也寫得出來**（`int next(int a, int b, int c)`）。判不出來就讓開，
     * 落到泛用的函式呼叫 ⟹ 執行期誠實出聲。
     * 同族的範圍搜尋那顆逐字記過這一條。
     */
    if (argChildren.length !== 1 && argChildren.length !== 2) return null
    const pos = ctx.lift(argChildren[0])
    if (!pos) return null
    if (argChildren.length === 1) {
      return createNode('cpp:pointer_step', { direction }, { pos: [pos] })
    }
    const count = ctx.lift(argChildren[1])
    // ⚠️ 第二個引數在而 lift 不回來 ⟹ **整顆讓開**，不要安靜地當成一格
    //（那會讓 `prev(it, k)` 產出 `prev(it)`——少走 k-1 格而編得過）。
    if (!count) return null
    return createNode('cpp:pointer_step', { direction }, { pos: [pos], count: [count] })
  })
}
