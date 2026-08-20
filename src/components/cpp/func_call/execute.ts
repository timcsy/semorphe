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
import type { RuntimeValue } from '../../../interpreter/types'
import { Scope } from '../../../interpreter/scope'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  const execFuncCall: ComponentExecutor = async (node, ctx) => {
    const name = String(node.properties.name)

    // 名字先在**變數**裡找——一個變數可能持有 lambda。
    //
    // 順序是刻意的：具名函式與變數同名時，C++ 的區域變數會遮蔽外層的函式。
    // 而 `ctx.scope.get` 找不到時會丟錯，所以用 `has` 先問。
    if (ctx.scope.has(name)) {
      const v = ctx.scope.get(name)
      const callable = ctx.callableOf?.(v) ?? null
      if (callable) return ctx.invokeCallable!(callable, node.children.args ?? [])
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
      const { RuntimeError, RUNTIME_ERRORS } = await import('../../../interpreter/errors')
      throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, { '%1': name })
    }

    const args = node.children.args ?? []
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

      const val = i < argValues.length ? argValues[i] : defaultValue(param.type.replace('&', '').replace('[]', ''))
      ctx.scope.declare(param.name, val)
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
    return returnValue
  }

  register('cpp:func_call', execFuncCall)
}
