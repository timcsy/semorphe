/**
 * variables 的語言專屬執行路——10 個。
 *
 * 通用的那些留在核心（拔掉 C++ 之後仍然存在，不是違規）；
 * 這裡是語言專屬的部分。歸屬由概念定義的層級欄位決定，不由檔名。
 *
 * 見 specs/055-finish-executor-move/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import { execVarDeclare } from '../../../../interpreter/executors/variables'
import type { Scope } from '../../../../interpreter/scope'
import { defaultValue } from '../../../../interpreter/types'

/** 走到最外層的作用域——區域靜態變數的儲存位置（它比函式活得久） */
function 根作用域(s: Scope): Scope {
  let cur = s
  while (cur.parent) cur = cur.parent
  return cur
}

export function registerVariablesCoreExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {


  // const/constexpr/auto declarations behave like var_declare in the interpreter

  // const/constexpr 的**執行期**行為確實與 var_declare 相同——不可變是編譯期
  // 的約束，這個直譯器不強制它。身分保留：碼形態不同（`const int` vs `int`），
  // 而修飾詞要不要變成參數，取決於參數規格化（C 項）。
  register('cpp_const_declare', execVarDeclare)

  register('cpp_constexpr_declare', execVarDeclare)

  register('cpp_auto_declare', async (node, ctx) => {
    const name = String(node.properties.name)
    const init = node.children.initializer
    if (init && init.length > 0) {
      const val = await ctx.evaluate(init[0])
      ctx.scope.declare(name, val)
    } else {
      ctx.scope.declare(name, { type: 'int', value: 0 })
    }
  })

  // typedef and using alias are type declarations — no runtime effect

  register('cpp_typedef', async () => {})

  register('cpp_using_alias', async () => {})

  /**
   * `int& r = a;`——**別名，不是複製**。
   *
   * ⚠️ 在此之前它註冊的是 `execVarDeclare`，於是 `r = 9` 只改到 r：
   * `cout << a << r` 印出 **59**，而 g++ 印 **99**。**參照這個概念完全沒有意義。**
   *
   * `Scope.declareRef` 一直都在——又一次「機制有了，沒人接上」。
   */
  register('cpp_ref_declare', async (node, ctx) => {
    const name = String(node.properties.name)
    const inits = node.children.initializer ?? []
    const 目標 = inits[0]
    if (目標?.conceptId === 'var_ref' && 目標.properties?.name !== undefined) {
      // `get`／`set` 會沿 parent 往上找，所以目標作用域傳當前的就夠
      ctx.scope.declareRef(name, ctx.scope, String(目標.properties.name))
      return
    }
    // 綁到非變數（例如 `int& r = f();`）——**不是別名做得到的事**。
    // 退回一般宣告，行為與加入本執行器之前相同。
    await execVarDeclare(node, ctx)
  })

  // Static: persists across calls (simplified: same as var_declare in interpreter)

  /**
   * `static int n = 0;` 在函式裡——**跨呼叫保存**。
   *
   * ⚠️ 在此之前它註冊的是 `execVarDeclare`，於是每次呼叫都重新初始化：
   * `tick(); tick(); tick()` 印出 **111**，而 g++ 印 **123**。
   *
   * **而這個缺陷之所以三個月沒被發現，正是因為它與 `var_declare` 共用執行器**
   * ——身分健檢護欄報「六顆宣告完全相同」時，那看起來像「可以合併」，
   * 實際上是「有兩顆的行為沒有被模型化」。**共用執行器讓「沒實作」長得像「一樣」。**
   *
   * 儲存位置是**根作用域**，鍵用宣告節點的 id——同一個宣告點共用一格，
   * 不同函式的同名 static 互不干擾。別名機制（`declareRef`）本來就在。
   */
  register('cpp_static_declare', async (node, ctx) => {
    const name = String(node.properties.name)
    const type = String(node.properties.type || 'int')
    const 儲存名 = `__static__${node.id}__${name}`
    const root = 根作用域(ctx.scope)

    if (!root.has(儲存名)) {
      const inits = node.children.initializer ?? []
      const 初值 = inits.length > 0 ? await ctx.evaluate(inits[0]) : defaultValue(type)
      root.declare(儲存名, ctx.coerceType ? ctx.coerceType(初值, type) : 初值)
    }
    // 本次呼叫的區域名字指向那一格
    ctx.scope.declareRef(name, root, 儲存名)
  })

  // Static member: declaration only, noop

  register('cpp_static_member', async () => {})
}
