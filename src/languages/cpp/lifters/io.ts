import type { Lifter } from '../../../core/lift/lifter'
import type { AstNode, LiftContext } from '../../../core/lift/types'
import { createNode } from '../../../core/semantic-tree'
import type { SemanticNode } from '../../../core/types'
import { extractPrintf, extractScanf } from '../std/cstdio/lifters'
import { callConceptFor } from '../../../core/component/call-concepts'
import { methodConceptFor, containerMethodConcept, typedMethodConcept } from '../../../core/component/method-concepts'
import { tryCallBranches, tryMethodBranches } from '../../../core/component/lift-branches'
import { namedCastConcept } from '../../../core/component/named-cast-concepts'
import { 建malloc } from '../../../components/cpp/malloc/lift'

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
    // `find_first_not_of` / `find_last_not_of` 已元件化——身分由膠囊登錄，
    // 見下方 `conceptForMethod` 的分支。
    //
    // ⚠️ 原本這裡是兩個 case 標籤 ＋ `createNode(\`cpp:string_${method}\`)`，
    // 而那一行的註解記著它害過一次：**模板字串組出來的身分，掃描器看不到**
    // ——命名空間遷移時它還組著舊前綴，於是兩顆概念**安靜地建不出來**。
    // 搬進膠囊順帶治了它：**身分現在是字面字串。**
    default:
      break
  }
  // **方法名 → 身分**由膠囊登錄（`core/component/method-concepts.ts`）。
  {
    const 認領 = tryMethodBranches(obj, method, argChildren, ctx)
    if (認領) return 認領
    const 形狀 = methodConceptFor(method)
    if (形狀) {
      const children: Record<string, SemanticNode[]> = {}
      形狀.argSlots.forEach((slot, i) => {
        const n = argChildren[i] ? ctx.lift(argChildren[i]) : null
        children[slot] = n ? [n] : []
      })
      return createNode(形狀.conceptId, { obj }, children)
    }
  }
  switch (method) {
    // Disambiguate by arg count: 2 args = string erase(pos, len)
    // Disambiguate by arg count: 2 args = string insert(pos, val)
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
  // generic container concepts (shared methods across containers)
  push: 'cpp:container_push',
  pop: 'cpp:container_pop',
}

/**
 * 接收者型別已知時的專屬身分。
 *
 * 只列**確定不同**的那些：字串的 `clear` 與容器的 `clear` 是兩個概念，
 * 產生的程式碼與執行行為都不同。型別查不到時不用這張表。
 */
const TYPED_METHOD_TO_CONCEPT: Record<string, Record<string, string>> = {
  string: {
  },
  // ⚠️ `top` 的通用退路是 `cpp_stack_peek`（回傳最後推入的）。
  // 優先佇列的 `top()` 回傳的是**最大的**——`g++` 對
  // `pq.push(1); pq.push(5); pq.push(3); pq.top()` 的答案是 5，不是 3。
  //
  // 型別查得到時才走這裡；查不到就留在通用版——**猜一個錯的專屬身分比誠實降級更糟**。
  priority_queue: {
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

// ⚠️ 這裡原本有一張 `METHOD_OBJ_PROP` 表——把方法名對應到「這顆概念的
// 接收者參數叫什麼」，因為 `vector_size` 叫 `vector` 而 `stack_top` 叫 `obj`。
// 它的註解寫著「container-specific ones **keep their original property names
// for backward compatibility**」。
//
// **統一成 `obj` 之後，這張表整個消失了**（G 項第 1 步，2026-08-09）。
// 那是命名一致的直接回報：一張只為了容納不一致而存在的對應表，
// 在不一致消失時自己就不見了。

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
        (objType ? typedMethodConcept(objType, methodName) : undefined) ??
        METHOD_TO_CONCEPT[methodName] ??
        containerMethodConcept(methodName)
      if (conceptId) {
        const properties: Record<string, string> = { obj: objText }

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
      return createNode('cpp:method_call', { obj: objText, method: methodName }, { args: liftedArgs })
    }

    // printf("...", args) → cstdio module
    if (funcName === 'printf') {
      return extractPrintf(argsNode, ctx)
    }

    // scanf("...", &args) → cstdio module
    if (funcName === 'scanf') {
      return extractScanf(argsNode, ctx)
    }

    // **自由函式呼叫 → 身分**由膠囊登錄（`core/component/call-concepts.ts`）。
    //
    // ⚠️ 這一段取代了原本的 `tryCmathLift`——那個函式看起來像實作，
    // 拆開看只是三筆「名字 → 身分 ＋ 引數槽名」的資料配上共用判別。
    // 資料回膠囊，判別留這裡。
    {
      const 形狀 = callConceptFor(funcName)
      if (形狀 && 形狀.argSlots.length > 0) {
        const args = argsNode
          ? argsNode.namedChildren.map((a) => ctx.lift(a)).filter((n): n is SemanticNode => n !== null)
          : []
        const children: Record<string, SemanticNode[]> = {}
        形狀.argSlots.forEach((slot, i) => {
          children[slot] = args[i] ? [args[i]] : []
        })
        const props = 形狀.funcProp ? { [形狀.funcProp]: funcName } : {}
        return createNode(形狀.conceptId, props, children)
      }
    }

    // C++ named casts: static_cast<T>(expr), dynamic_cast<T>(expr), etc.
    if (funcNode?.type === 'template_function') {
      const castName = funcNode.namedChildren.find(c => c.type === 'identifier')?.text
      const templateArgs = funcNode.namedChildren.find(c => c.type === 'template_argument_list')
      const targetType = templateArgs ? templateArgs.text.slice(1, -1) : 'int' // strip < >
      const castConcept = castName ? namedCastConcept(castName) : undefined
      if (castConcept) {
        const argNodes = argsNode?.namedChildren ?? []
        const value = argNodes.length > 0 ? ctx.lift(argNodes[0]) : null
        return createNode(castConcept, { target_type: targetType }, {
          value: value ? [value] : [],
        })
      }
    }

    // Free string functions: getline, to_string, stoi, stod
    const argChildren = argsNode?.namedChildren ?? []

    // **膠囊自己的辨識分支**（帶真邏輯的那一種）——見 `core/component/lift-branches.ts`。
    // 路由器該知道的是「去問誰」，不是「答案是什麼」。
    {
      const 認領 = tryCallBranches(funcName, argChildren, ctx, argsNode)
      if (認領) return 認領
    }


    // cstdlib functions

    // swap

    // sort, reverse, fill (iterator-range algorithms)
    // Check arg count to avoid intercepting user-defined functions with same name

    // min, max (value algorithms)

    // std::accumulate / accumulate

    // std::iota / iota

    // std::partial_sum / partial_sum

    // __gcd / gcd / std::gcd

    // lcm / std::lcm

    // std::make_pair / make_pair

    // free(ptr) → cpp_free

    // malloc(size) → cpp_malloc (without cast; cast is handled in lift-patterns via cast_expression)
    if (funcName === 'malloc' && argChildren.length === 1) {
      const size = argChildren[0] ? ctx.lift(argChildren[0]) : null
      return 建malloc('void', size)
    }

    // General function call
    const args = argsNode
      ? argsNode.namedChildren.map(a => ctx.lift(a)).filter((n): n is NonNullable<typeof n> => n !== null)
      : []
    return createNode('cpp:func_call', { name: funcName }, { args })
  })
}
