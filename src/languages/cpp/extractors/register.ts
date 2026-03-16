import { createNode } from '../../../core/semantic-tree'
import type { SemanticNode } from '../../../core/types'
import { BlockExtractorRegistry } from '../../../core/registry/block-extractor-registry'
import type { BlockExtractContext } from '../../../core/registry/block-extractor-registry'

/**
 * Block interface for extractor functions.
 * Uses `unknown` in the registry, but extractors cast to this shape internally.
 */
interface ExtractorBlock {
  type: string
  id: string
  getFieldValue(name: string): string | null
  getInputTargetBlock(name: string): ExtractorBlock | null
  getInput(name: string): unknown | null
  saveExtraState?(): Record<string, unknown> | null
}

function asBlock(b: unknown): ExtractorBlock {
  return b as ExtractorBlock
}

function extractStatementInput(block: ExtractorBlock, inputName: string, ctx: BlockExtractContext): SemanticNode[] {
  return ctx.extractStatementInput(block, inputName)
}

function countElseIfs(block: ExtractorBlock): number {
  let count = 0
  while (block.getInput(`ELSEIF_CONDITION_${count}`)) count++
  return count
}

function buildElseIfChain(block: ExtractorBlock, index: number, ctx: BlockExtractContext): SemanticNode[] {
  const total = countElseIfs(block)
  if (index >= total) {
    return extractStatementInput(block, 'ELSE', ctx)
  }

  const condBlock = block.getInputTargetBlock(`ELSEIF_CONDITION_${index}`)
  const cond = condBlock ? ctx.extractBlock(condBlock) : createNode('var_ref', { name: 'true' })
  const thenBody = extractStatementInput(block, `ELSEIF_THEN_${index}`, ctx)
  const elseBody = buildElseIfChain(block, index + 1, ctx)

  return [createNode('if', { isElseIf: 'true' }, {
    condition: cond ? [cond] : [],
    then_body: thenBody,
    else_body: elseBody,
  })]
}

export function registerCppExtractors(registry: BlockExtractorRegistry): void {
  // ── Variable declarations (complex multi-variable logic) ──
  registry.register('u_var_declare', (b, ctx) => {
    const block = asBlock(b)
    const type = block.getFieldValue('TYPE') ?? 'int'
    const declarators: SemanticNode[] = []
    let i = 0
    while (true) {
      const name = block.getFieldValue(`NAME_${i}`)
      if (name === null || name === undefined) break
      const initBlock = block.getInputTargetBlock(`INIT_${i}`)
      const initNode = initBlock ? ctx.extractBlock(initBlock) : null
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
      : (block.getFieldValue('NAME') ?? 'x')
    const initChildren = declarators.length === 1
      ? declarators[0].children.initializer ?? []
      : (() => {
          const initBlock = block.getInputTargetBlock('INIT') ?? block.getInputTargetBlock('INIT_0')
          const initNode = initBlock ? ctx.extractBlock(initBlock) : null
          return initNode ? [initNode] : []
        })()
    return createNode('var_declare', { name, type }, { initializer: initChildren })
  })

  // ── Control flow (if-elseif chain flattening) ──
  const extractIf = (b: unknown, ctx: BlockExtractContext): SemanticNode | null => {
    const block = asBlock(b)
    const condBlock = block.getInputTargetBlock('CONDITION')
    const cond = condBlock ? ctx.extractBlock(condBlock) : createNode('var_ref', { name: 'true' })
    const thenBody = extractStatementInput(block, 'THEN', ctx)
    let elseBody: SemanticNode[] = []
    if (countElseIfs(block) > 0) {
      elseBody = buildElseIfChain(block, 0, ctx)
    } else {
      elseBody = extractStatementInput(block, 'ELSE', ctx)
    }
    return createNode('if', {}, {
      condition: cond ? [cond] : [],
      then_body: thenBody,
      else_body: elseBody,
    })
  }
  registry.register('u_if', extractIf)
  registry.register('u_if_else', extractIf)

  // ── I/O (input with select mode fallback) ──
  const extractInput = (b: unknown, _ctx: BlockExtractContext): SemanticNode | null => {
    const block = asBlock(b)
    const extraState = block.saveExtraState?.() as { args?: Array<{ mode: string; text?: string; selectedVar?: string }> } | null
    const args = extraState?.args ?? []
    const varNames: string[] = []
    for (const a of args) {
      if (a.mode === 'select') {
        const name = a.text ?? a.selectedVar
        if (name) varNames.push(name)
      }
    }
    if (varNames.length === 0) {
      // Fallback: try SEL_0 field (dynamic dropdown), then NAME field (JSON blockDef)
      const singleVar = block.getFieldValue('SEL_0') ?? block.getFieldValue('NAME') ?? 'x'
      varNames.push(singleVar)
    }
    return createNode('input', { variable: varNames[0] }, {
      values: varNames.map(n => createNode('var_ref', { name: n })),
    })
  }
  registry.register('u_input', extractInput)
  registry.register('u_input_expr', extractInput)

  // ── Doc comment (flat property model) ──
  registry.register('c_comment_doc', (b) => {
    const block = asBlock(b)
    const props: Record<string, string> = { brief: block.getFieldValue('BRIEF') ?? '' }
    let i = 0
    while (true) {
      const paramName = block.getFieldValue(`PARAM_NAME_${i}`)
      if (paramName === null || paramName === undefined) break
      props[`param_${i}_name`] = paramName
      props[`param_${i}_desc`] = block.getFieldValue(`PARAM_DESC_${i}`) ?? ''
      i++
    }
    const returnDesc = block.getFieldValue('RETURN')
    if (returnDesc) props.return_desc = returnDesc
    return createNode('doc_comment', props)
  })

  // ── var_declare_expr (expression version) ──
  registry.register('c_var_declare_expr', (b, ctx) => {
    const block = asBlock(b)
    const type = block.getFieldValue('TYPE') ?? 'int'
    const name = block.getFieldValue('NAME_0') ?? 'i'
    const initBlock = block.getInputTargetBlock('INIT_0')
    const initNode = initBlock ? ctx.extractBlock(initBlock) : null
    return createNode('var_declare_expr', { name, type }, {
      initializer: initNode ? [initNode] : [],
    })
  })
}

export function createCppExtractorRegistry(): BlockExtractorRegistry {
  const registry = new BlockExtractorRegistry()
  registerCppExtractors(registry)
  return registry
}
