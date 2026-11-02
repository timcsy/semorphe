/** `cpp:var_declare` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { CellaJson, FormalizeContext, FormalizeRegistrar } from '../../../core/formalize-contract'
import type { SemanticNode } from '../../../core/types'

/**
 * 類別物件的直接初始化（`P p(3, 4);`，lift 記成 `init_style: constructor`、引數全在 `initializer` 槽）→ `sDeclC`／`iVarC`，**每一個引數都送**。
 * spec 203：在此之前走通用宣告子，只取 initializer 的第一顆當 `= 值`——兩個引數的建構子被靜靜丟掉第二個。
 * 純量的 `int x(5)` 不走這裡（Cella：「a constructor's arguments for a type that is not a class」），照舊是 `= 值`。
 */
function classCtor(n: SemanticNode, f: FormalizeContext, global: boolean): CellaJson[] | null {
  if (n.properties?.init_style !== 'constructor') return null
  const text = String(n.properties?.type ?? '').trim()
  if (!f.isStructName(text)) return null
  const t = f.type(text, n)
  if (!t) return []
  return f.declCtor(n, t, (n.slots?.initializer ?? []).map((c) => f.expr(c)), global)
}

/**
 * 類別外的靜態成員定義（`int Counter::total = 0;`）：lift 成一顆名字是 `Counter::total` 的頂層宣告。
 * 照通用宣告子送的話它是**另一個**叫 `Counter::total` 的全域變數，而類別裡的那個靜態成員拿不到它的初值——
 * 實測（spec 203）`= 5` 時 Cella 印 2、g++ 印 7。初值要併進類別的 `mbStatic`，那一步還沒做 ⟹ 照實標翻不出。
 */
function qualifiedDefinition(n: SemanticNode, f: FormalizeContext): CellaJson[] | null {
  if (!String(n.properties?.name ?? '').includes('::')) return null
  f.miss(n, '類別外的靜態成員定義（初值要併進類別的靜態成員）還沒有對應')
  return []
}

export function registerFormalize(r: FormalizeRegistrar): void {
  // 通用的宣告子形狀（型別 名字 = 初值；多個宣告子逐一遞迴）在引擎——它也是別顆宣告子沒註冊時的形狀
  r.stmt('cpp:var_declare', (n, f) => classCtor(n, f, false) ?? f.decl(n, false))
  r.item('cpp:var_declare', (n, f) => qualifiedDefinition(n, f) ?? classCtor(n, f, true) ?? f.decl(n, true))
  // 編譯期的整數值：型別是 const、初值是整數字面（`const int N = 100;`）——`int a[N]` 的長度問這一條（spec 199）；可變的變數不是
  r.constInt('cpp:var_declare', (n, f) => (/^\s*const\s/.test(String(n.properties?.type ?? '')) ? f.constInt(f.one(n, 'initializer')) : null))
}
