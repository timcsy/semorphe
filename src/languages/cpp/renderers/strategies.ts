import type { RenderStrategyRegistry, BlockState } from '../../../core/registry/render-strategy-registry'

export function registerCppRenderStrategies(registry: RenderStrategyRegistry): void {
  // input: cin >> x >> y — three-mode arg slots with extraState.args
  registry.register('cpp:renderInput', (node, ctx) => {
    const block: BlockState = {
      type: 'u_input',
      id: ctx.nextBlockId(),
      fields: {},
      inputs: {},
    }

    // Collect variable names from modern or legacy format
    const varNames: string[] = []
    const inputValues = node.children.values ?? []
    if (inputValues.length > 0) {
      for (const v of inputValues) {
        varNames.push((v.properties.name as string) ?? 'x')
      }
    } else {
      const singleVar = (node.properties.variable as string) ?? 'x'
      const vars = node.properties.variables
      if (vars) {
        const varList = typeof vars === 'string' ? vars.split(',') : (Array.isArray(vars) ? vars : [])
        for (const v of varList) varNames.push(v)
      }
      if (varNames.length === 0) varNames.push(singleVar)
    }

    // Produce extraState.args matching u_input's loadExtraState format
    block.extraState = {
      args: varNames.map(name => ({ mode: 'select', text: name })),
    }

    return block
  })

  // var_declare: multi-variable with per-variable init control
  registry.register('cpp:renderVarDeclare', (node, ctx) => {
    const block: BlockState = {
      type: 'u_var_declare',
      id: ctx.nextBlockId(),
      fields: { TYPE: node.properties.type ?? 'int' },
      inputs: {},
    }

    const declarators = node.children.declarators ?? []

    if (declarators.length > 0) {
      const items: string[] = []
      for (let i = 0; i < declarators.length; i++) {
        const d = declarators[i]
        block.fields[`NAME_${i}`] = d.properties.name ?? 'x'
        const inits = d.children.initializer ?? []
        if (inits.length > 0) {
          const initBlock = ctx.renderExpression(inits[0])
          if (initBlock) {
            block.inputs[`INIT_${i}`] = { block: initBlock }
          }
          items.push('var_init')
        } else {
          items.push('var')
        }
      }
      block.extraState = { items }
    } else {
      block.fields.NAME_0 = node.properties.name ?? 'x'
      const inits = node.children.initializer ?? []
      if (inits.length > 0) {
        const initBlock = ctx.renderExpression(inits[0])
        if (initBlock) {
          block.inputs.INIT_0 = { block: initBlock }
        }
      }
      block.extraState = { items: [inits.length > 0 ? 'var_init' : 'var'] }
    }

    return block
  })

  // print: cout << expr0 << expr1 << ...
  registry.register('cpp:renderPrint', (node, ctx) => {
    const block: BlockState = {
      type: 'u_print',
      id: ctx.nextBlockId(),
      fields: {},
      inputs: {},
    }

    const values = node.children.values ?? []
    for (let i = 0; i < values.length; i++) {
      const valBlock = ctx.renderExpression(values[i])
      if (valBlock) {
        block.inputs[`EXPR${i}`] = { block: valBlock }
      }
    }
    if (values.length > 0) {
      block.extraState = { itemCount: values.length }
    }

    return block
  })

  // func_def: function definition with params
  registry.register('cpp:renderFuncDef', (node, ctx) => {
    const block: BlockState = {
      type: 'u_func_def',
      id: ctx.nextBlockId(),
      fields: {
        NAME: node.properties.name ?? 'f',
        RETURN_TYPE: node.properties.return_type ?? 'void',
      },
      inputs: {},
    }

    const params = node.properties.params
    if (Array.isArray(params)) {
      const paramCount = params.length
      for (let i = 0; i < paramCount; i++) {
        const parts = (params[i] as string).split(/\s+/)
        block.fields[`TYPE_${i}`] = parts[0] ?? 'int'
        block.fields[`PARAM_${i}`] = parts.slice(1).join(' ') || `p${i}`
      }
      if (paramCount > 0) {
        block.extraState = { paramCount }
      }
    }

    const bodyChildren = node.children.body ?? []
    if (bodyChildren.length > 0) {
      const chain = ctx.renderStatementChain(bodyChildren)
      if (chain) {
        block.inputs.BODY = { block: chain }
      }
    }

    return block
  })

  // func_call / func_call_expr: function call with dynamic args
  registry.register('cpp:renderFuncCall', (node, ctx) => {
    const blockType = node.concept === 'func_call_expr' ? 'u_func_call_expr' : 'u_func_call'
    const block: BlockState = {
      type: blockType,
      id: ctx.nextBlockId(),
      fields: { NAME: node.properties.name ?? 'f' },
      inputs: {},
    }

    const args = node.children.args ?? []
    for (let i = 0; i < args.length; i++) {
      const argBlock = ctx.renderExpression(args[i])
      if (argBlock) {
        block.inputs[`ARG_${i}`] = { block: argBlock }
      }
    }
    if (args.length > 0) {
      block.extraState = { ...block.extraState, argCount: args.length }
    }

    return block
  })

  // if: progressive if/if-else block
  registry.register('cpp:renderIf', (node, ctx) => {
    const block: BlockState = {
      type: 'u_if',
      id: ctx.nextBlockId(),
      fields: {},
      inputs: {},
    }

    // condition
    const condChildren = node.children.condition ?? []
    if (condChildren.length > 0) {
      const condBlock = ctx.renderExpression(condChildren[0])
      if (condBlock) {
        block.inputs.CONDITION = { block: condBlock }
      }
    }

    // then body
    const thenChildren = node.children.then_body ?? []
    if (thenChildren.length > 0) {
      const chain = ctx.renderStatementChain(thenChildren)
      if (chain) {
        block.inputs.THEN = { block: chain }
      }
    }

    // else body
    const elseChildren = node.children.else_body ?? []
    if (elseChildren.length > 0) {
      const chain = ctx.renderStatementChain(elseChildren)
      if (chain) {
        block.inputs.ELSE = { block: chain }
      }
      block.extraState = { hasElse: true }
    }

    return block
  })
}
