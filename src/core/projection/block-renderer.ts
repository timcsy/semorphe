import type { SemanticNode } from '../types'
import { PatternRenderer } from './pattern-renderer'

interface BlockState {
  type: string
  id: string
  fields: Record<string, unknown>
  inputs: Record<string, { block: BlockState }>
  next?: { block: BlockState }
  extraState?: Record<string, unknown>
  x?: number
  y?: number
}

interface WorkspaceBlockState {
  blocks: {
    languageVersion: number
    blocks: BlockState[]
  }
}

let globalPatternRenderer: PatternRenderer | null = null

/** Set the JSON-driven pattern renderer engine */
export function setPatternRenderer(pr: PatternRenderer): void {
  globalPatternRenderer = pr
}

const CONCEPT_TO_BLOCK: Record<string, string> = {
  var_declare: 'u_var_declare',
  var_assign: 'u_var_assign',
  var_ref: 'u_var_ref',
  number_literal: 'u_number',
  string_literal: 'u_string',
  arithmetic: 'u_arithmetic',
  compare: 'u_compare',
  logic: 'u_logic',
  logic_not: 'u_logic_not',
  negate: 'u_negate',
  if: 'u_if',
  count_loop: 'u_count_loop',
  while_loop: 'u_while_loop',
  break: 'u_break',
  continue: 'u_continue',
  func_def: 'u_func_def',
  func_call: 'u_func_call',
  func_call_expr: 'u_func_call_expr',
  return: 'u_return',
  print: 'u_print',
  input: 'u_input',
  endl: 'u_endl',
  array_declare: 'u_array_declare',
  array_access: 'u_array_access',
  comment: 'c_comment_line',
  // C++ specific
  cpp_include: 'c_include',
  cpp_include_local: 'c_include_local',
  cpp_using_namespace: 'c_using_namespace',
  cpp_define: 'c_define',
}

let blockIdCounter = 0

function nextBlockId(): string {
  return `block_${++blockIdCounter}`
}

export function renderToBlocklyState(tree: SemanticNode): WorkspaceBlockState {
  blockIdCounter = 0
  if (tree.concept !== 'program') {
    return { blocks: { languageVersion: 0, blocks: [] } }
  }

  const body = tree.children.body ?? []
  if (body.length === 0) {
    return { blocks: { languageVersion: 0, blocks: [] } }
  }

  // Chain top-level statements into a single block chain
  const firstBlock = renderStatementChain(body)
  if (!firstBlock) {
    return { blocks: { languageVersion: 0, blocks: [] } }
  }

  firstBlock.x = 30
  firstBlock.y = 30

  return {
    blocks: {
      languageVersion: 0,
      blocks: [firstBlock],
    },
  }
}

function renderStatementChain(nodes: SemanticNode[]): BlockState | null {
  if (nodes.length === 0) return null

  const first = renderBlock(nodes[0])
  if (!first) return null

  let current = first
  for (let i = 1; i < nodes.length; i++) {
    const next = renderBlock(nodes[i])
    if (next) {
      current.next = { block: next }
      current = next
    }
  }

  return first
}

// Concepts that need special handling in the switch-case below
// (e.g., dynamic fields like NAME_0, NAME_1 or extraState)
const SWITCH_CASE_CONCEPTS = new Set([
  'input', 'var_declare', 'print', 'func_def', 'func_call', 'func_call_expr', 'if',
])

function renderBlock(node: SemanticNode): BlockState | null {
  // Try JSON-driven pattern renderer first (skip concepts with special switch-case logic)
  if (globalPatternRenderer && !SWITCH_CASE_CONCEPTS.has(node.concept)) {
    const patternResult = globalPatternRenderer.render(node)
    if (patternResult) return patternResult
  }

  const blockType = CONCEPT_TO_BLOCK[node.concept]

  if (!blockType) {
    // raw_code or unknown
    if (node.concept === 'raw_code') {
      return {
        type: 'c_raw_code',
        id: nextBlockId(),
        fields: { CODE: node.metadata?.rawCode ?? node.properties.code ?? '' },
        inputs: {},
      }
    }
    // unresolved — render as raw_code block with visual distinction
    if (node.concept === 'unresolved') {
      return {
        type: 'c_raw_code',
        id: nextBlockId(),
        fields: { CODE: node.metadata?.rawCode ?? '' },
        inputs: {},
        extraState: { unresolved: true, nodeType: node.properties.node_type },
      }
    }
    return null
  }

  const block: BlockState = {
    type: blockType,
    id: nextBlockId(),
    fields: {},
    inputs: {},
  }

  switch (node.concept) {
    case 'var_declare':
      renderVarDeclare(node, block)
      break
    case 'var_assign':
      renderVarAssign(node, block)
      break
    case 'var_ref':
      block.fields.NAME = node.properties.name ?? 'x'
      break
    case 'number_literal':
      block.fields.NUM = Number(node.properties.value ?? 0)
      break
    case 'string_literal':
      block.fields.TEXT = node.properties.value ?? ''
      break
    case 'arithmetic':
    case 'compare':
    case 'logic':
      renderBinaryOp(node, block)
      break
    case 'logic_not':
      renderChild(node, 'operand', block, 'A')
      break
    case 'negate':
      renderChild(node, 'value', block, 'VALUE')
      break
    case 'if':
      renderIf(node, block)
      break
    case 'while_loop':
      renderWhileLoop(node, block)
      break
    case 'count_loop':
      renderCountLoop(node, block)
      break
    case 'func_def':
      renderFuncDef(node, block)
      break
    case 'func_call':
    case 'func_call_expr':
      renderFuncCall(node, block)
      break
    case 'return':
      renderChild(node, 'value', block, 'VALUE')
      break
    case 'print':
      renderPrint(node, block)
      break
    case 'input': {
      // Handle chain-lifted cin (children.values contains var_ref nodes)
      const inputValues = node.children.values ?? []
      if (inputValues.length > 0) {
        for (let vi = 0; vi < inputValues.length; vi++) {
          block.fields[`NAME_${vi}`] = inputValues[vi].properties.name ?? 'x'
        }
        if (inputValues.length > 1) {
          block.extraState = { varCount: inputValues.length }
        }
      } else {
        // Single variable from properties
        block.fields.NAME_0 = node.properties.variable ?? 'x'
        // Handle multiple variables stored as comma-separated or array
        const vars = node.properties.variables
        if (vars) {
          const varList = typeof vars === 'string' ? vars.split(',') : (Array.isArray(vars) ? vars : [])
          for (let vi = 0; vi < varList.length; vi++) {
            block.fields[`NAME_${vi}`] = varList[vi]
          }
          if (varList.length > 1) {
            block.extraState = { varCount: varList.length }
          }
        }
      }
      break
    }
    case 'array_declare': {
      block.fields.TYPE = node.properties.type ?? 'int'
      block.fields.NAME = node.properties.name ?? 'arr'
      // SIZE is now a value input, render as expression child
      const sizeNodes = node.children.size ?? []
      if (sizeNodes.length > 0) {
        renderChild(node, 'size', block, 'SIZE')
      } else {
        // Fallback: create a number literal block for the size
        const sizeVal = node.properties.size ?? '10'
        block.inputs.SIZE = { block: { type: 'u_number', id: nextBlockId(), fields: { NUM: Number(sizeVal) }, inputs: {} } }
      }
      break
    }
    case 'array_access':
      block.fields.NAME = node.properties.name ?? 'arr'
      renderChild(node, 'index', block, 'INDEX')
      break
    case 'comment':
      block.fields.TEXT = node.properties.text ?? ''
      break
    case 'break':
    case 'continue':
    case 'endl':
      // No fields or inputs
      break
    // C++ specific blocks
    case 'cpp_include':
      block.fields.HEADER = node.properties.header ?? 'iostream'
      break
    case 'cpp_include_local':
      block.fields.HEADER = node.properties.header ?? 'myheader.h'
      break
    case 'cpp_using_namespace':
      block.fields.NS = node.properties.namespace ?? 'std'
      break
    case 'cpp_define':
      block.fields.NAME = node.properties.name ?? 'MACRO'
      block.fields.VALUE = node.properties.value ?? ''
      break
  }

  return block
}

function renderVarDeclare(node: SemanticNode, block: BlockState): void {
  block.fields.TYPE = node.properties.type ?? 'int'
  const declarators = node.children.declarators ?? []

  if (declarators.length > 0) {
    // Multi-variable declaration
    const items: string[] = []
    for (let i = 0; i < declarators.length; i++) {
      const d = declarators[i]
      block.fields[`NAME_${i}`] = d.properties.name ?? 'x'
      const inits = d.children.initializer ?? []
      if (inits.length > 0) {
        const initBlock = renderExpression(inits[0])
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
    // Single variable
    block.fields.NAME_0 = node.properties.name ?? 'x'
    const inits = node.children.initializer ?? []
    if (inits.length > 0) {
      const initBlock = renderExpression(inits[0])
      if (initBlock) {
        block.inputs.INIT_0 = { block: initBlock }
      }
    }
    block.extraState = { items: [inits.length > 0 ? 'var_init' : 'var'] }
  }
}

function renderVarAssign(node: SemanticNode, block: BlockState): void {
  block.fields.NAME = node.properties.name ?? 'x'
  renderChild(node, 'value', block, 'VALUE')
}

function renderBinaryOp(node: SemanticNode, block: BlockState): void {
  block.fields.OP = node.properties.operator ?? '+'
  renderChild(node, 'left', block, 'A')
  renderChild(node, 'right', block, 'B')
}

function renderIf(node: SemanticNode, block: BlockState): void {
  const elseBody = node.children.else_body ?? []
  // Always use u_if (unified progressive block), set extraState for else
  renderChild(node, 'condition', block, 'CONDITION')
  renderStatementChild(node, 'then_body', block, 'THEN')
  if (elseBody.length > 0) {
    renderStatementChild(node, 'else_body', block, 'ELSE')
    block.extraState = { hasElse: true }
  }
}

function renderWhileLoop(node: SemanticNode, block: BlockState): void {
  renderChild(node, 'condition', block, 'CONDITION')
  renderStatementChild(node, 'body', block, 'BODY')
}

function renderCountLoop(node: SemanticNode, block: BlockState): void {
  block.fields.VAR = node.properties.var_name ?? 'i'
  renderChild(node, 'from', block, 'FROM')
  renderChild(node, 'to', block, 'TO')
  renderStatementChild(node, 'body', block, 'BODY')
}

function renderFuncDef(node: SemanticNode, block: BlockState): void {
  block.fields.NAME = node.properties.name ?? 'f'
  block.fields.RETURN_TYPE = node.properties.return_type ?? 'void'
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
  renderStatementChild(node, 'body', block, 'BODY')
}

function renderFuncCall(node: SemanticNode, block: BlockState): void {
  block.fields.NAME = node.properties.name ?? 'f'
  const args = node.children.args ?? []
  for (let i = 0; i < args.length; i++) {
    const argBlock = renderExpression(args[i])
    if (argBlock) {
      block.inputs[`ARG_${i}`] = { block: argBlock }
    }
  }
  if (args.length > 0) {
    block.extraState = { ...block.extraState, argCount: args.length }
  }
}

function renderPrint(node: SemanticNode, block: BlockState): void {
  const values = node.children.values ?? []
  for (let i = 0; i < values.length; i++) {
    const valBlock = renderExpression(values[i])
    if (valBlock) {
      block.inputs[`EXPR${i}`] = { block: valBlock }
    }
  }
  if (values.length > 0) {
    block.extraState = { itemCount: values.length }
  }
}

function renderChild(node: SemanticNode, childName: string, block: BlockState, inputName: string): void {
  const children = node.children[childName] ?? []
  if (children.length > 0) {
    const childBlock = renderExpression(children[0])
    if (childBlock) {
      block.inputs[inputName] = { block: childBlock }
    }
  }
}

function renderStatementChild(node: SemanticNode, childName: string, block: BlockState, inputName: string): void {
  const children = node.children[childName] ?? []
  if (children.length > 0) {
    const chain = renderStatementChain(children)
    if (chain) {
      block.inputs[inputName] = { block: chain }
    }
  }
}

function renderExpression(node: SemanticNode): BlockState | null {
  const block = renderBlock(node)
  // If it's a raw_code (statement) block in expression context, use c_raw_expression instead
  if (block && block.type === 'c_raw_code') {
    return { ...block, type: 'c_raw_expression' }
  }
  return block
}
