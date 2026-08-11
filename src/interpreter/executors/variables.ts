import { RuntimeError, RUNTIME_ERRORS } from '../errors'
import type { RuntimeValue } from '../types'
import type { ConceptExecutor } from '../executor-registry'
import { defaultValue } from '../types'
import { isNamedCall } from '../../core/component/traits'

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
      //
      // ⚠️ 而**辨識那一路實際產出的是另一個形狀**：`A a(5)` 得到
      // `cpp:var_declare { init_style: 'constructor' }`＋初始值直接掛在
      // `initializer` 底下，**不是**一顆 `cpp:func_call`。只認 `func_call`
      // 的話，`A a(5)` 會走進 `evaluate(5)` 然後在讀 `a.v` 時說
      // 「a（不是一個結構）」——宣告與消費者對不上的又一筆。
      const isCtor =
        String(node.properties.init_style) === 'constructor' ||
        (isNamedCall(arg0.conceptId) && String(arg0.properties?.name) === type)
      const ctorArgs =
        isNamedCall(arg0.conceptId) && String(arg0.properties?.name) === type
          ? (arg0.children?.args ?? [])
          : init0
      ctx.scope.declare(
        name,
        isCtor ? await ctx.structs.construct(type, ctorArgs) : await ctx.evaluate(arg0),
      )
    } else {
      // `A a;` —— **預設建構式也要跑**。
      //
      // ⚠️ 原本是 `instantiate(type)`：只建實例、不跑建構式。於是
      // `class A { A(){ cout<<"ctor"; } };` 宣告一顆 `A a;` 什麼都不印，
      // 而**解構子會印**（`structs.ts:151` 有呼叫 `destructorOf`）
      // ——同一顆物件，一邊跑一邊不跑，而少的那一邊沒有任何訊號。
      //
      // `construct` 在沒有建構式時等同 `instantiate`，所以無建構式的型別行為不變。
      ctx.scope.declare(name, await ctx.structs.construct(type, []))
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

/**
 * ⚠️ **這個模組不再註冊任何執行器**——它的元件都搬進膠囊了。
 * 檔案留著因為裡面還有**共用的執行演算法**（`execVarDeclare`／`getMember`／`setMember`），
 * 而那些不屬於任何一顆元件。
 */
