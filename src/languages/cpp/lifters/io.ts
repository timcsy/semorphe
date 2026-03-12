import type { Lifter } from '../../../core/lift/lifter'
import { createNode } from '../../../core/semantic-tree'
import { extractPrintf, extractScanf } from '../std/cstdio/lifters'
import { tryCmathLift } from '../std/cmath/lifters'

/** Map method names from field_expression to concept IDs */
const METHOD_TO_CONCEPT: Record<string, string> = {
  // vector
  push_back: 'cpp_vector_push_back',
  pop_back: 'cpp_vector_pop_back',
  clear: 'cpp_vector_clear',
  back: 'cpp_vector_back',
  size: 'cpp_vector_size',
  // stack
  top: 'cpp_stack_top',
  // queue
  front: 'cpp_queue_front',
  // ambiguous — pick most common container concept
  push: 'cpp_stack_push',
  pop: 'cpp_stack_pop',
  empty: 'cpp_vector_empty',
  erase: 'cpp_map_erase',
  count: 'cpp_map_count',
  insert: 'cpp_set_insert',
}

/** Methods that take one argument (the rest take zero) */
const METHODS_WITH_ARG = new Set([
  'push_back', 'push', 'insert', 'erase', 'count',
])

/** Property name used for the object in each concept's semantic node */
const METHOD_OBJ_PROP: Record<string, string> = {
  push_back: 'vector',
  pop_back: 'vector',
  clear: 'vector',
  back: 'vector',
  size: 'vector',
  empty: 'vector',
  push: 'obj',
  pop: 'obj',
  top: 'obj',
  front: 'obj',
  erase: 'obj',
  count: 'obj',
  insert: 'obj',
}

/** Child slot name for the argument value */
const METHOD_CHILD_SLOT: Record<string, string> = {
  push_back: 'value',
  push: 'value',
  insert: 'value',
  erase: 'key',
  count: 'key',
}

export function registerIOLifters(lifter: Lifter): void {
  lifter.register('call_expression', (node, ctx) => {
    const funcNode = node.childForFieldName('function')
    const argsNode = node.childForFieldName('arguments')
    const funcName = funcNode?.text ?? ''

    // Method call: obj.method(...) via field_expression
    if (funcNode && funcNode.type === 'field_expression') {
      const objNode = funcNode.childForFieldName('argument')
      const fieldNode = funcNode.childForFieldName('field')
      const objText = objNode?.text ?? ''
      const methodName = fieldNode?.text ?? ''

      const conceptId = METHOD_TO_CONCEPT[methodName]
      if (conceptId) {
        const propName = METHOD_OBJ_PROP[methodName] ?? 'obj'
        const properties: Record<string, string> = { [propName]: objText }

        if (METHODS_WITH_ARG.has(methodName) && argsNode) {
          const childSlot = METHOD_CHILD_SLOT[methodName] ?? 'value'
          const argNodes = argsNode.namedChildren
            .map(a => ctx.lift(a))
            .filter((n): n is NonNullable<typeof n> => n !== null)
          return createNode(conceptId, properties, { [childSlot]: argNodes })
        }

        return createNode(conceptId, properties)
      }
    }

    // printf("...", args) → cstdio module
    if (funcName === 'printf') {
      return extractPrintf(argsNode, ctx)
    }

    // scanf("...", &args) → cstdio module
    if (funcName === 'scanf') {
      return extractScanf(argsNode, ctx)
    }

    // cmath functions (pow, sqrt, sin, cos, etc.)
    const cmathResult = tryCmathLift(funcName, argsNode, ctx)
    if (cmathResult) return cmathResult

    // General function call
    const args = argsNode
      ? argsNode.namedChildren.map(a => ctx.lift(a)).filter((n): n is NonNullable<typeof n> => n !== null)
      : []
    return createNode('func_call_expr', { name: funcName }, { args })
  })
}
