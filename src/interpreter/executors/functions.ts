import type { ConceptExecutor } from '../executor-registry'
import type { RuntimeValue } from '../types'
import { defaultValue } from '../types'
import { createNode } from '../../core/semantic-tree'
import { Scope } from '../scope'

class ReturnSignal {
  value: RuntimeValue
  constructor(value: RuntimeValue) { this.value = value }
}

export { ReturnSignal }

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
        ctx.scope = parentScope
        throw signal
      }
    }

    ctx.scope = parentScope
    return returnValue
  }

  register('func_call', execFuncCall)
  register('func_call_expr', execFuncCall)

  register('return', async (node, ctx) => {
    const valueNodes = node.children.value
    if (valueNodes && valueNodes.length > 0) {
      const val = await ctx.evaluate(valueNodes[0])
      throw new ReturnSignal(val)
    }
    throw new ReturnSignal(defaultValue('void'))
  })

  register('forward_decl', async () => {
    // no-op: forward function declaration
  })
}
