import type { Lifter } from '../../../core/lift/lifter'
import type { AstNode, LiftContext } from '../../../core/lift/types'
import { createNode } from '../../../core/semantic-tree'
import type { SemanticNode } from '../../../core/types'
import { extractPrintf, extractScanf } from '../lang/runtime/printf'
import { callComponentFor } from '../../../core/component/call-components'
import { methodComponentFor, containerMethodComponent, typedMethodComponent } from '../../../core/component/method-components'
import { componentComponents } from '../../../core/component/registry'
import { tryCallBranches, tryMethodBranches } from '../../../core/component/lift-branches'
import { namedCastComponent } from '../../../core/component/named-cast-components'
import { buildMalloc } from '../../../components/cpp/malloc/lift'
import { buildMethodCall } from '../../../components/cpp/method_call/lift'
import { buildFuncCall } from '../../../components/cpp/func_call/lift'

/**
 * **這顆元件的接收者是一個【接點】，還是一個【字串屬性】？**
 *
 * ## 🔴 為什麼要有這道閘（2026-09-18）
 *
 * 接收者原本一律被壓成一串文字（`properties.obj`），而解開它的地方
 * （`src/interpreter/receiver.ts`）只認得「名字、數字、以及它們的加減」。
 * 於是這些寫法**在執行期就斷了**：
 *
 * ```cpp
 * m[name].push_back(3);      下標是字串鍵
 * buckets[keys[i % 2]]++;    巢狀下標
 * m[1].insert(5);            巢狀容器
 * ```
 *
 * 十支資訊隔離的盲測程式裡 **7 支**死在上面，而語料裡也有 3 支
 * ——`receiver.ts` 自己留的觸發條件逐字是「第二個獨立來源就夠了」。
 *
 * ## ⚠️ 而這道閘的形狀是【問宣告】，不是一張名單
 *
 * Python 那 33 顆**早就把接收者做成接點**（`slots.obj`），C++ 這 58 顆是字串。
 * 一次全翻的話沒有辦法逐顆驗，所以這裡照 `hasInitSourceDecl` 的形狀：
 * **宣告了 `slots.obj` 的走接點，其餘原樣走屬性。**
 *
 * > **一次搬得動的數量，由「一次驗得完的數量」決定
 * > ——而讓兩者可以不一樣的，是一道問宣告的閘。**
 *
 * ⚠️ **有一族刻意不搬**：`Serial`／`EEPROM`／`WiFi` 的接收者是一個**固定的
 * 全域物件**，不是一個變數。它不是運算式，把它做成插槽等於請學生去接一個
 * 永遠只有一個答案的東西。
 */
const receiverIsSlot = new Set(
  (componentComponents() as { componentId?: string; slots?: Record<string, unknown> }[])
    .filter((c) => c.slots?.obj !== undefined)
    .map((c) => String(c.componentId)),
)

/**
 * 把接收者放進它該去的地方。
 *
 * @param objNode 接收者的 AST 節點——**它一直都在手上**，只是以前只取了 `.text`
 */
function receiverInto(
  componentId: string,
  objNode: AstNode | null | undefined,
  objText: string,
  ctx: LiftContext,
): { props: Record<string, string>; slots: Record<string, SemanticNode[]> } {
  if (!receiverIsSlot.has(componentId)) return { props: { obj: objText }, slots: {} }
  const lifted = objNode ? ctx.lift(objNode) : null
  // 🔴 **lift 不出來就回頭走字串**——那比塞一個空接點好：
  //    空接點在積木上是一個開口，而使用者沒有東西可以放進去。
  return lifted ? { props: {}, slots: { obj: [lifted] } } : { props: { obj: objText }, slots: {} }
}

/** Try to lift a method call (field_expression) into a string-specific component.
 *  Returns null for shared methods (empty, clear, push_back, etc.) so the caller
 *  can dispatch them via METHOD_TO_COMPONENT for container support. */
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
    // 見下方 `componentForMethod` 的分支。
    //
    // ⚠️ 原本這裡是兩個 case 標籤 ＋ `createNode(\`cpp:string_${method}\`)`，
    // 而那一行的註解記著它害過一次：**模板字串組出來的身分，掃描器看不到**
    // ——命名空間遷移時它還組著舊前綴，於是兩顆概念**安靜地建不出來**。
    // 搬進膠囊順帶治了它：**身分現在是字面字串。**
    default:
      break
  }
  // **方法名 → 身分**由膠囊登錄（`core/component/method-components.ts`）。
  {
    const claim = tryMethodBranches(obj, method, argChildren, ctx, objNode)
    if (claim) return claim
    const shape = methodComponentFor(method)
    if (shape) {
      const slots: Record<string, SemanticNode[]> = {}
      shape.argSlots.forEach((slot, i) => {
        const n = argChildren[i] ? ctx.lift(argChildren[i]) : null
        slots[slot] = n ? [n] : []
      })
      // 接收者去哪一格由**宣告**決定（見 `receiverInto` 的檔頭）
      const recv = receiverInto(shape.componentId, objNode, obj, ctx)
      return createNode(shape.componentId, recv.props, { ...slots, ...recv.slots })
    }
  }
  switch (method) {
    // Disambiguate by arg count: 2 args = string erase(pos, len)
    // Disambiguate by arg count: 2 args = string insert(pos, val)
  }

  // Shared methods (empty, clear, push_back, pop_back, back, size, etc.)
  // → return null so caller dispatches via METHOD_TO_COMPONENT
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
 * 076 接上了：脈絡查得到型別時走 `TYPED_METHOD_TO_COMPONENT`，
 * **查不到就留在通用版**——猜一個錯的專屬身分比誠實降級更糟。
 */
const METHOD_TO_COMPONENT: Record<string, string> = {
  // ⚠️ **空的，而那是進度不是設計。** 這張表原本列 `push`／`pop`，
  // 而那兩顆已經搬進膠囊、改用 `registerMethodComponent` 自己認領方法名。
  // 剩下的（今天是零筆）是**還沒膠囊化**的，它只減不增。
}

/**
 * 接收者型別已知時的專屬身分。
 *
 * 只列**確定不同**的那些：字串的 `clear` 與容器的 `clear` 是兩個概念，
 * 產生的程式碼與執行行為都不同。型別查不到時不用這張表。
 */
const TYPED_METHOD_TO_COMPONENT: Record<string, Record<string, string>> = {
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
/**
 * **這顆元件宣告的第一個接點叫什麼**——`value`／`key`／或者沒有。
 *
 * 🔴 **這裡原本是兩張手寫表**（`METHODS_WITH_ARG` ＋ `METHOD_CHILD_SLOT`），
 * 而它們與元件自己的 `slots` 宣告**逐字相同**——第二份真相。
 *
 * 症狀（2026-09-16，模糊測試抓到）：新加一顆 `push_front` 元件、宣告了
 * `slots: { value: "expression" }`、五路齊全、自證測綠——而**引數在 lift 時被丟掉**，
 * 產碼變成 `dq.push_front();`。因為那兩張表裡沒有它的名字。
 *
 * > **一顆元件已經說過自己有幾個接點了。共用檔再說一次，
 * > 就多了一個會忘記更新的地方——而它忘記的那天不會報錯，只會少一個引數。**
 *
 * ⚠️ 這個檔裡已經有同樣的先例：`METHOD_OBJ_PROP` 那張表也是這樣退場的。
 */
/**
 * **這顆元件宣告了一個叫 `method` 的屬性嗎**——宣告了才把使用者寫的那個字記下來。
 *
 * 🔴 為什麼要問宣告而不是列一張名單：同一個理由，`firstSlotOf` 的檔頭逐字
 *「一顆元件已經說過自己有幾個接點了。共用檔再說一次，就多了一個會忘記更新的地方」。
 */
const declaresMethodProp = (componentId: string): boolean =>
  (componentComponents() as { componentId: string; properties?: { name: string }[] }[])
    .find((c) => c.componentId === componentId)
    ?.properties?.some((p) => p.name === 'method') === true

/**
 * **這個方法名是一個 `#define` 取的小名嗎**——是的話換成本名。
 *
 * 🔴 **有一道閘**（2026-09-19）：**原名查不到、而別名查得到**時才換。
 *
 * 少了這道閘的話，一個叫 `size` 的 `int` 變數會讓 `v.size()` 去查一個
 * 叫 `int` 的方法——因為別名與型別**住在同一張表**（那是刻意的，
 * 見 `lift-context.ts` 的 `getType`：「一個查得到的東西查兩次，
 * 比替它開第二張表便宜」）。
 *
 * > **兩種東西共用一張表是對的；而共用之後，查詢端要自己說清楚它問的是哪一種。**
 *
 * @returns 換過的名字，或原名。
 */
function resolveMethodAlias(method: string, ctx: LiftContext, known: (m: string) => boolean): string {
  if (known(method)) return method
  const alias = ctx.data.getType(method)
  return alias && alias !== method && known(alias) ? alias : method
}

const firstSlotOf = (componentId: string): string | null => {
  const decl = (componentComponents() as { componentId: string; slots?: Record<string, unknown> }[])
    .find((c) => c.componentId === componentId)
  /**
   * 🔴 **接收者不是引數**（2026-09-18）。
   *
   * 這一支問的是「**呼叫的引數**放進哪一格」，而接收者變成接點之後，
   * `obj` 也出現在 `slots` 裡——於是 `v.push_back(3)` 的 `3` 被放進 `obj`，
   * 再被接收者蓋掉，**引數整個消失**（產碼是對的，執行時什麼都沒發生）。
   *
   * > **一個「第一個接點」的取法，在接點多了一種【不同種類】的成員時會拿錯。
   * > 而它不會報錯——它會拿到一個真的存在的接點。**
   */
  const keys = Object.keys(decl?.slots ?? {}).filter((k) => k !== 'obj')
  return keys.length > 0 ? keys[0] : null
}

// ⚠️ 這裡原本有一張 `METHOD_OBJ_PROP` 表——把方法名對應到「這顆概念的
// 接收者參數叫什麼」，因為 `vector_size` 叫 `vector` 而 `stack_top` 叫 `obj`。
// 它的註解寫著「container-specific ones **keep their original property names
// for backward compatibility**」。
//
// **統一成 `obj` 之後，這張表整個消失了**（G 項第 1 步，2026-08-09）。
// 那是命名一致的直接回報：一張只為了容納不一致而存在的對應表，
// 在不一致消失時自己就不見了。

/** Child slot name for the argument value */


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
      /**
       * 🔴 **`#define pb push_back` 取的小名在這裡換回本名**（2026-09-19）。
       * 閘的理由見 `resolveMethodAlias` 的檔頭。
       */
      const lookupName = resolveMethodAlias(methodName, ctx, (m) =>
        (objType !== null && (TYPED_METHOD_TO_COMPONENT[objType]?.[m] !== undefined
          || typedMethodComponent(objType, m) !== undefined))
        || METHOD_TO_COMPONENT[m] !== undefined
        || containerMethodComponent(m) !== undefined)
      const componentId =
        (objType ? TYPED_METHOD_TO_COMPONENT[objType]?.[lookupName] : undefined) ??
        (objType ? typedMethodComponent(objType, lookupName) : undefined) ??
        METHOD_TO_COMPONENT[lookupName] ??
        containerMethodComponent(lookupName)
      if (componentId) {
        // 接收者去哪一格由**宣告**決定（見 `receiverInto` 的檔頭）
        const recv = receiverInto(componentId, objNode, objText, ctx)
        const properties: Record<string, string> = { ...recv.props }

        /**
         * 🔴 **記住使用者寫的那個字**（2026-09-19）。
         *
         * 一顆元件可以認好幾個方法名（`push_back` 與 `emplace_back` 是同一件事），
         * 而在此之前產生器**寫死其中一個**：`v.emplace_back(3)` 產回
         * `v.push_back(3)`、`m.emplace(1,2)` 產回 `m.insert(1)`（連引數都掉了）。
         *
         * > **一顆元件認了 N 個方法名而只記得其中一個，
         * > 學生寫的另外 N−1 個會被悄悄改寫。**
         *
         * ⚠️ 記的是**原文**（`pb`），不是換過的本名——那正是要保住的東西。
         */
        if (declaresMethodProp(componentId)) properties.method = methodName

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
        if (objType && GENERIC_CONTAINER_METHODS.has(lookupName)) {
          properties.container_kind = objType
        }

        const childSlot = firstSlotOf(componentId)
        if (childSlot && argsNode) {
          const argNodes = argsNode.namedChildren
            .map(a => ctx.lift(a))
            .filter((n): n is NonNullable<typeof n> => n !== null)
          return createNode(componentId, properties, { [childSlot]: argNodes, ...recv.slots })
        }

        return createNode(componentId, properties, recv.slots)
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
      return buildMethodCall(objNode ? ctx.lift(objNode) : null, methodName, liftedArgs)
    }

    // printf("...", args) → cstdio module
    if (funcName === 'printf') {
      return extractPrintf(argsNode, ctx)
    }

    // scanf("...", &args) → cstdio module
    if (funcName === 'scanf') {
      return extractScanf(argsNode, ctx)
    }

    // **自由函式呼叫 → 身分**由膠囊登錄（`core/component/call-components.ts`）。
    //
    // ⚠️ 這一段取代了原本的 `tryCmathLift`——那個函式看起來像實作，
    // 拆開看只是三筆「名字 → 身分 ＋ 引數槽名」的資料配上共用判別。
    // 資料回膠囊，判別留這裡。
    {
      const shape = callComponentFor(funcName)
      // 🔴 **不要加回 `argSlots.length > 0` 這個條件。**
      //
      // 它原本在這裡，而它是一個**沒有說出口的假設**：「登錄的概念都至少有一個引數」。
      // 那句話在 `cpp:millis`（`millis()`，零引數）出現之前一直是真的
      // ——而它失效時的症狀是**靜默落到下一條分支**：`millis()` 被 lift 成
      // 通用的 `cpp:func_call`，**不報錯、不留痕跡**。
      //
      // > **一個看起來像防護的條件，常常是一句沒有被寫下來的假設。**
      //
      // 空的 `argSlots` 讓下面的迴圈產出 `slots = {}`，那正是零引數該有的樣子。
      if (shape) {
        const args = argsNode
          ? argsNode.namedChildren.map((a) => ctx.lift(a)).filter((n): n is SemanticNode => n !== null)
          : []
        const slots: Record<string, SemanticNode[]> = {}
        shape.argSlots.forEach((slot, i) => {
          slots[slot] = args[i] ? [args[i]] : []
        })
        const props = shape.funcProp ? { [shape.funcProp]: funcName } : {}
        return createNode(shape.componentId, props, slots)
      }
    }

    // C++ named casts: static_cast<T>(expr), dynamic_cast<T>(expr), etc.
    if (funcNode?.type === 'template_function') {
      const castName = funcNode.namedChildren.find(c => c.type === 'identifier')?.text
      const templateArgs = funcNode.namedChildren.find(c => c.type === 'template_argument_list')
      const targetType = templateArgs ? templateArgs.text.slice(1, -1) : 'int' // strip < >
      const castComponent = castName ? namedCastComponent(castName) : undefined
      if (castComponent) {
        const argNodes = argsNode?.namedChildren ?? []
        const value = argNodes.length > 0 ? ctx.lift(argNodes[0]) : null
        return createNode(castComponent, { target_type: targetType }, {
          value: value ? [value] : [],
        })
      }
    }

    // Free string functions: getline, to_string, stoi, stod
    const argChildren = argsNode?.namedChildren ?? []

    // **膠囊自己的辨識分支**（帶真邏輯的那一種）——見 `core/component/lift-branches.ts`。
    // 路由器該知道的是「去問誰」，不是「答案是什麼」。
    {
      const claim = tryCallBranches(funcName, argChildren, ctx, argsNode)
      if (claim) return claim
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
      return buildMalloc('void', size)
    }

    // General function call
    const args = argsNode
      ? argsNode.namedChildren.map(a => ctx.lift(a)).filter((n): n is NonNullable<typeof n> => n !== null)
      : []
    return buildFuncCall(funcName, args)
  })
}
