/**
 * `cpp:exception_make` 的 **lift** 路——`runtime_error("…")` 之類
 *
 * ⚠️ 用具名策略而不是純資料的 `fieldMappings`：`extract: "lift"` 只認
 * `$namedChildren[N]` 或 `childForFieldName(欄位名)`，而引數住在
 * `argument_list` 的**第一個 namedChild**——那是兩層，宣告式的路徑語法表達不了。
 *
 * > **一個宣告式的機制表達不了的東西，硬塞給它會變成一個看起來有值而其實是空的欄位。**
 * > （第一版寫 `"ast": "arguments.0"`，於是訊息永遠是空字串——
 * > 而 `caught: ` 印出來看起來只是「訊息剛好是空的」。）
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'

const KINDS = new Set([
  'runtime_error', 'logic_error', 'out_of_range',
  'invalid_argument', 'overflow_error', 'length_error',
])

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('cpp:liftExceptionMake', (node, ctx) => {
    const fn = node.childForFieldName('function')?.text ?? ''
    // 判別已由 pattern 的 constraints 做過；這裡是**第二道**，
    // 為的是「策略被別的 pattern 誤用時不要靜靜產出一個 runtime_error」。
    const kind = KINDS.has(fn) ? fn : 'runtime_error'

    const argList = node.childForFieldName('arguments') ?? node.namedChildren.find((c) => c.type === 'argument_list')
    const first = argList?.namedChildren[0]
    const message = first ? ctx.lift(first) : null

    return message
      ? createNode('cpp:exception_make', { kind }, { message: [message] })
      : createNode('cpp:exception_make', { kind })
  })
}
