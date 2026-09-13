/**
 * **Lambda 的執行期支援** —— 與身分無關的機制
 *
 * 原本住在 `core/executors/lambda.ts`，而那個檔的 `registerLambdaExecutors`
 * 在 `cpp:lambda` 搬進膠囊之後就空了。**留一個空的註冊函式就是殼。**
 */
import type { RuntimeValue, Callable } from '../../../../interpreter/types'
import { Scope } from '../../../../interpreter/scope'
// 從定義它的地方導入——**不要再建一份**，`instanceof` 會失效
import { ReturnSignal } from '../../../../interpreter/executors/functions'
import { RuntimeError, RUNTIME_ERRORS } from '../../../../interpreter/errors'

/**
 * 安裝 lambda 執行機構——**從閉包提升為模組層級的匯出**（同 `openBraceFor`）。
 *
 * ⚠️ 一個閉包 helper 會把它所在的整個函式變成不可分割的單位，
 * 而那個單位是「一個檔案」不是「一顆元件」——擋住膠囊化。
 */
export const installLambda = (ctx: import('../../../../interpreter/executor-registry').ExecutionContext): void => {
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



/**
 * 用**值**（不是節點）呼叫一個可呼叫物——`sort` 的比較器需要這個。
 *
 * ⚠️ `ctx.invokeCallable` 吃的是**節點**，因為一般的呼叫式手上有語義樹。
 * 而比較器是在排序的迴圈裡被呼叫的，手上只有兩個值——把值包成假節點
 * 會讓那些假節點流進錯誤訊息與除錯視圖裡。
 *
 * > **共用的是演算法，不是身分**：`range_sort` 與未來的 `find_if`／`count_if`
 * > 用的是同一段，而它不屬於任何一顆元件。
 */
export async function callWithValues(
  fn: RuntimeValue,
  values: RuntimeValue[],
  ctx: import('../../../../interpreter/executor-registry').ExecutionContext,
): Promise<RuntimeValue> {
  const callable = asCallable(fn)
  if (!callable) {
    throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, { '%1': '這個值不是一個可呼叫的東西' })
  }
  const outer = ctx.scope
  const inner = lambdaScope(callable)
  callable.params.forEach((p, i) => inner.declare(p.name, values[i] ?? { type: 'int', value: 0 }))
  ctx.scope = inner
  try {
    await ctx.executeBody(callable.body)
    return { type: 'void', value: null }
  } catch (e) {
    if (e instanceof ReturnSignal) return e.value as RuntimeValue
    throw e
  } finally {
    await ctx.exitScope(ctx.scope, outer)
  }
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

