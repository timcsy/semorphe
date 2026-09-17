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
