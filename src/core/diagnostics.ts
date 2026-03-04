import type { WorkspaceDiagnostic } from './types'

interface BlockJSON {
  type: string
  id?: string
  fields?: Record<string, unknown>
  inputs?: Record<string, { block?: BlockJSON }>
  next?: { block?: BlockJSON }
  extraState?: Record<string, unknown>
}

interface WorkspaceStateJSON {
  blocks?: {
    blocks?: BlockJSON[]
  }
}

function collectAllBlocks(state: WorkspaceStateJSON): BlockJSON[] {
  const result: BlockJSON[] = []
  const topBlocks = state.blocks?.blocks ?? []

  function walk(block: BlockJSON) {
    result.push(block)
    if (block.inputs) {
      for (const inp of Object.values(block.inputs)) {
        if (inp?.block) walk(inp.block)
      }
    }
    if (block.next?.block) walk(block.next.block)
  }

  for (const top of topBlocks) {
    walk(top)
  }
  return result
}

function hasReturnInSubtree(block: BlockJSON): boolean {
  if (block.type === 'u_return') return true
  if (block.inputs) {
    for (const inp of Object.values(block.inputs)) {
      if (inp?.block && hasReturnInSubtree(inp.block)) return true
    }
  }
  if (block.next?.block && hasReturnInSubtree(block.next.block)) return true
  return false
}

function hasReturnInBody(block: BlockJSON): boolean {
  const body = block.inputs?.BODY?.block
  if (!body) return false
  return hasReturnInSubtree(body)
}

export function runDiagnosticsOnState(state: unknown): WorkspaceDiagnostic[] {
  const ws = state as WorkspaceStateJSON
  const allBlocks = collectAllBlocks(ws)
  const diagnostics: WorkspaceDiagnostic[] = []

  // Collect declared variable names
  const declaredVars = new Set<string>()
  for (const block of allBlocks) {
    if (block.type === 'u_var_declare') {
      const name = block.fields?.NAME as string
      if (name) declaredVars.add(name)
    }
    if (block.type === 'u_count_loop') {
      const name = block.fields?.VAR as string
      if (name) declaredVars.add(name)
    }
  }

  for (const block of allBlocks) {
    // Check: non-void function without return
    if (block.type === 'u_func_def') {
      const returnType = block.fields?.RETURN_TYPE as string
      if (returnType && returnType !== 'void') {
        if (!hasReturnInBody(block)) {
          diagnostics.push({
            blockId: block.id ?? '',
            type: 'missing_return',
            message: `函式 "${block.fields?.NAME}" 的回傳類型為 ${returnType}，但缺少 return 語句`,
          })
        }
      }
    }

    // Check: undeclared variable reference
    if (block.type === 'u_var_ref') {
      let name = block.fields?.NAME as string
      // Handle custom name from dynamic dropdown
      if (name === '__CUSTOM__') {
        name = (block.extraState?.customName as string) || (block.fields?.CUSTOM_NAME as string) || ''
      }
      if (name && name !== '__CUSTOM__' && !declaredVars.has(name)) {
        diagnostics.push({
          blockId: block.id ?? '',
          type: 'undeclared_variable',
          message: `變數 "${name}" 尚未宣告`,
        })
      }
    }
  }

  return diagnostics
}
