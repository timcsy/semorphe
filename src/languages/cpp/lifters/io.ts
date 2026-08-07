import type { Lifter } from '../../../core/lift/lifter'
import type { AstNode, LiftContext } from '../../../core/lift/types'
import { createNode } from '../../../core/semantic-tree'
import { extractPrintf, extractScanf } from '../std/cstdio/lifters'
import { tryCmathLift } from '../std/cmath/lifters'

/** Try to lift a method call (field_expression) into a string-specific concept.
 *  Returns null for shared methods (empty, clear, push_back, etc.) so the caller
 *  can dispatch them via METHOD_TO_CONCEPT for container support. */
function tryStringMethodLift(
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

  // String-ONLY methods (no other container uses these)
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
      // ⚠️ **第二個引數（起點）原本被丟掉**——`s.find("X", pos)` 於是永遠
      // 從頭找，而 `while ((pos = s.find("X", pos)) != -1)` 這種掃描寫法
      // **無限迴圈**（症狀是爆步數上限，離現場很遠）。
      const arg = argChildren[0] ? ctx.lift(argChildren[0]) : null
      const from = argChildren[1] ? ctx.lift(argChildren[1]) : null
      return createNode('cpp_string_find', { obj }, {
        arg: arg ? [arg] : [],
        from: from ? [from] : [],
      })
    }
    // `find_first_not_of` / `find_last_not_of`——與 `find` 同形，
    // 只是回傳「第一個／最後一個**不屬於**那組字元的位置」。
    case 'find_first_not_of':
    case 'find_last_not_of': {
      const a = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode(`cpp_string_${method}`, { obj }, { arg: a ? [a] : [] })
    }
    case 'append': {
      const value = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode('cpp_string_append', { obj }, {
        value: value ? [value] : [],
      })
    }
    case 'c_str':
      return createNode('cpp_string_c_str', { obj })
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
    // Disambiguate by arg count: 2 args = string erase(pos, len)
    case 'erase':
      if (argChildren.length >= 2) {
        const pos = ctx.lift(argChildren[0])
        const len = ctx.lift(argChildren[1])
        return createNode('cpp_string_erase', { obj }, {
          pos: pos ? [pos] : [],
          len: len ? [len] : [],
        })
      }
      return null // 1 arg → container erase (handled by METHOD_TO_CONCEPT)
    // Disambiguate by arg count: 2 args = string insert(pos, val)
    case 'insert':
      if (argChildren.length >= 2) {
        const pos = ctx.lift(argChildren[0])
        const value = ctx.lift(argChildren[1])
        return createNode('cpp_string_insert', { obj }, {
          pos: pos ? [pos] : [],
          value: value ? [value] : [],
        })
      }
      return null // 1 arg → set insert (handled by METHOD_TO_CONCEPT)
  }

  // Shared methods (empty, clear, push_back, pop_back, back, size, etc.)
  // → return null so caller dispatches via METHOD_TO_CONCEPT
  return null
}

/**
 * 方法名 → 概念身分。
 *
 * 共用的方法名（`clear`、`push_back`…）預設用**通用容器概念**——因為光看
 * 語法樹不知道接收者是什麼型別。
 *
 * ⚠️ 這句話以前寫成「為了避免型別消歧問題」，讀起來像**做不到**。
 * 實際上辨識脈絡一直有作用域與型別追蹤，只是**沒有人接上**（見
 * `knowledge/concepts/執行機構.md`「機制有了，沒人接上」第五個實例）。
 *
 * 076 接上了：脈絡查得到型別時走 `TYPED_METHOD_TO_CONCEPT`，
 * **查不到就留在通用版**——猜一個錯的專屬身分比誠實降級更糟。
 */
const METHOD_TO_CONCEPT: Record<string, string> = {
  // container-specific (unique method names)
  pop_back: 'cpp_vector_pop_back',
  back: 'cpp_vector_back',
  size: 'cpp_vector_size',
  top: 'cpp_stack_top',
  front: 'cpp_queue_front',
  // generic container concepts (shared methods across containers)
  empty: 'cpp_container_empty',
  push: 'cpp_container_push',
  pop: 'cpp_container_pop',
  clear: 'cpp_container_clear',
  push_back: 'cpp_container_push_back',
  erase: 'cpp_container_erase',
  count: 'cpp_container_count',
  insert: 'cpp_set_insert',
}

/**
 * 接收者型別已知時的專屬身分。
 *
 * 只列**確定不同**的那些：字串的 `clear` 與容器的 `clear` 是兩個概念，
 * 產生的程式碼與執行行為都不同。型別查不到時不用這張表。
 */
const TYPED_METHOD_TO_CONCEPT: Record<string, Record<string, string>> = {
  string: {
    clear: 'cpp_string_clear',
    push_back: 'cpp_string_push_back',
  },
}

/**
 * 通用容器方法——**同一個身分，多個容器**。
 *
 * 這些方法在不同容器上行為相同（執行器不分支），所以身分是一個；
 * 但**積木上該怎麼說不同**，所以形態可以有多個。容器種類寫進節點供投影選形態。
 */
const GENERIC_CONTAINER_METHODS = new Set(['push', 'pop', 'empty', 'clear'])

/** Methods that take one argument (the rest take zero) */
const METHODS_WITH_ARG = new Set([
  'push_back', 'push', 'insert', 'erase', 'count',
])

/** Property name used for the object in each concept's semantic node.
 * Generic container concepts all use 'obj'. Container-specific ones
 * keep their original property names for backward compatibility. */
const METHOD_OBJ_PROP: Record<string, string> = {
  // container-specific (keep original names)
  pop_back: 'vector',
  back: 'vector',
  size: 'vector',
  top: 'obj',
  front: 'obj',
  insert: 'obj',
  // generic (all use 'obj')
  push_back: 'obj',
  push: 'obj',
  pop: 'obj',
  clear: 'obj',
  empty: 'obj',
  erase: 'obj',
  count: 'obj',
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
      // Try string-only method calls first (substr, find, append, c_str, length, replace)
      const stringResult = tryStringMethodLift(funcNode, argsNode, ctx)
      if (stringResult) return stringResult

      // Shared/container methods (push_back, pop_back, clear, size, empty, push, pop, top, front, erase, count, insert)
      const objNode = funcNode.childForFieldName('argument')
      const fieldNode = funcNode.childForFieldName('field')
      const objText = objNode?.text ?? ''
      const methodName = fieldNode?.text ?? ''

      // 接收者的型別查得到的話，用專屬身分；**查不到就留在通用版**。
      // 猜一個的話，猜錯會靜默產生一個錯的身分——那比誠實降級更糟。
      const objType = objText ? ctx.data.getType(objText) : null
      const conceptId =
        (objType ? TYPED_METHOD_TO_CONCEPT[objType]?.[methodName] : undefined) ??
        METHOD_TO_CONCEPT[methodName]
      if (conceptId) {
        const propName = METHOD_OBJ_PROP[methodName] ?? 'obj'
        const properties: Record<string, string> = { [propName]: objText }

        // 容器種類——**投影要用，而投影查不到脈絡**。
        //
        // `st.push(x)` 與 `q.push(x)` 的行為完全相同（執行器不分支），
        // 但積木上該說「推到頂端」還是「加到尾端」不同。那是**形態**的事，
        // 而形態選擇是逐節點的，走不到宣告節點——所以在這裡記下來。
        //
        // 與 095 的 `input.from` 同型：投影需要的資訊必須在節點上。
        //
        // ⚠️ 查不到型別就**不寫**（CK-1）。猜一個會讓積木顯示錯的位置，
        // 那比中性標籤更糟——而中性標籤已經不說謊了（ab84f6c）。
        if (objType && GENERIC_CONTAINER_METHODS.has(methodName)) {
          properties.container_kind = objType
        }

        if (METHODS_WITH_ARG.has(methodName) && argsNode) {
          const childSlot = METHOD_CHILD_SLOT[methodName] ?? 'value'
          const argNodes = argsNode.namedChildren
            .map(a => ctx.lift(a))
            .filter((n): n is NonNullable<typeof n> => n !== null)
          return createNode(conceptId, properties, { [childSlot]: argNodes })
        }

        return createNode(conceptId, properties)
      }

      // 不認得的方法呼叫 → 泛用的方法呼叫概念。
      //
      // ⚠️ 這裡原本依語法樹的父節點在**兩個身分**之間選（敘述版／運算式版）。
      // B 項把那一對合併了——**位置不是身分**，它是形態。
      //
      // 那個修法本身是對的（原本第一版永遠產出運算式版，敘述位置的身分永遠
      // 拿不到），只是它把位置修進了**錯的槽**：修進身分，於是每一對雙版本
      // 都要在五路上各維護一份，而 `saveExtraState` 的格式契約要人工同步。
      const allArgs = argsNode?.namedChildren ?? []
      const liftedArgs = allArgs.map(a => ctx.lift(a)).filter((n): n is NonNullable<typeof n> => n !== null)
      return createNode('cpp_method_call', { obj: objText, method: methodName }, { args: liftedArgs })
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
    if (funcName === 'atoi') {
      const str = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode('cpp_atoi', {}, { str: str ? [str] : [] })
    }
    if (funcName === 'atof') {
      const str = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode('cpp_atof', {}, { str: str ? [str] : [] })
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

    // sort, reverse, fill (iterator-range algorithms)
    // Check arg count to avoid intercepting user-defined functions with same name
    if ((funcName === 'sort' || funcName === 'std::sort') && argChildren.length === 2) {
      const beginText = argChildren[0]?.text ?? 'v.begin()'
      const endText = argChildren[1]?.text ?? 'v.end()'
      return createNode('cpp_sort', { begin: beginText, end: endText })
    }
    if ((funcName === 'reverse' || funcName === 'std::reverse') && argChildren.length === 2) {
      const beginText = argChildren[0]?.text ?? 'v.begin()'
      const endText = argChildren[1]?.text ?? 'v.end()'
      return createNode('cpp_reverse', { begin: beginText, end: endText })
    }
    if ((funcName === 'fill' || funcName === 'std::fill') && argChildren.length === 3) {
      const beginText = argChildren[0]?.text ?? 'v.begin()'
      const endText = argChildren[1]?.text ?? 'v.end()'
      const valueChild = argChildren[2] ? ctx.lift(argChildren[2]) : null
      return createNode('cpp_fill', { begin: beginText, end: endText }, {
        value: valueChild ? [valueChild] : [],
      })
    }

    // min, max (value algorithms)
    if (funcName === 'min' || funcName === 'std::min') {
      const a = argChildren[0] ? ctx.lift(argChildren[0]) : null
      const b = argChildren[1] ? ctx.lift(argChildren[1]) : null
      return createNode('cpp_min', {}, {
        a: a ? [a] : [],
        b: b ? [b] : [],
      })
    }
    if (funcName === 'max' || funcName === 'std::max') {
      const a = argChildren[0] ? ctx.lift(argChildren[0]) : null
      const b = argChildren[1] ? ctx.lift(argChildren[1]) : null
      return createNode('cpp_max', {}, {
        a: a ? [a] : [],
        b: b ? [b] : [],
      })
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

    // std::iota / iota
    if (funcName === 'iota' || funcName === 'std::iota') {
      const iotaArgs = argsNode ? argsNode.namedChildren : []
      const beginText = iotaArgs[0]?.text ?? 'v.begin()'
      const endText = iotaArgs[1]?.text ?? 'v.end()'
      const valueChild = iotaArgs[2] ? ctx.lift(iotaArgs[2]) : null
      return createNode('cpp_iota', { begin: beginText, end: endText }, {
        value: valueChild ? [valueChild] : [],
      })
    }

    // std::partial_sum / partial_sum
    if (funcName === 'partial_sum' || funcName === 'std::partial_sum') {
      const psArgs = argsNode ? argsNode.namedChildren : []
      const beginText = psArgs[0]?.text ?? 'v.begin()'
      const endText = psArgs[1]?.text ?? 'v.end()'
      const destText = psArgs[2]?.text ?? 'result.begin()'
      return createNode('cpp_partial_sum', { begin: beginText, end: endText, dest: destText }, {})
    }

    // __gcd / gcd / std::gcd
    if (funcName === '__gcd' || funcName === 'gcd' || funcName === 'std::gcd') {
      const a = argChildren[0] ? ctx.lift(argChildren[0]) : null
      const b = argChildren[1] ? ctx.lift(argChildren[1]) : null
      return createNode('cpp_gcd', {}, { a: a ? [a] : [], b: b ? [b] : [] })
    }

    // lcm / std::lcm
    if (funcName === 'lcm' || funcName === 'std::lcm') {
      const a = argChildren[0] ? ctx.lift(argChildren[0]) : null
      const b = argChildren[1] ? ctx.lift(argChildren[1]) : null
      return createNode('cpp_lcm', {}, { a: a ? [a] : [], b: b ? [b] : [] })
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

    // free(ptr) → cpp_free
    if (funcName === 'free' && argChildren.length === 1) {
      const ptr = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode('cpp_free', {}, { ptr: ptr ? [ptr] : [] })
    }

    // malloc(size) → cpp_malloc (without cast; cast is handled in lift-patterns via cast_expression)
    if (funcName === 'malloc' && argChildren.length === 1) {
      const size = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode('cpp_malloc', { type: 'void' }, { size: size ? [size] : [] })
    }

    // cstring functions
    if (funcName === 'strlen') {
      const str = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return createNode('cpp_strlen', {}, { str: str ? [str] : [] })
    }
    if (funcName === 'strcmp') {
      const s1 = argChildren[0] ? ctx.lift(argChildren[0]) : null
      const s2 = argChildren[1] ? ctx.lift(argChildren[1]) : null
      return createNode('cpp_strcmp', {}, { s1: s1 ? [s1] : [], s2: s2 ? [s2] : [] })
    }
    if (funcName === 'strcpy') {
      const dest = argChildren[0] ? ctx.lift(argChildren[0]) : null
      const src = argChildren[1] ? ctx.lift(argChildren[1]) : null
      return createNode('cpp_strcpy', {}, { dest: dest ? [dest] : [], src: src ? [src] : [] })
    }
    if (funcName === 'strcat') {
      const dest = argChildren[0] ? ctx.lift(argChildren[0]) : null
      const src = argChildren[1] ? ctx.lift(argChildren[1]) : null
      return createNode('cpp_strcat', {}, { dest: dest ? [dest] : [], src: src ? [src] : [] })
    }
    if (funcName === 'strncpy' && argChildren.length === 3) {
      const dest = argChildren[0] ? ctx.lift(argChildren[0]) : null
      const src = argChildren[1] ? ctx.lift(argChildren[1]) : null
      const n = argChildren[2] ? ctx.lift(argChildren[2]) : null
      return createNode('cpp_strncpy', {}, { dest: dest ? [dest] : [], src: src ? [src] : [], n: n ? [n] : [] })
    }
    if (funcName === 'strncmp' && argChildren.length === 3) {
      const s1 = argChildren[0] ? ctx.lift(argChildren[0]) : null
      const s2 = argChildren[1] ? ctx.lift(argChildren[1]) : null
      const n = argChildren[2] ? ctx.lift(argChildren[2]) : null
      return createNode('cpp_strncmp', {}, { s1: s1 ? [s1] : [], s2: s2 ? [s2] : [], n: n ? [n] : [] })
    }
    if (funcName === 'strchr' && argChildren.length === 2) {
      const str = argChildren[0] ? ctx.lift(argChildren[0]) : null
      const ch = argChildren[1] ? ctx.lift(argChildren[1]) : null
      return createNode('cpp_strchr', {}, { str: str ? [str] : [], ch: ch ? [ch] : [] })
    }
    if (funcName === 'strstr' && argChildren.length === 2) {
      const haystack = argChildren[0] ? ctx.lift(argChildren[0]) : null
      const needle = argChildren[1] ? ctx.lift(argChildren[1]) : null
      return createNode('cpp_strstr', {}, { haystack: haystack ? [haystack] : [], needle: needle ? [needle] : [] })
    }
    if (funcName === 'memset' && argChildren.length === 3) {
      const ptr = argChildren[0] ? ctx.lift(argChildren[0]) : null
      const value = argChildren[1] ? ctx.lift(argChildren[1]) : null
      const size = argChildren[2] ? ctx.lift(argChildren[2]) : null
      return createNode('cpp_memset', {}, { ptr: ptr ? [ptr] : [], value: value ? [value] : [], size: size ? [size] : [] })
    }
    if (funcName === 'memcpy' && argChildren.length === 3) {
      const dest = argChildren[0] ? ctx.lift(argChildren[0]) : null
      const src = argChildren[1] ? ctx.lift(argChildren[1]) : null
      const size = argChildren[2] ? ctx.lift(argChildren[2]) : null
      return createNode('cpp_memcpy', {}, { dest: dest ? [dest] : [], src: src ? [src] : [], size: size ? [size] : [] })
    }

    // General function call
    const args = argsNode
      ? argsNode.namedChildren.map(a => ctx.lift(a)).filter((n): n is NonNullable<typeof n> => n !== null)
      : []
    return createNode('func_call', { name: funcName }, { args })
  })
}
