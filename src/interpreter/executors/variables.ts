import { RuntimeError, RUNTIME_ERRORS } from '../errors'
import type { RuntimeValue } from '../types'
import type { ConceptExecutor } from '../executor-registry'
import { defaultValue } from '../types'

export const execVarDeclare: ConceptExecutor = async (node, ctx) => {
  // Multi-variable declaration: int a, b, c;
  const declarators = node.children.declarators
  if (declarators && declarators.length > 0) {
    const parentType = String(node.properties.type || 'int')
    for (const decl of declarators) {
      // Propagate parent type to declarator if it doesn't have its own
      if (!decl.properties.type) decl.properties.type = parentType
      await ctx.executeNode(decl)
    }
    return
  }

  const name = String(node.properties.name)
  const type = String(node.properties.type || 'int')

  // 結構型別的變數——欄位遞迴取得預設值。
  // 放在 initializer 判斷**之前**，因為 `Point p;`（無初始化）正是最常見的寫法，
  // 而落到下面的 `defaultValue(type)` 會回傳一個 `int 0`——那個變數看起來
  // 宣告成功了，直到有人讀它的欄位才發現它不是物件。
  if (ctx.structs.has(type)) {
    const init0 = node.children.initializer
    if (init0 && init0.length > 0) {
      const arg0 = init0[0]
      // `P p(42);` —— 初始化式是一個名字等於型別名的呼叫，那是建構式。
      //
      // 核心**不編一個假概念來分派**：第一版那樣做，而孤兒實作護欄當場抓到
      // 「一個沒有任何概念定義的執行器」。改成呼叫登記處的掛勾，怎麼跑由
      // 語言套件安裝。
      const isCtor = arg0.conceptId === 'cpp:func_call'
        && String(arg0.properties?.name) === type
      ctx.scope.declare(
        name,
        isCtor ? await ctx.structs.construct(type, arg0.children?.args ?? []) : await ctx.evaluate(arg0),
      )
    } else {
      ctx.scope.declare(name, ctx.structs.instantiate(type))
    }
    return
  }

  const init = node.children.initializer
  if (init && init.length > 0) {
    let val = await ctx.evaluate(init[0])
    val = ctx.coerceType(val, type)
    ctx.scope.declare(name, val)
  } else {
    ctx.scope.declare(name, defaultValue(type))
  }
}


/**
 * 讀一個結構欄位。
 *
 * **不存在的欄位要出聲。** 回 0 的話，打錯欄位名的程式會跑完、印出東西、
 * 而它是錯的——「靜默降級是 bug 的藏身之處」。
 */
export function getMember(
  obj: RuntimeValue | undefined,
  member: string,
  objName: string,
  statics?: Map<string, RuntimeValue>,
): RuntimeValue {
  if (!obj || obj.type !== 'object') {
    throw new RuntimeError(RUNTIME_ERRORS.UNDECLARED_VAR, { '%1': `${objName}（不是一個結構）` })
  }
  const fields = obj.value as Map<string, RuntimeValue>
  // 實例欄位優先，找不到再看型別的靜態表——C++ 允許 `a.count` 取靜態成員，
  // 而它住在型別上不在實例上。順序與方法作用域的層次一致。
  const v = fields.get(member) ?? statics?.get(member)
  if (v === undefined) {
    throw new RuntimeError(RUNTIME_ERRORS.UNDECLARED_VAR, {
      '%1': `${objName}.${member}（${obj.structName ?? '結構'} 沒有這個欄位）`,
    })
  }
  return v
}

/** 寫一個結構欄位。同樣：不存在的欄位要出聲，不得默默新增一個 */
export function setMember(obj: RuntimeValue | undefined, member: string, val: RuntimeValue, objName: string): void {
  getMember(obj, member, objName)  // 先驗存在，錯誤訊息一致
  ;(obj!.value as Map<string, RuntimeValue>).set(member, val)
}

export function registerVariableExecutors(register: (concept: string, executor: ConceptExecutor) => void): void {

  register('cpp:var_declare', execVarDeclare)

  register('cpp:var_assign', async (node, ctx) => {
    const name = String(node.properties.obj)
    const valueNodes = node.children.value
    if (!valueNodes || valueNodes.length === 0) return
    const val = await ctx.evaluate(valueNodes[0])

    // `p.x = 7` —— 指派到結構的一個欄位。
    //
    // ⚠️ **辨識器把它編成一個帶點號的名字**（`name: "p.x"`），不是拆開的
    // `{ name: 'p', member: 'x' }`。第一版只認拆開的形狀，而**沒有任何
    // 生產者會產出那個形狀**——單元測試手寫節點時通過了，從真實原始碼跑
    // 卻完全沒有效果。那正是「測試通過卻什麼都沒測到」。
    //
    // 兩種都認：`member` 屬性（若未來有生產者）與帶點號的名字（現況）。
    // 字串編碼結構是既有的技術債（同 `func_def` 的參數），不在這一刀的範圍。
    const member = node.properties.member
    if (member !== undefined) {
      setMember(ctx.scope.get(name), String(member), val, name)
      return
    }
    const dot = name.indexOf('.')
    if (dot > 0 && ctx.scope.has(name.slice(0, dot))) {
      const objName = name.slice(0, dot)
      setMember(ctx.scope.get(objName), name.slice(dot + 1), val, objName)
      return val
    }

    ctx.scope.set(name, val)
    // **指派是一個運算式，它求值成被指派的值。**
    //
    // 第一版什麼都不回，於是 `while ((p = f()) != 0)` 這種寫法裡的比較
    // 拿到 undefined —— 判定為假，**迴圈一次都不跑**，而程式照樣「跑完」
    // 印出後面的東西。那是靜默降級最典型的形狀。
    return val
  })

  register('cpp:var_ref', async (node, ctx) => {
    const name = String(node.properties.name)
    return ctx.scope.get(name)
  })

  // Reference: aliases the original variable (simplified: just copies value)
}
