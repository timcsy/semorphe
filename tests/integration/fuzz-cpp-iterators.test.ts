/**
 * **模糊測試的常駐網：迭代器一族。**
 *
 * ## 它從哪來
 *
 * 管線 180 的第四關。往「我自己寫的測試想不到的邊界」壓：邊走邊刪、
 * 兩個位置界定一段範圍、空容器、巢狀容器、位置算術、前置與後置的差別。
 *
 * ## 🔴 壓出來的，與它們的形狀
 *
 *     auto lo = a, hi = b;      只認得【第一個】宣告子 ⟹ hi 整個蒸發
 *     s.erase(it++)             別人手上那份位置的偏移量沒有人通知它
 *     m[1].insert(5)            接收者被壓成文字
 *
 * 🔴 **第一個這個 repo 修過一次**（2026-09-10，容器的宣告：
 * `vector<int> C(n), V(n);` 的 `V` 整個蒸發），而自動型別那一支沒有跟著修。
 *
 * > **一個只寫得出「一個」的讀取器，在遇到兩個的時候不會出聲
 * > ——它會安靜地讀完第一個就回去。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { runCppDetailed, hasReferenceCompiler } from '../helpers/run-cpp'
import type { SemanticNode } from '../../src/core/types'

const ROOT = process.cwd()
let parser: Parser
let lifter: ReturnType<typeof createTestLifter>

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${ROOT}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${ROOT}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
}, 120_000)

const lift = (c: string): SemanticNode =>
  lifter.lift(parser.parse(c)!.rootNode as never) as SemanticNode
const run = async (src: string): Promise<string> => {
  const out: string[] = []
  const interp = new SemanticInterpreter({ maxSteps: 400_000 })
  interp.setOutputCallback((x) => out.push(x))
  await interp.execute(lift(src), [])
  return out.join('')
}
const H = `#include <iostream>\n#include <set>\n#include <map>\n#include <vector>\n#include <string>\n#include <algorithm>\nusing namespace std;\n`
const prog = (body: string): string => `${H}int main(){ ${body} return 0; }\n`

const sameAsCompiler = async (body: string, hint: string): Promise<void> => {
  const src = prog(body)
  const ref = runCppDetailed(src)
  expect(ref.ok, `🔴 參照編譯器收不下（測試自己的問題）：${ref.ok ? '' : ref.message}`).toBe(true)
  expect(await run(src), hint).toBe(ref.output)
}

describe('模糊測試：迭代器的邊界', () => {
  it.runIf(hasReferenceCompiler())('🔴 一個 `auto` 宣告兩個名字', async () => {
    await sameAsCompiler(
      `set<int> s; for (int i = 1; i <= 9; i++) s.insert(i);
       auto lo = s.lower_bound(3), hi = s.upper_bound(6);
       int n = 0, sum = 0; for (auto it = lo; it != hi; ++it) { n++; sum += *it; }
       cout << n << ' ' << sum;`,
      '🔴 只認得第一個宣告子的話，第二個名字整個蒸發，而錯誤會指著【使用】的那一行')
  }, 60_000)

  it.runIf(hasReferenceCompiler())('🔴 邊走邊刪：`it = c.erase(it)`（語料用的那一個）', async () => {
    await sameAsCompiler(
      `set<int> s; for (int i = 1; i <= 6; i++) s.insert(i);
       for (auto it = s.begin(); it != s.end(); ) { if (*it % 2 == 0) it = s.erase(it); else ++it; }
       for (int v : s) cout << v; cout << s.size();`,
      '🔴 刪除要回傳下一個位置，否則迴圈會跳過一格或走不完')
  }, 60_000)

  it.runIf(hasReferenceCompiler())('🔴 邊走邊刪：對照表那一側', async () => {
    await sameAsCompiler(
      `map<int,int> m; for (int i = 1; i <= 5; i++) m[i] = i * i;
       for (auto it = m.begin(); it != m.end(); ) { if (it->second > 9) it = m.erase(it); else ++it; }
       cout << m.size(); for (auto& p : m) cout << p.first;`, '')
  }, 60_000)

  it.runIf(hasReferenceCompiler())('🔴 邊走邊刪：列表那一側（`erase` 回傳下一個）', async () => {
    await sameAsCompiler(
      `vector<int> v{1,2,3,4};
       for (auto it = v.begin(); it != v.end(); ) { if (*it % 2 == 0) it = v.erase(it); else ++it; }
       for (int x : v) cout << x;`, '')
  }, 60_000)

  it.runIf(hasReferenceCompiler())('★ 空容器：`begin() == end()`，而迴圈跑零次', async () => {
    await sameAsCompiler(
      `set<int> s; cout << (s.begin() == s.end()) << s.empty();
       int n = 0; for (auto it = s.begin(); it != s.end(); ++it) n++; cout << n;`,
      '🔴 這是良好定義的——而空容器上【解參考】才是未定義，那一條不在這裡')
  }, 60_000)

  it.runIf(hasReferenceCompiler())('🔴 位置算術：排序過的列表上二分搜', async () => {
    await sameAsCompiler(
      `vector<int> v{5,3,9,1}; sort(v.begin(), v.end());
       auto it = lower_bound(v.begin(), v.end(), 4); cout << *it << (it - v.begin());`,
      '🔴 自由函式那一形式吃的是兩個位置——與方法那一形式是不同的身分')
  }, 60_000)

  it.runIf(hasReferenceCompiler())('🔴 後置遞增在運算式位置回傳舊的', async () => {
    await sameAsCompiler(`vector<int> v{7,8,9}; auto it = v.begin(); cout << *it++ << *it;`,
      '🔴 `*it++` 印的是舊位置上的值，而 `it` 已經往前一格')
  }, 60_000)

  it.runIf(hasReferenceCompiler())('★ 找不到：`c.find(x) == c.end()` 的標準寫法', async () => {
    await sameAsCompiler(
      `set<string> s; s.insert("ab");
       cout << (s.find("zz") == s.end()) << (s.find("ab") != s.end());`, '')
  }, 60_000)

  // ─── 第二輪盲測壓出來的三個（2026-09-17，全部當場修好） ──────

  /**
   * 🔴 **把一個容器交出去，它到不了對面**。
   *
   * `map<char,int> r = f();` 的初始值在 **lift 就掉了**——掛不掛 `source`
   * 這一格是**問宣告**的，而集合與對照表那兩顆的 `slots` 是空的。
   * 症狀兩層而兩層都不出聲：產出的碼變成 `map<char,int> r;`（合法，
   * 只是不是使用者寫的那一段），跑起來 `r` 是空的。
   *
   * > **一格沒有宣告的接點，與一個「這個概念不吃初始值」的決定長得一模一樣。**
   */
  it('回傳一個對照表，接住它的宣告要真的接到', async () => {
    const src = `${H}map<char,int> f(){ map<char,int> m; m['a']=1; return m; }\n`
      + `int main(){ map<char,int> r=f(); cout<<r.size()<<r['a']; return 0; }\n`
    const ref = runCppDetailed(src)
    expect(ref.ok, '🔴 參照編譯器收不下（測試自己的問題）').toBe(true)
    expect(await run(src), '🔴 回傳的容器整個掉了').toBe(ref.output)
  }, 60_000)

  it('用另一個集合建起來——而複製要真的是複製', async () => {
    // ⚠️ 正向錨點在後半段：`a.size()` 必須是 1。
    //    淺複製的話 `b.insert(4)` 會同時改到 `a`，而那種錯不在建立的那一行出聲。
    await sameAsCompiler(
      `set<int> a; a.insert(3); set<int> b = a; b.insert(4); cout << a.size() << b.size();`,
      '🔴 兩個集合共用了同一串格子')
  }, 60_000)

  /**
   * 🔴 **`const` ＋ 陣列**——查表法的標準寫法，而它有兩個不同的壞法：
   *
   *     const int  a[3] = {…}    整段認不出來（降級成原文）
   *     const char* n[2] = {…}   認【錯】：陣列那一層被吃掉，n 成了一個純量
   *
   * 後者更糟，而它的成因是那道閘**只往下看一層**——`const char* n[2]` 的
   * 陣列被指標包住了。判準寫在 `strategies.ts`：**`const` 是型別修飾詞，
   * 它屬於型別；`static` 是儲存類別，它不屬於。**
   */
  it('const ＋ 陣列：一維、指標元素、不寫大小', async () => {
    await sameAsCompiler(
      `const int a[3] = {1,2,3}; const char* n[2] = {"ab","cd"}; const char* m[] = {"x","y"};
       cout << a[1] << n[1] << m[0];`, '🔴 const 把陣列那一層吃掉了')
  }, 60_000)

  it('const ＋ 二維陣列', async () => {
    await sameAsCompiler(
      `const int t[2][3] = {{1,2,3},{4,5,6}}; cout << t[1][2] << t[0][0];`,
      '🔴 const ＋ 二維：維度被塞進名字')
  }, 60_000)

  /**
   * 🔴 **傳值的字串，被呼叫端刪它的字——而呼叫者的【走訪】跟著少字**。
   *
   * `begin()` 會把字元格子攤出來**存回那個值身上**當快取，而複製一個字串
   * 走的是「純量」那條路（`{ ...v }`）——外殼是新的，**格子是同一個陣列**。
   *
   * ⚠️ 症狀**分裂成兩半**，而那是它活下來的原因：
   * `cout << base` 印的是 `value`（對的），`for (auto it = base.begin()…)`
   * 走的是格子（少了字）。**同一個變數的兩個讀法，只有一個壞了。**
   */
  it('傳值的字串被刪字之後，呼叫者的走訪不得跟著變', async () => {
    const src = `${H}string squeeze(string s, char drop){\n`
      + `  string::iterator it = s.begin();\n`
      + `  while (it != s.end()) { if (*it == drop) it = s.erase(it); else ++it; }\n`
      + `  return s;\n}\n`
      + `int main(){ string base = "banana"; string t = squeeze(base, 'a');\n`
      + `  int n = 0; for (string::const_iterator it = base.begin(); it != base.end(); ++it) n++;\n`
      + `  cout << t << ' ' << base << ' ' << n; return 0; }\n`
    const ref = runCppDetailed(src)
    expect(ref.ok, '🔴 參照編譯器收不下（測試自己的問題）').toBe(true)
    expect(await run(src), '🔴 傳值的複本與呼叫者共用了字元格子').toBe(ref.output)
  }, 60_000)

  /**
   * 🔴 **`string w(names[i]);` 的下標會被「最令人困惑的解析」吃掉**。
   *
   * tree-sitter 把 `names[i]` 讀成一個**參數宣告**（型別 `names` ＋
   * 一個沒有名字的陣列宣告子 `[i]`），而還原那一路只取了型別名
   * ——於是 `string a(w[0])` 與 `string b(w[1])` **lift 出一模一樣的樹**。
   *
   * ⚠️ 而它是靜默的：積木畫得出來、產出的碼少一段下標而仍然合法。
   */
  it('建構參數裡的下標不得消失：`string w(names[i])`', async () => {
    await sameAsCompiler(
      `const char* names[3] = {"do","re","mi"};
       for (int i = 0; i < 3; i++) { string w(names[i]); cout << w << w.size(); }`,
      '🔴 兩個不同的下標 lift 成同一棵樹')
  }, 60_000)

  // ─── 壓出來而這一刀不修的，各留一支 ────────────────────────
  //
  // ⚠️ 兩支都用 `it.fails`（不是 `it.todo`）——**修好的那天它會紅，逼人來拔釘子**。

  it.fails('[BLOCKED:cpp:container_erase] 刪一格之後，別人手上那份位置沒有人通知它', async () => {
    // 🔴 **這【不是】迭代器失效**：C++ 的 `set::erase` 只讓被刪的那個失效，
    //    別人手上的仍然有效。所以這是我們「位置＝偏移量」模型的一個真實限制
    //    ——刪掉一格之後，指向後面的那些拷貝的偏移量全部差一。
    //    而它是**靜默的錯答案**：`s.erase(a)` 之後 `*b` 我們給 4、g++ 給 3。
    //
    // 🟠 **為什麼不現在修**：要讓位置能被「修正」，容器得記下每一次刪除的位置，
    //    而每一個讀位置的地方都要先套用那份紀錄。那是一次模型改動，
    //    而**語料量到 0 支**用這個寫法（語料用的是 `it = c.erase(it)`，已支援）。
    // 🔴 何時該修：如果盲測或使用者的程式出現這個寫法——**第二個獨立來源**就夠了。
    await sameAsCompiler(
      `set<int> s; for (int i = 1; i <= 4; i++) s.insert(i);
       auto a = s.begin(); auto b = a; ++b; ++b; s.erase(a); cout << *b;`, '')
  }, 60_000)

  it.fails('[BLOCKED:cpp:map_at] 巢狀容器的接收者：`m[1].insert(5)`', async () => {
    // 🟠 **為什麼不現在修**：`m[1]` 當接收者時被壓成文字，而解析它需要讓接收者
    //    的解析知道「這個容器是 keyed」——那是「接收者被壓成文字」那個設計題的一部分
    //    （34 顆元件共用）。
    // 🔴 何時該修：接收者重構那一刀。
    await sameAsCompiler(
      `map<int,set<int>> m; m[1].insert(5); m[1].insert(3);
       for (auto it = m[1].begin(); it != m[1].end(); ++it) cout << *it; cout << m[1].size();`, '')
  }, 60_000)
})
