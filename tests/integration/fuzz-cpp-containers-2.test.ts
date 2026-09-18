/**
 * **模糊測試的回歸網：容器的第二輪（2026-09-18）。**
 *
 * ## 它從哪來
 *
 * 一個**看不到原始碼**的代理（隔離 worktree）寫了 10 支 hard 的容器程式，
 * 全部 `g++ -std=c++17 -Wall` 零警告編過、跑兩次輸出一致。
 * 第一輪過管線時 **1/10**——而那一輪的前一天，同一批元件剛做完一整條管線、
 * 全套 7117 綠。
 *
 * > **資訊隔離量到的不是「我做得對不對」，是「我想不想得到」。**
 *
 * ## 它抓到的（下面每一條都是那些缺陷的最小重現）
 *
 * ```
 * emplace_back／emplace 沒登錄     錯誤指著接收者（「不是一個物件」），而缺的是方法名
 * emplace_back(7, 8)              只讀第一個引數 → 那個 pair 變成一個 7
 * map/set 的大括號初始化           被當成「另一個容器」原樣接管 → insert 找不到鍵
 * multimap 沒登錄                  掉到一般變數宣告
 * insert 不回傳「位置 ＋ 有沒有插進去」 `auto [it, ok] = m.insert(…)` 拆不開
 * 限定名（`std::pair<…>`）         基底名查不到 → 聚合形狀整個失效
 * 聚合的每一格都寫死 int            `pair<string,int>` 的字串被壓成 0
 * ```
 *
 * ⚠️ **最後兩條是疊在一起的**：限定名那條修好的當天，寫死 `int` 那條才第一次被執行。
 * > **一段「從來沒有被走到」的程式碼，與一段正確的程式碼長得一模一樣。**
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

const H = '#include <bits/stdc++.h>\nusing namespace std;\n'

/** 拿 g++ 當權威，兩邊比 stdout。 */
async function same(body: string, hint: string, glob = ''): Promise<void> {
  const src = `${H}${glob}\nint main(){ ${body} return 0; }\n`
  const ref = runCppDetailed(src)
  expect(ref.ok, `🔴 參照編譯器收不下（測試自己的問題）：${ref.ok ? '' : ref.message}`).toBe(true)
  const out: string[] = []
  const interp = new SemanticInterpreter({ maxSteps: 300_000 })
  interp.setOutputCallback((x) => out.push(x))
  await interp.execute(lifter.lift(parser.parse(src)!.rootNode as never) as SemanticNode, [])
  expect(out.join(''), hint).toBe(ref.output)
}

/** 寫全名的版本——不加 `using namespace std;`。 */
async function sameQualified(src: string, hint: string): Promise<void> {
  const ref = runCppDetailed(src)
  expect(ref.ok, '🔴 參照編譯器收不下（測試自己的問題）').toBe(true)
  const out: string[] = []
  const interp = new SemanticInterpreter({ maxSteps: 300_000 })
  interp.setOutputCallback((x) => out.push(x))
  await interp.execute(lifter.lift(parser.parse(src)!.rootNode as never) as SemanticNode, [])
  expect(out.join(''), hint).toBe(ref.output)
}

describe.runIf(hasReferenceCompiler())('模糊測試的回歸：容器第二輪', () => {
  it('🔴 `emplace_back` 與 `push_back` 是同一件事', async () => {
    await same(
      `vector<int> v; v.emplace_back(3); v.emplace_back(5); for (int x : v) cout << x; cout << v.size();`,
      '🔴 沒登錄的症狀不是報錯——它掉到泛用的方法呼叫，然後說「這個接收者不是一個物件」')
  }, 60_000)

  it('🔴 `emplace_back(7, 8)` 是【用這兩個值建一個元素】', async () => {
    await same(
      `vector<pair<int,int>> v; v.emplace_back(7, 8); v.push_back({1, 2});`
      + ` for (auto [x, y] : v) cout << x << y; cout << v.size();`,
      '🔴 只讀第一個引數的話，那個 pair 變成一個 7')
  }, 60_000)

  it('★ 正向錨點：一個引數的 `emplace_back` 與非聚合的元素', async () => {
    await same(`vector<int> v; v.emplace_back(3); vector<string> s; s.emplace_back("ab"); cout << v[0] << s[0];`, '')
  }, 60_000)

  it('🔴 `m.emplace(k, v)` 給的是兩個引數，不是一個大括號', async () => {
    await same(
      `map<string,int> m; m.emplace("a", 3); m.emplace("a", 9); cout << m["a"] << m.size();`,
      '🔴 對照表的 emplace 收「鍵, 值」')
  }, 60_000)

  it('🔴 對照表與集合的大括號初始化', async () => {
    await same(
      `map<string,int> c{{"a",1},{"b",2}}; cout << c.size() << c["a"] << c["b"];`
      + ` set<int> s{3,1,3,2}; for (int x : s) cout << x; cout << s.size();`
      + ` multiset<int> ms{3,1,3}; for (int x : ms) cout << x; cout << ms.size();`,
      '🔴 被當成「另一個容器」原樣接管的話，順序是寫的順序而重複也留著')
  }, 60_000)

  it('🔴 `insert` 回傳「位置 ＋ 有沒有真的插進去」', async () => {
    await same(
      `map<string,int> c{{"a",1}}; auto [it,ok] = c.insert({"c",3}); cout << ok << it->first;`
      + ` auto [it2,ok2] = c.insert({"a",99}); cout << ok2 << it2->second << c.size();`,
      '🔴 `auto [it, ok] = m.insert(…)` 是判斷「這次插入有沒有生效」的標準寫法')
  }, 60_000)

  it('🔴 `multimap`：一個鍵可以有多個值', async () => {
    await same(
      `multimap<string,int> mm; mm.emplace("a",1); mm.emplace("a",2); mm.emplace("b",3);`
      + ` cout << mm.size() << mm.count("a") << mm.count("b") << mm.count("z");`,
      '🔴 沒登錄的話它掉到一般變數宣告')
  }, 60_000)

  it('★ 正向錨點：不可重複的那兩種不得跟著變', async () => {
    await same(
      `map<string,int> m; m.emplace("a",1); m.emplace("a",2); cout << m.size() << m["a"];`
      + ` set<int> s; s.insert(3); s.insert(3); cout << s.size() << s.count(3);`,
      '')
  }, 60_000)

  /**
   * 🔴 **寫全名的程式**（`std::pair<…>`）——而這個 repo 自己的測試幾乎都寫
   * `using namespace std;`。
   *
   * > **一個只在別人的寫法上壞掉的缺陷，自己的語料量不到它。**
   */
  it('🔴 限定名：`std::pair` 的聚合形狀查得到', async () => {
    await sameQualified(
      `#include <bits/stdc++.h>\nint main(){ std::vector<std::pair<int,int>> v;`
      + ` v.emplace_back(7, 8); v.push_back({1, 2});`
      + ` for (const auto& [x, y] : v) std::cout << x << y; std::cout << v.size(); return 0; }\n`,
      '🔴 基底名沒剝掉 `std::` 的話，聚合形狀整個查不到')
  }, 60_000)

  it('🔴 限定名 ＋ 巢狀容器：自動建的那一格也要是容器', async () => {
    await sameQualified(
      `#include <bits/stdc++.h>\nint main(){ std::map<std::string, std::vector<std::pair<int,int>>> ix;`
      + ` ix["a"].push_back({1,2}); ix["a"].emplace_back(7,8);`
      + ` int s = 0; for (const auto& [k, vec] : ix) for (const auto& [x, y] : vec) s += x * y;`
      + ` std::cout << s << ix["a"].size(); return 0; }\n`,
      '🔴 `m[k]` 自動建出來的那一格不是容器的話，`push_back` 說「這不是一個容器」')
  }, 60_000)

  /**
   * 🔴 **聚合的每一格要照【自己的】型別**——這一條躲在上面那條後面。
   *
   * 在限定名修好之前，這條分支對 `std::pair<…>` **根本不會進來**，
   * 所以「每一格都寫死 `int`」從來沒有被執行過。
   */
  it('🔴 `pair<string,int>` 的字串不得被壓成 0', async () => {
    await same(
      `priority_queue<pair<string,int>> ps; ps.push({"a",9}); ps.push({"a",2}); ps.push({"b",1});`
      + ` while (!ps.empty()) { auto [nm, k] = ps.top(); ps.pop(); cout << nm << k << " "; }`,
      '🔴 每一格都寫死 int 的話，`"a"` 被 coerce 成 0')
  }, 60_000)

  // ─── 壓出來而這一輪不做的，各留一支 ────────────────────────
  //
  // ⚠️ 全部用 `it.fails`（不是 `it.todo`）——**修好的那天它會紅，逼人來拔釘子**。
  // 🔴 而每一根都寫**阻斷者**與**何時該修**：一根只寫著「還沒做」的釘子，
  //    與一個殼是同一件事。

  it.fails('[UNSUPPORTED:容器的 resize] 🟠 `d.resize(n)` 縮放一個容器', async () => {
    // 🟠 **為什麼不現在修**：`resize` 是一顆**新元件**（五路 ＋ 積木 ＋ 課程清單），
    //    而這一輪是模糊測試那一關，不是產生那一關。
    // 🔴 何時該修：它與 `at` 兩顆一起走一次 `component-pipeline`
    //    ——盲測 10 支裡它們各擋掉一支，而語料也用得到。
    await same(`deque<int> d{1,2,3}; d.resize(5); cout << d.size() << d[4]; d.resize(2); cout << d.size();`, '')
  }, 60_000)

  it.fails('[UNSUPPORTED:容器的 at] 🟠 `v.at(i)` 是帶範圍檢查的下標', async () => {
    // 🟠 **為什麼不現在修**：同上——它是一顆新元件。
    // ⚠️ 而它與下標**不是同一顆**：`at` 越界時丟例外，`[]` 是未定義行為。
    // 🔴 何時該修：與 `resize` 一起。
    await same(`map<string,int> m{{"a",1}}; cout << m.at("a"); vector<int> v{1,2}; cout << v.at(1);`, '')
  }, 60_000)

  it.fails('[UNSUPPORTED:multimap 的 equal_range] 🟠 一個鍵的所有值', async () => {
    // 🟠 **為什麼不現在修**：它回傳的是**一對位置**，而那要先有
    //    「回傳一對值的自由函式」這條路——`lower_bound`／`upper_bound` 各自回一個位置，
    //    合起來那一對今天沒有人造得出來。
    // 🔴 何時該修：盲測或語料再出現一次（第二個獨立來源）。
    await same(
      `multimap<string,int> mm; mm.emplace("a",1); mm.emplace("a",2);
       auto [lo, hi] = mm.equal_range("a"); int s = 0; for (auto i = lo; i != hi; ++i) s += i->second;
       cout << s;`, '')
  }, 60_000)

  /**
   * 🟢 **釘子拔了**（2026-09-18）。它的阻斷條件逐字寫著「範圍那一族從字串屬性
   * 換成接點的那一刀」，而那一刀做完了——`cpp:range_unique`／`cpp:range_remove`
   * 兩顆隨之誕生（它們回傳一個位置，而位置在那一刀之前表達不出來）。
   *
   * ⚠️ **這一次真的回來拔了**。上一根同樣寫著「那一天回來拔」的釘子沒有人回來，
   * 而缺陷換了一個形狀活下去（見 `set_insert/execute.ts` 的註解）。
   *
   * > **一根釘子如果只寫著「誰擋住我」，它不會在那個人讓開的時候自己掉下來。**
   */
  it('🟢 刪除-移除的慣用法（釘子已拔）', async () => {
    await same(
      `vector<int> v{3,1,1,2}; sort(v.begin(), v.end());
       v.erase(unique(v.begin(), v.end()), v.end()); for (int x : v) cout << x;`, '')
  }, 60_000)

  it('🟢 刪除-移除：擠掉等於某個值的（同一族的另一半）', async () => {
    await same(
      `vector<int> v{1,2,1,3};
       v.erase(remove(v.begin(), v.end(), 1), v.end()); for (int x : v) cout << x;`, '')
  }, 60_000)

  it.fails('[UNSUPPORTED:std::make_tuple] 🟠 三個值的一組', async () => {
    // 🟠 **為什麼不現在修**：`tuple` 在執行期是一串格子（只有「一對」登記過欄位名），
    //    而 `make_tuple` 要的是「造一個那樣的東西」——它是一顆新元件。
    // 🔴 何時該修：與 `make_pair` 同一顆元件收下它時（同族，同一個形狀）。
    await same(`auto t = make_tuple(1, 2, 3); auto [a, b, c] = t; cout << a << b << c;`, '')
  }, 60_000)

  it.fails('[UNSUPPORTED:容器的暫時物件] 🟠 `deque<int>{4, 5}` 當成一個值', async () => {
    // 🟠 **為什麼不現在修**：`型別{…}` 是一個**暫時物件**，而這個直譯器今天
    //    只在宣告那一行認得大括號。它要的是「一個運算式位置的容器字面值」。
    // 🔴 何時該修：盲測或語料再出現一次。
    await same(`deque<int> d = deque<int>{4, 5}; cout << d[0] << d[1];`, '')
  }, 60_000)
})
