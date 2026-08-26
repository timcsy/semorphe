/**
 * **左值是接點，不是字串**（路線圖項目，2026-08-25）——C++ 那一側的行為證據。
 *
 * ## 它從哪來
 *
 * 使用者 2026-08-24 逐字：
 * 「**我的意思是 lvalue 的型態應該百百種吧，這樣不就寫死了？**」
 *
 * 🪦 在此之前 `cpp:var_assign_compound` 的左邊是 `properties.name`（一個字串）
 * ＋ 一個可有可無的 `index` 接點——**兩種形狀的列舉**。lift 那側寫著：
 *
 * > 「⚠️ 兩種形狀：`x += 1` 與 `arr[i] += 1`。後者多一個 `index` 子節點。」
 *
 * 而左值不只兩種。下面每一條在那一版都是壞的，**而且是靜默的**：
 * `o.x += 1` 會去 `ctx.scope.get("o.x")` 查一個不存在的變數名。
 *
 * ## 這一支不檢測什麼
 *
 * - ❌ **不檢測積木長什麼樣**——沒有任何測試在看標籤（見 `retire-imperative-block` §5），
 *   那一半是開瀏覽器看的。
 * - ❌ **不檢測普通指定**（`=`）——那是 `cpp:var_assign`／`array_assign` 的地盤，
 *   它們還在棘輪上（`audit-lvalue-slot`）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { generateCode } from '../../src/core/projection/code-generator'
import type { SemanticNode } from '../../src/core/types'
import googleStyle from '../../src/languages/cpp/styles/google.json'
import type { StylePreset } from '../../src/core/types'

let parser: Parser

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 60_000)

function lift(src: string): SemanticNode {
  const tree = parser.parse(src)
  if (!tree) throw new Error('parse 失敗')
  return createTestLifter().lift(tree.rootNode as never) as SemanticNode
}

async function run(src: string): Promise<string> {
  const i = new SemanticInterpreter({ maxSteps: 100000 })
  await i.execute(lift(src))
  return i.getOutput().join('')
}

/** 找出那顆普通指派節點——找不到回 null，讓斷言指名。 */
function findAssign(n: SemanticNode): SemanticNode | null {
  if (n.componentId === 'cpp:var_assign') return n
  for (const kids of Object.values(n.children ?? {})) {
    for (const k of kids as SemanticNode[]) {
      const hit = findAssign(k)
      if (hit) return hit
    }
  }
  return null
}

/** 找出那顆遞增節點——找不到回 null，讓斷言指名。 */
function findIncrement(n: SemanticNode): SemanticNode | null {
  if (n.componentId === 'cpp:increment') return n
  for (const kids of Object.values(n.children ?? {})) {
    for (const k of kids as SemanticNode[]) {
      const hit = findIncrement(k)
      if (hit) return hit
    }
  }
  return null
}

/** 找出那顆複合指定節點——找不到回 null，讓斷言指名。 */
function findCompound(n: SemanticNode): SemanticNode | null {
  if (n.componentId === 'cpp:var_assign_compound') return n
  for (const kids of Object.values(n.children ?? {})) {
    for (const k of kids as SemanticNode[]) {
      const hit = findCompound(k)
      if (hit) return hit
    }
  }
  return null
}

const IO = '#include <iostream>\nusing namespace std;\n'
const S = '#include <iostream>\n#include <string>\nusing namespace std;\n'
const P = 'struct P { int x; };\n'

describe('C++ 的左值是接點', () => {
  it('★ 錨點：`x += 1` lift 得出來，而左邊是一顆節點不是字串', () => {
    const node = findCompound(lift(`${IO}int main(){ int x = 1; x += 1; cout << x; }`))
    expect(node, '正向錨點——沒有它，下面的負向會空過').toBeTruthy()
    expect(node!.properties.name, '🔴 字串屬性長回來了').toBeUndefined()
    expect(node!.children.target).toHaveLength(1)
    expect(node!.children.target[0].componentId).toBe('cpp:var_ref')
  })

  it.each([
    ['a[i]', 'cpp:array_at', `${IO}int main(){ int a[3]={1,2,3}; int i=1; a[i] += 10; cout << a[1]; }`, '12'],
    ['o.x', 'cpp:struct_at_member', `${IO}${P}int main(){ P o; o.x = 1; o.x += 5; cout << o.x; }`, '6'],
    ['p->x', 'cpp:struct_at_ptr', `${IO}${P}int main(){ P o; o.x = 1; P* p = &o; p->x += 5; cout << o.x; }`, '6'],
    ['*q', 'cpp:pointer_deref', `${IO}int main(){ int i = 1; int* q = &i; *q += 5; cout << i; }`, '6'],
  ])('🎯 左值是 %s → 巢狀成 %s，而且算得對', async (_shape, componentId, src, want) => {
    const node = findCompound(lift(src))
    expect(node, '🔴 沒 lift 出複合指定').toBeTruthy()
    expect(node!.children.target[0].componentId,
      '🔴 左邊沒有變成那顆節點——它可能又被壓成字串了').toBe(componentId)
    expect(await run(src), '🔴 lift 對了而執行錯了').toBe(want)
  })

  /**
   * 🔴 **這一條是這個設計的證據**：`a[i][j]` 與 `s[i]` 是**另外兩顆元件**
   * （`cpp:array_2d_at`／`cpp:string_at`），而讓它們變成左值
   * **沒有動任何一支賦值執行器**——各自在自己的膠囊裡宣告怎麼被寫回。
   *
   * 這一支第一次跑時它們兩個都紅（「這個東西不能被指定值」），
   * 而修法是各加一個 `declareLvalue`，不是在共用檔多兩個分支。
   */
  it('★ 加一種左值形狀不改任何既有執行器（路線圖驗收②）', () => {
    const two = findCompound(lift(`${IO}int main(){ int a[2][2]; a[1][0] += 5; }`))
    const str = findCompound(lift(`${S}int main(){ string s = "h"; s[0] -= 7; }`))
    expect(two!.children.target[0].componentId).toBe('cpp:array_2d_at')
    expect(str!.children.target[0].componentId).toBe('cpp:string_at')
  })

  it('🎯 兩層下標（`a[i][j] += 1`）——舊版連 lift 都拆不出來', async () => {
    const src = `${IO}int main(){ int a[2][2]={{1,2},{3,4}}; a[1][0] += 5; cout << a[1][0]; }`
    expect(await run(src)).toBe('8')
  })

  it('⚠️ 字串那一格仍然是左值（`s[i] -= 7`）——C++ 的 `operator[]` 回參照', async () => {
    // 🔴 這個直譯器裡字串是**不可變**的，所以那一格的寫回要重建整個字串
    //    再寫回變數——`cpp:array_at` 的解法認得它。
    expect(await run(`${S}int main(){ string s = "h"; s[0] -= 7; cout << s; }`)).toBe('a')
  })

  it('⚠️ 字串的 `+=` 是串接不是相加（這一筆踩過兩次）', async () => {
    expect(await run(`${S}int main(){ string d = ""; d += 'a'; d += "bc"; cout << d; }`)).toBe('abc')
  })

  it('🎯 產回去一字不差——五種左值', () => {
    const src = `${IO}${P}int main(){ int a[3]; int i=0; P o; P* p=&o; int* q=&i;\n`
      + `a[i] += 1;\no.x += 1;\np->x += 1;\n*q += 1;\ni += 1;\n}`
    const out = generateCode(lift(src), 'cpp', googleStyle as unknown as StylePreset)
    for (const line of ['a[i] += 1;', 'o.x += 1;', 'p->x += 1;', '*q += 1;', 'i += 1;']) {
      expect(out, `🔴 產不回 ${line}`).toContain(line)
    }
  })

  /**
   * 🎯 **`++` 的運算元也是一個左值**（2026-08-25，同一刀的第二顆）。
   *
   * 🪦 `cpp:increment` 的 lift 那側本來也寫著「⚠️ 兩種形狀：`i++` 與 `arr[i]++`」
   * ——而 `o.x++`／`p->x++`／`(*q)++`／`a[i][j]++`／`s[i]++` 全部合法。
   * 🪦 **第二個 `altLayout` 隨這一刀退場**。
   */
  it.each([
    ['a[i]++', 'cpp:array_at', `${IO}int main(){ int a[3]={1,2,3}; int i=1; a[i]++; cout << a[1]; }`, '3'],
    ['o.x++', 'cpp:struct_at_member', `${IO}${P}int main(){ P o; o.x = 1; o.x++; cout << o.x; }`, '2'],
    ['p->x++', 'cpp:struct_at_ptr', `${IO}${P}int main(){ P o; o.x = 1; P* p = &o; p->x++; cout << o.x; }`, '2'],
    ['(*q)++', 'cpp:pointer_deref', `${IO}int main(){ int i = 1; int* q = &i; (*q)++; cout << i; }`, '2'],
  ])('🎯 遞增的運算元是 %s → 巢狀成 %s，而且算得對', async (_shape, componentId, src, want) => {
    const node = findIncrement(lift(src))
    expect(node, '🔴 沒 lift 出遞增').toBeTruthy()
    expect(node!.properties.name, '🔴 字串屬性長回來了').toBeUndefined()
    expect(node!.children.target[0].componentId).toBe(componentId)
    expect(await run(src), '🔴 lift 對了而執行錯了').toBe(want)
  })

  it('⚠️ 前綴給新值、後綴給舊值——而字元那一格要保持 char', async () => {
    expect(await run(`${IO}int main(){ int i = 1; int b = i++; cout << b << i; }`), '後綴給舊值').toBe('12')
    expect(await run(`${IO}int main(){ int i = 1; int b = ++i; cout << b << i; }`), '前綴給新值').toBe('22')
    expect(await run(`${S}int main(){ string s = "a"; s[0]++; cout << s; }`), '字元加完仍是字元').toBe('b')
  })

  it('🎯 遞增也產得回去——五種運算元', () => {
    const src = `${IO}${P}int main(){ int a[3]; int i=0; P o; P* p=&o; int* q=&i;\n`
      + `a[i]++;\no.x++;\np->x++;\n(*q)++;\n--i;\n}`
    const out = generateCode(lift(src), 'cpp', googleStyle as unknown as StylePreset)
    for (const line of ['a[i]++;', 'o.x++;', 'p->x++;', '(*q)++;', '--i;']) {
      expect(out, `🔴 產不回 ${line}`).toContain(line)
    }
  })

  /**
   * 🎯 **普通指派的左邊也是左值**（2026-08-25，同一刀的第四顆）。
   *
   * 🪦 `cpp:var_assign` 的執行器本來這樣拆它的字串左值：
   *
   * ```
   * const dot = name.indexOf('.')   // ← 只認【一個】點
   * ```
   *
   * 🔴 而第七十二條護欄量到那個字串**在語料上裝著 12 種非原子的值**
   * （`r.x`／`p.x`…）。下面的 `a.b.c = 1`／`p->x = 1`／`*q = 1`
   * 在那一版全部走不通，**而 `ctx.scope.set("p->x", val)` 會安靜地
   * 在作用域裡長出一個叫 `p->x` 的變數**。
   */
  it.each([
    ['o.x', `${IO}${P}int main(){ P o; o.x = 7; cout << o.x; }`, '7'],
    ['p->x', `${IO}${P}int main(){ P o; P* p = &o; p->x = 7; cout << o.x; }`, '7'],
    ['*q', `${IO}int main(){ int i = 1; int* q = &i; *q = 7; cout << i; }`, '7'],
    ['a[i][j]', `${IO}int main(){ int a[2][2]; a[1][0] = 7; cout << a[1][0]; }`, '7'],
  ])('🎯 普通指派的左值是 %s——舊版會安靜地長出一個叫它的變數', async (_s, src, want) => {
    expect(await run(src)).toBe(want)
  })

  it('🔴 左值不再是字串屬性——那一格已經沒有了', () => {
    const node = findAssign(lift(`${IO}${P}int main(){ P o; o.x = 7; }`))
    expect(node, '正向錨點——沒有它，下面的負向會空過').toBeTruthy()
    expect(node!.properties.obj, '🔴 字串屬性長回來了').toBeUndefined()
    expect(node!.children.target[0].componentId).toBe('cpp:struct_at_member')
  })

  /**
   * 🔴 **`&a[i]` 的迴歸——而它不會出現在「答案對不對」那一欄。**
   *
   * 2026-08-26 把 `cpp:array_at` 的容器從字串屬性換成接點之後，
   * `cpp:address_of` 還在讀 `properties.obj`，於是 `&arr[0]` 退到
   * 「符號式取位址」那一支、拿不到名字、丟 `TYPE_MISMATCH: pointer`。
   *
   * ⚠️ 抓到它的是**第三十二條護欄的「只有參照跑得動」那一欄**（1 → 3）
   * ——而**誤差本身仍然是 0**。
   *
   * > **一個「跑不動」的迴歸，不會出現在「答案對不對」那一欄
   * > ——分子是 0，而分母悄悄少了兩段。**
   */
  it('🔴 `&a[i]` 取的是那一格的位址，而寫回去要影響原本的陣列', async () => {
    expect(await run(`${IO}int main(){ int arr[3]; arr[0] = 10;\n`
      + `int* ptr = &arr[0];\ncout << *ptr << endl;\n*ptr = *ptr + 5;\ncout << arr[0] << endl; }`))
      .toBe('10\n15\n')
  })

  it('🔴 函式回傳 `&arr[i]`——跨作用域仍然指著同一格', async () => {
    expect(await run(`${IO}int* firstPositive(int* a, int n) {\n`
      + `  for (int i = 0; i < n; i++) { if (a[i] > 0) return &a[i]; }\n  return nullptr;\n}\n`
      + `int main(){ int data[4] = {-1,-2,3,4}; int* p = firstPositive(data, 4);\n`
      + `if (p) cout << *p << endl; }`))
      .toBe('3\n')
  })

  /**
   * 🔴 **`m[k]++` 的迴歸——而它是被【另一個缺陷】藏起來的。**
   *
   * `cpp:increment` 的運算元改成接點之後，`freq[c]++` 走 `resolvePlace`，
   * 而 `cpp:map_at` **沒有宣告怎麼被寫回** → 丟「這個東西不能被指定值」。
   *
   * ⚠️ 沒有任何測試變紅。抓到它的是第三十二條護欄（行為的誤差），
   * 而那條護欄當時正被一個壞掉的語料收集器藏著將近一半的語料。
   *
   * > **兩個缺陷疊在一起時，上面那個會讓下面那個看不見。**
   */
  it('🔴 `m[k]++` 與 `m[k] = v`——對應表的一格也是左值', async () => {
    const M = '#include <iostream>\n#include <map>\nusing namespace std;\n'
    expect(await run(`${M}int main(){ map<char,int> f; f['a']++; f['a']++; cout << f['a']; }`)).toBe('2')
    expect(await run(`${M}int main(){ map<char,int> f; f['a'] = 7; cout << f['a']; }`)).toBe('7')
  })

  /**
   * 🔴 **`for (char c : s)` 迴圈一次都不跑——而它沒有出聲。**
   *
   * `cpp:loop_range` 的執行器只認 `array`，字串不在內。
   *
   * > **一個「條件沒中就整段跳過」的執行器，
   * > 把「還沒支援」變成了「安靜地什麼都不做」。**
   */
  it('🔴 字串也能 range-for，而每一格是一個字元', async () => {
    const S2 = '#include <iostream>\n#include <string>\nusing namespace std;\n'
    expect(await run(`${S2}int main(){ string s = "abc"; for (char c : s) cout << c; }`)).toBe('abc')
  })

  /**
   * 🔴 **`std::map` 是有序的，而我們是插入序**——而它不會報錯，只是順序不對。
   */
  it('🔴 對應表走訪照鍵的順序，不是插入的順序', async () => {
    const M = '#include <iostream>\n#include <map>\nusing namespace std;\n'
    expect(await run(`${M}int main(){ map<char,int> f; f['r']=1; f['a']=2; f['m']=3;\n`
      + `for (auto& p : f) cout << p.first; }`)).toBe('amr')
  })

  /**
   * 🔴 **`scanf("%d", &a[i])` 的 `&` 掉了——而它編不過。**
   *
   * 產生器本來問的是「這個參數是不是 `variableRef`」，於是只有 `&x` 加得回 `&`。
   * 而它的另一半條件 `!a.properties.noAddr` **從來沒有人設過那個屬性**。
   *
   * > **一個永遠不會成立的條件，讀起來像一條規則，而它什麼都沒管到。**
   *
   * 🟢 修法是問一個**宣告的性狀**：`traits.addressable`
   * ——而那一組正好就是「宣告了左值解法」的那一組：
   * **一個取得到位址的東西，就是一個寫得回去的位置。**
   */
  it('🔴 `scanf` 的每一個目標都要帶回 `&`——包含 `&a[i]`', () => {
    const src = '#include <cstdio>\nint main() {\n  int a[3];\n  int i = 0;\n  int x, y;\n'
      + '  scanf("%d %d", &x, &y);\n  scanf("%d", &a[i]);\n'
      + '  printf("%d %d\\n", x, y);\n  printf("sum=%d\\n", x + y);\n  return 0;\n}'
    const out = generateCode(lift(src), 'cpp', googleStyle as unknown as StylePreset)
    expect(out.trim()).toBe(src.trim())
  })
})
