/**
 * `cpp:print` 的 **execute** 路——從共用檔原封剪過來（批次第三十九批）。
 *
 * ## 🔴 2026-09-18：它開始看串流的狀態
 *
 * `setw`／`setprecision`／`setfill`／`fixed`／`scientific` 設的東西住在
 * `runtime/stream-state.ts`（`WeakMap` 以 `ctx.io` 為鍵，一次執行一份），
 * 而**套用它們的只有這裡**——輸出那一路是唯一把值變成文字送出去的地方。
 *
 * ⚠️ **不動 `valueToString`**：那一支同時被變數面板與型別轉換呼叫，
 *    而那兩處不該受 `cout` 的設定影響。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { streamState, textForStream, padForStream } from '../../../languages/cpp/lang/runtime/stream-state'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:print', async (node, ctx) => {
      const values = node.slots.values ?? []
      const st = streamState(ctx.io as unknown as object)
      for (const valNode of values) {
        // ⚠️ **每一項都要求值**——操縱子（`fixed`／`setw(2)`）是「只有副作用」的項，
        //    跳過它等於跳過那個副作用。
        const val = await ctx.evaluate(valNode)
        if (val.type === 'string' && val.value === '\n') {
          /**
           * ⚠️ **換行不吃欄寬**：`endl` 在 C++ 裡走的是未格式化的輸出，
           * 而 `setw` 只被**格式化**的輸出消耗掉。
           */
          ctx.io.writeNewline()
          continue
        }
        const text = textForStream(val, st)
        /**
         * 🔴 **印零個字的那一項不得吃掉欄寬**（2026-09-18）。
         *
         * 操縱子求值出來是空字串，而它們就排在 `setw(2)` 與真正要印的東西之間：
         *
         * ```cpp
         * cout << setw(2) << fixed << 7;   // 那個 2 要給 7，不是給 fixed
         * ```
         *
         * ⚠️ 副作用**已經發生**（上面那行 `ctx.evaluate` 跑過了）
         * ——這裡跳過的只是「寫出去」。
         */
        if (text === '') continue
        ctx.io.write(padForStream(text, st))
      }
    })
}
