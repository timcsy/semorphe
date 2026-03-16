import type { RenderStrategyRegistry, BlockState } from '../../../core/registry/render-strategy-registry'

export function registerCppRenderStrategies(registry: RenderStrategyRegistry): void {
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
  registry.register('cpp:renderDocComment', (node, _ctx) => {
    const block: BlockState = {
      type: 'c_comment_doc',
      id: _ctx.nextBlockId(),
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
