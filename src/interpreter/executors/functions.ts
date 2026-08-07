import type { ConceptExecutor } from '../executor-registry'
import type { RuntimeValue } from '../types'
import { defaultValue } from '../types'
import { createNode } from '../../core/semantic-tree'
import { Scope } from '../scope'

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
  register('program', async (node, ctx) => {
    const body = node.children.body ?? []
    await ctx.executeBody(body)
    if (ctx.functions.has('main')) {
      const execFuncCall = async (callNode: import('../../core/types').SemanticNode) => {
        await ctx.executeNode(callNode)
      }
      await execFuncCall(createNode('func_call', { name: 'main' }, { args: [] }))
    }
  })

  register('func_def', async (node, ctx) => {
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

  const execFuncCall: ConceptExecutor = async (node, ctx) => {
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
      const { RuntimeError, RUNTIME_ERRORS } = await import('../errors')
      throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, {
        '%1': `${name}（是一個 ${v.type}，不是函式）`,
      })
    }

    const funcDef = ctx.functions.get(name)
    if (!funcDef) {
      const { RuntimeError, RUNTIME_ERRORS } = await import('../errors')
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

  register('func_call', execFuncCall)


  register('return', async (node, ctx) => {
    const valueNodes = node.children.value
    if (valueNodes && valueNodes.length > 0) {
      const val = await ctx.evaluate(valueNodes[0])
      throw new ReturnSignal(val)
    }
    throw new ReturnSignal(defaultValue('void'))
  })
}
