/**
 * 結構的執行——物件導向的第一片。
 *
 * ## 為什麼住在語言套件
 *
 * `cpp_struct_declare` / `cpp_struct_member_access` 是 C++ 專屬的概念身分。
 * 核心層只提供**機制**（執行期的物件值、型別登記處），語言套件說**哪些概念
 * 用它**——與註解語法、skip 宣告、下拉選單同一個形狀。
 *
 * ## 範圍：一片
 *
 * 只做結構型別與欄位讀寫。方法、建構式、繼承、存取控制仍然是殼，
 * 完備性報表照樣數它們——**切一片不等於把剩下的宣告掉**。
 *
 * 見 specs/071-struct-execute/
 */
import type { FieldDecl, MethodDecl } from '../../../../interpreter/struct-types'
import { Scope } from '../../../../interpreter/scope'
// 從定義它的地方導入——**不要再建一份**，見該處的說明
import { ReturnSignal } from '../../../../interpreter/executors/functions'
import type { RuntimeValue, ObjectFields } from '../../../../interpreter/types'
import { defaultValue } from '../../../../interpreter/types'
import type { SemanticNode } from '../../../../core/types'
import { componentsWithMemberRole, memberRoleOf } from '../../../../core/component/registry'

/** 把一群成員敘述拆成「欄位／方法／建構式」 */
export function splitMember(members: SemanticNode[]): {
  fields: FieldDecl[]
  methods: MethodDecl[]
  ctor?: MethodDecl
  dtor?: MethodDecl
  statics: FieldDecl[]
} {
  const fields: FieldDecl[] = []
  const methods: MethodDecl[] = []
  const statics: FieldDecl[] = []
  let ctor: MethodDecl | undefined
  let dtor: MethodDecl | undefined
  const params = (m: SemanticNode): FieldDecl[] =>
    (m.children.params ?? []).map((p) => ({
      name: String(p.properties?.name ?? ''),
      type: String(p.properties?.type ?? 'int'),
    }))
  // ⚠️ **問角色，不問身分。**
  //
  // 這裡原本寫死三個 conceptId，而那讓那幾顆元件**永遠搬不進膠囊**
  // ——就近性護欄會指名「身分出現在自己資料夾外」。
  //
  // > **「另一顆元件需要認得它」是真的耦合，不是碎裂。**
  // > 處置不是把消費者搬走，是把「我是什麼角色」變成元件自己的宣告。
  //
  // ⚠️ 角色**只有一個來源**了（2026-08-11）：膠囊的 `component.json`（glob eager，
  // 沒有時序）。原本還疊著一張 `pending-member-roles.json` 過渡表，
  // 而 177 顆全部膠囊化之後它空了——**一個空的過渡表讀起來像
  // 「這裡還有一批沒處理的」**，已退場。
  const role = memberRoleOf
  const methodConcepts = new Set(componentsWithMemberRole('method'))
  for (const m of members) {
    if (role(m.conceptId) === 'static-field') {
      statics.push({ name: String(m.properties.name), type: String(m.properties.type ?? 'int') })
    } else if (role(m.conceptId) === 'pure-virtual') {
      // 沒有本體。註冊它是為了讓「呼叫一個純虛擬方法」能**出聲**——
      // 不註冊的話那會變成「找不到方法」，訊息指錯方向。
      methods.push({ name: String(m.properties.name), params: params(m), body: [], pure: true })
    } else if (role(m.conceptId) === 'operator') {
      // 存成名字是 `operator+` 的方法，讓算術執行器找得到
      methods.push({
        name: `operator${String(m.properties.operator)}`,
        params: [{ name: String(m.properties.param_name ?? 'rhs'), type: String(m.properties.param_type ?? 'int') }],
        body: m.children.body ?? [],
      })
    } else if (methodConcepts.has(m.conceptId)) {
      methods.push({ name: String(m.properties.name), params: params(m), body: m.children.body ?? [] })
    } else if (role(m.conceptId) === 'constructor') {
      ctor = { name: String(m.properties.class_name ?? ''), params: params(m), body: m.children.body ?? [] }
    } else if (role(m.conceptId) === 'destructor') {
      dtor = { name: `~${String(m.properties.class_name ?? '')}`, params: [], body: m.children.body ?? [] }
    } else if (m.properties?.name !== undefined) {
      fields.push({
        name: String(m.properties.name),
        type: String(m.properties?.type ?? 'int'),
        // 成員預設值——`initializer` 是 `cpp:var_declare` 既有的接點，
        // 類別成員與一般宣告用的是同一顆元件，所以這裡不需要新的形狀
        init: m.children.initializer?.[0],
      })
    }
  }
  return { fields, methods, ctor, dtor, statics }
}

/**
 * 在一個實例上跑一段方法本體。
 *
 * **作用域直接用物件的欄位表**，所以方法裡寫 `x = 5` 改的就是這個實例的欄位
 * ——沒有副本、沒有複製回寫的時機問題（那種做法在方法呼叫方法時會壞）。
 *
 * 本體跑在那之上的**子作用域**裡，否則方法的區域變數會落進物件變成欄位。
 */
/**
 * 在一個實例上執行一個方法。
 *
 * ⚠️ **匯出它，因為 `cpp:method_call` 搬進膠囊了。** 這不是那顆元件的實作
 * ——`class_def` 的建構、解構、方法執行器都走它。**共用的是演算法，不是身分。**
 */
export async function runOnInstance(
  obj: RuntimeValue,
  m: MethodDecl,
  argNodes: SemanticNode[],
  ctx: import('../../../../interpreter/executor-registry').ExecutionContext,
): Promise<RuntimeValue | void> {
  const argValues: RuntimeValue[] = []
  for (const a of argNodes) argValues.push(await ctx.evaluate(a))

  const outer = ctx.scope
  // 型別層在最外——靜態成員由**所有實例共用**，所以它住在型別上不在實例上。
  // 順序：外層 → 型別層（靜態） → 欄位層（實例） → 本體層（區域變數）。
  // 實例欄位擋在靜態前面，與 C++ 的遮蔽一致。
  const staticTable = ctx.structs.staticsOf(obj.structName ?? '')
  const typeLevel = staticTable ? Scope.overFields(staticTable, outer) : outer
  const fieldLevel = Scope.overFields(obj.value as ObjectFields, typeLevel)
  const bodyLevel = fieldLevel.createChild()
  m.params.forEach((p, i) => bodyLevel.declare(p.name, argValues[i] ?? defaultValue(p.type)))
  // `this` 指向自己，讓 `this.x` 與 `this->method()` 也能用
  bodyLevel.declare('this', obj)

  ctx.scope = bodyLevel
  try {
    await ctx.executeBody(m.body)
    return defaultValue('void')
  } catch (e) {
    if (e instanceof ReturnSignal) return e.value as RuntimeValue
    throw e
  } finally {
    await ctx.exitScope(ctx.scope, outer)
  }
}

/**
 * 安裝方法執行器——**從宣告執行器的閉包提升為模組層級的匯出**。
 *
 * ⚠️ 它原本是 `registerStructExecutors` 內部的閉包。與 `openBrace` 同一個病：
 * **一個閉包 helper 會把它所在的整個函式變成不可分割的單位**，
 * 而那個單位是「一個檔案」不是「一顆元件」——擋住膠囊化。
 *
 * 提升之後行為一字未變（它本來就只用 `ctx`，沒有捕獲別的東西）。
 */
export const installMethodExecutors = (ctx: import('../../../../interpreter/executor-registry').ExecutionContext): void => {
  ctx.structs.installMethodRunner((obj, m, args) => runOnInstance(obj, m, args, ctx) as Promise<unknown>)
  ctx.structs.installExprEvaluator((node) => ctx.evaluate(node))

  // 作用域結束時跑解構式。核心知道「作用域結束了」，**結束時該做什麼**
  // 是這裡的知識——別的語言可能什麼都不做。
  if (!ctx.onScopeExit) {
    // ⚠️ **正在解構中的物件**——沒有這道防線會無限遞迴。
    //
    // 解構式的本體跑在一個作用域裡，而那個作用域宣告了 `this`（指向這個
    // 物件自己）。離開它時又對同一個物件跑一次解構式 → 堆疊爆掉。
    // 第一版就是這樣，症狀是 **OOM 而不是一則錯誤訊息**。
    const destructuring = new Set<unknown>()

    ctx.onScopeExit = async (own) => {
      // **反序**：C++ 保證後宣告的先解構。順序錯的實作在單一物件時看不出來。
      for (const [name, v] of [...own.entries()].reverse()) {
        if (v.type !== 'object') continue  // 非物件不觸發任何收尾
        if (name === 'this') continue      // `this` 不是這個作用域擁有的
        if (destructuring.has(v.value)) continue
        const dtor = ctx.structs.destructorOf(v.structName ?? '')
        if (!dtor) continue
        destructuring.add(v.value)
        try {
          await runOnInstance(v, dtor, [], ctx)
        } finally {
          destructuring.delete(v.value)
        }
      }
    }
  }
}

/**
 * ⚠️ **這個模組不再註冊任何執行器**——它的元件全部搬進膠囊了。
 *
 * 檔案留著是因為裡面還有**共用的演算法**（見上面的匯出），
 * 而那些不屬於任何一顆元件。
 *
 * > **模組是搬家的中途站，不是終點——而中途站的最後一塊石頭是它共用的東西。**
 */
