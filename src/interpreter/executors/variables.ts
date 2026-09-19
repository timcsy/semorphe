import { RuntimeError, RUNTIME_ERRORS } from '../errors'
import type { RuntimeValue } from '../types'
import type { ComponentExecutor } from '../executor-registry'
import { defaultValue } from '../types'
import { hasAlias, resolveAlias } from '../aliases'
import { isNamedCall } from '../../core/component/traits'
import { evalInitializer } from '../aggregate'

export const execVarDeclare: ComponentExecutor = async (node, ctx) => {
  // Multi-variable declaration: int a, b, c;
  const declarators = node.slots.declarators
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
  /**
   * 🔴 **型別名可能是一個別名**（2026-09-20，語料 `AP325/4/4_15_3t.cpp`）。
   *
   * ```cpp
   * #define pii pair<int,int>
   * pii p = {3,4};      →  p.first 說「p（不是一個結構）」
   * pair<int,int> p …   →  🟢 好的
   * ```
   *
   * 底下每一個判斷都拿這個字串去查（`ctx.structs.has`、聚合形狀、`defaultValue`）
   * ——而 `pii` 在每一張表裡都查不到，於是它靜靜地變成一個 `int 0`，
   * **錯誤要等到有人讀它的欄位才出現**。
   *
   * ⚠️ **同一個檔案的下面 80 行早就對【成員名】做了這件事**（`#define F first`）
   * ——而型別名那一側沒有。
   * > **一張別名表如果只有一個消費者記得查它，
   * > 那它治好的是那一個位置，不是那一族。**
   *
   * ⚠️ 這裡解的是**執行期的型別查詢**，不是把學生寫的名字換掉：
   * 產生器讀的是 `properties.type`，它一個字都沒有變
   * （`pii p = {3,4};` 產回去仍然是 `pii p = {3,4};`）。
   */
  const writtenType = String(node.properties.type || 'int')
  const declaredType = hasAlias(writtenType) ? resolveAlias(writtenType) : writtenType

  // `Container<int> c;` —— **樣板實例化：查型別時剝掉樣板引數**。
  //
  // 🔴 `Container<int>` 這個字串在 `structs` 裡查不到（登記的名字是
  // `Container`），於是它落到下面的 `defaultValue` 變成 `int 0`，
  // 而症狀要等到 `c.add(42)` 才出現：「c（不是一個物件）」。
  //
  // ⚠️ 剝掉引數是**在這個直譯器裡**才成立的簡化——型別不參與求值，
  // `Container<int>` 與 `Container<string>` 執行起來是同一個型別。
  // 真的泛型要為每組引數各實例化一份，而那要等到型別有可觀察的差別
  // （型別檢查、多載解析）才有意義。
  const type = ctx.structs.has(declaredType)
    ? declaredType
    : declaredType.includes('<') && ctx.structs.has(declaredType.slice(0, declaredType.indexOf('<')))
      ? declaredType.slice(0, declaredType.indexOf('<'))
      : declaredType

  // 結構型別的變數——欄位遞迴取得預設值。
  // 放在 initializer 判斷**之前**，因為 `Point p;`（無初始化）正是最常見的寫法，
  // 而落到下面的 `defaultValue(type)` 會回傳一個 `int 0`——那個變數看起來
  // 宣告成功了，直到有人讀它的欄位才發現它不是物件。
  if (ctx.structs.has(type)) {
    const init0 = node.slots.initializer
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
        (isNamedCall(arg0.componentId) && String(arg0.properties?.name) === type)
      const ctorArgs =
        isNamedCall(arg0.componentId) && String(arg0.properties?.name) === type
          ? (arg0.slots?.args ?? [])
          : init0
      // ⚠️ `evalInitializer` 而不是 `evaluate`：`P a{3};` 的初始值是一層 `{…}`，
      // 而那是**聚合初始化**——要按成員宣告順序填，不是求一個值出來。
      // `evaluate` 對它會丟 `UNKNOWN_COMPONENT`。哪個節點算一層 `{…}`
      // 由語言套件宣告（`core/component/aggregate-nodes.ts`），這裡不比對名字。
      ctx.scope.declare(
        name,
        isCtor ? await ctx.structs.construct(type, ctorArgs) : await evalInitializer(arg0, type, ctx),
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

  const init = node.slots.initializer
  if (init && init.length > 0) {
    /**
     * 🔴 **純量的大括號初始化要拆開**（2026-09-16）。
     *
     * `int a{7}` 的初始值是一顆 `cpp:initializer_list`，而它求值出來是一個
     * **陣列**。在此之前這裡直接把它 `coerceType(…, 'int')`，於是：
     *
     * ```
     * int a{};          g++ 0  ↔ 我們 1     ← 值初始化變成 1
     * int a{7};         g++ 7  ↔ 我們 1     ← 給的值直接被丟掉
     * long long ans{};  g++ 0  ↔ 我們 ""    ← 什麼都印不出來
     * ```
     *
     * ⚠️ 而 **lift 與 generate 都是對的**——樹裡逐字是
     * `var_declare ← initializer_list ← literal_number 7`，產生器也照樣吐回
     * `int a{7};`。所以①②③④四個面向全綠，抓到它的是第五個：
     * **拿真實的學生程式跟參照編譯器比跑出來的東西**。
     *
     * > **一個只錯在 execute 那一路的缺陷，形狀是完美的
     * > ——而形狀完美正是它活下來的原因。**
     *
     * ⚠️ **只拆純量**：`vector<int> v{1,2,3}` 的那個串列是它的內容，不是一個值。
     *    判準用「型別裡有沒有 `<`」——結構體在上面那一段已經走掉了。
     * ⚠️ 也**只拆 0 或 1 個元素**：多個元素的純量大括號在 C++ 裡本來就不合法，
     *    留給原本那條路去處理，不要自己發明語義。
     */
    const braced = init[0].componentId?.endsWith(':initializer_list') === true
    if (braced && !type.includes('<')) {
      const items = init[0].slots?.values ?? []
      if (items.length === 0) { ctx.scope.declare(name, defaultValue(type)); return }
      if (items.length === 1) {
        ctx.scope.declare(name, ctx.coerceType(await ctx.evaluate(items[0]), type))
        return
      }
    }
    /**
     * 🔴 **走 `evalInitializer`，不要自己 `evaluate` ＋ `coerceType`**（2026-09-16）。
     *
     * 在此之前這裡直接求值再壓型別，於是**聚合形狀永遠用不到**：
     * `pair<int,int> pr = {3,4};` 變成一個陣列，而 `pr.first` 讀出 0。
     * （`make_pair(3,4)` 是好的——所以它看起來像「只有大括號那種寫法壞掉」。）
     *
     * ⚠️ `evalInitializer` 對**不是大括號**的初始值就是
     * `coerceType(evaluate(node), type)` ——與原本逐字相同，所以這不是行為變更，
     * 是把兩條路合成一條。
     *
     * > **同一件事有兩份實作的時候，壞掉的永遠是沒有人走的那一份。**
     */
    ctx.scope.declare(name, await evalInitializer(init[0], type, ctx))
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
  let v = fields.get(member) ?? statics?.get(member)
  // 🔴 **查不到才問別名**（`#define x first`，見 `aliases.ts`）——
  //    有這個欄位的時候一個字都不動，所以它不會蓋掉正常的查找。
  if (v === undefined && hasAlias(member)) {
    const real = resolveAlias(member)
    v = fields.get(real) ?? statics?.get(real)
  }
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
  const fields = obj!.value as Map<string, RuntimeValue>
  // ⚠️ 讀得到而寫錯地方的話，症狀是「改了沒反應」——比拋錯難查得多
  fields.set(fields.has(member) ? member : resolveAlias(member), val)
}

/**
 * ⚠️ **這個模組不再註冊任何執行器**——它的元件都搬進膠囊了。
 * 檔案留著因為裡面還有**共用的執行演算法**（`execVarDeclare`／`getMember`／`setMember`），
 * 而那些不屬於任何一顆元件。
 */
