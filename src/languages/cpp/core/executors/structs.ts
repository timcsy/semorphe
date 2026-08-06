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
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import { getMember } from '../../../../interpreter/executors/variables'
import type { FieldDecl, MethodDecl } from '../../../../interpreter/struct-types'
import { Scope } from '../../../../interpreter/scope'
import { RuntimeError, RUNTIME_ERRORS } from '../../../../interpreter/errors'
// 從定義它的地方導入——**不要再建一份**，見該處的說明
import { ReturnSignal } from '../../../../interpreter/executors/functions'
import type { RuntimeValue, ObjectFields } from '../../../../interpreter/types'
import { defaultValue } from '../../../../interpreter/types'
import type { SemanticNode } from '../../../../core/types'

/** 把一群成員敘述拆成「欄位／方法／建構式」 */
function 拆解成員(members: SemanticNode[]): { fields: FieldDecl[]; methods: MethodDecl[]; ctor?: MethodDecl } {
  const fields: FieldDecl[] = []
  const methods: MethodDecl[] = []
  let ctor: MethodDecl | undefined
  const params = (m: SemanticNode): FieldDecl[] =>
    (m.children.params ?? []).map((p) => ({
      name: String(p.properties?.name ?? ''),
      type: String(p.properties?.type ?? 'int'),
    }))
  for (const m of members) {
    if (m.concept === 'func_def') {
      methods.push({ name: String(m.properties.name), params: params(m), body: m.children.body ?? [] })
    } else if (m.concept === 'cpp_constructor') {
      ctor = { name: String(m.properties.class_name ?? ''), params: params(m), body: m.children.body ?? [] }
    } else if (m.properties?.name !== undefined) {
      fields.push({ name: String(m.properties.name), type: String(m.properties?.type ?? 'int') })
    }
  }
  return { fields, methods, ctor }
}

/**
 * 在一個實例上跑一段方法本體。
 *
 * **作用域直接用物件的欄位表**，所以方法裡寫 `x = 5` 改的就是這個實例的欄位
 * ——沒有副本、沒有複製回寫的時機問題（那種做法在方法呼叫方法時會壞）。
 *
 * 本體跑在那之上的**子作用域**裡，否則方法的區域變數會落進物件變成欄位。
 */
async function 在實例上執行(
  obj: RuntimeValue,
  m: MethodDecl,
  argNodes: SemanticNode[],
  ctx: import('../../../../interpreter/executor-registry').ExecutionContext,
): Promise<RuntimeValue | void> {
  const argValues: RuntimeValue[] = []
  for (const a of argNodes) argValues.push(await ctx.evaluate(a))

  const outer = ctx.scope
  const 欄位層 = Scope.overFields(obj.value as ObjectFields, outer)
  const 本體層 = 欄位層.createChild()
  m.params.forEach((p, i) => 本體層.declare(p.name, argValues[i] ?? defaultValue(p.type)))
  // `this` 指向自己，讓 `this.x` 與 `this->method()` 也能用
  本體層.declare('this', obj)

  ctx.scope = 本體層
  try {
    await ctx.executeBody(m.body)
    return defaultValue('void')
  } catch (e) {
    if (e instanceof ReturnSignal) return e.value as RuntimeValue
    throw e
  } finally {
    ctx.scope = outer
  }
}

export function registerStructExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  /**
   * `struct Point { int x; int y; };`
   *
   * 成員宣告本身**不執行**——它們是型別的一部分，不是要跑的敘述。
   * 執行它們的話 `x` 和 `y` 會變成外層作用域的真變數。
   */
  /**
   * 告訴核心「怎麼在一個實例上跑一段方法本體」。
   *
   * 核心知道「這個型別有建構式」，但不知道怎麼綁 `this`、怎麼接回傳訊號
   * ——那些是語言套件的知識。安裝在宣告執行器裡，因為它們一定在任何
   * 實例化之前跑，而登記處是**每個直譯器一份**（不能在模組載入時裝）。
   */
  const 安裝方法執行器 = (ctx: import('../../../../interpreter/executor-registry').ExecutionContext): void => {
    ctx.structs.installMethodRunner((obj, m, args) => 在實例上執行(obj, m, args, ctx) as Promise<unknown>)
  }

  register('cpp_struct_declare', async (node, ctx) => {
    安裝方法執行器(ctx)
    const name = String(node.properties.name)
    const fields: FieldDecl[] = []
    for (const m of node.children.members ?? []) {
      const fname = m.properties?.name
      if (fname === undefined) continue
      fields.push({ name: String(fname), type: String(m.properties?.type ?? 'int') })
    }
    ctx.structs.declare(name, fields)
  })

  /**
   * `class C { public: … private: … };`
   *
   * 存取控制（public／private）**這一片不做**——兩區的成員一視同仁。
   * 那讓 `cpp_class_def` 從殼變成可執行，但**不代表類別支援完整了**：
   * 存取控制、繼承、虛擬函式仍然是殼，完備性報表照樣數它們。
   */
  register('cpp_class_def', async (node, ctx) => {
    安裝方法執行器(ctx)
    const name = String(node.properties.name)
    const { fields, methods, ctor } = 拆解成員([
      ...(node.children.public ?? []),
      ...(node.children.private ?? []),
    ])
    ctx.structs.declare(name, fields, methods, ctor)
  })

  /** `c.bump()` 與 `c.get()` —— 敘述與運算式兩個位置同一個實作 */
  const 呼叫方法: ConceptExecutor = async (node, ctx) => {
    const objName = String(node.properties.obj)
    const methodName = String(node.properties.method)
    const obj = ctx.scope.get(objName)
    if (obj.type !== 'object') {
      throw new RuntimeError(RUNTIME_ERRORS.UNDECLARED_VAR, { '%1': `${objName}（不是一個物件）` })
    }
    const m = ctx.structs.method(obj.structName ?? '', methodName)
    if (!m) {
      // 出聲，不靜默略過——打錯方法名的程式會跑完而什麼都沒做
      throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, {
        '%1': `${obj.structName ?? '?'}::${methodName}`,
      })
    }
    return 在實例上執行(obj, m, node.children.args ?? [], ctx)
  }

  register('cpp_method_call', 呼叫方法)
  register('cpp_method_call_expr', 呼叫方法)

  /**
   * `P p(42);` —— 建構式在 `func_call_expr` 的位置出現，名字就是類別名。
   *
   * 這裡只註冊「建構式的定義」不執行任何東西；真正的呼叫由 `var_declare`
   * 的初始化路徑觸發（見下）。
   */
  register('cpp_constructor', async () => {})

  /** `p.x` */
  register('cpp_struct_member_access', async (node, ctx) => {
    const objName = String(node.properties.obj)
    return getMember(ctx.scope.get(objName), String(node.properties.member), objName)
  })
}
