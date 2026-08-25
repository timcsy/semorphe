/** `cpp:var_ref` 的 **execute** 路——從共用檔原封剪過來（批次第三十八批）。 */
import type { ComponentExecutor, ExecutionContext } from '../../../interpreter/executor-registry'
import { declareLvalue } from '../../../core/component/lvalue-nodes'
import type { RuntimeValue, Callable } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { pinConstantValue } from '../../../languages/cpp/core/runtime/arduino-pins'

/**
 * **C++ 的標準串流——它們是名字，而不是變數。**
 *
 * ## 為什麼需要這張表（2026-08-17）
 *
 * `cout < "Hello!" << endl`（`<<` 打成 `<`）被 tree-sitter 讀成
 * `(cout) < ("Hello!" << endl)`——因為 `<<` 綁得比 `<` 緊。
 * 於是 `cout` 變成一個**裸識別字**，查作用域查不到，訊息是：
 *
 * ```
 * 🔴 變數 'cout' 尚未宣告
 * ```
 *
 * ⚠️ **那是【事實錯誤】**：`cout` 在真的 C++ 裡**是宣告過的**（`std::cout`）。
 * `experience`：「**一個指錯地方的錯誤訊息，比沒有訊息更糟。**」
 *
 * 🔴 **而這一格我們說得比 clang 好**——同一段程式 clang 說
 * 「reference to overloaded function could not be resolved」而且**指著 `endl`**。
 *
 * > **委派解決的是【判斷】，不是【說法】。而這一格我們知道的比它多。**
 *
 * ## ⚠️ 為什麼在這裡而不是 `Scope`
 *
 * 中立性護欄的 `NEUTRAL_DIRS` 含 `src/interpreter`——**核心不得硬編
 * 特定語言的名字**。「`cout` 是串流」是 C++ 的事實，所以它住在 cpp 膠囊裡。
 */
const STREAMS: Record<string, string> = {
  cout: '<<',
  cerr: '<<',
  clog: '<<',
  cin: '>>',
}

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  // 🔴 **與執行器同一個生命週期**——左值解析要用到執行環境，
  //    而「這種節點可以被寫回」與「這種節點怎麼求值」是同一顆元件的兩面。
  registerLvalue()

  register('cpp:var_ref', async (node, ctx) => {
      const name = String(node.properties.name)
      // **一個識別字也可能是函式名**——`sort(v.begin(), v.end(), cmp)` 的 `cmp`。
      //
      // ⚠️ 順序是「先變數後函式」，與 C++ 的名稱查找一致：區域變數遮蔽同名函式。
      // 反過來的話，`int max = 3;` 之後的 `max` 會拿到那個函式。
      try {
        return ctx.scope.get(name)
      } catch (notAVariable) {
        const fn = ctx.functions.get(name)
        if (!fn) {
          // 🔴 **它是串流的話，「尚未宣告」是假話**——見上面那張表的說明。
          // ⚠️ 而這一段只在**已經確定查不到**之後才走到，所以
          // 正常的 `cout << x`（走 `cpp:print`）一行都沒有被影響。
          const op = STREAMS[name]
          if (op) throw new RuntimeError(RUNTIME_ERRORS.STREAM_NOT_VARIABLE, { '%1': name, '%2': op })

          // 🔴 **腳位常數也在這裡，而【只能】在這裡。**
          //
          // 第一版把 `HIGH`／`LOW`／`OUTPUT` 做成一個 lift 樣式（靠識別字的名字認），
          // 而第三十二條護欄當場抓到：語料裡的 `enum Level { LOW = -1 };`
          // 讓 `cout << LOW` 印成 **0** 而不是 **-1**——**樣式把使用者宣告的名字搶走了**。
          //
          // > **一個名字的意思由誰宣告它決定，而樣式比對看不到宣告。**
          //
          // ⚠️ 接在這裡就沒有那個問題：**走到這一行代表查過了，沒有人宣告它**。
          const pin = pinConstantValue(name, ctx.board)
          if (pin !== undefined) return { type: 'int', value: pin }

          // 🔴 **而串流的名字也要進近似名的候選**——`Cout` 大小寫打錯時，
          // 作用域裡沒有 `cout`（它不是變數），所以 `Scope` 那一側找不到。
          // ⚠️ 那是同一個根因的另一面：**候選集合少了「語言自己的名字」**。
          //
          // 🔴 **而這裡只認【大小寫】，不認編輯距離**——測試當場抓到
          // `couty` 被誤認成 `cout`（距離 1、兩邊都 ≥4）。
          //
          // > **一個使用者自己取的名字，長得像函式庫的名字，是常態不是打錯。**
          //
          // 變數那一側可以用編輯距離，因為候選是**他自己宣告過的**；
          // 這一側的候選是**我們塞進去的**，所以門檻要更高。
          const lower = name.toLowerCase()
          const near = Object.keys(STREAMS).find(k => k !== name && k === lower)
          if (near !== undefined) {
            throw new RuntimeError(RUNTIME_ERRORS.STREAM_NOT_VARIABLE_SUGGEST,
              { '%1': name, '%2': near, '%3': STREAMS[near] })
          }
          throw notAVariable
        }
        // 包成與 lambda 相同的可呼叫值——**不為函式指標發明第二種表示**。
        //
        // ⚠️ `capture: ''`——一個具名函式**看不到呼叫端的區域變數**。
        // `closure` 仍給當下的作用域是因為 `capture: ''` 已經讓
        // `lambdaScope` 建一個空的父層（見 `runtime/lambda.ts`），
        // 所以那個值不會被用來查名字。
        const callable: Callable = {
          params: fn.params,
          body: fn.body,
          capture: '',
          closure: ctx.scope,
        }
        return { type: 'function', value: callable } as RuntimeValue
      }
    })
}

/**
 * **我可以被寫回**——一個名字（`x`），寫回作用域。
 *
 * 🔴 **2026-08-25：從一個 `kind` 字串換成這個函式。** 第一版的登記處只認得
 * 三種寫死的形狀（`name` / `element` / `field`），而那仍然是列舉式：
 * `*q`、`a.b.c`、`d["k"]` 各要一個新的 kind。見 `core/component/lvalue-nodes.ts`。
 */
export function registerLvalue(): void {
  declareLvalue('cpp:var_ref', async (node, ctx: ExecutionContext) => {
    const name = String(node.properties.name)
    return {
      read: () => ctx.scope.get(name),
      write: (v) => { ctx.scope.set(name, v as never) },
    }
  })
}
