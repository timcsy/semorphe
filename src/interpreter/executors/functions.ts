import type { ConceptExecutor } from '../executor-registry'
import type { RuntimeValue } from '../types'
import { 建func_call } from '../../components/cpp/func_call/lift'

/**
 * ⚠️ **導出，而且只能有這一份。**
 *
 * 訊號類別靠 `instanceof` 辨識。複製成第二份的話 `instanceof` 一律為假，
 * 而症狀是「控制流程靜靜地穿過去了」——這個專案已經被同一件事咬過：
 * `BreakSignal` 在一次搬移中變成兩個類別，於是 `break` 逃出了迴圈，
 * 而型別檢查與清冊都是綠的。
 */
export class ReturnSignal {
  value: RuntimeValue
  constructor(value: RuntimeValue) { this.value = value }
}


export function registerFunctionExecutors(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:program', async (node, ctx) => {
    const body = node.children.body ?? []
    await ctx.executeBody(body)
    if (ctx.functions.has('main')) {
      const execFuncCall = async (callNode: import('../../core/types').SemanticNode) => {
        await ctx.executeNode(callNode)
      }
      await execFuncCall(建func_call('main', []))
    }
  })

  register('cpp:func_def', async (node, ctx) => {
    const name = String(node.properties.name)
    const returnType = String(node.properties.return_type || 'void')
    const paramChildren = node.children.params ?? []
    const params = paramChildren.map(p => ({
      type: String(p.properties.type ?? 'int'),
      name: String(p.properties.name ?? ''),
    }))
    ctx.functions.set(name, {
      name,
      params,
      returnType,
      body: node.children.body ?? [],
    })
  })







}
