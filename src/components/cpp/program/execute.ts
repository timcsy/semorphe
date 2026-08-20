/**
 * `cpp:program` 的 **execute** 路——**跑完整棵樹，然後呼叫進入點**
 *
 * ⚠️ `'main'` 這個名字留在這裡，而**不是** `func_def` 的性狀：
 * 「哪一個函式是進入點」是**這顆（整個程式）的知識**，不是那顆函式的性質。
 * 一個叫 `main` 的函式在別的語言裡可能什麼都不是。
 *
 * ## 🔴 而 2026-08-17 那句話兌現了：進入點不只有 `main`
 *
 * 實測十段 Arduino 語料：**辨識殘差 0/10，而執行結果 `out=""` `err=""`**
 * ——`setup`／`loop` 從來沒有人呼叫，**而它不會拋錯**。
 *
 * > **一個「沒有失敗」的訊號，與一個「成功」的訊號，在報表上長得一模一樣。**
 *
 * 🟢 **而修法【不需要知道目標是什麼】**：進入點由「**樹裡有哪些函式**」決定。
 * 那正是上面那句「這顆的知識」的意思——⚠️ 我一度以為要把目標傳進執行路，
 * 而**那個資訊本來就在樹裡**。
 *
 * ```
 * main 存在        → 跑 main            C／C++ 的既有行為，不得改變
 * 否則 setup／loop → setup 一次，loop 重複
 * 都沒有           → 🔴 出聲            而在此之前是【安靜結束】
 * ```
 *
 * `main` 優先**不是偏袒 C++**——是「一個宣告了 `main` 的程式，作者的意圖是明確的」。
 * 兩者都有時去猜，猜錯的代價比出聲高。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { isFunctionDefinition } from '../../../core/component/traits'
import { buildFuncCall } from '../func_call/lift'
import { loopBudget, tickLoop } from '../../../languages/cpp/core/runtime/arduino-clock'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:program', async (node, ctx) => {
      const body = node.children.body ?? []
      await ctx.executeBody(body)

      if (ctx.functions.has('main')) {
        // ⚠️ 這裡原本包了一層叫 `execFuncCall` 的 local——**而同一個檔案裡
        // 二十行外還有一個同名的執行器**。名字一樣、意思不同，剪錯一個不會報錯。
        await ctx.executeNode(buildFuncCall('main', []))
        return
      }

      const hasSetup = ctx.functions.has('setup')
      const hasLoop = ctx.functions.has('loop')
      if (hasSetup || hasLoop) {
        // ⚠️ `setup` 拋錯時**不繼續跑 `loop`**——一個初始化失敗的板子，
        // 繼續跑主迴圈只會把第一個錯誤埋在後面一長串裡。
        if (hasSetup) await ctx.executeNode(buildFuncCall('setup', []))
        // 🔴 `loop()` 依定義不終止，所以**界由外面給**（見 `arduino-clock`）：
        // 語義的界是**模擬時間**，而 `maxSteps` 是防卡死的網。兩個都要有。
        while (hasLoop && tickLoop()) {
          await ctx.executeNode(buildFuncCall('loop', []))
        }
        return
      }

      // 🔴 **頂層的敘述【本身就是進入點】。**
      //
      // ⚠️ 第一版漏了這件事，於是 144 支既有測試當場紅——而它們是對的：
      // 一個 body 裡直接放 `cout << ...` 的 `cpp:program`（測試最常見的形狀，
      // 也是「片段」的形狀）**沒有任何函式，而它跑得好好的**。
      //
      // > **「沒有進入點」與「進入點不是一個函式」是兩件事，
      // > 而只問 `functions` 的話，第二種會被誤判成第一種。**
      //
      // 判準用**宣告**（`traits.functionDefinition`）而不是猜 componentId——
      // 那是 `isFunctionDefinition` 存在的理由。
      if (body.some((n) => !isFunctionDefinition(n.componentId))) return

      // ⚠️ **空的程式不算「找不到進入點」**——它什麼都沒有。
      // 那是學生剛打開編輯器的狀態，按執行不該看到錯誤。
      // 🔴 第二版漏了這一格（`[].some()` 是 `false`），而它只紅了一支測試
      // ——**一支比 144 支難發現**。
      if (body.length === 0) return

      // 到這裡：body 裡**寫了函式，而沒有一個是進入點**。
      // **在此之前這裡是安靜結束的**，而那讓「找不到進入點」與
      // 「跑完了什麼都沒印」在報表上長得一模一樣。
      throw new RuntimeError(RUNTIME_ERRORS.NO_ENTRY_POINT, { '%1': [...ctx.functions.keys()].join(', ') })
    })
}

/** 讓呼叫端（測試／UI）說得出「跑多久」——預設見 `arduino-clock`。 */
export { loopBudget }
