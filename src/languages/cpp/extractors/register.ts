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
}

function asBlock(b: unknown): ExtractorBlock {
  return b as ExtractorBlock
}

/** Map Blockly operator field values to semantic operators */
function mapOperator(op: string): string {
  const map: Record<string, string> = {
    'ADD': '+', 'SUB': '-', 'MUL': '*', 'DIV': '/', 'MOD': '%',
    'EQ': '==', 'NEQ': '!=', 'LT': '<', 'GT': '>', 'LTE': '<=', 'GTE': '>=',
    'AND': '&&', 'OR': '||',
  }
  return map[op] ?? op
}

function extractBinaryExpr(
  block: ExtractorBlock,
  concept: string,
  opField: string,
  leftInput: string,
  rightInput: string,
  ctx: BlockExtractContext,
): SemanticNode {
  const op = mapOperator(block.getFieldValue(opField) ?? '+')
  const leftBlock = block.getInputTargetBlock(leftInput)
  const rightBlock = block.getInputTargetBlock(rightInput)
  const left = leftBlock ? ctx.extractBlock(leftBlock) : createNode('number_literal', { value: '0' })
  const right = rightBlock ? ctx.extractBlock(rightBlock) : createNode('number_literal', { value: '0' })
  return createNode(concept, { operator: op }, {
    left: left ? [left] : [],
    right: right ? [right] : [],
  })
}

function extractUnaryExpr(
  block: ExtractorBlock,
  concept: string,
  inputName: string,
  childName: string,
  ctx: BlockExtractContext,
): SemanticNode {
  const innerBlock = block.getInputTargetBlock(inputName)
  const inner = innerBlock ? ctx.extractBlock(innerBlock) : createNode('number_literal', { value: '0' })
  return createNode(concept, {}, {
    [childName]: inner ? [inner] : [],
  })
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

/** Extract three-mode args (printf/scanf dynamic args) */
function extractThreeModeArgs(block: ExtractorBlock, ctx: BlockExtractContext): SemanticNode[] {
  const extraState = (block as unknown as { extraState?: { args?: Array<{ mode: string; text?: string }> } }).extraState
  const argSlots = extraState?.args ?? []
  const args: SemanticNode[] = []
  for (let i = 0; i < argSlots.length; i++) {
    const slot = argSlots[i]
    if (slot.mode === 'select' && slot.text) {
      args.push(createNode('var_ref', { name: slot.text }))
    } else if (slot.mode === 'compose') {
      const argBlock = block.getInputTargetBlock(`ARG_${i}`)
      if (argBlock) {
        const argNode = ctx.extractBlock(argBlock)
        if (argNode) args.push(argNode)
      }
    }
  }
  return args
}

export function registerCppExtractors(registry: BlockExtractorRegistry): void {
  // Variable declarations
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

  registry.register('u_var_assign', (b, ctx) => {
    const block = asBlock(b)
    const name = block.getFieldValue('NAME') ?? 'x'
    const valueBlock = block.getInputTargetBlock('VALUE')
    const valueNode = valueBlock ? ctx.extractBlock(valueBlock) : null
    return createNode('var_assign', { name }, { value: valueNode ? [valueNode] : [] })
  })

  registry.register('u_var_ref', (b) => {
    const block = asBlock(b)
    return createNode('var_ref', { name: block.getFieldValue('NAME') ?? 'x' })
  })

  registry.register('u_number', (b) => {
    const block = asBlock(b)
    return createNode('number_literal', { value: String(block.getFieldValue('NUM') ?? 0) })
  })

  registry.register('u_string', (b) => {
    const block = asBlock(b)
    return createNode('string_literal', { value: block.getFieldValue('TEXT') ?? '' })
  })

  // Operators
  registry.register('u_arithmetic', (b, ctx) => extractBinaryExpr(asBlock(b), 'arithmetic', 'OP', 'A', 'B', ctx))
  registry.register('u_compare', (b, ctx) => extractBinaryExpr(asBlock(b), 'compare', 'OP', 'A', 'B', ctx))
  registry.register('u_logic', (b, ctx) => extractBinaryExpr(asBlock(b), 'logic', 'OP', 'A', 'B', ctx))
  registry.register('u_logic_not', (b, ctx) => extractUnaryExpr(asBlock(b), 'logic_not', 'A', 'operand', ctx))

  registry.register('u_negate', (b, ctx) => {
    const block = asBlock(b)
    const negOp = block.getFieldValue('OP') ?? '-'
    const negInner = block.getInputTargetBlock('VALUE')
    const negChild = negInner ? ctx.extractBlock(negInner) : createNode('number_literal', { value: '0' })
    return createNode('negate', { operator: negOp }, { value: negChild ? [negChild] : [] })
  })

  // Control flow
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

  registry.register('u_while_loop', (b, ctx) => {
    const block = asBlock(b)
    const condBlock = block.getInputTargetBlock('CONDITION')
    const cond = condBlock ? ctx.extractBlock(condBlock) : createNode('var_ref', { name: 'true' })
    const body = extractStatementInput(block, 'BODY', ctx)
    return createNode('while_loop', {}, { condition: cond ? [cond] : [], body })
  })

  registry.register('u_count_loop', (b, ctx) => {
    const block = asBlock(b)
    const varName = block.getFieldValue('VAR') ?? 'i'
    const inclusive = block.getFieldValue('BOUND') ?? 'FALSE'
    const fromBlock = block.getInputTargetBlock('FROM')
    const toBlock = block.getInputTargetBlock('TO')
    const from = fromBlock ? ctx.extractBlock(fromBlock) : createNode('number_literal', { value: '0' })
    const to = toBlock ? ctx.extractBlock(toBlock) : createNode('number_literal', { value: '10' })
    const body = extractStatementInput(block, 'BODY', ctx)
    return createNode('count_loop', { var_name: varName, inclusive }, {
      from: from ? [from] : [],
      to: to ? [to] : [],
      body,
    })
  })

  registry.register('c_for_loop', (b, ctx) => {
    const block = asBlock(b)
    const initBlock = block.getInputTargetBlock('INIT')
    const condBlock = block.getInputTargetBlock('COND')
    const updateBlock = block.getInputTargetBlock('UPDATE')
    const init = initBlock ? ctx.extractBlock(initBlock) : null
    const cond = condBlock ? ctx.extractBlock(condBlock) : null
    const update = updateBlock ? ctx.extractBlock(updateBlock) : null
    const body = extractStatementInput(block, 'BODY', ctx)
    return createNode('cpp_for_loop', {}, {
      init: init ? [init] : [],
      cond: cond ? [cond] : [],
      update: update ? [update] : [],
      body,
    })
  })

  registry.register('u_break', () => createNode('break', {}))
  registry.register('u_continue', () => createNode('continue', {}))

  // Functions
  registry.register('u_func_def', (b, ctx) => {
    const block = asBlock(b)
    const name = block.getFieldValue('NAME') ?? 'f'
    const returnType = block.getFieldValue('RETURN_TYPE') ?? 'void'
    const paramNodes: SemanticNode[] = []
    let i = 0
    while (true) {
      const paramType = block.getFieldValue(`TYPE_${i}`)
      const paramName = block.getFieldValue(`PARAM_${i}`)
      if (paramType === null && paramName === null) break
      paramNodes.push(createNode('param_decl', { type: paramType ?? 'int', name: paramName ?? `p${i}` }))
      i++
    }
    const body = extractStatementInput(block, 'BODY', ctx)
    return createNode('func_def', { name, return_type: returnType }, { params: paramNodes, body })
  })

  registry.register('u_func_call', (b, ctx) => {
    const block = asBlock(b)
    const name = block.getFieldValue('NAME') ?? 'f'
    const args = ctx.extractFuncArgs(block)
    return createNode('func_call', { name }, { args })
  })

  registry.register('u_func_call_expr', (b, ctx) => {
    const block = asBlock(b)
    const name = block.getFieldValue('NAME') ?? 'f'
    const args = ctx.extractFuncArgs(block)
    return createNode('func_call_expr', { name }, { args })
  })

  registry.register('u_return', (b, ctx) => {
    const block = asBlock(b)
    const valueBlock = block.getInputTargetBlock('VALUE')
    const valueNode = valueBlock ? ctx.extractBlock(valueBlock) : null
    return createNode('return', {}, { value: valueNode ? [valueNode] : [] })
  })

  // I/O
  registry.register('u_print', (b, ctx) => {
    const block = asBlock(b)
    const values: SemanticNode[] = []
    let i = 0
    while (true) {
      const exprBlock = block.getInputTargetBlock(`EXPR${i}`)
      if (!exprBlock) break
      const exprNode = ctx.extractBlock(exprBlock)
      if (exprNode) values.push(exprNode)
      i++
    }
    return createNode('print', {}, { values })
  })

  const extractInput = (b: unknown, _ctx: BlockExtractContext): SemanticNode | null => {
    const block = asBlock(b)
    const extraState = (block as unknown as { extraState?: { args?: Array<{ mode: string; text?: string }> } }).extraState
    const args = extraState?.args ?? []
    const varNames: string[] = []
    for (const a of args) {
      if (a.mode === 'select' && a.text) varNames.push(a.text)
    }
    if (varNames.length === 0) {
      const singleVar = block.getFieldValue('VAR') ?? 'x'
      varNames.push(singleVar)
    }
    return createNode('input', { variable: varNames[0] }, {
      values: varNames.map(n => createNode('var_ref', { name: n })),
    })
  }
  registry.register('u_input', extractInput)
  registry.register('u_input_expr', extractInput)
  registry.register('u_endl', () => createNode('endl', {}))

  registry.register('c_printf', (b, ctx) => {
    const block = asBlock(b)
    const format = block.getFieldValue('FORMAT') ?? '%d\\n'
    const args = extractThreeModeArgs(block, ctx)
    return createNode('cpp_printf', { format }, { args })
  })

  registry.register('c_scanf', (b, ctx) => {
    const block = asBlock(b)
    const format = block.getFieldValue('FORMAT') ?? '%d'
    const args = extractThreeModeArgs(block, ctx)
    return createNode('cpp_scanf', { format }, { args })
  })

  // Arrays
  registry.register('u_array_declare', (b, ctx) => {
    const block = asBlock(b)
    const type = block.getFieldValue('TYPE') ?? 'int'
    const name = block.getFieldValue('NAME') ?? 'arr'
    const sizeBlock = block.getInputTargetBlock('SIZE')
    const sizeNode = sizeBlock ? ctx.extractBlock(sizeBlock) : null
    return createNode('array_declare', { type, name }, { size: sizeNode ? [sizeNode] : [] })
  })

  registry.register('u_array_access', (b, ctx) => {
    const block = asBlock(b)
    const name = block.getFieldValue('NAME') ?? 'arr'
    const idxBlock = block.getInputTargetBlock('INDEX')
    const idxNode = idxBlock ? ctx.extractBlock(idxBlock) : createNode('number_literal', { value: '0' })
    return createNode('array_access', { name }, { index: idxNode ? [idxNode] : [] })
  })

  registry.register('u_array_assign', (b, ctx) => {
    const block = asBlock(b)
    const arrName = block.getFieldValue('NAME') ?? 'arr'
    const idxBlock = block.getInputTargetBlock('INDEX')
    const valBlock = block.getInputTargetBlock('VALUE')
    const idxNode = idxBlock ? ctx.extractBlock(idxBlock) : createNode('number_literal', { value: '0' })
    const valNode = valBlock ? ctx.extractBlock(valBlock) : createNode('number_literal', { value: '0' })
    return createNode('array_assign', { name: arrName }, {
      index: idxNode ? [idxNode] : [],
      value: valNode ? [valNode] : [],
    })
  })

  // C++ basic blocks
  registry.register('c_increment', (b) => {
    const block = asBlock(b)
    return createNode('cpp_increment', {
      name: block.getFieldValue('NAME') ?? 'i',
      operator: block.getFieldValue('OP') ?? '++',
      position: block.getFieldValue('POSITION') ?? 'postfix',
    })
  })

  registry.register('c_compound_assign', (b, ctx) => {
    const block = asBlock(b)
    const valueBlock = block.getInputTargetBlock('VALUE')
    const valueNode = valueBlock ? ctx.extractBlock(valueBlock) : createNode('number_literal', { value: '1' })
    return createNode('cpp_compound_assign', {
      name: block.getFieldValue('NAME') ?? 'x',
      operator: block.getFieldValue('OP') ?? '+=',
    }, { value: valueNode ? [valueNode] : [] })
  })

  // Expression versions
  registry.register('c_increment_expr', (b) => {
    const block = asBlock(b)
    return createNode('cpp_increment_expr', {
      name: block.getFieldValue('NAME') ?? 'i',
      operator: block.getFieldValue('OP') ?? '++',
      position: block.getFieldValue('POSITION') ?? 'postfix',
    })
  })

  registry.register('c_compound_assign_expr', (b, ctx) => {
    const block = asBlock(b)
    const valueBlock = block.getInputTargetBlock('VALUE')
    const valueNode = valueBlock ? ctx.extractBlock(valueBlock) : createNode('number_literal', { value: '1' })
    return createNode('cpp_compound_assign_expr', {
      name: block.getFieldValue('NAME') ?? 'x',
      operator: block.getFieldValue('OP') ?? '+=',
    }, { value: valueNode ? [valueNode] : [] })
  })

  registry.register('c_scanf_expr', (b, ctx) => {
    const block = asBlock(b)
    const format = block.getFieldValue('FORMAT') ?? '%d'
    const args = extractThreeModeArgs(block, ctx)
    return createNode('cpp_scanf_expr', { format }, { args })
  })

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

  // C++ control flow
  registry.register('c_do_while', (b, ctx) => {
    const block = asBlock(b)
    const body = extractStatementInput(block, 'BODY', ctx)
    const condBlock = block.getInputTargetBlock('COND')
    const condNode = condBlock ? ctx.extractBlock(condBlock) : createNode('var_ref', { name: 'true' })
    return createNode('cpp_do_while', {}, {
      body,
      cond: condNode ? [condNode] : [],
    })
  })

  registry.register('c_ternary', (b, ctx) => {
    const block = asBlock(b)
    const condBlock = block.getInputTargetBlock('CONDITION')
    const trueBlock = block.getInputTargetBlock('TRUE_EXPR')
    const falseBlock = block.getInputTargetBlock('FALSE_EXPR')
    const condNode = condBlock ? ctx.extractBlock(condBlock) : createNode('var_ref', { name: 'true' })
    const trueNode = trueBlock ? ctx.extractBlock(trueBlock) : createNode('number_literal', { value: '0' })
    const falseNode = falseBlock ? ctx.extractBlock(falseBlock) : createNode('number_literal', { value: '0' })
    return createNode('cpp_ternary', {}, {
      condition: condNode ? [condNode] : [],
      true_expr: trueNode ? [trueNode] : [],
      false_expr: falseNode ? [falseNode] : [],
    })
  })

  registry.register('c_char_literal', (b) => {
    const block = asBlock(b)
    return createNode('char_literal', { value: block.getFieldValue('VALUE') ?? 'a' })
  })

  registry.register('c_cast', (b, ctx) => {
    const block = asBlock(b)
    const castValBlock = block.getInputTargetBlock('VALUE')
    const castValNode = castValBlock ? ctx.extractBlock(castValBlock) : createNode('number_literal', { value: '0' })
    return createNode('cpp_cast', { target_type: block.getFieldValue('TYPE') ?? 'int' }, {
      value: castValNode ? [castValNode] : [],
    })
  })

  registry.register('c_bitwise_not', (b, ctx) => {
    const block = asBlock(b)
    const bnotBlock = block.getInputTargetBlock('VALUE')
    const bnotNode = bnotBlock ? ctx.extractBlock(bnotBlock) : createNode('number_literal', { value: '0' })
    return createNode('bitwise_not', {}, { operand: bnotNode ? [bnotNode] : [] })
  })

  registry.register('c_builtin_constant', (b) => {
    const block = asBlock(b)
    return createNode('builtin_constant', { value: block.getFieldValue('VALUE') ?? 'true' })
  })

  // Forward declaration
  registry.register('c_forward_decl', (b) => {
    const block = asBlock(b)
    const returnType = block.getFieldValue('RETURN_TYPE') ?? 'void'
    const fwdName = block.getFieldValue('NAME') ?? 'f'
    const fwdParamNodes: SemanticNode[] = []
    for (let i = 0; ; i++) {
      const paramType = block.getFieldValue(`TYPE_${i}`)
      if (paramType === null || paramType === undefined) break
      fwdParamNodes.push(createNode('param_decl', { type: paramType }))
    }
    return createNode('forward_decl', {
      return_type: returnType,
      name: fwdName,
    }, { params: fwdParamNodes })
  })

  // Special blocks
  registry.register('c_raw_code', (b) => {
    const block = asBlock(b)
    const code = block.getFieldValue('CODE') ?? ''
    const node = createNode('raw_code', { code })
    node.metadata = { rawCode: code }
    return node
  })

  registry.register('c_raw_expression', (b) => {
    const block = asBlock(b)
    const code = block.getFieldValue('CODE') ?? ''
    const node = createNode('raw_code', { code })
    node.metadata = { rawCode: code }
    return node
  })

  registry.register('c_comment_line', (b) => {
    const block = asBlock(b)
    return createNode('comment', { text: block.getFieldValue('TEXT') ?? '' })
  })

  registry.register('c_comment_block', (b) => {
    const block = asBlock(b)
    return createNode('block_comment', { text: block.getFieldValue('TEXT') ?? '' })
  })

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

  // Preprocessor
  registry.register('c_include', (b) => {
    const block = asBlock(b)
    return createNode('cpp_include', { header: block.getFieldValue('HEADER') ?? 'iostream', local: false })
  })

  registry.register('c_include_local', (b) => {
    const block = asBlock(b)
    return createNode('cpp_include_local', { header: block.getFieldValue('HEADER') ?? 'myheader.h' })
  })

  registry.register('c_using_namespace', (b) => {
    const block = asBlock(b)
    return createNode('cpp_using_namespace', { namespace: block.getFieldValue('NS') ?? 'std' })
  })

  registry.register('c_define', (b) => {
    const block = asBlock(b)
    return createNode('cpp_define', {
      name: block.getFieldValue('NAME') ?? 'MACRO',
      value: block.getFieldValue('VALUE') ?? '',
    })
  })
}

export function createCppExtractorRegistry(): BlockExtractorRegistry {
  const registry = new BlockExtractorRegistry()
  registerCppExtractors(registry)
  return registry
}
