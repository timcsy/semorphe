/**
 * `python:input` 的 **execute** 路。
 *
 * ## 🔴 它要【等】使用者，不是讀一個已經在那裡的緩衝區
 *
 * 第一版用 `ctx.io.read()`——那讀的是**預先餵好的 stdin**（測試用的那種）。
 * 在瀏覽器裡使用者按執行之後，提示印出來了、而它立刻拿到 `null` 並丟錯。
 *
 * 使用者看到的是：**主控台印出「請輸入名字：」，然後跳出「這一段程式我看不懂」**
 * ——而程式碼一點問題都沒有，只是他還沒打字。
 *
 * > **一個互動的動作如果不等，它就不是互動——它是一個立刻失敗的讀取。**
 *
 * 🟢 `ctx.awaitInput()` 是現成的機制（C++ 的 `cin` 用的就是它）。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:input', async (node, ctx) => {
    const p = (node.children.prompt ?? [])[0]
    // ⚠️ **提示要先印出來**——不然使用者會對著一個空的輸入框發呆。
    if (p) ctx.io.write(String((await ctx.evaluate(p)).value))

    // 🔴 **兩層：先讀預餵的，沒有才【等】使用者。**
    //
    // `ctx.io.read()`  測試／批次執行預先餵好的那些行
    // `ctx.awaitInput()` 瀏覽器裡真的等使用者打字（C++ 的 `cin` 走的也是這條）
    //
    // ⚠️ 只做第二層的話**測試環境永遠拿到 null**（那裡沒有 inputProvider）；
    // 只做第一層的話**瀏覽器裡永遠不等**——而後者正是使用者看到的那個症狀。
    const line = ctx.io.read() ?? (await ctx.awaitInput())
    // ⚠️ **真的沒有輸入時出聲，而訊息要說【實話】**：
    // Python 的 `input()` 在這裡丟 `EOFError`。
    // 🔴 而這一格原本借用 `UNRECOGNIZED_CODE`——它的訊息是「這一段程式我看不懂」，
    //    那會把使用者送去改一段沒有壞的程式碼。
    if (line === null) throw new RuntimeError(RUNTIME_ERRORS.NO_MORE_INPUT, {})

    // Python 的 input() 【永遠】回字串——這是初學者最常撞的一格。
    return { type: 'string' as const, value: line }
  })
}
