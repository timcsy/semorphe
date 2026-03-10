import type { RenderStrategyRegistry, BlockState, RenderContext } from '../../../core/registry/render-strategy-registry'
import type { SemanticNode } from '../../../core/types'

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

    // Prefer structured param_decl children, fallback to legacy string[] properties
    const paramChildren = node.children.params ?? []
    if (paramChildren.length > 0) {
      for (let i = 0; i < paramChildren.length; i++) {
        block.fields[`TYPE_${i}`] = paramChildren[i].properties.type ?? 'int'
        block.fields[`PARAM_${i}`] = paramChildren[i].properties.name ?? `p${i}`
      }
      block.extraState = { paramCount: paramChildren.length }
    } else {
      const params = node.properties.params
      if (Array.isArray(params)) {
        const paramCount = params.length
        for (let i = 0; i < paramCount; i++) {
          const { type, name } = parseParamTypeAndName(params[i] as string, i)
          block.fields[`TYPE_${i}`] = type
          block.fields[`PARAM_${i}`] = name
        }
        if (paramCount > 0) {
          block.extraState = { paramCount }
        }
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

  // cpp_printf: printf with FORMAT field + three-mode dynamic args
  registry.register('cpp:renderPrintf', (node, ctx) => {
    const block: BlockState = {
      type: 'c_printf',
      id: ctx.nextBlockId(),
      fields: {
        FORMAT: (node.properties.format as string) ?? '%d\\n',
      },
      inputs: {},
    }

    const argNodes = node.children.args ?? []
    const args = renderThreeModeArgs(argNodes, block, ctx)
    block.extraState = { args }

    return block
  })

  // cpp_scanf: scanf with FORMAT field + three-mode dynamic args
  registry.register('cpp:renderScanf', (node, ctx) => {
    const block: BlockState = {
      type: 'c_scanf',
      id: ctx.nextBlockId(),
      fields: {
        FORMAT: (node.properties.format as string) ?? '%d',
      },
      inputs: {},
    }

    const argNodes = node.children.args ?? []
    const args = renderThreeModeArgs(argNodes, block, ctx)
    block.extraState = { args }

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

  // forward_decl: structured forward declaration with return type, name, params
  registry.register('cpp:renderForwardDecl', (node, ctx) => {
    const block: BlockState = {
      type: 'c_forward_decl',
      id: ctx.nextBlockId(),
      fields: {
        RETURN_TYPE: node.properties.return_type ?? 'void',
        NAME: node.properties.name ?? 'f',
      },
      inputs: {},
    }

    // Prefer structured param_decl children, fallback to legacy string[] properties
    const paramChildren = node.children.params ?? []
    if (paramChildren.length > 0) {
      for (let i = 0; i < paramChildren.length; i++) {
        block.fields[`TYPE_${i}`] = paramChildren[i].properties.type ?? 'int'
      }
      block.extraState = { paramCount: paramChildren.length }
    } else {
      const params = node.properties.params
      if (Array.isArray(params) && params.length > 0) {
        for (let i = 0; i < params.length; i++) {
          block.fields[`TYPE_${i}`] = params[i] as string
        }
        block.extraState = { paramCount: params.length }
      }
    }

    return block
  })

  // if: progressive if/if-else block — flattens nested else-if chains
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

    // Flatten else-if chain: detect nested if nodes in else_body
    let elseIfCount = 0
    let current = node
    while (true) {
      const elseChildren = current.children.else_body ?? []
      // If else_body is exactly one `if` node marked as else-if, flatten into mutator inputs
      if (elseChildren.length === 1 && elseChildren[0].concept === 'if' && elseChildren[0].properties.isElseIf === 'true') {
        const elseIfNode = elseChildren[0]

        // Render else-if condition
        const elifCond = elseIfNode.children.condition ?? []
        if (elifCond.length > 0) {
          const condBlock = ctx.renderExpression(elifCond[0])
          if (condBlock) {
            block.inputs[`ELSEIF_CONDITION_${elseIfCount}`] = { block: condBlock }
          }
        }

        // Render else-if body
        const elifBody = elseIfNode.children.then_body ?? []
        if (elifBody.length > 0) {
          const chain = ctx.renderStatementChain(elifBody)
          if (chain) {
            block.inputs[`ELSEIF_THEN_${elseIfCount}`] = { block: chain }
          }
        }

        elseIfCount++
        current = elseIfNode
      } else {
        // Final else (or no else)
        if (elseChildren.length > 0) {
          const chain = ctx.renderStatementChain(elseChildren)
          if (chain) {
            block.inputs.ELSE = { block: chain }
          }
          const extra: Record<string, unknown> = { hasElse: true }
          if (elseIfCount > 0) extra.elseifCount = elseIfCount
          block.extraState = extra
        } else if (elseIfCount > 0) {
          block.extraState = { elseifCount: elseIfCount, hasElse: false }
        }
        break
      }
    }

    return block
  })

  // doc_comment: /** ... */ with @brief, @param, @return
  registry.register('cpp:renderDocComment', (node, ctx) => {
    const block: BlockState = {
      type: 'c_comment_doc',
      id: ctx.nextBlockId(),
      fields: { BRIEF: node.properties.brief ?? '' },
      inputs: {},
    }

    // Collect params
    let paramCount = 0
    while (node.properties[`param_${paramCount}_name`] !== undefined) {
      block.fields[`PARAM_NAME_${paramCount}`] = node.properties[`param_${paramCount}_name`]
      block.fields[`PARAM_DESC_${paramCount}`] = node.properties[`param_${paramCount}_desc`] ?? ''
      paramCount++
    }

    const hasReturn = !!node.properties.return_desc
    if (hasReturn) {
      block.fields.RETURN = node.properties.return_desc
    }

    if (paramCount > 0 || hasReturn) {
      block.extraState = { paramCount, hasReturn }
    }

    return block
  })
}

/** Known compound type prefixes (longest first for greedy match) */
const COMPOUND_TYPES = [
  'unsigned long long',
  'long long',
  'unsigned long',
  'unsigned int',
  'unsigned short',
  'unsigned char',
  'long double',
  'signed char',
]

/** Parse a parameter declaration string like "long long x" into { type, name } */
function parseParamTypeAndName(param: string, index: number): { type: string; name: string } {
  const trimmed = param.trim()
  // Try compound types first
  for (const ct of COMPOUND_TYPES) {
    if (trimmed.startsWith(ct + ' ')) {
      const rest = trimmed.slice(ct.length).trim()
      // Handle pointer/reference: "long long *p" or "long long &r"
      if (rest.startsWith('*') || rest.startsWith('&')) {
        return { type: ct + rest[0], name: rest.slice(1).trim() || `p${index}` }
      }
      return { type: ct, name: rest || `p${index}` }
    }
  }
  // Simple split: first token is type, rest is name (handles "int* p", "char x", etc.)
  const parts = trimmed.split(/\s+/)
  return { type: parts[0] ?? 'int', name: parts.slice(1).join(' ') || `p${index}` }
}

/** Map semantic arg nodes to three-mode arg slots, using compose mode for non-var_ref */
function renderThreeModeArgs(
  argNodes: SemanticNode[],
  block: BlockState,
  ctx: RenderContext,
): Array<{ mode: 'select' | 'compose'; text?: string }> {
  return argNodes.map((a, i) => {
    if (a.concept === 'var_ref') {
      return { mode: 'select' as const, text: (a.properties.name as string) ?? 'x' }
    }
    // Non-var_ref: use compose mode and render expression block into inputs
    const exprBlock = ctx.renderExpression(a)
    if (exprBlock) {
      block.inputs[`ARG_${i}`] = { block: exprBlock }
    }
    return { mode: 'compose' as const }
  })
}
