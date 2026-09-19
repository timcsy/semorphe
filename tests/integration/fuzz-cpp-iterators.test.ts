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
/**
 * 🔴 **標頭走墊片，不手列**（2026-09-18，CI 抓到）——本機是 Apple clang（libc++）、
 * CI 是 GNU g++（libstdc++），而**兩者對「哪個標頭遞移帶進哪個」的答案不同**。
 * 手列的話，本機全綠而 CI 紅，訊息還會說「測試自己的問題」。
 * 見第 120 條護欄 `audit-refcc-headers`。
 */
const H = '#include <bits/stdc++.h>\nusing namespace std;\n'
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

  /**
   * 🔴 **`->` 的接收者是一個運算式**——`m.begin()->second`、`it->second`。
   *
   * 那顆元件的接收者原本被 `.text` 抄成字串，於是執行時
   * `scope.get("m.begin()")` 說「這個變數尚未宣告」。
   * ⚠️ 同族的 `.`（成員存取）2026-08-26 就改成接點了，而 `->` 這一條漏掉。
   *
   * 🔴 **而它改不動的原因值得記住**：那顆積木的 BlockSpec 上還有一個
   * `astPattern`——**一個第二個 lift 來源**，而它贏過膠囊自己的分支。
   * > **一個概念有兩個 lift 來源時，改對了其中一個不會有任何反應
   * > ——而那讓人以為自己改錯了地方。**
   */
  it('`->` 的接收者可以是一棵樹', async () => {
    await sameAsCompiler(
      `map<int, vector<int>> m; m[1].push_back(7);
       cout << m.begin()->second.size() << m.begin()->first;`,
      '🔴 `->` 的接收者被壓成文字了')
  }, 60_000)

  it('`it->second` 當函式引數', async () => {
    const src = `${H}int g(const vector<int>& v){ return v.size(); }\n`
      + `int main(){ map<int,vector<int>> m; m[1].push_back(7); m[2].push_back(1); m[2].push_back(2);\n`
      + `  for (auto it = m.begin(); it != m.end(); ++it) cout << g(it->second); return 0; }\n`
    const ref = runCppDetailed(src)
    expect(ref.ok, '🔴 參照編譯器收不下（測試自己的問題）').toBe(true)
    expect(await run(src), '🔴 `it->second` 當引數傳不過去').toBe(ref.output)
  }, 60_000)

  // ─── 壓出來而這一刀不修的，各留一支 ────────────────────────
  //
  // ⚠️ 兩支都用 `it.fails`（不是 `it.todo`）——**修好的那天它會紅，逼人來拔釘子**。

  /**
   * 🟢 **2026-09-18：這根釘子被拔了，而拔它的是它自己寫的觸發條件。**
   *
   * 原本的釘子寫著：「**語料量到 0 支**用這個寫法……🔴 何時該修：如果盲測或
   * 使用者的程式出現這個寫法——**第二個獨立來源**就夠了。」
   * 那一天來了，而且不是兩個來源是**三個**：十支盲測裡 fuzz_3（`multiset`）、
   * fuzz_6（`map<int,set<int>>`）、fuzz_9 全部寫 `c.erase(it++)`。
   *
   * 🟢 修法就是釘子上寫的那一句：**容器記下每一次刪除的位置，
   * 而每一個讀位置的地方先套用那份紀錄**（`pointer.ts` 的 `noteErasure`／
   * `offsetOf`／`positionIn`，以及 `RuntimeValue.era`）。
   *
   * > **一根釘子如果寫得出「什麼讀數會讓我該被拔掉」，
   * > 那個讀數出現的那天它就不需要有人記得它。**
   */
  it('★ 刪一格之後，別人手上那份位置會被通知', async () => {
    // 🔴 **這【不是】迭代器失效**：C++ 的 `set::erase` 只讓被刪的那個失效，
    //    別人手上的仍然有效——所以這一格有唯一的正確答案，進得了判準。
    await sameAsCompiler(
      `set<int> s; for (int i = 1; i <= 4; i++) s.insert(i);
       auto a = s.begin(); auto b = a; ++b; ++b; s.erase(a); cout << *b;`, '')
  }, 60_000)

  /**
   * 🔴 **邊走邊刪的兩種寫法**——盲測三支同時寫的那一個。
   *
   * `c.erase(it++)` 的 `it++` **先**挪一格、**後**那一格被抽掉，於是底下整串左移。
   * 症狀不是當掉，是**數字偏小**（`pruned=1` 而 g++ 說 2）。
   */
  it('★ `erase(it++)`：集合／對照表／文字三種容器', async () => {
    await sameAsCompiler(
      `set<int> s; for (int i = 1; i <= 6; i++) s.insert(i);
       auto it = s.begin(); int n = 0;
       while (it != s.end()) { if (*it % 2 == 0) { s.erase(it++); n++; } else ++it; }
       cout << n << s.size(); for (int x : s) cout << x;`,
      '🔴 挪過去的位置指到了再下一個——每刪一格就跳過一格')
  }, 60_000)

  it('★ `erase(it++)` 在對照表上，而值也要跟著', async () => {
    await sameAsCompiler(
      `map<int,int> m; for (int i = 0; i < 5; i++) m[i] = i * i;
       auto it = m.begin(); int n = 0;
       while (it != m.end()) { if (it->second < 9) { m.erase(it++); n++; } else ++it; }
       cout << n << m.size();`, '')
  }, 60_000)

  it('★ `it = c.erase(it)` 那一半不得被弄壞', async () => {
    await sameAsCompiler(
      `vector<int> v{1,2,3,4,5,6}; auto it = v.begin(); int n = 0;
       while (it != v.end()) { if (*it % 2) { it = v.erase(it); n++; } else ++it; }
       cout << n << v.size(); for (int x : v) cout << x;`, '')
  }, 60_000)

  it('★ 兩個位置存在變數裡，中間刪掉前面一格', async () => {
    await sameAsCompiler(
      `multiset<int> ms{1,2,3,4,5,6,7};
       auto lo = ms.lower_bound(3); auto hi = ms.upper_bound(5);
       ms.erase(ms.find(1));
       cout << *lo << *hi << ms.size();`,
      '🔴 刪掉第 0 格之後，手上那兩個位置各該往前一格')
  }, 60_000)

  /**
   * 🔴 **參數的型別帶著修飾，而別名查不到就會認錯身分**（盲測 fuzz_6）。
   *
   * ```cpp
   * typedef map<int, set<int>> Graph;
   * void dfs(const Graph &g, …) { auto row = g.find(u); … }
   * ```
   *
   * `normalizeParamType('const Graph &')` 對不認得的型別回傳原樣，於是
   * 「`g` 是什麼」查不到 `Graph`，而 `g.find(u)` 被認成**字串的 find**——
   * 它回 `-1`，下一步 `row->second` 就去 `scope.get('-1')`。
   *
   * > **一個查不到型別就讓開的判別是安全的；而一個查不到型別就
   * > 【落到預設身分】的判別，會安靜地把別人的東西當成自己的。**
   *
   * ⚠️ 斷言**身分**而不只是輸出：認錯身分而輸出碰巧對，是這一族的常態。
   */
  it('★ `typedef` 的容器當 `const &` 參數傳進去', async () => {
    const src = `${H}typedef map<int, set<int>> Graph;\n`
      + `int deg(const Graph &g, int u){ auto row = g.find(u);\n`
      + `  if (row == g.end()) return -1; return row->second.size(); }\n`
      + `int main(){ Graph g; g[1].insert(2); g[1].insert(3); g[2].insert(1);\n`
      + `  cout << deg(g, 1) << deg(g, 2) << deg(g, 9); return 0; }\n`
    const ids = new Set<string>()
    const walk = (n: SemanticNode): void => {
      ids.add(n.componentId)
      for (const kids of Object.values(n.slots ?? {})) for (const k of kids ?? []) walk(k)
    }
    walk(lift(src))
    expect([...ids], '🔴 `g.find(u)` 被認成字串的 find（回 -1）').toContain('cpp:container_find')
    expect([...ids], '🔴 接收者的型別查不到，於是落到字串那一支').not.toContain('cpp:string_find')
    const ref = runCppDetailed(src)
    expect(ref.ok, '🔴 參照編譯器收不下（測試自己的問題）').toBe(true)
    expect(await run(src), '🔴 別名 ＋ 修飾詞的參數型別沒解開').toBe(ref.output)
  }, 60_000)

  /**
   * 🔴 **一個「位置」不是一個容器——傳值那一路不得複製它**（盲測 fuzz_8）。
   *
   * ```cpp
   * long long parseExpr(TIt &it, TIt end);   // end 是【傳值】的迭代器
   * ```
   *
   * 兩者在執行期都是 `type: 'array'`，於是 `end` 底下那串格子被整個複製，
   * 而 `it != end` 的判準是「同一個 JS 陣列參考」——**結束條件永遠不成立**，
   * 最後在結尾之後解參考。⚠️ 症狀是一個**越界**，不是一個錯答案。
   */
  it('★ 迭代器傳值進函式，仍然指著同一串格子', async () => {
    const src = `${H}int eat(vector<int>::iterator it, vector<int>::iterator end){\n`
      + `  int n = 0; while (it != end) { n += *it; ++it; } return n; }\n`
      + `int main(){ vector<int> v{1,2,3,4}; cout << eat(v.begin(), v.end()); return 0; }\n`
    const ref = runCppDetailed(src)
    expect(ref.ok, '🔴 參照編譯器收不下（測試自己的問題）').toBe(true)
    expect(await run(src), '🔴 傳值把位置底下那串格子複製走了').toBe(ref.output)
  }, 60_000)

  /**
   * 🔴 **`char` 是整數型別**（盲測 fuzz_8 的第二個缺陷）——`*c - '0'` 在 C++ 裡是 `int`。
   * 把它算成小數的話，**下游第一個整數除法才會失真**：`100/7/2+1` 印出 `8.14286`。
   */
  it('★ 字元相減之後的整數除法', async () => {
    await sameAsCompiler(
      `string t = "100"; long long n = 0;
       for (string::const_iterator c = t.begin(); c != t.end(); ++c) n = n * 10 + (*c - '0');
       long long r = 7; n /= r; cout << n;`,
      '🔴 `char - char` 被算成小數了')
  }, 60_000)

  /**
   * 🟢 **2026-09-18：這根釘子被拔了。** 它寫著「何時該修：接收者重構那一刀」，
   * 而那一刀確實修好了接收者——**只解開一半**：`m[1]` 自動建出來的那一格
   * 還要拿得到自己的種類（見 `runtime/container-defaults`）。
   *
   * > **一根釘子上寫的阻斷者，可能只是擋住它的其中一半。**
   */
  it('★ 巢狀容器的接收者：`m[1].insert(5)`', async () => {
    await sameAsCompiler(
      `map<int,set<int>> m; m[1].insert(5); m[1].insert(3);
       for (auto it = m[1].begin(); it != m[1].end(); ++it) cout << *it; cout << m[1].size();`, '')
  }, 60_000)
})

const P03 = `#include <bits/stdc++.h>
using namespace std;

// 原始陣列沒有 .begin()，只能用自由函式或指標
void shiftToZero(int* first, int* last) {
    if (first == last) return;
    int mn = *min_element(first, last);
    for (int* p = first; p != last; ++p) *p -= mn;
}

int sumRange(const int* first, const int* last) {
    int s = 0;
    while (first != last) {
        s += *first;
        ++first;
    }
    return s;
}

// 指標傳參考：把位置推到第一個嚴格遞增被打斷的地方
void runEnd(const int* last, const int*& cur) {
    while (next(cur) != last && *next(cur) > *cur) ++cur;
}

int main() {
    int a[10] = {37, 12, 55, 12, 90, 3, 47, 55, 21, 68};
    const int n = static_cast<int>(end(a) - begin(a));
    cout << "n = " << n << "\\n";

    // 先在未排序的陣列上找一段遞增
    const int* cur = begin(a);
    runEnd(end(a), cur);
    cout << "first run ends at index " << (cur - begin(a)) << " value " << *cur << "\\n";

    cout << "raw sum = " << sumRange(begin(a), end(a)) << "\\n";
    cout << "max = " << *max_element(begin(a), end(a))
         << " at " << (max_element(begin(a), end(a)) - begin(a)) << "\\n";

    sort(begin(a), end(a));
    for (int v : a) cout << v << " ";
    cout << "\\n";

    // 用位址當位置
    int* mid = &a[n / 2];
    cout << "mid = " << *mid << ", before = " << *prev(mid) << ", after = " << *next(mid) << "\\n";

    int* p = find(begin(a), end(a), 47);
    if (p != end(a)) {
        cout << "found 47 at " << (p - a);
        if (p != begin(a)) cout << ", prev " << *prev(p);
        if (next(p) != end(a)) cout << ", next " << *next(p);
        cout << "\\n";
    }

    // lower_bound / upper_bound 回傳的也是指標
    int* lo = lower_bound(begin(a), end(a), 12);
    int* hi = upper_bound(begin(a), end(a), 55);
    cout << "window [" << *lo << "," << *prev(hi) << "] length " << (hi - lo) << "\\n";
    cout << "window sum = " << accumulate(lo, hi, 0) << "\\n";

    // unique 只把重複的擠到後面，邏輯尾端是它的回傳值
    int* u = unique(begin(a), end(a));
    cout << "distinct = " << (u - begin(a)) << ":";
    for (int* q = begin(a); q != u; ++q) cout << " " << *q;
    cout << "\\n";

    shiftToZero(begin(a), u);
    cout << "shifted:";
    for (int* q = begin(a); q != u; ++q) cout << " " << *q;
    cout << "\\n";

    // 從尾端往回走，reverse 形式在原始陣列上一樣可用
    reverse(begin(a), u);
    cout << "reversed front part:";
    for (int* q = begin(a); q != u; ++q) cout << " " << *q;
    cout << "\\n";
    return 0;
}
`
const P01_NAIL = `#include <bits/stdc++.h>
using namespace std;

// 在有序集合裡找最接近 target 的值，用 lower_bound 的位置與它的前一格比
int closest(const set<int>& s, int target) {
    auto it = s.lower_bound(target);
    if (it == s.end()) return *prev(s.end());
    if (it == s.begin()) return *it;
    auto lo = prev(it);
    if (target - *lo <= *it - target) return *lo;
    return *it;
}

// 位置用傳值的方式交給函式，左右各看一格
long long neighbourSum(const set<int>& s, set<int>::const_iterator it) {
    long long sum = *it;
    if (it != s.begin()) sum += *prev(it);
    auto nx = next(it);
    if (nx != s.end()) sum += *nx;
    return sum;
}

int main() {
    set<int> s = {4, 8, 15, 16, 23, 42};

    for (int q : {1, 10, 15, 20, 50})
        cout << q << " -> " << closest(s, q) << "\\n";

    for (auto it = s.begin(); it != s.end(); ++it)
        cout << *it << ":" << neighbourSum(s, it) << " ";
    cout << "\\n";

    // 鄰居的鄰居
    auto it = s.find(16);
    cout << "two before 16 = " << *prev(it, 2) << "\\n";
    cout << "two after  16 = " << *next(it, 2) << "\\n";

    // 鄰居當範圍端點
    auto lo = s.lower_bound(8);
    auto hi = s.upper_bound(23);
    cout << "count in [8,23] = " << distance(lo, hi) << "\\n";
    cout << "sum   in [8,23] = " << accumulate(lo, hi, 0) << "\\n";

    // 從尾端數回來，而不是用索引
    cout << "last = " << *s.rbegin() << ", second last = " << *next(s.rbegin()) << "\\n";
    cout << "max-min = " << *prev(s.end()) - *s.begin() << "\\n";

    // 刪掉一格之後，先前算出的鄰居位置要重新取
    s.erase(s.find(16));
    auto after = s.lower_bound(16);
    cout << "after erasing 16: " << *prev(after) << " | " << *after << "\\n";
    return 0;
}
`
const P02_NAIL = `#include <bits/stdc++.h>
using namespace std;

// 頭尾各派一個位置往中間收，反向位置的 base() 會多走一格，要記得
string trim(const string& s) {
    auto b = find_if(s.begin(), s.end(), [](char c) { return !isspace(static_cast<unsigned char>(c)); });
    auto r = find_if(s.rbegin(), s.rend(), [](char c) { return !isspace(static_cast<unsigned char>(c)); });
    auto e = r.base();
    if (b >= e) return string();
    return string(b, e);
}

// 兩端夾擠判回文，只看字母。b 永遠停在「還沒檢查的那一段」的後面一格
bool isPalindrome(const string& s) {
    auto f = s.begin();
    auto b = s.end();
    while (true) {
        while (f != b && !isalpha(static_cast<unsigned char>(*f))) ++f;
        while (f != b && !isalpha(static_cast<unsigned char>(*prev(b)))) --b;
        if (f == b) return true;
        --b;                      // 現在 b 指到真正要比的那個字元
        if (f == b) return true;  // 只剩正中間一格
        if (tolower(static_cast<unsigned char>(*f)) != tolower(static_cast<unsigned char>(*b))) return false;
        ++f;                      // b 已經用掉了，剩下的就是 [f, b)
    }
}

int main() {
    string raw = "   spaces both sides   ";
    cout << "[" << trim(raw) << "]\\n";
    cout << "[" << trim("      ") << "]\\n";
    cout << "[" << trim("x") << "]\\n";

    string s = "A man, a plan, a canal: Panama";
    cout << s << " -> " << (isPalindrome(s) ? "yes" : "no") << "\\n";
    cout << "hello -> " << (isPalindrome("hello") ? "yes" : "no") << "\\n";

    string t = "abracadabra";
    cout << "first a at " << (find(t.begin(), t.end(), 'a') - t.begin()) << "\\n";
    auto lastA = find(t.rbegin(), t.rend(), 'a');
    cout << "last a at " << (t.size() - 1 - distance(t.rbegin(), lastA)) << "\\n";
    cout << "char before last a = " << *next(lastA) << "\\n";
    cout << "char via base()-1  = " << *prev(lastA.base()) << "\\n";

    // 用兩個位置刪掉中間一段
    string u = t;
    auto from = u.begin() + 3;
    auto to = u.begin() + 7;
    cout << "cutting [" << string(from, to) << "]\\n";
    u.erase(from, to);
    cout << "after erase: " << u << "\\n";

    // 刪單一位置：把每個 'a' 拿掉，邊走邊刪
    string v = t;
    for (auto it = v.begin(); it != v.end(); ) {
        if (*it == 'a') it = v.erase(it);
        else ++it;
    }
    cout << "no a: " << v << "\\n";

    // remove 只搬不刪，真正縮短要靠 erase
    string w = t;
    w.erase(remove(w.begin(), w.end(), 'b'), w.end());
    cout << "no b: " << w << "\\n";

    // 反向走一遍
    string rev;
    for (auto it = t.rbegin(); it != t.rend(); ++it) rev.push_back(*it);
    cout << "reversed: " << rev << "\\n";
    return 0;
}
`
const P03_NAIL = `#include <bits/stdc++.h>
using namespace std;

// 把同一個值的那一段當成一個範圍來處理
int runLength(const multiset<int>& ms, int v) {
    auto [lo, hi] = ms.equal_range(v);
    return static_cast<int>(distance(lo, hi));
}

// 只留下每個值的第一顆：用範圍 erase，而且要先把下一段的起點記下來
void squash(multiset<int>& ms) {
    auto it = ms.begin();
    while (it != ms.end()) {
        auto hi = ms.upper_bound(*it);
        auto second = next(it);
        if (second != hi) ms.erase(second, hi);
        it = ms.upper_bound(*it);
    }
}

// 位置傳值進來，往回數 k 格（不夠就停在開頭）
multiset<int>::const_iterator backUp(const multiset<int>& ms, multiset<int>::const_iterator it, int k) {
    while (k > 0 && it != ms.begin()) {
        --it;
        --k;
    }
    return it;
}

int main() {
    multiset<int> ms{5, 3, 9, 3, 7, 5, 5, 1, 9, 3};

    for (int v : ms) cout << v << " ";
    cout << "\\n";
    cout << "size = " << ms.size() << ", distinct = ";
    int distinct = 0;
    for (auto it = ms.begin(); it != ms.end(); it = ms.upper_bound(*it)) ++distinct;
    cout << distinct << "\\n";

    for (int v : {1, 3, 5, 7, 9, 4}) cout << v << "x" << runLength(ms, v) << " ";
    cout << "\\n";

    // 一段的尾端就是下一段的開頭
    auto firstFive = ms.lower_bound(5);
    auto pastFive = ms.upper_bound(5);
    cout << "just before the 5s = " << *prev(firstFive)
         << ", just after = " << *pastFive << "\\n";
    cout << "sum of the 5s = " << accumulate(firstFive, pastFive, 0) << "\\n";

    // 從尾端取，不用 size
    cout << "largest = " << *prev(ms.end())
         << ", second largest = " << *prev(ms.end(), 2) << "\\n";
    cout << "via rbegin: " << *ms.rbegin() << " then " << *next(ms.rbegin()) << "\\n";

    // 位置傳值進函式往回走
    auto tail = prev(ms.end());
    cout << "back up 4 from the end -> " << *backUp(ms, tail, 4) << "\\n";
    cout << "back up 99 from the end -> " << *backUp(ms, tail, 99) << "\\n";

    // 只刪一顆 3，而不是全部的 3
    ms.erase(ms.find(3));
    cout << "after erasing one 3: 3 appears " << ms.count(3) << " times\\n";

    squash(ms);
    for (auto it = ms.begin(); it != ms.end(); ++it) {
        cout << *it;
        cout << (next(it) == ms.end() ? "\\n" : ",");
    }
    cout << "final size = " << ms.size() << "\\n";
    return 0;
}
`
const P04_NAIL = `#include <bits/stdc++.h>
using namespace std;

using It = vector<int>::iterator;

// 半開區間 [first, last) 的遞迴合併排序，順便數交換次數
long long mergeSort(It first, It last, vector<int>& buf) {
    auto n = distance(first, last);
    if (n < 2) return 0;
    It mid = first + n / 2;
    long long inv = mergeSort(first, mid, buf) + mergeSort(mid, last, buf);

    buf.clear();
    It a = first, b = mid;
    while (a != mid && b != last) {
        if (*b < *a) {
            inv += distance(a, mid);
            buf.push_back(*b);
            ++b;
        } else {
            buf.push_back(*a);
            ++a;
        }
    }
    buf.insert(buf.end(), a, mid);
    buf.insert(buf.end(), b, last);
    copy(buf.begin(), buf.end(), first);
    return inv;
}

// 遞迴二分搜，回傳位置；找不到就回 last
It bsearch_rec(It first, It last, int target) {
    if (first == last) return last;
    It mid = first + distance(first, last) / 2;
    if (*mid == target) return mid;
    if (*mid < target) return bsearch_rec(next(mid), last, target);
    return bsearch_rec(first, mid, target);
}

// 遞迴反轉：兩個位置往中間走
void flip(It first, It last) {
    if (first == last) return;
    --last;
    if (first == last) return;
    swap(*first, *last);
    flip(next(first), last);
}

// 遞迴求最大子段和，回傳 (和, 起點, 終點)，終點是後一格
tuple<int, It, It> bestSlice(It first, It last) {
    if (distance(first, last) == 1) return {*first, first, last};
    It mid = first + distance(first, last) / 2;
    auto [lsum, lb, le] = bestSlice(first, mid);
    auto [rsum, rb, re] = bestSlice(mid, last);

    int run = 0, bestLeft = numeric_limits<int>::min();
    It leftStart = mid;
    for (It it = mid; it != first; ) {
        --it;
        run += *it;
        if (run > bestLeft) { bestLeft = run; leftStart = it; }
    }
    run = 0;
    int bestRight = numeric_limits<int>::min();
    It rightEnd = mid;
    for (It it = mid; it != last; ++it) {
        run += *it;
        if (run > bestRight) { bestRight = run; rightEnd = next(it); }
    }
    int cross = bestLeft + bestRight;

    if (lsum >= rsum && lsum >= cross) return {lsum, lb, le};
    if (rsum >= lsum && rsum >= cross) return {rsum, rb, re};
    return {cross, leftStart, rightEnd};
}

int main() {
    vector<int> v{9, 4, 7, 1, 8, 2, 6, 3, 5, 0};
    vector<int> keep = v;

    vector<int> buf;
    buf.reserve(v.size());
    cout << "inversions = " << mergeSort(v.begin(), v.end(), buf) << "\\n";
    for (int x : v) cout << x << " ";
    cout << "\\n";

    for (int q : {0, 5, 9, 11}) {
        It pos = bsearch_rec(v.begin(), v.end(), q);
        if (pos == v.end()) {
            cout << q << ": not found\\n";
        } else {
            cout << q << ": at " << (pos - v.begin());
            if (pos != v.begin()) cout << " after " << *prev(pos);
            if (next(pos) != v.end()) cout << " before " << *next(pos);
            cout << "\\n";
        }
    }

    flip(v.begin(), v.end());
    for (int x : v) cout << x << " ";
    cout << "\\n";
    flip(v.begin() + 2, v.begin() + 6);
    for (int x : v) cout << x << " ";
    cout << "\\n";

    vector<int> s{3, -4, 5, -1, 6, -8, 2, 7, -3, 4};
    auto [total, b, e] = bestSlice(s.begin(), s.end());
    cout << "best slice sum = " << total
         << " from " << (b - s.begin()) << " to " << (e - s.begin()) << ":";
    for (It it = b; it != e; ++it) cout << " " << *it;
    cout << "\\n";
    cout << "check = " << accumulate(b, e, 0) << "\\n";

    cout << "original untouched: ";
    for (int x : keep) cout << x << " ";
    cout << "\\n";
    return 0;
}
`
const P05_NAIL = `#include <bits/stdc++.h>
using namespace std;

// 跟標準函式同名，但參數不一樣，所以編譯器分得出來
int find(const vector<int>& v, int x) {
    auto it = std::find(v.begin(), v.end(), x);
    return it == v.end() ? -1 : static_cast<int>(it - v.begin());
}

string reverse(const string& s) {
    string out;
    for (auto it = s.rbegin(); it != s.rend(); ++it) out.push_back(*it);
    return out;
}

int count(const vector<int>& v, int x) {
    int c = 0;
    for (auto it = v.begin(); it != v.end(); ++it)
        if (*it == x) ++c;
    return c;
}

// 傳參考進來就地改，回傳新的邏輯尾端
vector<int>::iterator dedupeSorted(vector<int>& v) {
    if (v.empty()) return v.end();
    auto write = v.begin();
    for (auto read = next(v.begin()); read != v.end(); ++read) {
        if (*read != *write) {
            ++write;
            *write = *read;
        }
    }
    return next(write);
}

int main() {
    vector<int> v{8, 3, 8, 1, 9, 3, 3, 5, 1, 9, 2};

    cout << "find(9) = " << find(v, 9) << ", find(42) = " << find(v, 42) << "\\n";
    cout << "count(3) = " << count(v, 3) << ", std::count = "
         << std::count(v.begin(), v.end(), 3) << "\\n";
    cout << reverse(string("stressed")) << "\\n";

    // remove 只搬不刪，尾巴要自己砍
    vector<int> w = v;
    auto newEnd = remove(w.begin(), w.end(), 3);
    cout << "logical size after remove = " << (newEnd - w.begin())
         << ", physical size = " << w.size() << "\\n";
    w.erase(newEnd, w.end());
    for (int x : w) cout << x << " ";
    cout << "\\n";

    sort(v.begin(), v.end());
    for (int x : v) cout << x << " ";
    cout << "\\n";

    auto logicalEnd = dedupeSorted(v);
    cout << "手寫去重:";
    for (auto it = v.begin(); it != logicalEnd; ++it) cout << " " << *it;
    cout << " (tail still holds " << (v.end() - logicalEnd) << " leftovers)\\n";
    v.erase(logicalEnd, v.end());

    cout << "unique agrees: " << (unique(v.begin(), v.end()) == v.end() ? "yes" : "no") << "\\n";

    // 二分搜的兩個端點
    for (int q : {1, 4, 9}) {
        auto lo = lower_bound(v.begin(), v.end(), q);
        auto hi = upper_bound(v.begin(), v.end(), q);
        cout << q << ": lo@" << (lo - v.begin()) << " hi@" << (hi - v.begin());
        if (lo != v.begin()) cout << " prev=" << *prev(lo);
        if (hi != v.end()) cout << " next=" << *hi;
        cout << "\\n";
    }

    // 從尾端拿最後一個，而不是 v[v.size()-1]
    cout << "last = " << v.back() << " == " << *prev(v.end())
         << " == " << *v.rbegin() << "\\n";
    cout << "sum = " << accumulate(v.begin(), v.end(), 0)
         << " max = " << *max_element(begin(v), end(v)) << "\\n";
    return 0;
}
`

/**
 * ═══════════════════════════════════════════════════════════════════
 * **盲測第二輪：位置的相鄰一格（管線 197 階段四）** —— 2026-09-19
 * ═══════════════════════════════════════════════════════════════════
 *
 * 出題者在隔離的 worktree 裡，只知道 C++ 與「寫真實的競賽風格學生程式」。
 * 十支**每一支都 `-Wall -Wextra` 零警告、跑過、再用 `-fsanitize=undefined,address`
 * 跑一次而消毒器一個字都沒印**。
 *
 * ## 讀數：**1/10 → 3/10**，而這一輪最貴的東西不在分子上
 *
 * ### 🔴 一：`prev(it, 2)` ——「語料 0 處」那個決定被翻面了
 *
 * 探索階段**明文決定不做**第二個引數，理由是「語料 0 處」＋
 * 「同族的『移除』那顆做了一個常態留空的插槽，而瀏覽器驗收時它刺眼」。
 *
 * 而盲測十支裡**兩支**用了它：`set` 上取倒數第二個、`map` 上往後跳兩格。
 * 兩支都**剛好死在那一行**，而在那之前與 g++ **逐位元相同**。
 *
 * > **一個「語料 0 處」的讀數量到的是【這批語料的人怎麼寫】，
 * > 不是【這個寫法有多常見】——而盲測的母體不一樣。**
 *
 * ### 🔴 二：一個**安靜的錯答**（這一輪唯一的語義缺陷）
 *
 * 第七支是合法的 C++：它自己定義 `int count(const vector<int>&, int)`，
 * 然後在同一支程式裡呼叫 `std::count(v.begin(), v.end(), 3)`。
 *
 * ```
 * g++   3
 * 我們   2      退回裸名 → 撞上使用者那顆兩參數的 count → 綁前兩個、丟掉第三個
 * ```
 *
 * **它不會出聲**，回的是一個型別正確、看起來合理的整數。
 *
 * > **一個「引數對不上就少綁幾個」的呼叫，
 * > 在遇到同名多載的時候不會報錯——它會回一個錯的答案。**
 *
 * ### 🟠 三：`distance` 擋住 **5/10**，而它在語料裡是 0 處
 *
 * 見下面那一族釘子。**它是這一輪最大的單一缺口。**
 */
describe.runIf(hasReferenceCompiler())('盲測第二輪：位置的相鄰一格', () => {
  /** 整支程式（這一輪的題目自己帶函式與 `main`，不能套 `prog()`）。 */
  const whole = async (code: string, hint: string): Promise<void> => {
    const ref = runCppDetailed(code)
    expect(ref.ok, `🔴 參照編譯器收不下（測試自己的問題）：${ref.ok ? '' : ref.message}`).toBe(true)
    expect(await run(code), hint).toBe(ref.output)
  }

  /**
   * 🟢 **fuzz_03：原始 C 陣列上的指標位置**——這一輪唯一一開始就綠的。
   *
   * 它壓的是「原始陣列沒有成員 `begin()`」那一整條路：`begin(a)`／`end(a)`
   * 自由函式形式、`&a[n/2]` 當位置、`prev`／`next` 走在裸指標上、
   * `unique` 的邏輯尾端當後續每一段的界線。
   */
  it('🟢 fuzz_03｜原始 C 陣列上的指標位置', async () => {
    await whole(P03, '')
  }, 180_000)

  /**
   * 🔴 **fuzz_01 的前半段**——`prev(it, 2)`／`next(it, 2)` 那兩行就在這裡面。
   *
   * ⚠️ 整支還跑不完（卡在 `distance`，見下面的釘子），所以這裡測的是
   * **它死掉的那一行為止**——而那一行正是這一輪翻面的那個決定。
   * 🟢 整支能跑的那一天，這一條要換成 `whole(P01, …)`。
   */
  it('🔴 fuzz_01 蒸餾｜`set` 上往前／往後跳兩格', async () => {
    await sameAsCompiler(
      `set<int> s = {4, 8, 15, 16, 23, 42};
       auto it = s.find(16);
       cout << *prev(it, 2) << " " << *next(it, 2) << "\\n";
       cout << *prev(s.end(), 2) << " " << *next(s.begin(), 3) << "\\n";`,
      '🔴 第二個引數掉了——而產出的碼仍然編得過')
  }, 120_000)

  /**
   * 🔴 **fuzz_02 蒸餾**——`map` 上跳兩格，而且解參考成 `pair`。
   * ⚠️ `next(it, 2)->first` 比 `*next(it, 2)` 多一層：**位置先移，再取成員**。
   */
  it('🔴 fuzz_02 蒸餾｜`map` 上跳兩格再取鍵', async () => {
    await sameAsCompiler(
      `map<string,int> m{{"amy",88},{"bob",42},{"cin",95},{"dan",60}};
       auto it = m.find("bob");
       cout << next(it, 2)->first << " " << prev(m.end(), 3)->second << "\\n";`,
      '🔴 第二個引數掉了')
  }, 120_000)

  /** ★ **正向錨點**：留空的時候**不得**產出／執行成 `prev(it, 1)` 以外的東西。 */
  it('★ 一個引數的照舊（留空就是一格）', async () => {
    await sameAsCompiler(
      `set<int> s{1,2,3,4}; cout << *prev(s.end()) << *next(s.begin());`, '')
  }, 120_000)

  /**
   * 🔴 **負的格數是合法的**——`prev(it, -2)` 就是往後兩格。
   * ⚠️ 所以執行那一路**不得取絕對值**。
   */
  it('🔴 格數是負的時候方向要反過來', async () => {
    await sameAsCompiler(
      `vector<int> v{10,20,30,40,50}; auto it = v.begin() + 1;
       cout << *prev(it, -2) << " " << *next(it, -1);`, '')
  }, 120_000)

  /**
   * 🔴 **反向的位置上，格數不得被翻兩次**——`movePointer` 自己會翻。
   */
  it('🔴 反向的位置 ＋ 格數', async () => {
    await sameAsCompiler(
      `vector<int> v{1,2,3,4,5}; auto r = v.rbegin();
       cout << *next(r, 2) << " " << *prev(v.rend(), 2);`, '')
  }, 120_000)

  /**
   * 🔴 **fuzz_07 蒸餾：這一輪唯一的語義缺陷，而它不會出聲。**
   *
   * 這一段是**合法的 C++**（g++ 印 3）。在修好之前我們印 **2**：
   * `std::count` 退回裸名 `count` → 撞上使用者那顆**兩參數**的 `count`
   * → 綁前兩個、丟掉第三個 → 回一個型別正確而錯的整數。
   *
   * 🟢 **修法是 C++ 的事實**：使用者定義的函式沒有可變引數，所以
   * 「給的比宣告的多」在任何合法的程式裡都不成立 ⟹ 那就不是這一顆。
   * ⚠️ 反方向（給的比宣告的少）**是合法的**——那是預設引數，不在這條閘裡。
   */
  it('🔴 引數比參數多的時候，不得派給使用者那顆同名函式', async () => {
    const code = `${H}int count(const vector<int>& v, int x) {
  int c = 0;
  for (auto it = v.begin(); it != v.end(); ++it) if (*it == x) ++c;
  return c;
}
int main(){
  vector<int> v{8,3,8,1,9,3,3,5,1,9,2};
  cout << count(v, 3) << "\\n";
  return 0;
}
`
    await whole(code, '🔴 使用者自己那顆 count 被弄壞了')
  }, 120_000)

  /** ★ **正向錨點**：引數剛好對上的時候照舊派過去。 */
  it('★ 引數個數對上時照舊', async () => {
    await sameAsCompiler(
      `cout << 0;`, '')
  }, 60_000)

  /** ★ **正向錨點**：給的比宣告的少是**合法的**（預設引數），不得被這條閘擋掉。 */
  it('★ 預設引數不得被「引數個數」那條閘擋掉', async () => {
    const code = `${H}int add(int a, int b = 10){ return a + b; }
int main(){ cout << add(1) << " " << add(1, 2); return 0; }
`
    await whole(code, '🔴 預設引數被擋掉了')
  }, 120_000)

  /**
   * 🟠 **fuzz_01 · 02 · 05 · 09 · 10（**5/10**）：缺 `distance`。**
   *
   * `cpp:pointer_step` 的鄰居，而它是**另一顆身分**：回傳的是一個整數，不是位置。
   *
   * 🔴 **這是這一輪最大的單一缺口，而它推翻了探索階段的一個決定。**
   *    探索報告寫著「不做：語料 0 處，而且有等價寫法 `it - v.begin()`（今天能跑）」
   *    ——而那個等價寫法**只在隨機存取的容器上成立**。`set`／`map` 上沒有 `-`，
   *    所以 `distance` 在那些容器上是**唯一的寫法**。
   *
   * 🟠 **為什麼不是現在**：它是**一顆新身分**（新的膠囊、積木、標籤、
   *    工具箱段落、十幾本清冊），而這一刀的題目是「相鄰的一格」。
   *    把兩顆身分塞進同一刀，兩顆的驗收都會變糊。
   *
   * 🔴 **何時該修：【下一刀】**——證據是這一輪量到的 5/10，
   *    而執行期只有一行（實體式指標：兩個偏移量相減）。
   *    ⚠️ 觸發條件刻意不寫刀號（一根寫著號碼的釘子，在下一刀因為別的理由
   *    插隊時就永遠等不到它的號碼）。判準是：**下一次有人碰位置那一族。**
   */
  it.fails('[UNSUPPORTED:distance] 🟠 fuzz_01 · 02 · 05 · 09 · 10（**5/10**） 卡在 `distance`', async () => {
    await whole(P01_NAIL, '')
  }, 180_000)

  /**
   * 🟠 **fuzz_04：缺 `range_find_if`。**
   *
   * `find_if(first, last, 述詞)`——述詞是一顆 **lambda**。
   *
   * 🟠 **為什麼不是現在**：缺的不只是一顆元件，是「**把一個 lambda 當成值
   *    傳進範圍演算法**」這一整條路。同族十顆範圍演算法今天**一顆都沒有
   *    收述詞的插槽**。
   * 🔴 **何時該修**：範圍演算法收述詞那一刀（`find_if`／`count_if`／
   *    `remove_if`／帶比較器的 `sort` 是同一批）。
   *    ⚠️ fuzz_09 也卡在同一族（帶比較器的 `lower_bound`）。
   */
  it.fails('[UNSUPPORTED:range_find_if] 🟠 fuzz_04 卡在 `range_find_if`', async () => {
    await whole(P02_NAIL, '')
  }, 180_000)

  /**
   * 🟠 **fuzz_06：缺 `container_equal_range`。**
   *
   * `ms.equal_range(v)` ——回傳**一對位置**，而且慣用寫法是拆進結構化繫結。
   *
   * 🟠 **為什麼不是現在**：它回傳的是 `pair<iterator,iterator>`，
   *    而今天沒有任何一顆元件的回傳值是「一對位置」。
   * 🟢 **而它有等價寫法今天就能跑**：`lower_bound` ＋ `upper_bound`
   *    ——所以它的優先序低於 `distance`。
   * 🔴 **何時該修**：有序容器的區段那一刀。
   */
  it.fails('[UNSUPPORTED:container_equal_range] 🟠 fuzz_06 卡在 `container_equal_range`', async () => {
    await whole(P03_NAIL, '')
  }, 180_000)

  /**
   * 🟠 **fuzz_08：缺 `container_reserve`。**
   *
   * `v.reserve(n)` ——預留空間。
   *
   * 🟠 **為什麼不是現在**：它在這個直譯器裡**沒有可觀察的行為**
   *（容器不是連續記憶體，沒有「重新配置」這件事），所以它該是一顆
   *    `skipPaths: ["execute"]` 的宣告式元件——**而那個判斷要有人做**，
   *    不是順手加一個 noop。
   *    ⚠️ 「顯式的空與遺漏的空要分得出來」，而一個 noop 函式兩者長得一樣。
   * 🔴 **何時該修**：容器的容量那一族（`reserve`／`capacity`／`shrink_to_fit`）。
   */
  it.fails('[UNSUPPORTED:container_reserve] 🟠 fuzz_08 卡在 `container_reserve`', async () => {
    await whole(P04_NAIL, '')
  }, 180_000)

  /**
   * 🟠 **fuzz_04 · 07：缺 `string_construct`。**
   *
   * `string(first, last)`／`string(s)` ——把兩個位置之間的東西做成字串。
   *
   * 🟠 **為什麼不是現在**：`string` 是一個型別，而
   *    `string(a, b)` 是**建構**——今天只有登記過的 `struct` 走得到建構那一路
   *（`ctx.structs.construct`），內建型別沒有。要做的是「內建型別的建構」
   *    這一整條，不是一顆元件。
   * 🔴 **何時該修**：內建型別的建構那一刀（`string(n, c)`／`vector<int>(n)`
   *    都在同一族，而後者今天是由宣告那一路特判的）。
   */
  it.fails('[UNSUPPORTED:string_construct] 🟠 fuzz_04 · 07 卡在 `string_construct`', async () => {
    await whole(P05_NAIL, '')
  }, 180_000)
})
