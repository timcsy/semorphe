/**
 * `python:try_catch` 的 **execute** 路。
 *
 * 🔴 **例外的名字今天不比對**：這個直譯器沒有例外的類別階層，
 * 所以**第一個分支永遠接住**——`except ValueError` 與 `except KeyError`
 * 寫在一起時，第二個永遠不會跑。
 *
 * 那是一個**已知的簡化，寫在這裡而不是靜靜地做**：學生寫兩個不同的 `except`
 * 時會期待它們分開，而今天不會。⚠️ 而它比「整顆降級」好：程式跑得動、
 * 積木看得見，而這一行說清楚它哪裡還不對。
 *
 * ⚠️ 而**控制流訊號不得被當成例外抓走**——`break`／`continue`／`return`
 * 是用丟出來實作的，抓住它們會讓迴圈與函式安靜地壞掉。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { BreakSignal, ContinueSignal } from '../../../interpreter/executors/control-flow'
import { ReturnSignal } from '../../../interpreter/executors/functions'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:try_catch', async (node, ctx) => {
    try {
      await ctx.executeBody(node.children.body ?? [])
    } catch (e) {
      if (e instanceof BreakSignal || e instanceof ContinueSignal || e instanceof ReturnSignal) throw e
      const first = (node.children.handlers ?? [])[0]
      if (!first) throw e // 沒有分支就不吞——不然錯誤會安靜地消失
      await ctx.executeBody(first.children.body ?? [])
    }
  })
}
