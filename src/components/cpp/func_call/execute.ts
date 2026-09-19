/**
 * `cpp:func_call` 的 **execute** 路
 *
 * ⚠️ 它原本是 `interpreter/executors/functions.ts` 裡一個叫 `execFuncCall`
 * 的閉包，**而同一個檔案裡還有第二個同名的東西**——`cpp:program` 的執行器
 * 內部宣告了一個 local `execFuncCall`（只是 `ctx.executeNode` 的包裝），
 * 用來呼叫 `main`。兩者名字一樣、意思不同、相隔二十行。
 *
 * > **同一個名字在同一個檔案裡指兩件事時，剪錯一個不會報錯——
 * > 只會讓另一個悄悄消失。**
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { ReturnSignal } from '../../../interpreter/executors/functions'
import { defaultValue } from '../../../interpreter/types'
import { cloneValue } from '../../../interpreter/clone'
import { cppParamDefault } from '../../../languages/cpp/lang/executors/param-default'
import type { RuntimeValue } from '../../../interpreter/types'
import { Scope } from '../../../interpreter/scope'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  const execFuncCall: ComponentExecutor = async (node, ctx) => {
    const name = String(node.properties.name)

    // 名字先在**變數**裡找——一個變數可能持有 lambda。
    //
    // 順序是刻意的：具名函式與變數同名時，C++ 的區域變數會遮蔽外層的函式。
    // 而 `ctx.scope.get` 找不到時會丟錯，所以用 `has` 先問。
    if (ctx.scope.has(name)) {
      const v = ctx.scope.get(name)
      const callable = ctx.callableOf?.(v) ?? null
      if (callable) return ctx.invokeCallable!(callable, node.slots.args ?? [])
      // 變數存在但不可呼叫——**出聲**。把一個整數當函式呼叫靜默成功的話，
      // 使用者只會看到一個莫名其妙的結果。
      const { RuntimeError, RUNTIME_ERRORS } = await import('../../../interpreter/errors')
      throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, {
        '%1': `${name}（是一個 ${v.type}，不是函式）`,
      })
    }

    // `Math::square(5)` —— 限定名退回裸名再查一次。
    //
    // ⚠️ 這不是猜，是**跟隨一個已經寫下的設計**：`cpp:namespace_def` 的執行器
    // 註解逐字「這個直譯器**沒有名稱隔離**，本體直接跑」——`namespace Math`
    // 裡的 `square` 就是登記成 `square`。而呼叫端拿到的是完整的 `Math::square`，
    // 於是兩端對不起來，症狀是 `UNDEFINED_FUNC`（第三十二條護欄的 2 段缺口）。
    //
    // 順序是刻意的：**先查完整名**。有人真的用完整名登記時，那一份優先。
    //
    // ⚠️ 已知代價：使用者自己定義的 `max` 會被 `std::max` 撞上。那是
    // 「沒有名稱隔離」這個設計本來就有的代價，不是這一行新增的——
    // 真要隔離就得讓 `namespace_def` 開一個命名空間，而那是另一個題目。
    const bareName = name.includes('::') ? name.slice(name.lastIndexOf('::') + 2) : null
    const funcDef = ctx.functions.get(name) ?? (bareName ? ctx.functions.get(bareName) : undefined)
    if (!funcDef) {
      /**
       * 🔴 **一個名字如果是登記過的結構，那個呼叫是【建構】**（2026-09-17，盲測抓到）。
       *
       * ```cpp
       * struct T { int a; T(int x) : a(x) {} };
       * T t = T(3);      🟢 宣告那一路早就會了（走 `structs.construct`）
       * s.insert(T(3));  🔴 而運算式位置說「沒有這個函式：T」
       * ```
       *
       * ⚠️ 同一件事的兩個位置，只有一個接上了——而**那正是「一族有幾個註冊點」
       * 那條教訓的形狀**：宣告那一路接了，運算式那一路沒有。
       *
       * ⚠️ 判準問**登記處**（`ctx.structs.has`），不是名字長怎樣（大寫開頭那種猜法）。
       */
      const ctorName = ctx.structs.has(name) ? name : (bareName && ctx.structs.has(bareName) ? bareName : null)
      // ⚠️ `construct` 吃的是**引數節點**（它自己求值），不是求好的值。
      if (ctorName) return await ctx.structs.construct(ctorName, node.slots.args ?? [])
      const { RuntimeError, RUNTIME_ERRORS } = await import('../../../interpreter/errors')
      throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, { '%1': name })
    }

    const args = node.slots.args ?? []
    const argValues: RuntimeValue[] = []
    for (const argNode of args) {
      argValues.push(await ctx.evaluate(argNode))
    }

    const parentScope = ctx.scope
    ctx.scope = new Scope(parentScope)

    for (let i = 0; i < funcDef.params.length; i++) {
      const param = funcDef.params[i]
      const isRef = param.type.includes('&')

      if (isRef && i < args.length) {
        const argNode = args[i]
        const argVarName = String(argNode.properties.name ?? '')
        if (argVarName) {
          const ownerScope = parentScope.findOwner(argVarName)
          if (ownerScope) {
            ctx.scope.declareRef(param.name, ownerScope, argVarName)
            continue
          }
        }
      }

      // 🔴 **少給引數時先看簽名上的預設值**——本來直接退到型別的零值，
      //    於是 `int add(int a, int b = 10)` 的 `add(1)` 算出 1 而不是 11。
      const declared = (param as { default?: string }).default
      const val = i < argValues.length
        ? argValues[i]
        : declared
          ? cppParamDefault(declared)
          : defaultValue(param.type.replace('&', '').replace('[]', ''))
      /**
       * 🔴 **傳值要真的複製一份**（2026-09-16，模糊測試抓到的）。
       *
       * 在此之前這裡直接把呼叫端那個物件綁給參數，於是
       * `int drain(deque<int> d)` 把 `d` 清空之後，**呼叫者的容器也空了**
       * ——g++ 印 2 而我們印 0。而它壞得很安靜：程式跑完、印出數字、數字是錯的。
       *
       * ⚠️ 參考參數（`deque<int>&`）走上面那條 `declareRef`，到不了這裡
       * ——所以這一行不會把「該共用的」也複製掉。
       *
       * > **「傳值」與「傳參考」的差別，在解譯器裡就是「有沒有複製」這一個動作
       * > ——少了它，兩者的行為完全相同，而語言的宣告變成一句空話。**
       */
      /**
       * ⚠️ **陣列參數【不複製】**——`void feed(deque<int> bins[], int v)` 在 C++ 裡
       * 退化成指標，被呼叫端改得到呼叫者的那一份。
       *
       * 🪦 第一版不分，於是模糊測試裡一支本來通過的程式當場退步
       * （`feed(bins, …)` 餵進去的東西全部留在函式裡）。
       *
       * > **一個「傳值就複製」的規則，在陣列參數上是錯的
       * > ——那是語言的例外，不是我的選擇。**
       */
      /**
       * ⚠️ **陣列與指標參數都【不複製】**——它們是呼叫者那份資料的別名。
       *
       * ```
       * void feed(deque<int> b[], int v)   陣列退化成指標
       * void fillArray(int* a, int n)      指標本來就是別名
       * ```
       *
       * 🪦 第一版只擋了 `[]`，於是第三十二條護欄（行為的誤差）當場紅
       * ——`fillArray` 填的是複本，呼叫者印出 `0 0 0 0` 而 g++ 是 `3 6 9 12`。
       *
       * > **C++ 裡 `T*` 與 `T[]` 都是別名，不是值
       * > ——一個「傳值就複製」的規則要先數清楚語言有幾種例外。**
       */
      const aliases = param.type.includes('[]') || param.type.includes('*')
      ctx.scope.declare(param.name, aliases ? val : cloneValue(val))
    }

    let returnValue: RuntimeValue = defaultValue(funcDef.returnType)

    try {
      await ctx.executeBody(funcDef.body)
    } catch (signal) {
      if (signal instanceof ReturnSignal) {
        returnValue = signal.value
      } else {
        await ctx.exitScope(ctx.scope, parentScope)
        throw signal
      }
    }

    await ctx.exitScope(ctx.scope, parentScope)
    /**
     * 🔴 **回傳值要照宣告的回傳型別轉一次**（2026-09-19）。
     *
     * ```cpp
     * ll DFS(int x, ll st){ … return 1e9; }   // AP325/7/7_5_TLE.cpp
     * cout << DFS(0,0);                        // g++ 1000000000 ／ 我們 1e+09
     * ```
     *
     * 在此之前回傳值**原封往外送**，於是一個寫成 `1e9` 的整數常數
     * 一路帶著 `double` 的型別跑出來——而**印出來才看得到**。
     * ⚠️ 連 `int f(){ return 1e9; }` 都是（不只是 `long long`）。
     *
     * > **宣告的型別如果只在宣告那一行生效，它就不是一個型別，是一句註解。**
     *
     * ⚠️ `void` 不轉（`coerceType(…, 'void')` 會把值變成 null）。
     * ⚠️ 結構／容器／指標也不轉——`coerceType` 對認不得的型別是原樣回傳，
     *    而 `ctx.structs.has(...)` 那一類本來就不該被壓成純量。
     */
    const rt = String(funcDef.returnType || 'void')
    if (rt !== 'void' && returnValue.type !== 'void' && !ctx.structs.has(rt)) {
      return ctx.coerceType(returnValue, rt)
    }
    return returnValue
  }

  register('cpp:func_call', execFuncCall)
}
