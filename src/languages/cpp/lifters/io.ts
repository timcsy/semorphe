import type { Lifter } from '../../../core/lift/lifter'
import type { AstNode, LiftContext } from '../../../core/lift/types'
import { createNode } from '../../../core/semantic-tree'
import { extractPrintf, extractScanf } from '../std/cstdio/lifters'
import { tryCmathLift } from '../std/cmath/lifters'

/** Try to lift a method call (field_expression) into a specific concept */
function tryMethodCallLift(
  funcNode: AstNode,
  argsNode: AstNode | null | undefined,
  ctx: LiftContext,
): ReturnType<typeof createNode> | null {
  if (funcNode.type !== 'field_expression') return null

  const objNode = funcNode.childForFieldName('argument')
  const fieldNode = funcNode.childForFieldName('field')
  if (!objNode || !fieldNode) return null

  const obj = objNode.text
  const method = fieldNode.text
  const argChildren = argsNode?.namedChildren ?? []

  // String method calls
  switch (method) {
    case 'length':
      return createNode('cpp_string_length', { obj })
    case 'substr': {
      const pos = argChildren[0] ? ctx.lift(argChildren[0]) : null
      const len = argChildren[1] ? ctx.lift(argChildren[1]) : null
      return createNode('cpp_string_substr', { obj }, {
        pos: pos ? [pos] : [],
        len: len ? [len] : [],
      })
    }
    case 'find': {
      const arg = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode('cpp_string_find', { obj }, {
        arg: arg ? [arg] : [],
      })
    }
    case 'append': {
      const value = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode('cpp_string_append', { obj }, {
        value: value ? [value] : [],
      })
    }
    case 'c_str':
      return createNode('cpp_string_c_str', { obj })
    case 'empty':
      return createNode('cpp_string_empty', { obj })
    case 'erase': {
      const pos = argChildren[0] ? ctx.lift(argChildren[0]) : null
      const len = argChildren[1] ? ctx.lift(argChildren[1]) : null
      return createNode('cpp_string_erase', { obj }, {
        pos: pos ? [pos] : [],
        len: len ? [len] : [],
      })
    }
    case 'insert': {
      const pos = argChildren[0] ? ctx.lift(argChildren[0]) : null
      const value = argChildren[1] ? ctx.lift(argChildren[1]) : null
      return createNode('cpp_string_insert', { obj }, {
        pos: pos ? [pos] : [],
        value: value ? [value] : [],
      })
    }
    case 'replace': {
      const pos = argChildren[0] ? ctx.lift(argChildren[0]) : null
      const len = argChildren[1] ? ctx.lift(argChildren[1]) : null
      const value = argChildren[2] ? ctx.lift(argChildren[2]) : null
      return createNode('cpp_string_replace', { obj }, {
        pos: pos ? [pos] : [],
        len: len ? [len] : [],
        value: value ? [value] : [],
      })
    }
    case 'push_back': {
      const ch = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode('cpp_string_push_back', { obj }, {
        char: ch ? [ch] : [],
      })
    }
    case 'clear':
      return createNode('cpp_string_clear', { obj })
  }

  // Generic method call — lift args as children for proper round-trip
  const liftedArgs = argChildren
    .map(a => ctx.lift(a))
    .filter((n): n is NonNullable<typeof n> => n !== null)
  return createNode('cpp_method_call_expr', { obj, method }, { args: liftedArgs })
}

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
  // ambiguous -- pick most common container concept
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
      // Try string method calls first (substr, find, append, c_str, length)
      const stringResult = tryMethodCallLift(funcNode, argsNode, ctx)
      if (stringResult) return stringResult

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

    // C++ named casts: static_cast<T>(expr), dynamic_cast<T>(expr), etc.
    if (funcNode?.type === 'template_function') {
      const castName = funcNode.namedChildren.find(c => c.type === 'identifier')?.text
      const templateArgs = funcNode.namedChildren.find(c => c.type === 'template_argument_list')
      const targetType = templateArgs ? templateArgs.text.slice(1, -1) : 'int' // strip < >
      const castConcepts: Record<string, string> = {
        'static_cast': 'cpp_static_cast',
        'dynamic_cast': 'cpp_dynamic_cast',
        'reinterpret_cast': 'cpp_reinterpret_cast',
        'const_cast': 'cpp_const_cast',
      }
      if (castName && castConcepts[castName]) {
        const argNodes = argsNode?.namedChildren ?? []
        const value = argNodes.length > 0 ? ctx.lift(argNodes[0]) : null
        return createNode(castConcepts[castName], { target_type: targetType }, {
          value: value ? [value] : [],
        })
      }
    }

    // Method calls: obj.method(args) via field_expression
    if (funcNode && funcNode.type === 'field_expression') {
      const methodResult = tryMethodCallLift(funcNode, argsNode, ctx)
      if (methodResult) return methodResult
    }

    // Free string functions: getline, to_string, stoi, stod
    const argChildren = argsNode?.namedChildren ?? []
    if (funcName === 'getline' && argChildren.length >= 2) {
      const nameNode = argChildren[1]
      return createNode('cpp_getline', { name: nameNode?.text ?? 'str' })
    }
    if (funcName === 'to_string' || funcName === 'std::to_string') {
      const value = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode('cpp_to_string', {}, { value: value ? [value] : [] })
    }
    if (funcName === 'stoi' || funcName === 'std::stoi') {
      const value = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode('cpp_stoi', {}, { value: value ? [value] : [] })
    }
    if (funcName === 'stod' || funcName === 'std::stod') {
      const value = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode('cpp_stod', {}, { value: value ? [value] : [] })
    }

    // cstdlib functions
    if (funcName === 'rand') {
      return createNode('cpp_rand', {})
    }
    if (funcName === 'srand') {
      const seed = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode('cpp_srand', {}, { seed: seed ? [seed] : [] })
    }
    if (funcName === 'abs') {
      const value = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode('cpp_abs', {}, { value: value ? [value] : [] })
    }
    if (funcName === 'exit') {
      const code = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode('cpp_exit', {}, { code: code ? [code] : [] })
    }

    // cctype functions
    const cctypeFuncs: Record<string, string> = {
      'isalpha': 'cpp_isalpha', 'isdigit': 'cpp_isdigit',
      'toupper': 'cpp_toupper', 'tolower': 'cpp_tolower',
    }
    if (funcName in cctypeFuncs) {
      const value = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode(cctypeFuncs[funcName], {}, { value: value ? [value] : [] })
    }

    // swap
    if (funcName === 'swap' || funcName === 'std::swap') {
      const a = argChildren[0]?.text ?? 'a'
      const b = argChildren[1]?.text ?? 'b'
      return createNode('cpp_swap', { a, b })
    }

    // std::accumulate / accumulate
    if (funcName === 'accumulate' || funcName === 'std::accumulate') {
      const accumArgs = argsNode ? argsNode.namedChildren : []
      const beginText = accumArgs[0]?.text ?? 'v.begin()'
      const endText = accumArgs[1]?.text ?? 'v.end()'
      const initChild = accumArgs[2] ? ctx.lift(accumArgs[2]) : null
      return createNode('cpp_accumulate', { begin: beginText, end: endText }, {
        init: initChild ? [initChild] : [],
      })
    }

    // std::make_pair / make_pair
    if (funcName === 'make_pair' || funcName === 'std::make_pair') {
      const pairArgs = argsNode ? argsNode.namedChildren : []
      const firstChild = pairArgs[0] ? ctx.lift(pairArgs[0]) : null
      const secondChild = pairArgs[1] ? ctx.lift(pairArgs[1]) : null
      return createNode('cpp_make_pair', {}, {
        first: firstChild ? [firstChild] : [],
        second: secondChild ? [secondChild] : [],
      })
    }

    // General function call
    const args = argsNode
      ? argsNode.namedChildren.map(a => ctx.lift(a)).filter((n): n is NonNullable<typeof n> => n !== null)
      : []
    return createNode('func_call_expr', { name: funcName }, { args })
  })
}
