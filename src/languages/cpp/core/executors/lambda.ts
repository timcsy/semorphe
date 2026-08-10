/**
 * lambda 的執行——閉包。
 *
 * ## 為什麼是新機制
 *
 * lambda 求值出來的是一個**可以晚點再呼叫的東西**，而執行期的值模型原本
 * 沒有「可呼叫」。而且它要記得**定義時的那個作用域**，否則捕捉來的變數在
 * 呼叫時已經不在了。
 *
 * ## 捕捉語意
 *
 * | 寫法 | 做法 |
 * |---|---|
 * | `[&]` | 記住定義時的作用域物件本身——之後外層改了，讀得到新值 |
 * | `[=]` | **定義當下**把外層看得到的變數拍一份快照 |
 *
 * 兩者只實作一種、或把兩種當成同一件事的話，**單看一支測試分不出來**——
 * `lambda-execute.test.ts` 那兩支要成對讀。
 *
 * ## 這一片不做
 *
 * 具名捕捉（`[x, &y]`）——那需要解析捕捉清單裡的每一個名字。`[&]`／`[=]`
 * 是兩個極端，先把機制立起來。具名捕捉落在 `capture` 屬性的其他值上，
 * 目前**視為無捕捉**，而下面的錯誤訊息會說得出來。
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import type { RuntimeValue, Callable } from '../../../../interpreter/types'
import { Scope } from '../../../../interpreter/scope'
// 從定義它的地方導入——**不要再建一份**，`instanceof` 會失效
import { ReturnSignal } from '../../../../interpreter/executors/functions'

/**
 * 安裝 lambda 執行機構——**從閉包提升為模組層級的匯出**（同 `openBraceFor`）。
 *
 * ⚠️ 一個閉包 helper 會把它所在的整個函式變成不可分割的單位，
 * 而那個單位是「一個檔案」不是「一顆元件」——擋住膠囊化。
 */
export const 安裝Lambda = (ctx: import('../../../../interpreter/executor-registry').ExecutionContext): void => {
  if (ctx.callableOf) return
  ctx.callableOf = (v) => asCallable(v)
  ctx.invokeCallable = async (c, argNodes) => {
    const callable = c as Callable
    const argValues: RuntimeValue[] = []
    for (const a of argNodes) argValues.push(await ctx.evaluate(a))

    const outer = ctx.scope
    const inner = lambdaScope(callable)
    callable.params.forEach((p, i) => inner.declare(p.name, argValues[i] ?? { type: 'int', value: 0 }))
    ctx.scope = inner
    try {
      await ctx.executeBody(callable.body)
      return { type: 'void', value: null }
    } catch (e) {
      if (e instanceof ReturnSignal) return e.value as RuntimeValue
      throw e
    } finally {
      // 一定要還原——不還原的話，lambda 呼叫之後外層的程式會跑在 lambda
      // 的作用域裡，而那個錯誤的症狀離現場很遠
      await ctx.exitScope(ctx.scope, outer)
    }
  }
}

export function registerLambdaExecutors(
  _register: (concept: string, executor: ConceptExecutor) => void,
): void {
  // 告訴核心「什麼算可呼叫」與「怎麼呼叫它」。裝在執行器裡而不是模組載入時，
  // 因為掛勾掛在**每一個直譯器實例**上（與結構的方法執行器同一個理由）。



}

/** 這個值是不是可呼叫的？呼叫端用它決定要不要走 lambda 路徑 */
export function asCallable(v: RuntimeValue | undefined): Callable | null {
  return v?.type === 'function' ? (v.value as Callable) : null
}

/** 建立呼叫 lambda 用的作用域——捕捉語意在這裡體現 */
export function lambdaScope(c: Callable): Scope {
  if (c.capture === '=') {
    // 值捕捉：用快照當父層，之後外層的改動看不到
    const snap = new Scope(null)
    for (const [k, v] of c.snapshot ?? []) snap.declare(k, v)
    return snap.createChild()
  }
  if (c.capture === '&') {
    // 參照捕捉：定義時的作用域本身當父層，讀得到之後的改動
    return (c.closure as Scope).createChild()
  }
  // 無捕捉：一個乾淨的作用域。外層的變數讀不到——那是 C++ 的行為，
  // 而讀不到時會丟「未宣告變數」，訊息指得出是哪一個。
  return new Scope(null)
}
