/**
 * **解譯器跑出來的，要和參照編譯器一樣**——最小重現的那一批。
 *
 * ## 它從哪來（2026-09-16）
 *
 * 使用者：「你有幫我驗證語料庫的執行結果與模擬的是一致的嗎？」——沒有。
 * 那 218 支學生程式的四支探針裡，`interpret`／`execute` 的出現次數是 **0**：
 * 量的全是形狀（殘差、不動點、載得進工作區、宣告的形狀）。
 *
 * 補上第五個面向之後（`tests/probes/studycpp-behaves.test.ts`），
 * 兩邊都跑得完的 91 支裡有 **41 支輸出不同**，而它們收斂成兩族：
 *
 * 
 * cout << '\n'   印出一個【反斜線】     ← properties.char 存的是原始碼文字，沒解跳脫
 * int a{7}       變成 1                ← 純量的大括號初始化沒有被拆開
 * 
 *
 * 🔴 **兩個都只錯在 `execute` 那一路**：lift 的樹是對的、產生器吐回去也是對的，
 * 所以第一百一十五／一百一十七／一百一十八條（形狀）**全綠**。
 *
 * > **一個只錯在 execute 那一路的缺陷，形狀是完美的
 * > ——而形狀完美正是它活下來的原因。**
 *
 * ## ⚠️ 這裡不放什麼
 *
 * **未定義行為不得進來**。第一版我寫了 `int n, L, c{}; cout << n;`
 * ——而讀一個沒初始化的 `n` 在 C++ 裡是 UB，g++ 印出 `-278200144`。
 * 那一題量的是「我們有沒有跟 g++ 一起做出同一個未定義的選擇」，不是行為。
 *
 * > **一條拿參照實作當權威的護欄，不得把【它也沒有答案的地方】寫進判準。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
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

/** 🔴 每一題都是從真實的學生程式夾出來的——見檔頭。 */
/** `[名稱, 全域段, main 內容, stdin]` */
const CASES: [string, string, string, string[]][] = [
  ['字元字面值 `\\n`（AP325/3/3_1）', '', `cout << 'A' << '\\n' << 'B';`, []],
  ['字元字面值 `\\t`', '', `cout << 'a' << '\\t' << 'b';`, []],
  ['字元字面值 `\\\\`', '', `cout << '\\\\';`, []],
  ['字元字面值的數值', '', `cout << (int)'0' << " " << (int)'a';`, []],
  ['字元相減', '', `cout << ('7' - '0');`, []],
  ['大括號值初始化（AP325/3/3_9）', '', `int a{}; cout << a;`, []],
  ['大括號帶值', '', `int a{7}; cout << a;`, []],
  ['一行兩個都帶大括號', '', `int c{}, mc{}; cout << c << mc;`, []],
  ['`long long` 的大括號', '', `long long ans{}; cout << ans;`, []],
  ['容器的大括號【不得】被拆開', '', `vector<int> v{1,2,3}; cout << v.size() << v[1];`, []],
  ['字串的大括號', '', `string s{}; cout << "[" << s << "]";`, []],
  // ── 2026-09-16 第二輪：從那 90 支「解譯器出錯」裡夾出來的 ──
  ['數字分隔符（AP325/2/2_5）', '', `long long p = 10'0000'0007; cout << p;`, []],
  ['陣列＋變數偏移的 sort（AP325/3/3_13）', 'int h[100];',
    `int N=4; h[0]=3;h[1]=1;h[2]=4;h[3]=1; sort(h,h+N); for(int i=0;i<N;i++) cout<<h[i];`, []],
  ['陣列＋字面值偏移（本來就是好的，守著別壞）', 'int h[100];',
    `h[0]=1;h[1]=3;h[2]=5; cout << (lower_bound(h,h+3,3)-h);`, []],
  ['`cin.tie(0)`（AP325/2/2_7）', '', `ios::sync_with_stdio(0),cin.tie(0); int a; cin>>a; cout<<a;`, ['5']],
  ['`cin.ignore()` ＋ `getline`', '',
    `int a; cin>>a; cin.ignore(); string s; getline(cin,s); cout<<a<<"["<<s<<"]";`, ['5', 'xy']],
  ['`cin` 寫進全域陣列', 'int A[200007];',
    `int n; cin>>n; for(int i=0;i<n;i++) cin>>A[i]; cout<<A[0]<<A[n-1];`, ['3', '7', '8', '9']],
  // ── 2026-09-16 第三輪：pair、聚合、別名 ──
  ['`pair` 的大括號初始化', '', `pair<int,int> pr = {3,4}; cout << pr.first << pr.second;`, []],
  ['`pair` 的陣列（AP325/3/3_13）', 'pair<int,int> A[10];',
    `A[0].first=3; int i=0; cout << A[i].first;`, []],
  ['寫進 `pair` 陣列的成員', 'pair<int,int> A[10];', `int i=0; A[i].first=7; cout << A[0].first;`, []],
  ['`A[0] = {3,1}` 照元素型別填', 'pair<int,int> A[10];',
    `A[0]={3,1};A[1]={1,2}; sort(A,A+2); cout<<A[0].first<<A[1].first;`, []],
  ['`#define x first` 讀', '#define x first\npair<int,int> A[10];',
    `A[0].first=3; int i=0; cout << A[i].x;`, []],
  ['`#define x first` 寫', '#define x first\npair<int,int> A[10];',
    `int i=0; A[i].x=7; cout << A[0].first;`, []],
  ['`cin >> A[i].x`', '#define x first\npair<int,int> A[10];',
    `int i=0; cin >> A[i].x; cout << A[0].first;`, ['5']],
  ['`max({...})` 的串列形式（AP325/5/5_2）', '', `cout << max({3,9,4}) << min({3,9,4});`, []],
  ['⚠️ `vector<int>` **不得**被當成聚合', '', `vector<int> v{1,2,3}; cout << v.size() << v[1];`, []],
  // ── 2026-09-16 第四輪：型別別名、容器的元素型別、帶下標的接收者 ──
  ['`#define pii` 當陣列的元素型別（AP325/3/3_13）', '#define pii pair<int,int>\npii A[10];',
    `int i=0; cin >> A[i].first; cout << A[0].first;`, ['5']],
  ['`vector<pair>` 定大小（AP325/4/4_15）', '',
    `vector<pair<int,int>> vt(2); cin >> vt[0].first; cout << vt[0].first;`, ['5']],
  ['`vector<pii>` 定大小', '#define pii pair<int,int>',
    `vector<pii> vt(2); vt[0].first=3; cout << vt[0].first;`, []],
  ['帶下標的接收者（AP325/7/7_1）', 'vector<int> d2[10];',
    `d2[3].push_back(5); cout << d2[3][0] << d2[3].size();`, []],
  ['下標是變數的接收者', 'vector<int> d2[10];',
    `int a=2; d2[a].push_back(7); cout << d2[2][0];`, []],
  ['⚠️ 解不開的下標要用【原本】那句話報錯', 'vector<int> d2[10];',
    `d2[3].push_back(1); cout << d2[3].size();`, []],
  // ── 重複性與有序性那兩軸（2026-09-17）──────────────────────
  // 🔴 這兩族在此之前都**不當掉**：一個少一半元素、一個指著沒寫錯的那一行報索引錯誤。
  ['multiset 留重複（語料 13 支）', '',
    `multiset<int> ms; ms.insert(5); ms.insert(3); ms.insert(5);
     for (int x : ms) cout << x;`, []],
  ['而 set 不留', '',
    `set<int> s; s.insert(5); s.insert(3); s.insert(5);
     for (int x : s) cout << x;`, []],
  ['multiset 的大小', '',
    `multiset<int> ms; ms.insert(1); ms.insert(1); cout << ms.size();`, []],
  ['unordered_map 的查與寫（語料 5 支）', '',
    `unordered_map<int,int> m; m[3] = 7; m[3]++; cout << m[3] << m.size();`, []],
  ['unordered_map 數次數', '',
    `unordered_map<int,int> cnt; int a[4] = {1,2,1,1};
     for (int i = 0; i < 4; i++) cnt[a[i]]++; cout << cnt[1] << cnt[2];`, []],
  // ⚠️ **刻意沒有「走訪 unordered_map」那一題**：真的 unordered_map 走訪順序是
  //    【未指定的】，拿 g++ 當權威量它，量到的是「我們有沒有跟它做出同一個
  //    未指定的選擇」。見這個檔頭「這裡不放什麼」。
  // ── 位置（實體式指標／迭代器）（2026-09-17）──────────────────
  // 🔴 這一族在此之前**不當掉**：`++p` 把指標寫成一個 double，
  //    而 `p != e` 恆等於「相等」——於是每一個走訪迴圈一次都不跑。
  ['位置：走訪迴圈', '',
    `int a[3]={7,8,9}; int* p=a; int* e=a+3; int s=0;
     while (p != e) { s += *p; ++p; } cout << s;`, []],
  ['位置：前置遞增回傳新的', '',
    `int a[3]={7,8,9}; int* p=a; cout << *(++p);`, []],
  ['位置：後置遞增回傳舊的', '',
    `int a[3]={7,8,9}; int* p=a; cout << *(p++) << *p;`, []],
  ['位置：複合移動', '',
    `int a[4]={1,2,3,4}; int* p=a; p+=2; cout << *p; p-=1; cout << *p;`, []],
  ['🔴 位置：不同容器的兩個位置【不相等】', '',
    `int a[2]={1,2}; int b[2]={1,2}; int* p=a; int* q=b; cout << (p!=q) << (p==q);`, []],
  ['位置：同容器比大小', '',
    `int a[3]={1,2,3}; int* p=a; int* q=a+2; cout << (p<q) << (q<p);`, []],
  ['位置：兩個位置相減是隔幾格', '',
    `int a[5]={1,2,3,4,5}; int* p=a; int* q=a+3; cout << (q-p);`, []],
  // ★ **正向錨點：這一刀不得弄壞「指標對 NULL」**——`toNumber` 對一串格子
  //   回 1 正是為了它（少了它，Linked List 的走訪一圈都不跑）。
  ['★ 位置：陣列退化的指標不是空指標', '',
    `int a[3]={7,8,9}; int* p=a; cout << (p!=0) << (p==0);`, []],
  // ── 迭代器：語料真的會寫的那幾個形狀（2026-09-17）──────────
  ['走訪：容器的位置迴圈', '',
    `vector<int> v; v.push_back(3); v.push_back(1); int s=0;
     for (auto it = v.begin(); it != v.end(); ++it) s += *it; cout << s;`, []],
  ['走訪：對照表的鍵與值', '',
    `map<int,int> m; m[2]=7; m[1]=9;
     for (auto it = m.begin(); it != m.end(); ++it) cout << it->first << it->second;`, []],
  ['查找：找得到與找不到（`!= end()` 是標準寫法）', '',
    `set<int> s; s.insert(1); s.insert(2);
     cout << (s.find(2) != s.end()) << (s.find(9) != s.end());`, []],
  ['查找：第一個不小於（AP325/2/2_11 的形狀）', '',
    `set<int> s; s.insert(1); s.insert(3); s.insert(5);
     auto it = s.lower_bound(2); if (it != s.end()) cout << *it;`, []],
  ['查找：第一個大於', '',
    `set<int> s; s.insert(1); s.insert(3); s.insert(5); cout << *s.upper_bound(3);`, []],
  ['🔴 刪一個位置，不是刪全部（`ms.erase(ms.find(v))`）', '',
    `multiset<int> ms; ms.insert(4); ms.insert(4); ms.insert(7);
     ms.erase(ms.find(4)); cout << ms.size() << ms.count(4);`, []],
  ['最大的那一個（`*s.rbegin()`）', '',
    `set<int> s; s.insert(1); s.insert(5); s.insert(3); cout << *s.rbegin();`, []],
  ['🔴 反向走訪：由大到小', '',
    `set<int> s; s.insert(1); s.insert(5); s.insert(3);
     for (auto it = s.rbegin(); it != s.rend(); ++it) cout << *it;`, []],
  ['位置換算成索引（`it - v.begin()`）', '',
    `vector<int> v; v.push_back(3); v.push_back(1); v.push_back(4);
     auto it = v.begin() + 2; cout << (it - v.begin());`, []],
  // ── 有序容器裝一對值（語料 AP325/4/4_15 的形狀）（2026-09-17）────
  // 🔴 三個缺陷疊在這一支上：容器不知道元素型別 ⟹ 大括號存成陣列；
  //    排序的比較規則不認一對值 ⟹ 容器【根本沒有排序】；
  //    而查找把每一格拆開只比第一個。
  ['有序容器裝一對值：走訪出來要是排好的', '',
    `multiset<pair<int,int>> st; st.insert({3,4}); st.insert({1,2});
     for (auto it = st.begin(); it != st.end(); ++it) cout << it->first << it->second;`, []],
  ['有序容器裝一對值：字典序的查找', '',
    `multiset<pair<int,int>> st; st.insert({1,9}); st.insert({5,0});
     auto it = st.lower_bound({2,0}); cout << it->first << it->second;`, []],
  ['🔴 別名：`#define x first` 之後 `it->x`（AP325/4/4_15 逐字）', '#define x first',
    `multiset<pair<int,int>> st; st.insert({3,4}); auto it = st.begin(); cout << it->x;`, []],
  // ★ 正向錨點：這一刀不得弄壞純量的集合與字串的集合。
  ['★ 純量集合仍然有序', '',
    `set<int> s; s.insert(5); s.insert(1); s.insert(3);
     for (int v : s) cout << v;`, []],
  ['★ 字串集合不得被壓成數字', '',
    `set<string> s; s.insert("bb"); s.insert("aa"); cout << *s.begin();`, []],
  // ── 2026-09-17 第二輪盲測 ────────────────────────────────
  // 🔴 **成員初始化列的兩個名字查在不同的地方**（C++ 的規則）：
  //    括號【外】永遠是成員，括號【裡】在建構式的作用域裡查（所以是參數）。
  //    我們把 `: x(x)` 當成一句 `x = x` 跑，兩邊都解析成參數 → 成員停在 0。
  //    ⚠️ 它一直躲在另一個缺陷後面：在「名字是結構就當建構」補上之前，
  //    那段程式更早就死在 `UNDEFINED_FUNC`，**從來沒有機會印出錯的答案**。
  ['🔴 成員初始化列：參數與成員同名（課本寫法）',
    `class Vec2 {\npublic:\n  Vec2(double x, double y) : x(x), y(y) {}\n` +
    `  void print() { cout << "(" << x << ", " << y << ")"; }\nprivate:\n  double x;\n  double y;\n};`,
    `Vec2 a(1.0, 2.0); a.print();`, []],
  ['★ 正向錨點：不同名的初始化列本來就是好的',
    `struct T { int a; T(int v) : a(v) {} };`, `T t(3); cout << t.a;`, []],
  ['一個名字是登記過的結構，那個呼叫是建構',
    `struct P { int a; P(int x) : a(x) {} };`, `P p = P(7); cout << p.a;`, []],

  /**
   * 🔴 **`c ? a : b = d` 的括號**（2026-09-18，語料 3 支）——併查集的標準寫法。
   *
   * tree-sitter 剖成 `(c ? a : b) = d`，而 C++ 說三元的第三個運算元是**指定式**。
   * ⚠️ 症狀不指向括號：右邊照樣求值，於是 `find(p[x])` 拿 `p[x]` ＝ -1 去遞迴，
   * 報的是 `p[-1]` 越界。**錯誤落在它讓程式多做的那件事上。**
   */
  ['🔴 三元式的第三個運算元是指定式（AP325/7/7_12_2t 的併查集）',
    `int p[20];\nint f(int x){ return (p[x] < 0 ? x : p[x] = f(p[x])); }`,
    `for (int i = 0; i < 6; i++) p[i] = -1; p[2] = 3; p[3] = -2;\n` +
    `cout << f(0) << f(2) << p[2];`, []],
  ['★ 正向錨點：沒被選到的那一支不得有副作用',
    '', `int a = 0, b = 0; int y = (1 > 2 ? a = 7 : b = 9); cout << y << a << b;`, []],
  ['🔴 三元式裡的成員式左值', `struct S { int v; };`,
    `S s{0}; int y = (false ? 1 : s.v = 4); cout << y << s.v;`, []],
  ['🔴 三元式裡的複合指定', '',
    `int a = 10; int y = (false ? 1 : a += 5); cout << y << a;`, []],

  /**
   * 🔴 **指派是一個運算式，它求值成被指派的值**——四顆元件要說同一句話。
   * `cpp:var_assign` 2026-08 就記過了，而下標／二維／解參考那三顆沒跟上，
   * 於是 `return (… : p[x] = f(p[x]))` 印出 `void`。
   */
  ['🔴 四種左值的鏈式指定都求值成被指派的值', '',
    `int a, b, c; a = b = c = 4; cout << a << b << c;\n` +
    `int q[3] = {0,0,0}; int z = (q[1] = 8); cout << z << q[1];\n` +
    `int t[2][2] = {{0,0},{0,0}}; int w = (t[1][1] = 6); cout << w << t[1][1];\n` +
    `int v = 0; int* ptr = &v; int u = (*ptr = 3); cout << u << v;`, []],

  /**
   * 🔴 **容器要記得住自己裝什麼**（2026-09-18，探索階段量到的兩個前置缺陷）。
   *
   * ```
   * vector<pair<int,int>> v; v.push_back({3,4}); v[0].first     🟢 一直是好的
   * deque <pair<int,int>> q; q.push_back({1,2}); q[0].first     🔴「（不是一個結構）」
   * queue /priority_queue  .push({1,2}); .front().first          🔴 同上
   * ```
   *
   * 兩個根因不同：`deque` **沒有宣告元件**（掉進一般的變數宣告，型別整串塞進一格），
   * 而 `.push()` **不照元素型別長**（同族的 `push_back` 早就照了）。
   *
   * > **同一族的三顆元件，兩顆做了某件事而一顆沒有——那個差別不會有人發現，
   * > 直到有人寫出只有前兩顆能表達的程式。**
   */
  ['🔴 雙端佇列記得住元素型別（語料 22 支用它）', '',
    `deque<pair<int,int>> q; q.push_back({1,2}); q.push_front({7,8});\n` +
    `cout << q[0].first << q.front().second << q.back().first << q.size();`, []],
  ['★ 正向錨點：純量的雙端佇列本來就是好的', '',
    `deque<int> d; d.push_front(1); d.push_back(2); cout << d.front() << d.back() << d.size();`, []],
  ['🔴 雙端佇列的建構子引數 `deque<int> d(3)`', '',
    `deque<int> d(3); cout << d.size() << d[0];`, []],
  ['🔴 佇列／堆疊／優先佇列的 `push` 也要照元素型別長', '',
    `queue<pair<int,int>> q; q.push({1,2});\n` +
    `stack<pair<int,int>> st; st.push({3,4});\n` +
    `cout << q.front().first << q.front().second << st.top().second;`, []],
  /**
   * 🔴 **而元素長對的那一天，堆頂的比較就開始答錯**：`heapTopIndex` 寫著
   * `Number(cell.value)`，而一個 `pair` 的 `value` 是一張 `Map`——`Number(Map)`
   * 是 `NaN`，每一次比較都是 false，**堆頂永遠是先推進去的那一個**。
   *
   * > **一個「把值壓成數字」的比較，會在那個值終於長對的那天開始答錯。**
   */
  ['🔴 優先佇列裝一對值時，堆頂要照字典序', '',
    `priority_queue<pair<int,int>> pq; pq.push({1,2}); pq.push({5,6}); pq.push({5,1});\n` +
    `cout << pq.top().first << pq.top().second; pq.pop(); cout << pq.top().second;`, []],
  ['★ 正向錨點：純量的優先佇列（大根堆與小根堆）不得被弄壞', '',
    `priority_queue<int> a; a.push(3); a.push(9); a.push(1); cout << a.top(); a.pop(); cout << a.top();\n` +
    `priority_queue<int, vector<int>, greater<int>> b; b.push(3); b.push(9); b.push(1); cout << b.top();`, []],

  /**
   * 🔴 **結構化繫結**（2026-09-18，語料 16 處／13 支）——`auto [a, b] = …`。
   *
   * 在此之前它**不是「沒被 lift」，是安靜地答錯**：那一串名字被塞進自動型別
   * 宣告的名字那一格，於是執行期真的宣告了一個叫 `[pt,d]` 的變數。
   * ⚠️ 語料 15/16 處**不寫空格**，而名字馬上被當下標用——**症狀出現在下一行**。
   */
  ['🔴 結構化繫結：兩個名字（語料最常見）', '',
    `deque<pair<int,int>> BFS; BFS.push_back({2,5});\n` +
    `auto[pt,d] = BFS.front(); cout << pt << d;`, []],
  ['🔴 結構化繫結：三個名字，而右邊是使用者自己的結構',
    `struct side{ int u; int v; int w;\n  bool operator< (const side &b) const { return w > b.w; } };`,
    `priority_queue<side> ms; ms.push({1,2,9}); ms.push({3,4,5});\n` +
    `auto[u,v,w] = ms.top(); cout << u << v << w;`, []],
  ['🔴 結構化繫結：名字馬上被當下標用（症狀在下一行）', '',
    `vector<int> d2[5]; d2[2].push_back(9);\n` +
    `deque<pair<int,int>> BFS; BFS.push_back({2,1});\n` +
    `auto[pt,d] = BFS.front(); for (int i : d2[pt]) cout << i << d;`, []],
  ['🔴 結構化繫結在範圍 for 裡', '',
    `vector<pair<int,int>> ar[3]; ar[1].push_back({4,5}); int P = 1;\n` +
    `for (auto[w,to] : ar[P]) cout << w << to;`, []],
  /**
   * 🔴 **走訪的容器是一棵樹，不是一串文字**——`d2[pt]`／`m[k]` 都是運算式。
   * 在此之前執行期拿那串文字去查變數，說「沒有宣告過 `d2[pt]`」
   * ——**錯誤看起來像學生打錯字**。語料 3 支。
   */
  ['🔴 範圍 for 的容器是一個運算式', '',
    `vector<int> d2[5]; int k = 2; d2[2].push_back(9);\n` +
    `map<int,vector<int>> m; m[1].push_back(7);\n` +
    `for (int i : d2[k]) cout << i; for (int i : m[1]) cout << i;`, []],
  ['★ 正向錨點：範圍 for 的三種舊寫法不得被弄壞', '',
    `vector<int> v{1,2,3}; for (int x : v) cout << x;\n` +
    `string s = "ab"; for (char c : s) cout << c;\n` +
    `vector<string> w{"ab","cd"}; for (const string& t : w) cout << t;`, []],
  /**
   * 🔴 **一串格子也要照字典序比**——`tuple` 在執行期是一串格子（只有「一對」
   * 登記過欄位名）。少了它，`Number(陣列)` 是 `NaN`，**每次比較都是 false**。
   * 而堆頂還要**問使用者自己的 `operator<`**——排序、去重、查找三條早就問了，
   * 堆這一條漏掉。
   */
  ['🔴 一串值的字典序：排序與堆頂', '',
    `vector<tuple<int,int,int>> v; v.push_back({7,8,9}); v.push_back({1,2,3});\n` +
    `sort(v.begin(), v.end()); auto[a,b,c] = v[0]; cout << a << b << c;\n` +
    `priority_queue<tuple<int,int,int>> pq; pq.push({1,2,3}); pq.push({7,8,9});\n` +
    `auto[x,y,z] = pq.top(); cout << x << y << z;`, []],

  // ⚠️ **刻意沒有**：空容器上 `*c.begin()`、`erase` 之後繼續用那個位置
  //    ——兩者在 C++ 裡都是未定義行為，而判準裡不得放它們。
]

describe('解譯器與參照編譯器：同一段程式，印出來的要一樣', () => {
  it('★ 入口條件：真的有參照編譯器', () => {
    expect(hasReferenceCompiler(), '🔴 沒有 g++ → 下面每一條都在驗空氣').toBe(true)
  })

  for (const [name, glob, body, stdin] of CASES) {
    it(`🔴 ${name}`, async () => {
      // ⚠️ **這一行是【判準的一部分】**：少一個標頭，那一題會以
      //    「參照編譯器收不下」紅掉，而訊息會說「測試自己的問題」——
      //    2026-09-17 加 multiset 那三題時正是這樣紅的（缺 `<set>`）。
      const src = '#include <iostream>\n#include <string>\n#include <vector>\n'
        + '#include <algorithm>\n#include <map>\n#include <set>\n'
        + '#include <unordered_map>\n#include <deque>\n'
        + `using namespace std;\n${glob}\nint main(){ ${body} return 0; }\n`
      // ⚠️ **兩邊餵同一份 stdin**——`runCppDetailed` 的第二個參數是 2026-09-16
      //    才補的；在那之前它寫死忽略輸入，於是每個要讀輸入的案例，
      //    g++ 都印出未初始化的垃圾，而**看起來像是我們錯了**。
      const ref = runCppDetailed(src, stdin.join('\n') + '\n')
      expect(ref.ok, `🔴 參照編譯器收不下這一段（測試自己的問題）：${
        ref.ok ? '' : ref.message}`).toBe(true)
      const tree = lifter.lift(parser.parse(src).rootNode as never) as SemanticNode
      const out: string[] = []
      const interp = new SemanticInterpreter({ maxSteps: 200_000 })
      interp.setOutputCallback((x) => out.push(x))
      await interp.execute(tree, stdin)
      expect(out.join(''), `🔴 跑出來不一樣\n   ${src.trim().split('\n').pop()}`)
        .toBe(ref.ok ? ref.output : '')
    }, 60_000)
  }
})
