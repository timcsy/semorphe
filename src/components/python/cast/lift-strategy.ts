/**
 * `python:cast` 的 **lift** 路——認 `int(x)`／`str(x)`／`float(x)`／`bool(x)`。
 *
 * 🟢 不是那四個名字就回 `null`，比對迴圈落到下一筆樣式。
 *
 * ⚠️ **只認一個引數的**：`int("ff", 16)` 有第二個引數（進位），
 * 而這顆積木上沒有那一格——讓一般呼叫接手才不會**產出一個少了引數的呼叫**。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
// ⚠️ 裸的產生器算**一個**引數——見那個 helper 的檔頭
import { pythonCallArgs } from '../../../languages/python/call-args'

// ⚠️ `list` 加入日 2026-08-22——`list(map(...))`／`list(d.keys())` 是
//    「把走訪得到的東西收成一串」，教學語料裡到處都是。
//
// 🔴 **`set` 加入日 2026-08-23，而它上面那一行本來寫著「刻意不加」**：
//    理由是「這個直譯器沒有集合型別，`set(xs)` 只是去重」——而 2026-08-22
//    集合字面（`{1, 2}`）進來時 `seqKind: 'set'` 一起做了，**那個理由當天就過期**。
//    > **一條「現在還不需要」的理由，會在條件變了之後繼續被當成「永遠不需要」。**
//    ⚠️ `tuple`／`dict` 仍然不加——**內建表裡沒有它們**（已查證），
//    加了會在執行期丟一個「不是函式」而不是一個說得清楚的邊界。
const TARGETS = new Set(['int', 'str', 'float', 'bool', 'list', 'set'])

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_cast', (node, ctx) => {
    const name = node.childForFieldName('function')?.text ?? ''
    if (!TARGETS.has(name)) return null
    const args = pythonCallArgs(node)
    if (args.length !== 1) return null
    const value = ctx.lift(args[0])
    // 引數認不出來 → 整顆降級，不產出一個空著的轉換
    if (!value) return null
    return createNode('python:cast', { target_type: name }, { value: [value] })
  })
}
