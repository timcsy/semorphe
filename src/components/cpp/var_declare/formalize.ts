/** `cpp:var_declare` 的 **formalize** 路——從 `providers/cella/formalize/` 的分派原封搬過來（第 389 刀）。契約見 `core/formalize-contract.ts`。 */
import type { CellaJson, FormalizeContext, FormalizeRegistrar } from '../../../core/formalize-contract'
import type { SemanticNode } from '../../../core/types'

/**
 * 類別物件的直接初始化（`P p(3, 4);`，lift 記成 `init_style: constructor`、引數全在 `initializer` 槽）→ `sDeclC`／`iVarC`，**每一個引數都送**。
 * spec 203：在此之前走通用宣告子，只取 initializer 的第一顆當 `= 值`——兩個引數的建構子被靜靜丟掉第二個。
 * 純量的 `int x(5)` 不走這裡（Cella：「a constructor's arguments for a type that is not a class」），照舊是 `= 值`。
 * 標準庫的類別（`vector<int> a(4, 0), b[4];` 混著陣列宣告時不會變成 `vector_declare`）也走這裡：原本只送第一個引數，等於 `a = 4`（AP325 7_7 被誤判）。
 */
function classCtor(n: SemanticNode, f: FormalizeContext, global: boolean): CellaJson[] | null {
  if (n.properties?.init_style !== 'constructor') return null
  const text = String(n.properties?.type ?? '').trim()
  if (!f.isStructName(text) && !/^(std::)?(string$|\w+\s*<)/.test(text)) return null
  const t = f.type(text, n)
  if (!t) return []
  return f.declCtor(n, t, (n.slots?.initializer ?? []).map((c) => f.expr(c)), global)
}

/**
 * 類別外的靜態成員定義（`int Counter::total = 0;`）：lift 成一顆名字是 `Counter::total` 的頂層宣告。
 * 照通用宣告子送的話它是**另一個**叫 `Counter::total` 的全域變數，而類別裡的那個靜態成員拿不到它的初值——
 * 實測（spec 203）`= 5` 時 Cella 印 2、g++ 印 7。初值併進類別的 `mbStatic`（361，cella 的送法）；這一份不另外送。找不到對應成員才照實標翻不出。
 */
function qualifiedDefinition(n: SemanticNode, f: FormalizeContext): CellaJson[] | null {
  const name = String(n.properties?.name ?? '')
  if (!name.includes('::')) return null
  // 361：初值已併進類別的 mbStatic（member_static 用 staticInitOf 找回來）——這一份不另外送
  if (f.isClassMember(name)) return []
  f.miss(n, '類別外的靜態成員定義找不到對應的類別成員')
  return []
}

/**
 * 一行宣告好幾個（`F a(1, 2), b(1, 3);`）：外層那顆沒有 `init_style`，引擎的通用形狀逐一翻宣告子時**不經過上面的 `classCtor`**
 * ——於是兩個建構子引數被當成一般初值送出，Cella 判「找不到相符的建構子」（第 331 刀的往返測試撞到；分成兩行就判得出）。
 * 這裡先逐一試 `classCtor`，其餘照引擎的通用形狀。
 */
function eachDeclarator(n: SemanticNode, f: FormalizeContext, global: boolean): CellaJson[] | null {
  const kids = n.slots?.declarators
  if (!kids || kids.length === 0 || !kids.some((d) => d.properties?.init_style === 'constructor')) return null
  return kids.flatMap((d) => classCtor(d, f, global) ?? f.decl(d, global))
}

export function registerFormalize(r: FormalizeRegistrar): void {
  // 通用的宣告子形狀（型別 名字 = 初值；多個宣告子逐一遞迴）在引擎——它也是別顆宣告子沒註冊時的形狀
  r.stmt('cpp:var_declare', (n, f) => classCtor(n, f, false) ?? eachDeclarator(n, f, false) ?? f.decl(n, false))
  r.item('cpp:var_declare', (n, f) => qualifiedDefinition(n, f) ?? classCtor(n, f, true) ?? eachDeclarator(n, f, true) ?? f.decl(n, true))
  // 編譯期的整數值：型別是 const、初值是整數字面（`const int N = 100;`）——`int a[N]` 的長度問這一條（spec 199）；可變的變數不是
  r.constInt('cpp:var_declare', (n, f) => (/^\s*const\s/.test(String(n.properties?.type ?? '')) ? f.constInt(f.one(n, 'initializer')) : null))
}
