import { createNode } from '../../../core/semantic-tree'
import type { SemanticNode } from '../../../core/types'
import type { PatternExtractor, BlockState, ExtractContext } from '../../../core/projection/pattern-extractor'

/**
 * Register hand-written extraction strategies on a PatternExtractor instance.
 * These strategies handle blocks with complex logic that cannot be expressed
 * as declarative dynamicRules (multi-variable, elseif chains, select-mode fallback, etc.).
 *
 * Strategies operate on BlockState (JSON), NOT Blockly.Block.
 */
export function registerCppExtractStrategies(extractor: PatternExtractor): void {
  // ── Variable declarations (complex multi-variable logic) ──
  extractor.registerExtractStrategy('u_var_declare', (block: BlockState, ctx: ExtractContext) => {
    const type = (block.fields.TYPE as string) ?? 'int'
    const declarators: SemanticNode[] = []
    let i = 0
    while (true) {
      const name = block.fields[`NAME_${i}`] as string | undefined
      if (name === null || name === undefined) break
      const initInput = block.inputs[`INIT_${i}`]
      const initNode = initInput?.block ? ctx.extract(initInput.block) : null
      declarators.push(createNode('var_declarator', { name }, {
        initializer: initNode ? [initNode] : [],
      }))
      i++
    }
    if (declarators.length > 1) {
      return createNode('var_declare', { type }, { declarators })
    }
    const name = declarators.length === 1
      ? declarators[0].properties.name
      : ((block.fields.NAME as string) ?? 'x')
    const initChildren = declarators.length === 1
      ? declarators[0].children.initializer ?? []
      : (() => {
          const initInput = block.inputs.INIT ?? block.inputs.INIT_0
          const initNode = initInput?.block ? ctx.extract(initInput.block) : null
          return initNode ? [initNode] : []
        })()
    return createNode('var_declare', { name, type }, { initializer: initChildren })
  })

  // ── Control flow (if-elseif chain flattening) ──
  const extractIf = (block: BlockState, ctx: ExtractContext): SemanticNode | null => {
    const condInput = block.inputs.CONDITION
    const cond = condInput?.block ? ctx.extract(condInput.block) : createNode('var_ref', { name: 'true' })
    const thenInput = block.inputs.THEN
    const thenBody = thenInput?.block ? ctx.extractStatementChain(thenInput.block) : []

    let elseBody: SemanticNode[] = []
    const elseIfCount = countElseIfs(block)
    if (elseIfCount > 0) {
      elseBody = buildElseIfChain(block, 0, ctx)
    } else {
      const elseInput = block.inputs.ELSE
      elseBody = elseInput?.block ? ctx.extractStatementChain(elseInput.block) : []
    }

    return createNode('if', {}, {
      condition: cond ? [cond] : [],
      then_body: thenBody,
      else_body: elseBody,
    })
  }
  extractor.registerExtractStrategy('u_if', extractIf)
  extractor.registerExtractStrategy('u_if_else', extractIf)

  // ── I/O (input with select mode fallback) ──
  const extractInput = (block: BlockState, ctx: ExtractContext): SemanticNode | null => {
    const extraState = block.extraState as { args?: Array<{ mode: string; text?: string; selectedVar?: string }> } | undefined
    const args = extraState?.args ?? []
    const valueNodes: SemanticNode[] = []
    for (let i = 0; i < args.length; i++) {
      const a = args[i]
      if (a.mode === 'select') {
        const name = a.text ?? a.selectedVar
        if (name) valueNodes.push(createNode('var_ref', { name }))
      } else if (a.mode === 'compose') {
        const inputData = block.inputs[`ARG_${i}`]
        if (inputData?.block) {
          const extracted = ctx.extract(inputData.block)
          if (extracted) valueNodes.push(extracted)
        }
      }
    }
    if (valueNodes.length === 0) {
      // Fallback: try SEL_0 field (dynamic dropdown), then NAME field (JSON blockDef)
      const singleVar = (block.fields.SEL_0 as string) ?? (block.fields.NAME as string) ?? 'x'
      valueNodes.push(createNode('var_ref', { name: singleVar }))
    }
    const firstVarName = String((valueNodes[0] as any)?.properties?.name ?? 'x')
    return createNode('input', { variable: firstVarName }, {
      values: valueNodes,
    })
  }
  extractor.registerExtractStrategy('u_input', extractInput)
  extractor.registerExtractStrategy('u_input_expr', extractInput)

  // ── Doc comment (flat property model) ──
  extractor.registerExtractStrategy('c_comment_doc', (block: BlockState) => {
    const props: Record<string, string> = { brief: (block.fields.BRIEF as string) ?? '' }
    let i = 0
    while (true) {
      const paramName = block.fields[`PARAM_NAME_${i}`] as string | undefined
      if (paramName === null || paramName === undefined) break
      props[`param_${i}_name`] = paramName
      props[`param_${i}_desc`] = (block.fields[`PARAM_DESC_${i}`] as string) ?? ''
      i++
    }
    const returnDesc = block.fields.RETURN as string | undefined
    if (returnDesc) props.return_desc = returnDesc
    return createNode('doc_comment', props)
  })

  // ── var_declare_expr (expression version) ──
  extractor.registerExtractStrategy('c_var_declare_expr', (block: BlockState, ctx: ExtractContext) => {
    const type = (block.fields.TYPE as string) ?? 'int'
    const name = (block.fields.NAME_0 as string) ?? 'i'
    const initInput = block.inputs.INIT_0
    const initNode = initInput?.block ? ctx.extract(initInput.block) : null
    return createNode('var_declare_expr', { name, type }, {
      initializer: initNode ? [initNode] : [],
    })
  })
}

// ── Helpers for if-elseif chain ──

function countElseIfs(block: BlockState): number {
  let count = 0
  while (block.inputs[`ELSEIF_CONDITION_${count}`] !== undefined) count++
  return count
}

function buildElseIfChain(block: BlockState, index: number, ctx: ExtractContext): SemanticNode[] {
  const total = countElseIfs(block)
  if (index >= total) {
    const elseInput = block.inputs.ELSE
    return elseInput?.block ? ctx.extractStatementChain(elseInput.block) : []
  }

  const condInput = block.inputs[`ELSEIF_CONDITION_${index}`]
  const cond = condInput?.block ? ctx.extract(condInput.block) : createNode('var_ref', { name: 'true' })
  const thenInput = block.inputs[`ELSEIF_THEN_${index}`]
  const thenBody = thenInput?.block ? ctx.extractStatementChain(thenInput.block) : []
  const elseBody = buildElseIfChain(block, index + 1, ctx)

  return [createNode('if', { isElseIf: 'true' }, {
    condition: cond ? [cond] : [],
    then_body: thenBody,
    else_body: elseBody,
  })]
}
