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
  /**
   * 🔴 **一排位元**（2026-09-19，`cpp:bits_declare`／`cpp:bits_fill`）。
   * 語料 `bitset<` 4 處 / 3 支，而三支**全部**只缺這一族。
   * ⚠️ 執行期它就是 `type: 'array'` ＋ `elemType: 'bit'`——索引因此免費沿用
   *    既有的機制，而那一章讓位元運算子分得出它與一個 `vector<int>`。
   */
  ['位元①：宣告 ＋ 索引讀寫（AP325/3/3_11）', '', 'bitset<8> bs; bs[3]=1; cout << bs[3] << bs[0] << bs[7];', []],
  ['位元②：整排歸零（tioj/25_toj126）', '', 'bitset<8> bs; bs[3]=1; bs.reset(); cout << bs[3];', []],
  ['位元③：整排設為 1 與反轉', '', 'bitset<4> a; a.set(); bitset<4> b; b[0]=1; b.flip(); cout << a[0] << a[3] << b[0] << b[1];', []],
  ['位元④：數出有幾個 1（AP325/2/2_7_TLE）', '', 'bitset<8> bs; bs[1]=1; bs[5]=1; cout << bs.count();', []],
  ['位元⑤：右移（往低位）', '', 'bitset<8> a; a[4]=1; bitset<8> b = a >> 2; cout << b[2] << b[4];', []],
  ['🔴 位元⑥：左移超出長度的要【丟掉】', '', 'bitset<4> a; a[3]=1; bitset<4> b = a << 1; cout << b[0] << b[3];', []],
  ['位元⑦：或、且、互斥或', '',
    'bitset<4> a,b; a[0]=1; a[1]=1; b[1]=1; b[2]=1; bitset<4> o=a|b, n=a&b, x=a^b;'
    + ' cout << o[0] << o[2] << n[0] << n[1] << x[1] << x[2];', []],
  /**
   * 🔴 一陣列的 bitset（`AP325/2/2_7_TLE`）——**每一格都要是一排 26 個格子**。
   * ⚠️ 這裡不測 `d[0].reset()`：接收者是運算式時型別查不到，而那是整族的
   *    既有限制（釘在 `cpp:bits_fill` 的自證測裡，`it.fails`）。
   */
  ['🔴 位元⑧：一陣列的 bitset（AP325/2/2_7_TLE）', '',
    "bitset<26> d[3]; string x=\"AC\"; for(int j=0;j<2;j++) d[0][x[j]-'A']=1;"
    + ' cout << d[0][0] << d[0][2] << d[1][0] << d[2][25];', []],
  ['位元⑨：語料的整排位移合成（tioj/25_toj126）', '',
    'bitset<20> bs; bs[10]=1; int x=3; bs=(bs>>x|bs<<x); cout << bs[7] << bs[13] << bs[10];', []],
  ['位元⑩：語料的互斥或 ＋ 數 1（AP325/2/2_7_TLE）', '',
    'bitset<26> d[2]; bitset<26> bs; d[0][1]=1; d[1][2]=1; bs=(d[0]^d[1]); cout << bs.count();', []],
  /** ★ 正向錨點：**整數那一路與同族的容器不得被弄壞**。 */
  ['★ 整數的位元運算照舊', '', 'int x=6,y=3; cout << (x&y) << (x|y) << (x^y) << (x<<1) << (x>>1);', []],
  ['★ `__builtin_popcount` 照舊', '', 'cout << __builtin_popcount(7) << __builtin_popcount(0);', []],
  ['★ 一陣列的 vector 照舊', '', 'vector<int> ar[3]; ar[1].push_back(7); cout << ar[1][0];', []],
  ['★ `pair` 陣列照舊', '', 'pair<int,int> A[3]; A[0]={3,1}; cout << A[0].first << A[1].second;', []],
  ['★ 容器的 `count(x)` 照舊（同名不同顆）', '', 'multiset<int> s{1,2,2}; cout << s.count(2);', []],
  ['★ 容器的 `clear()` 照舊', '', 'vector<int> v{1,2}; v.clear(); cout << v.size();', []],
  /**
   * 🔴 **位置的相鄰一格**（2026-09-19，`cpp:pointer_step`）。
   * 語料 `prev(` 10 處 / 8 支，**每一處都是 `prev(X.end())`**——那是
   * 「取最後一個」在有序容器上**唯一的寫法**（`set` 沒有 `back()`）。
   */
  ['相鄰①：`*prev(s.end())` 在 set 上（AP325/4/4_8）', '', 'set<int> s{5,1,9}; cout << *prev(s.end());', []],
  ['相鄰②：在 multiset 上（重複要留著）', '', 'multiset<int> s{5,5,1}; cout << *prev(s.end());', []],
  ['相鄰③：在 vector 上（w/APCS/j607）', '', 'vector<int> v{3,7,2}; cout << *prev(v.end()) - *v.begin();', []],
  ['相鄰④：`s.erase(prev(s.end()))`（tioj/20_toj275）', '',
    'set<int> s{1,2,3}; s.erase(prev(s.end())); for(int x : s) cout << x;', []],
  ['相鄰⑤：`*next(v.begin())`', '', 'vector<int> v{7,8,9}; cout << *next(v.begin());', []],
  ['相鄰⑥：反向的位置上方向不得被翻兩次', '', 'vector<int> v{1,2,3}; auto it=v.rbegin(); cout << *next(it);', []],
  ['相鄰⑦：拿它當範圍的端點', '', 'vector<int> v{4,1,3,9}; sort(v.begin(), prev(v.end())); for(int x : v) cout << x;', []],
  /** ★ 正向錨點：既有的取端點寫法不得被弄壞，而使用者自己的同名函式不得被搶。 */
  ['★ `*v.begin()` 與 `v.end()-1` 照舊', '', 'vector<int> v{1,2,3}; cout << *v.begin() << *(v.end()-1);', []],
  ['★ 使用者自己的 `next(int)` 不得被搶', 'int next(int x){ return x+1; }', 'cout << next(3);', []],
  /**
   * 🔴 **`long long` 在這個直譯器裡曾經是一個 double**（2026-09-19）。
   * 見 `src/interpreter/int64.ts`（不變式）與 `src/core/scalar-types.ts`（拼法表）。
   */
  ['64位元①：乘積取模（模逆元的核心，AP325/2/2_8_*）', '#define ll long long',
    'll x=123456789,P=1000000007; cout << x*x%P;', []],
  ['64位元②：快速冪跑完', '#define ll long long\nll xn(ll x,ll nt,ll P){ ll ans=1; while(nt){ if(nt&1) ans=ans*x%P; x=x*x%P; nt>>=1; } return ans; }',
    'cout << xn(3,1000000005,1000000007);', []],
  ['64位元③：位移超過 32 位元', '', 'long long jp=1000000000000LL; jp>>=1; cout << jp;', []],
  ['64位元④：`for(ll jp=1e12; jp>0; jp>>=1)`（AP325/4/4_10_2）', '#define ll long long',
    'int n=0; for(ll jp=1e12; jp>0; jp>>=1) n++; cout << n;', []],
  ['64位元⑤：大整數字面值不得失真', '', 'long long a=9007199254740993LL; cout << a;', []],
  ['64位元⑥：大整數比較（轉成 double 會變成相等）', '',
    'long long a=9007199254740993LL, b=9007199254740992LL; cout << (a==b) << (a>b);', []],
  ['64位元⑦：`&` 在 64 位元上', '', 'long long n=1000000000000LL; cout << (n&1) << (n&1024);', []],
  /**
   * 🔴 **宣告的型別如果只在宣告那一行生效，它就不是一個型別，是一句註解。**
   * `#define ll long long` 的 `ll` 在語料裡 41 處，而它從來沒有進過別名表
   *（那條正則只收「一個字」）。
   */
  ['型別①：`ll n = 2e9` 是整數不是 2e+09', '#define ll long long', 'll n=2e9; cout << n;', []],
  ['型別②：函式回傳值照宣告的型別轉（AP325/7/7_5_TLE）', '#define ll long long\nll f(){ return 1e9; }',
    'cout << f();', []],
  ['型別③：連 `int` 的回傳值也沒轉過', 'int f(){ return 1e9; }', 'cout << f();', []],
  ['型別④：參數收 double 也要轉', '#define ll long long\nll g(ll v){ return v; }', 'cout << g(1e9);', []],
  /** ★ 正向錨點：**小整數與浮點不得被動到**。 */
  ['★ 小整數的算術照舊', '', 'int a=3,b=4; cout << a+b << a*b << a/b << (a%b) << (a<<2) << (a&1);', []],
  ['★ `double` 不得被升成整數（`1e300*1e300` 是 inf）', '', 'double a=1e300; cout << a*a;', []],
  ['★ `double d = 1e12` 仍然印成 `1e+12`', '', 'double d=1e12; cout << d;', []],
  ['★ 整數除法往零截斷', '', 'cout << (-7)/2 << " " << (-7)%2;', []],
  ['★ `char` 的算術照舊', '', "char c='7'; cout << (c-'0');", []],
  /**
   * 🔴 **轉型的三種寫法，而我們只認得一種**（2026-09-19，語料 2 支）。
   * 見 `src/languages/cpp/lifters/io.ts` 的 `call_expression` 前兩個分支。
   */
  ['轉型①：`(ll)(x+1)`——括號讓它被解成【呼叫】（w/APCS/f638_2t）', '#define ll long long',
    'int x=3,z=2; cout << (ll)(x+1)*z;', []],
  ['轉型②：`int()` 值初始化（basic/4_variable）', '', 'int v = int(); cout << v;', []],
  ['轉型③：`double(3)` 函式式轉型', '', 'cout << double(3)/2;', []],
  /**
   * 🔴 **只有【整數】除以零是未定義行為**（2026-09-19，AP325/3/3_14）。
   * IEEE 754 說 `5.0/0` 是 `inf`、`0.0/0.0` 是 `nan`，而 C++ 的浮點除法就是它。
   */
  ['除法①：浮點除以零是 `inf` 不是錯誤', '', 'int d=0; cout << (1.0*5)/d;', []],
  /**
   * 🔴 **`0.0/0.0` 的【正負號】是未指定的——所以不得拿印出來的字串當判準**
   *（2026-09-19，CI 抓到，而它紅了兩次合併）。
   *
   * ```
   * 本機  Apple clang（libc++）   nan
   * CI    GNU g++（libstdc++）    -nan
   * ```
   *
   * 這一條原本寫的是「印出來要一樣」，於是**本機全綠而 CI 紅**
   * ——與 2026-09-17／09-18 的標頭那兩次是**同一個形狀**：
   *
   * > **本機那一台比 CI 那一台寬鬆的地方，量不出來的不是缺陷
   * > ——是【我的判準有多寬】。**
   *
   * 🟢 **判準換成 C++ 真的保證的那一件事**：那個值**不等於它自己**。
   *    IEEE 754 定得死死的，兩台機器都印 `1`。
   * ⚠️ 而「它是不是 `inf`」（除法①③）**有定義**，所以那兩條照舊比字串。
   */
  ['除法②：`0.0/0.0` 得到的東西不等於自己', '',
    'double a=0.0,b=0.0; double c=a/b; cout << (c != c) << (c == c);', []],
  ['除法③：`-1.0/0` 是 `-inf`', '', 'int d=0; cout << (-1.0)/d;', []],
  /** 🔴 **八進位字面值**（2026-09-19，basic/3_literal_constant 整節在教這個）。 */
  ['字面值①：`0103` 是八進位（67，不是 103）', '', 'cout << 0103;', []],
  ['字面值②：四種進位並排', '', 'cout << 67 << " " << 0b1000011 << " " << 0103 << " " << 0x43;', []],
  /** 🔴 **二維陣列的扁平初值**（2026-09-19，basic/15_nD_array_1）。 */
  ['二維①：扁平初值照列優先填（`int a[2][3]={1,2,3,4,5,6}`）', '',
    'int a[2][3] = {1,2,3,4,5,6}; for(int i=0;i<2;i++) for(int j=0;j<3;j++) cout << a[i][j] << " ";', []],
  ['二維②：扁平只給一半，其餘是型別預設值', '',
    'int a[2][3] = {1,2,3}; for(int i=0;i<2;i++) for(int j=0;j<3;j++) cout << a[i][j] << " ";', []],
  /** ★ 正向錨點：**原本就對的那些不得被動到**。 */
  ['★ `(int)x`／`(ll)x` 照舊', '#define ll long long',
    'double x=2.7; int y=3,z=2; cout << (int)x << (ll)y*z;', []],
  ['★ 整數除以零仍然是未定義行為——要出聲', '', 'cout << "before"; return 0;', []],
  ['★ `0` 自己不是八進位', '', 'cout << 0 << 00;', []],
  ['★ 二維巢狀初值照舊（含給不滿的那一列）', '',
    'int a[2][3] = {{1,2,3},{4,5,6}}; int b[2][3] = {{1,2}}; cout << a[1][2] << a[0][0] << b[0][0] << b[0][2] << b[1][0];', []],
  ['★ 一維初值照舊', '', 'int a[3] = {7,8,9}; cout << a[0] << a[2];', []],
  /**
   * 🔴 **`#define` 取的小名與常數**（2026-09-19，語料 4 支＋）。
   * 見 `src/core/lift/lifter.ts` 的 `recordMacroAlias`
   * 與 `src/components/cpp/define/execute.ts` 的 `literalValue`。
   */
  ['小名①：`#define pb push_back`（從第一天就沒有work過）', '#define pb push_back',
    'vector<int> v; v.pb(3); cout << v[0] << v.size();', []],
  ['小名②：接收者是一格陣列（AP325/7/7_12 的 `ar[u].pb(...)`）', '#define pb push_back',
    'vector<int> ar[3]; ar[1].pb(7); cout << ar[1][0];', []],
  ['常數①：`#define z \'0\'`（字元字面值，w/APCS/j607_2t）', "#define z '0'",
    'string s="57"; cout << (s[0]-z) << (s[1]-z);', []],
  ['常數②：`#define z -\'0\'`（帶正負號）', "#define z -'0'",
    'string s="57"; cout << (s[0]+z);', []],
  ['常數③：`#define MAXN 1e2`（科學記號）', '#define MAXN 1e2', 'cout << (int)MAXN;', []],
  ['常數④：`#define M 0x1F`（十六進位）', '#define M 0x1F', 'cout << M;', []],
  ['常數⑤：`#define M 1000000007LL`（帶字尾）', '#define M 1000000007LL',
    'long long x=2; cout << (x*3)%M;', []],
  /**
   * 🔴 **一顆元件認了 N 個方法名而只記得其中一個**（2026-09-19）。
   * `v.emplace_back(3)` 在此之前產回 `v.push_back(3)`，`m.emplace(1,2)` 產回 `m.insert(1)`。
   */
  ['拼法①：`emplace_back` 不得被改寫成 `push_back`', '',
    'vector<int> v; v.emplace_back(3); cout << v[0];', []],
  ['拼法②：`s.emplace` 不得被改寫成 `insert`', '', 'set<int> s; s.emplace(3); cout << *s.begin();', []],
  /**
   * 🔴 **二維原生陣列的每一格也要是結構實例**——一維那顆 2026-09-04 修過，
   * 這顆漏了同一行（w/APCS/o713 那一族）。
   */
  /**
   * ⚠️ **兩個成員都要先寫過**——第一版寫 `cout << g[0][0].b` 而沒有指定過它，
   * 而區塊範圍的 POD 陣列是**未定值**：g++ 印出 `1`。
   * 那一題量的是「我們有沒有跟 g++ 一起做出同一個未定義的選擇」，不是行為
   *（這個檔的檔頭逐字寫過同一件事，而我又犯了一次）。
   */
  ['結構①：二維原生陣列上的成員（`P g[2][2]; g[1][1].a`）', 'struct P{int a; int b;};',
    'P g[2][2]; g[1][1].a=5; g[0][0].b=7; cout << g[1][1].a << g[0][0].b;', []],
  ['結構②：巢狀 vector 上的 `.first`（w/APCS/o713）', '',
    'vector<vector<pair<int,int>>> d(2, vector<pair<int,int>>(2)); d[1][1].first=9; cout << d[1][1].first << d[0][0].second;', []],
  /** ★ 正向錨點：**沒有小名時不得被動到**，而叫 `size` 的變數不得讓 `v.size()` 走錯。 */
  ['★ 沒有小名時 `push_back` 照舊', '', 'vector<int> v; v.push_back(3); cout << v[0];', []],
  ['★ 叫 `size` 的變數不得讓 `v.size()` 去查一個叫 `int` 的方法', '',
    'int size=9; vector<int> v{1,2}; cout << v.size() << size;', []],
  ['★ `#define MOD 1000000007` 照舊（原本就綠的那一路）', '#define MOD 1000000007',
    'long long x=2; cout << (x*3)%MOD;', []],
  /**
   * 🔴 **解析器自己解錯的兩種形狀**（2026-09-19，語料 4 支）。
   * 見 `src/languages/cpp/lang/misparse.ts` 的檔頭——它們是**唯一一批
   * 「往下追的每一層都是對的」的缺陷**。
   */
  ['解析器①：`!K--` 是 `!(K--)` 不是 `(!K)--`', 'int f(int K){ if(!K--) return 0; return K; }',
    'cout << f(3) << f(0);', []],
  ['解析器①：`-K--`', '', 'int K=3; cout << (-K--) << K;', []],
  ['解析器①：`~K--`', '', 'int K=3; cout << (~K--) << K;', []],
  ['解析器①：`!a[0]--`（運算元是一格陣列）', '', 'int a[2]={0,5}; if(!a[0]--) cout<<"z"; cout<<a[0];', []],
  ['解析器②：`a < b && c > -d` 不是樣板（AP325 的 eps 比較）', '',
    'double ans=0.5, eps=1.0; if(ans < eps && ans > -eps) cout<<"in"; else cout<<"out";', []],
  ['解析器②：三個 `&&`（左結合，自己算優先級會錯）', '',
    'int a=1,b=2,c=1,d=5,x=1; if(a < b && c && d > -x) cout<<"y"; else cout<<"n";', []],
  ['解析器②：`||` 那一支', '', 'int a=9,b=2,c=3,d=4; if(a < b || c > -d) cout<<"y"; else cout<<"n";', []],
  ['解析器②：右邊是解參考（`> *p`）', '',
    'int a=1,b=2,c=3,q=1; int* p=&q; if(a < b && c > *p) cout<<"y"; else cout<<"n";', []],
  ['解析器②：`i<si && s[i] - z > …`（w/APCS/j607_2t）', '',
    'int i=1,si=5,z=1; int s[6]={0,9,0,0,0,0}; if(i<si && s[i] - z > -3) cout<<"y"; else cout<<"n";', []],
  /**
   * 🔴 **誤判的那顆不一定在左邊**（AP325/7/7_3）——`i<m && j>` 被當成樣板，
   * 而後面的 `=0` 變成**指定值**，於是整句被 lift 成「把 0 指給一個邏輯運算」。
   */
  ['解析器②：誤判在 `&&` 的右邊（AP325/7/7_3 的邊界檢查）',
    'int m=5,n=5;\nbool inside(int i,int j){ return (i>=0 && i<m && j>=0 && j<n); }',
    'cout << inside(1,1) << inside(-1,1) << inside(1,9);', []],
  /** ★ 正向錨點：**沒有解錯的那些不得被動到**——修復是有條件的，不是無差別重寫。 */
  ['★ 解析器沒錯時不得被動到：一般的 `a<b && c>d`', '',
    'int a=1,b=2,c=3,d=4; if(a < b && c > d) cout<<"y"; else cout<<"n";', []],
  ['★ 解析器沒錯時不得被動到：一般的後置遞減', '', 'int K=3; cout << K-- << K;', []],
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

  /**
   * 🔴 **指定值不會換掉那個格子的型別**（2026-09-18，語料量出來的）。
   *
   * C++ 的 `=` 是**轉換成左邊的型別再放進去**，而在此之前這裡是
   * 「把右邊算出來的東西直接擺進去」——於是：
   *
   * ```cpp
   * char c = 'a'; c = c + 7;   g++ 印 h ／ 我們印 104
   * int  x = 5;   x = 3.7;     g++ 印 3 ／ 我們印 3.7
   * int  n = 7;   n /= 2;      g++ 印 3 ／ 我們印 3.5
   * ```
   *
   * > **一個宣告過型別的格子，它的型別是那個【格子】的性質，
   * > 不是上一次放進去的那個值的性質。**
   *
   * ⚠️ 而 `char` 在這個直譯器裡有**兩種表示**：碼位（`string_at`／
   *    `container_iter` 給的）與單字元字串（`literal_char`／`coerceType` 給的）。
   *    轉換時要**保住原本那一種**——`s[0] -= 7` 那一條就是為此而在：
   *    把碼位轉成單字元字串之後，寫回字串那一格的人會做 `Number('a')` ＝ NaN。
   */
  ['🔴 指定值保住宣告的型別（char 走碼位那一路）', '',
    `char c = 'a'; c = c + 7; cout << c << '\\n';\n` +
    `char d = 'y'; d += 1; cout << d << '\\n';\n` +
    `string s = "ai"; s[0] -= 7; cout << s << '\\n';`, []],
  ['🔴 指定值保住宣告的型別（整數不得變成小數）', '',
    `int x = 5; x = 3.7; cout << x << '\\n';\n` +
    `int n = 7; n /= 2; cout << n << '\\n';\n` +
    `int m = 9; m *= 0.5; cout << m << '\\n';\n` +
    `bool b = false; b = 2; cout << b << '\\n';`, []],
  /**
   * ★ **正向錨點**：上面那一刀最大的風險是**反過來壓壞小數**
   * ——一個「照宣告的型別轉」的實作，很容易把 `double` 也一起截斷。
   */
  ['★ 正向錨點：小數與字串的指定值不得被截斷', '',
    `double p = 0; p = 1.0 / 4; cout << p << '\\n';\n` +
    `double q = 0; q += 2.5; cout << q << '\\n';\n` +
    `double r = 0; r = 7 / 2; cout << r << '\\n';\n` +
    `string t = "x"; t = "yz"; t += "!"; cout << t << '\\n';`, []],

  /**
   * 🔴 **範圍的兩端從字串屬性換成接點**（2026-09-18）。
   *
   * 在此之前 `begin`／`end` 是兩個字串屬性，裝著原始碼的片段，而執行期用一條
   * regex 把它們解析回「哪個陣列、從哪到哪」——那條 regex 只認得**一個裸識別字**
   * 開頭的東西，於是學生真的寫的三種形狀全部斷在那裡。
   *
   * ⚠️ **前七條是【正向錨點】，而它們是這一刀最大的風險**：`sort(A, A+n)` 這種
   *    裸指標算術語料裡有 33 處，今天是綠的，而換成接點之後那條路**整個換人走**。
   *    ⚠️ 第二條特別重要：那一族的字串 parser 2026-09-16 才為了「偏移是算出來的」
   *    補過一次（`sort(h, h+N)`）。
   */
  ['★ 範圍錨點：裸陣列 ＋ 字面偏移', '',
    `int A[5]={5,3,1,4,2}; sort(A, A+5); for(int i=0;i<5;i++) cout << A[i];`, []],
  ['★ 範圍錨點：偏移是【算出來的】', '',
    `int h[5]={5,4,3,2,1}; int N=5; sort(h, h+N); for(int i=0;i<5;i++) cout << h[i];`, []],
  ['★ 範圍錨點：成員形式', '',
    `vector<int> v{3,1,2}; sort(v.begin(), v.end()); for(int x:v) cout << x;`, []],
  ['★ 範圍錨點：兩端都有偏移', '',
    `int fx[6]={9,5,3,8,1,7}; sort(fx+1, fx+6); for(int i=0;i<6;i++) cout << fx[i];`, []],
  ['★ 範圍錨點：部分範圍 ＋ 寫入型 ＋ 帶初值', '',
    `int a[4]={1,2,3,4}; reverse(a, a+3); for(int i=0;i<4;i++) cout << a[i];\n` +
    `int c[3]={1,1,1}; fill(c, c+3, 7); for(int i=0;i<3;i++) cout << c[i];\n` +
    `vector<int> v2{1,2,3}; cout << accumulate(v2.begin(), v2.end(), 0);`, []],
  ['★ 範圍錨點：遞增填充與前綴和', '',
    `vector<int> v(4); iota(v.begin(), v.end(), 3); for(int x:v) cout << x;\n` +
    `int a[4]={1,2,3,4}; int b[4]; partial_sum(a, a+4, b); for(int i=0;i<4;i++) cout << b[i];`, []],
  ['★ 範圍錨點：最大最小與二分', '',
    `int a[5]={3,9,1,7,2}; cout << *max_element(a,a+5) << *min_element(a,a+5);\n` +
    `vector<int> v{1,3,3,5};\n` +
    `cout << (lower_bound(v.begin(),v.end(),3)-v.begin()) << (upper_bound(v.begin(),v.end(),3)-v.begin());`, []],
  ['🔴 範圍的兩端可以是自由函式（原生陣列沒有成員 begin）', '',
    `int a[4]={4,2,3,1}; sort(begin(a), end(a)); for(int i=0;i<4;i++) cout << a[i];`, []],
  ['🔴 範圍的兩端可以是運算式（語料 tioj/17_toj575）', '',
    `vector<int> d2[3]; d2[1].push_back(5); d2[1].push_back(2);\n` +
    `sort(d2[1].begin(), d2[1].end()); for(int x:d2[1]) cout << x;`, []],
  /**
   * 🔴 **`forLoopPart` 這個病的第三次**（2026-09-18）。一般的變數宣告早就宣告了
   * 「我可以當 for 的初始化子」，`auto` 那顆 2026-09-17 才補，而**其餘 25 顆都沒有**
   * ——於是這一行整段掉進 raw code，而錯誤訊息指著那一整段，沒有指著少掉的宣告。
   */
  ['🔴 指標宣告可以當 for 的初始化子（語料 basic/14_array_1）', '',
    `int a[3]={7,8,9}; for(int* p = begin(a); p != end(a); p++) cout << *p;`, []],
  ['🔴 位置相減換算成索引（語料 basic/14_array_2）', '',
    `int a[4]={4,5,6,7}; int n = find(begin(a), end(a), 6) - begin(a); cout << n;`, []],
  ['🔴 找不到用「結尾之後的位置」表示，沒有別的哨兵值', '',
    `int a[3]={1,2,3}; cout << (find(begin(a), end(a), 9) == end(a));`, []],
  /**
   * 🔴 **「刪除-移除」的慣用法**——這兩顆是一根 `it.fails` 釘子指名要的，
   * 而那根釘子的阻斷條件逐字寫著「範圍那一族從字串屬性換成接點的那一刀」。
   * ⚠️ 它是**兩步**：擠掉的那一步**不改變長度**，真的變短是 `erase` 的事。
   */
  ['🔴 擠掉相鄰重複，再真的刪掉尾巴', '',
    `vector<int> v{1,1,2,3,3,3}; v.erase(unique(v.begin(), v.end()), v.end());\n` +
    `for(int x:v) cout << x;`, []],
  ['🔴 擠掉等於某個值的，再真的刪掉尾巴', '',
    `vector<int> v{1,2,1,3}; v.erase(remove(v.begin(), v.end(), 1), v.end());\n` +
    `for(int x:v) cout << x;`, []],
  ['★ 比較器仍然走得通（它一直是接點）', '',
    `vector<int> v{1,3,2}; sort(v.begin(), v.end(), [](int a,int b){return a>b;});\n` +
    `for(int x:v) cout << x;`, []],

  /**
   * 🔴 **`&a[n]` 是結尾指標的慣用寫法**（2026-09-18，盲測抓到）。
   *
   * 在此之前 `cpp:address_of` 先檢查 `i < length` 再取位置，於是
   * `max_element(&a[0], &a[8])` 丟 `INDEX_OUT_OF_RANGE: 8`。
   *
   * 而**取位址不讀那一格**——判準與範圍那一族一模一樣：
   * `i === length` 是「尾端之後一格」，只有**解參考**才是錯的。
   *
   * > **一個「不會讀」的運算，不該被「讀得到嗎」擋下來。**
   */
  ['🔴 `&a[n]` 當結尾，`&a[0]` 當開頭', '',
    `int a[5]={3,9,1,7,2};\n` +
    `cout << *max_element(&a[0], &a[5]) << '\\n';\n` +
    `cout << (max_element(&a[0], &a[5]) - &a[0]) << '\\n';\n` +
    `cout << accumulate(&a[0], &a[0], 100) << '\\n';\n` +
    `sort(&a[1], &a[4]); for (int i=0;i<5;i++) cout << a[i];`, []],

  /**
   * 🔴 **I/O 操縱子**（2026-09-18／19）：`setw`／`setprecision`／`setfill`／
   * `fixed`／`scientific`／`flush`。
   *
   * ⚠️ **第一條是正向錨點**，而它在開發途中真的紅過：新的 lift 樣式用了
   * `match: '^(fixed|scientific)$'`，而 `match` 是**比較方式**（`startsWith`）
   * 不是正規式——於是那條限制等於不存在，**每一個識別字**都被認成操縱子。
   *
   * > **一個不存在的欄位不會報錯，它只會讓你以為那個限制生效了。**
   * > **而當一個新的檢查連【正向錨點】都紅的時候，先懷疑那個檢查。**
   */
  ['🔴 I/O 操縱子：★ 錨點：不用操縱子時輸出一字不變', '',
    `int a=7; double d=1.0/3; cout << a << ' ' << d << '\\n';`, []],
  ['🔴 I/O 操縱子：setw 只影響下一項', '',
    `cout << setw(4) << 7 << 8 << '\\n';`, []],
  ['🔴 I/O 操縱子：setfill 之後 setw 補的是那個字', '',
    `cout << setfill('0') << setw(3) << 5 << '\\n';`, []],
  ['🔴 I/O 操縱子：fixed ＋ setprecision', '',
    `cout << fixed << setprecision(2) << 3.14159 << '\\n';`, []],
  ['🔴 I/O 操縱子：單獨的 setprecision（有效數字）', '',
    `cout << setprecision(3) << 3.14159 << ' ' << 123456.0 << '\\n';`, []],
  ['🔴 I/O 操縱子：scientific', '',
    `cout << scientific << setprecision(3) << 1234.5 << '\\n';`, []],
  ['🔴 I/O 操縱子：flush 不改變輸出', '',
    `cout << "ab" << flush << "cd" << flush << '\\n';`, []],
  ['🔴 I/O 操縱子：setprecision 一直有效', '',
    `cout << setprecision(2) << 1.23456 << ' ' << 2.34567 << '\\n';`, []],
  ['🔴 I/O 操縱子：setw 每次都要重設', '',
    `cout << setw(3) << 1 << setw(3) << 2 << '\\n';`, []],
  ['🔴 I/O 操縱子：語料的寫法：九九乘法表那一行', '',
    `for(int y=1;y<=3;y++){ cout << 2 << '*' << y << '=' << setw(2) << 2*y << ' '; } cout << '\\n';`, []],
  ['🔴 I/O 操縱子：語料的寫法：二維陣列對齊', '',
    `int a[2][2]={{1,22},{333,4}}; for(int r=0;r<2;r++){ for(int c=0;c<2;c++) cout << setw(4) << a[r][c] << ' '; cout << '\\n'; }`, []],
  ['🔴 I/O 操縱子：fixed 之後回不到預設（C++ 也是）', '',
    `cout << fixed << setprecision(1) << 2.5 << ' ' << 100000.0 << '\\n';`, []],

  /**
   * 🔴 **二維陣列的維度是運算式**（2026-09-19）。
   *
   * 在此之前 `rows`／`cols` 是兩個屬性，而執行期 `Number(那串文字)`
   * 對 `n`／`x*2` 都是 `NaN` ⟹ **零列** ⟹ 下一行的 `d2[i][j]` 才報錯。
   *
   * > **一個錯誤訊息指著最後一個碰到它的人，而不是造成它的人。**
   *
   * ⚠️ **同族那顆一維陣列的 `size` 早就是接點**——它是一個不對稱，
   *    而第七十二條看不到它（測試語料裡的維度永遠是數字字面值）。
   */
  ['★ 錨點：字面維度的二維陣列不得被弄壞', '',
    `int a[2][3] = {{1,2,3},{4,5,6}}; cout << a[1][2];\n` +
    `int b[2][3]; b[1][2] = 9; cout << b[1][2];\n` +
    `cout << sizeof(a) / sizeof(a[0]);`, []],
  ['🔴 維度是一個變數', '',
    `int n = 3; int a[n][2]; a[2][1] = 7; cout << a[2][1];`, []],
  ['🔴 維度是一個運算式', '',
    `int x = 2; int a[x*2][3]; a[3][2] = 5; cout << a[3][2];`, []],
  ['🔴 維度是變數 ＋ 讀進去（語料 w/zeroJudge/a005）', '',
    `int n = 2; int d2[n][5];\n` +
    `for (int i=0;i<n;i++) for (int j=0;j<5;j++) d2[i][j] = i*5+j;\n` +
    `cout << d2[1][4];`, []],
  ['★ 錨點：多宣告子的二維陣列', '',
    `int a[2][3], b[4][5]; a[1][2]=1; b[3][4]=2; cout << a[1][2] << b[3][4];`, []],

  // ⚠️ **刻意沒有**：空容器上 `*c.begin()`、`erase` 之後繼續用那個位置
  //    ——兩者在 C++ 裡都是未定義行為，而判準裡不得放它們。

  /**
   * 🔴 **一個宣告裡的第二個宣告子**（2026-09-20，語料 `template/Cn_k.cpp`）。
   * `const ll M = ..., MX = ...;` ——而 `ll` 還是一個 `#define` 的別名。
   * 症狀是 `RUNTIME_ERR_UNDECLARED_VAR ｜ MX`：**第二個名字整個不見了**，
   * 而 CLAUDE.md 的判準第二層逐字寫著「每一個宣告的名字都要被觀察」。
   */
  ['多宣告子：const ＋ #define 的型別別名', '#define ll long long\nconst ll M = 998244353, MX = 7;', '  cout << M << " " << MX;', []],
  ['多宣告子：兩個都要看得到（沒有 const、沒有別名）', 'long long A = 3, B = 4;', '  cout << A << B;', []],
  /**
   * 🔴 **一排字串裡的那一格，字元的表示要與單一字串的那一格一樣**
   *（2026-09-20，語料 `AP325/7/7_4.cpp` 的 `d2[i][j] == '0'`）。
   * ⚠️ 兩條路是兩份實作：名字當接收者走「取第幾個字」，運算式當接收者走「取第幾格」。
   */
  ['一排字串：取一格再取一個字，與字元字面值比得起來', '', '  vector<string> d = {"10", "1"};\n  cout << (d[0][1] == \'0\') << (d[0][0] == \'1\') << (int)d[1][1];', []],
  ['一排字串：那一格剛好等於長度也是空字元', '', '  vector<string> d = {"1"};\n  cout << (int)d[0][1] << (d[0][1] == \'0\');', []],
  /**
   * 🔴 **`s[s.size()]` 不是越界**（2026-09-20，語料 `AP325/7/7_4.cpp`）。
   * C++11 起它有定義：回一個空字元。我們原本丟越界，整支程式停在那裡。
   * ⚠️ ★ 錨點跟在後面：**真的越界仍然要出聲**，而寫進去那一路照舊。
   */
  ['字串：剛好等於長度那一格是空字元', '', '  string s = "1";\n  cout << (int)s[1] << (s[1] == \'0\') << (int)s.size();', []],
  ['字串：長度 0 的那一格也是', '', '  string s = "";\n  cout << (int)s[0] << (int)s.size();', []],
  ['★ 錨點：一般的字串索引照舊', '', '  string s = "abc";\n  cout << s[0] << s[2] << (int)s.size();', []],
  ['★ 錨點：從字串裡讀字元再算數照舊', '', '  string s = "507";\n  int t = 0;\n  for (int i = 0; i < (int)s.size(); i++) t += s[i] - \'0\';\n  cout << t;', []],
  /**
   * 🔴 **括號裡的逗號運算式**（2026-09-20，資訊隔離盲測抓到的）。
   *
   * tree-sitter 對它**解錯**：給一個 `assignment_expression` ＋ 一個 `ERROR`
   * 節點（那個 `3` 在裡面），而我們**把 ERROR 安靜吞掉**，產出 `(x = x + 1)`
   * ——輸出是一個型別正確、看起來合理的數字（g++ 4、我們 2）。
   * 修在 `lang/misparse.ts` 的第三條樹修復。
   *
   * ⚠️ ★ 錨點跟在後面：**語句位置的逗號**（那一種 tree-sitter 解得對）
   *    與**沒有逗號的括號**都不得被弄壞。
   */
  ['括號裡的逗號運算式', '', '  int x = 0;\n  cout << (x = 3, x + 1) << " x=" << x;', []],
  ['括號裡的逗號：三格', '', '  int x = 0, y = 0;\n  cout << (x = 3, y = 4, x + y);', []],
  ['括號裡的逗號：當引數', 'int f(int a, int b){ return a > b ? a : b; }', '  int x = 0;\n  cout << f((x = 3, x + 1), 2) << x;', []],
  ['括號裡的逗號：當初值', '', '  int x = 0;\n  int y = (x = 3, x + 1);\n  cout << y << x;', []],
  ['★ 錨點：語句位置的逗號照舊', '', '  int x = 0;\n  x = 3, x + 1;\n  cout << x;', []],
  ['★ 錨點：沒有逗號的括號照舊', '', '  int x = 2;\n  cout << (x + 1) * 2;', []],
  /**
   * 🔴 **帶參數的巨集**（2026-09-20，語料 4 支：AP325 的 7_4 · 6_5 · 6_6 · 4_19）。
   * ⚠️ 那幾個出處**刻意不寫在反引號裡**：第五十三條護欄的 C++ 語料是從
   *    測試檔的反引號區間刮出來的，而 `7_4` 在 C++ 文法裡是一個
   *    **使用者定義字面值**——一個檔案路徑會把兩筆判定變成「過期」。
   * tree-sitter 對 `rep(i,m) s += i;` **不給 ERROR**——它給一棵看起來合法的樹，
   * 而產出的程式碼**靜默少一個名字**（`rep(i, m) += i;`）。
   * 展開走 `lang/macro-expand.ts` 的樹修復，原文的拼法存進 `layoutHints`。
   */
  ['巨集：單句主體', '#define rep(i,n) for(int i=0;i<n;i++)', '  int s = 0;\n  rep(i,4) s += i;\n  cout << s;', []],
  ['巨集：區塊主體', '#define rep(i,n) for(int i=0;i<n;i++)', '  int s = 0;\n  rep(i,4){ s += i; s += 1; }\n  cout << s;', []],
  ['巨集：巢狀', '#define rep(i,n) for(int i=0;i<n;i++)', '  int s = 0;\n  rep(i,3) rep(j,2) s += i * j;\n  cout << s;', []],
  ['巨集：另一種表頭（1 起算、含右端）', '#define per(i,n) for(int i=1;i<=n;i++)', '  int s = 0;\n  per(k,4) s += k;\n  cout << s;', []],
  ['巨集：引數是一個運算式', '#define rep(i,n) for(int i=0;i<n;i++)', '  int m = 2, s = 0;\n  rep(i,m+1) s += i;\n  cout << s;', []],
  ['巨集：主體是讀取（>> 讓樹長得不一樣）', '#define rep(i,n) for(int i=0;i<n;i++)', '  int a[3], s = 0;\n  rep(i,3) cin >> a[i];\n  rep(i,3) s += a[i];\n  cout << s;', ['5 7 9']],
  ['★ 錨點：一般的 for 迴圈不得被弄壞', '#define rep(i,n) for(int i=0;i<n;i++)', '  int s = 0;\n  for(int z=0;z<3;z++) s += z;\n  cout << s;', []],
  ['★ 錨點：物件形的 #define 不得被弄壞', '#define rep(i,n) for(int i=0;i<n;i++)\n#define MAXN 7', '  cout << MAXN;', []],
  ['★ 錨點：沒定義過巨集時，rep 仍然是一個函式', 'int rep(int a, int b){ return a + b; }', '  cout << rep(2,3);', []],
  /**
   * 🔴 **型別名是一個 `#define` 別名**（2026-09-20，語料 `AP325/4/4_15_3t.cpp`）。
   * 症狀是 `iter[0]（不是一個結構）`：`pii` 在 `structs`／聚合形狀／樣板引數
   * 三張表裡都查不到，於是 `{3,4}` 變成一串普通的格子。
   * ⚠️ **成員名那一側（`F`／`S`）早就會解別名，型別名那一側沒有。**
   */
  ['別名型別：變數 ＋ 真名', '#define pii pair<int,int>\n#define F first\n#define S second\n#define ll long long', '  pii p = {3,4};\n  cout << p.first << p.second;', []],
  ['別名型別：變數 ＋ 別名成員', '#define pii pair<int,int>\n#define F first\n#define S second\n#define ll long long', '  pii p = {3,4};\n  cout << p.F << p.S;', []],
  ['別名型別：multiset 的元素', '#define pii pair<int,int>\n#define F first\n#define S second\n#define ll long long', '  multiset<pii> st;\n  st.insert({3,4});\n  auto iter = st.begin();\n  cout << iter->F << iter->S;', []],
  ['別名型別：upper_bound 之後解參考', '#define pii pair<int,int>\n#define F first\n#define S second\n#define ll long long', '  multiset<pii> st;\n  st.insert({3,4});\n  auto iter = st.upper_bound({1,0});\n  cout << (iter != st.end()) << iter->S;', []],
  ['別名型別：vector 的元素', '#define pii pair<int,int>\n#define F first\n#define S second\n#define ll long long', '  vector<pii> v;\n  v.push_back({3,4});\n  auto iter = v.begin();\n  cout << iter->S << v[0].F;', []],
  ['別名型別：一陣列的 pair', '#define pii pair<int,int>\n#define F first\n#define S second\n#define ll long long', '  pii A[3];\n  A[0].F = 7;\n  cout << A[0].F;', []],
  ['★ 錨點：寫全的 pair 不得被弄壞', '#define pii pair<int,int>\n#define F first\n#define S second\n#define ll long long', '  pair<int,int> p = {3,4};\n  cout << p.first << p.second;', []],
  ['★ 錨點：數值的別名照舊', '#define pii pair<int,int>\n#define F first\n#define S second\n#define ll long long', '  const ll z = 5;\n  cout << z;', []],
  /**
   * 🔴 **CTAD——樣板引數整段被省略**（2026-09-20，語料 `AP325/6/6_9.cpp`）。
   * 症狀是 `RUNTIME_ERR_TYPE_MISMATCH ｜ dp 不是容器`：型別節點是一個裸的
   * `type_identifier`，容器那條路要 `template_type`，於是它掉進一般的變數宣告。
   * ⚠️ 產回去會把省略的那一段補上——**正規化不是缺陷**（判準第三層）。
   */
  ['CTAD：省略的樣板引數（語料 AP325/6/6_9）', '', '  int w = 2, n = 3;\n  vector dp(w+1, vector<int>(n+1));\n  dp[1][2] = 7;\n  cout << dp[1][2] << dp.size() << dp[0].size();', []],
  ['CTAD：填充值是一個數字', '', '  vector v(3, 5);\n  cout << v[0] << v.size();', []],
  ['★ 錨點：寫全的那一種不得被弄壞', '', '  vector<int> a(3, 5);\n  cout << a[0] << a.size();', []],
  ['★ 錨點：推不出來時讓開（複製建構）', '', '  vector<int> src(2, 1);\n  vector cp(src);\n  cout << cp.size();', []],
  ['多宣告子：第二個當陣列大小', 'const int N = 5, K = 3;\nint T[K + 1];', '  cout << N << K << (int)(sizeof(T) / sizeof(T[0]));', []],
  /**
   * 🔴 **參照綁到一個【算出來的位置】**（2026-09-20，語料 `AP325/2/2_5`）。
   *
   * 在此之前兩個綁定點都寫著「引數是一個裸的變數名就綁引用，否則……」
   * ——而那個「否則」是**安靜地改用傳值**。實測**五種形狀全中**，
   * 而五種都是「跑得完的錯答案」：不報錯、有輸出、值是初值。
   *
   * ```
   * void g(int &r){ r = 7; }
   * int a[3]={0,0,0};  g(a[1]);   g++ 印 7，我們印 0
   * struct S{int a;};  g(s.a);    g++ 印 7，我們印 0
   * ```
   *
   * > **「傳參考」與「傳值」在解譯器裡的差別只有【有沒有複製】這一個動作，
   * > 而少做那個動作的症狀，是一個跑得完的錯答案。**
   *
   * 🟢 修法不是新機制：`lvalue.ts` 的 `Place`（`swap(a[j],a[j+1])` 在用）
   *    本來就解得出這些位置——缺的是**讓引用也拿得到它**。
   */
  ['參照①：C 陣列的一格當出參數', 'void g(int &r){ r = 7; }', '  int a[3] = {0,0,0};\n  g(a[1]);\n  cout << a[0] << a[1] << a[2];', []],
  ['參照②：vector 的一格', 'void g(int &r){ r = 7; }', '  vector<int> v(3, 0);\n  g(v[1]);\n  cout << v[0] << v[1];', []],
  ['參照③：struct 陣列的一格', 'struct S{ long long a; long long b; };\nvoid f(S A, S B, S &C){ C.a = A.a + B.a; C.b = A.b * B.b; }',
    '  S A[3];\n  A[0] = {2,3};\n  f(A[0], A[0], A[1]);\n  cout << A[1].a << "," << A[1].b;', []],
  ['參照④：struct 的一個成員', 'struct S{ int a; };\nvoid g(int &r){ r = 7; }', '  S s;\n  s.a = 0;\n  g(s.a);\n  cout << s.a;', []],
  ['參照⑤：把一個參照變數綁到一格', '', '  int a[3] = {0,0,0};\n  int &r = a[1];\n  r = 7;\n  cout << a[0] << a[1];', []],
  ['參照⑥：巢狀——一格的成員當出參數', 'struct S{ int a; };\nvoid g(int &r){ r = 7; }', '  S A[2];\n  A[1].a = 0;\n  g(A[1].a);\n  cout << A[1].a;', []],
  ['★ 錨點：純量變數當出參數照舊', 'void g(int &r){ r = 7; }', '  int a = 0;\n  g(a);\n  cout << a;', []],
  ['★ 錨點：傳值【不得】被改成傳參考', 'void g(int r){ r = 7; }', '  int a[3] = {0,0,0};\n  g(a[1]);\n  cout << a[1];', []],
  ['★ 錨點：const 參照收得下一個算出來的值', 'int twice(const int &r){ return r * 2; }', '  cout << twice(3 + 4);', []],
  ['★ 錨點：整個容器當出參數照舊', 'void fill3(vector<int> &v){ v.push_back(3); }', '  vector<int> v;\n  fill3(v);\n  cout << v.size() << v[0];', []],
  ['★ 錨點：出參數的索引只准算一次', 'void g(int &r){ r = 7; }', '  int a[3] = {0,0,0};\n  int i = 0;\n  g(a[i++]);\n  cout << i << a[0] << a[1];', []],
  /**
   * 🔴 **把一個參照參數再往下傳**（同一族的最後一種形狀）。
   * `findOwner` 逐字「只看 `variables` 不看 `refs`」，所以裸名字那條
   * 對 `h(r)` 裡的 `r` 答不出擁有者 ⟹ 掉到傳值。
   */
  ['參照⑧：把出參數再往下傳一層', 'void h(int &q){ q = 7; }\nvoid g(int &r){ h(r); }', '  int a[3] = {0,0,0};\n  g(a[1]);\n  cout << a[0] << a[1];', []],
  ['參照⑨：再往下傳，而起點是一個純量', 'void h(int &q){ q = 7; }\nvoid g(int &r){ h(r); }', '  int x = 0;\n  g(x);\n  cout << x;', []],
  ['參照⑩：再往下傳，而起點是一個成員', 'struct S{ int a; };\nvoid h(int &q){ q = 7; }\nvoid g(int &r){ h(r); }', '  S s;\n  s.a = 0;\n  g(s.a);\n  cout << s.a;', []],
  ['參照⑦：矩陣快速冪（語料 AP325/2/2_5 的核心）',
    'const long long p = 1000000007;\nstruct s{ long long a; long long b; long long c; long long d; };\n'
    + 'void times(s A, s B, s &C){\n  C.a = (A.a*B.a + A.b*B.c)%p; C.b = (A.a*B.b + A.b*B.d)%p;\n'
    + '  C.c = (A.c*B.a + A.d*B.c)%p; C.d = (A.c*B.b + A.d*B.d)%p; return; }\n'
    + 'long long An(long long n){ if(n <= 0) return 0;\n  s A[100],ans = {1,0,0,1}; A[0] = {1,1,1,0}; int i=-1;\n'
    + '  while(n!=0){ i++; times(A[i],A[i],A[i+1]); if(n&1){ times(A[i],ans,ans); } n >>= 1; }\n  return ans.a; }',
    '  for (int k = 1; k <= 10; k++) cout << An(k) << \' \';', []],
  /**
   * 🔴 **一格的專屬方法**（2026-09-20，語料 `AP325/2/2_7_TLE`）。
   *
   * 依接收者型別分派的那張表拿**接收者的原文**去查名字，而 `d[i]` 不是名字。
   * 既有的釘子逐字寫著它在等「宣告表記得住陣列的元素型別」的那一天
   * ——而那個型別**本來就在手上**（`cpp:array_declare` 的 `properties.type`
   * 逐字是 `bitset<8>`），只是 `recordDeclaration` 把它丟了。
   *
   * > **一個「這個值不該放在這一格」的判斷，如果沒有替它找一格，
   * > 就等於把它刪掉——而刪掉與「本來就沒有」看起來一樣。**
   */
  ['一格的專屬方法①：bitset 陣列', '', '  bitset<8> d[3];\n  d[0].set(2);\n  cout << d[0].count() << d[0][2];\n  d[0].reset();\n  cout << d[0].count();', []],
  ['一格的專屬方法②：vector 裝 bitset', '', '  vector<bitset<8>> vb(2);\n  vb[1].set(3);\n  cout << vb[1].count() << vb[0].count();', []],
  ['★ 錨點：字串陣列的一格仍然走字串的方法', '', '  string s[2];\n  s[0] = "abc";\n  cout << s[0].size() << s[0].substr(1);', []],
  ['★ 錨點：自訂 struct 陣列的一格叫自己的方法', 'struct S{ int a; int get(){ return a; } };', '  S A[2];\n  A[0].a = 3;\n  cout << A[0].get();', []],
  /**
   * 🔴 **`>>` 對 `bool` 只收 `0` 與 `1`**（2026-09-20，語料 `AP325/1/1_11`）。
   * 在此之前 `parseInputValue` 寫的是 `input === 'true' || input === '1'`
   * ——`12` 變成 false 而且**不設 failbit**，於是整片讀下去都不對。
   *
   * > **「這個值是 false」與「這一次讀取失敗了」是兩件事，
   * > 而把後者寫成前者，程式會照常跑完並印出一個錯的答案。**
   */
  /**
   * 🔴 **讀取當迴圈條件**（2026-09-20，第 209 刀）。
   *
   * 語料 **16 支**這樣寫（`while(cin >> n)` 15 支 ＋ `while(getline(cin,s))` 1 支），
   * 而三條最像的路都是對的、只有 `getline` 那一條什麼都不回——
   * 於是條件拿到 `undefined`，迴圈**一次都不進去**。
   *
   * ⚠️ 下面前三條是**正向錨點**（它們一直是對的），第四條才是修的那一個。
   * 少了錨點的話，一支「三條都壞掉」的迴歸與現況產出同一種綠。
   */
  ['讀取當條件①★錨點：while(cin >> n)', '', '  int n;\n  while (cin >> n) { cout << n * 2 << \'\\n\'; }', ['3', '4', '5']],
  ['讀取當條件②★錨點：while(cin >> a >> b)', '', '  int a, b;\n  while (cin >> a >> b) { cout << a + b << \'\\n\'; }', ['1', '2', '3', '4']],
  ['讀取當條件③★錨點：語句位置的 getline 照舊', '', '  string s;\n  getline(cin, s);\n  cout << "[" << s << "]";', ['hello']],
  ['🔴 讀取當條件④：while(getline(cin,s))（AP325/3/3_2）', '',
    '  string s;\n  while (getline(cin, s)) { cout << "[" << s << "]" << \'\\n\'; }', ['ab', 'cd']],
  ['🔴 讀取當條件⑤：if(getline(...)) 讀得到與讀不到', '',
    '  string s;\n  if (getline(cin, s)) cout << "got " << s; else cout << "none";', ['x']],
  /**
   * ⚠️ **這一條本來寫「完全沒有輸入」（`stdin: []`），而那在這個框架裡表達不出來**：
   * 餵給參照編譯器的是 `stdin.join('\n') + '\n'`，所以 `[]` 變成**一個空行**
   * ——g++ 讀得到那一行（印 `got`），而我們的佇列是空的（印 `none`）。
   * **我們是對的，而那次紅是測資不對等。**
   *
   * > **一個把「空」正規化成「一個空的東西」的測資管線，
   * > 量不出「完全沒有」與「有一個空的」的差別。**
   *
   * 🟢 改成「**讀完之後再讀一次**」——兩邊都真的走到 EOF。
   *
   * ⚠️ **而這一條在修好之前【也是綠的】**（拿掉回傳值重跑量過）：
   * `if (undefined)` 與 `if (0)` 一樣是假，所以它答對了而理由是錯的。
   * 留著是因為它守的是**另一件事**（EOF 那一路要回假，不要順手回成真），
   * 但它**不是**抓到這個缺陷的那一條——④⑤⑦ 才是。
   */
  ['讀取當條件⑥★（修好之前也綠）：讀完之後再讀一次要說【假】', '',
    '  string s;\n  getline(cin, s);\n  if (getline(cin, s)) cout << "got " << s; else cout << "none";', ['only']],
  ['🔴 讀取當條件⑦：空行也算讀到（不是 EOF）', '',
    '  string s; int n = 0;\n  while (getline(cin, s)) n++;\n  cout << n;', ['a', '', 'b']],
  /**
   * 🔴 **`for (int i{}; …)` 的起始值曾經是 1**（2026-09-20，第 209 刀）。
   *
   * `int i{}` 是**值初始化**（＝0），而 `from` 拿到的是一顆空的
   * `cpp:initializer_list`，求值之後是 `{ type:'array', value:[] }`，
   * 而 `toNumber` 對**任何** array 回 1（那一行是為「配出來的儲存體不是空指標」
   * 寫的，不能動）。症狀是**迴圈少跑一次**。
   *
   * ⚠️ ①②③是**正向錨點**：語句位置的 `int i{}`、帶值的 `{7}`、
   * 以及一般的 `= 0` 一直都是對的。少了它們，一支「整族都壞」的迴歸看起來一樣。
   */
  ['空大括號①★錨點：語句位置的 int i{}', '', '  int i{};\n  cout << i;', []],
  ['空大括號②★錨點：int i{7} 帶值', '', '  int i{7};\n  cout << i;', []],
  ['空大括號③★錨點：一般的 for(int i = 0; …)', '', '  for (int i = 0; i < 3; i++) cout << i;', []],
  ['🔴 空大括號④：for(int i{}; …) 要從 0 開始（AP325/2/2_8_loop）', '',
    '  for (int i{}; i < 3; i++) cout << i;', []],
  // ⚠️ ⑤ 在修好之前**也是綠的**（量過）——`int n{}` 走的是宣告那一路，一直對。
  //    它守的是「值初始化出來的 0 當上界時迴圈跑 0 次」，不是這一刀修的那個。
  ['空大括號⑤★（修好之前也綠）：值初始化的上界 ⟹ 跑 0 次', '', '  int n{};\n  for (int i = 0; i < n; i++) cout << i;\n  cout << "end";', []],
  ['🔴 空大括號⑥：long long 與 double 的值初始化', '', '  long long a{}; double d{};\n  cout << a << \' \' << d;', []],
  /**
   * 🔴 **複合指定的左邊是 int、右邊是小數 ⟹ 小數部分要被捨去**
   *（2026-09-21，學生的課後回饋逼出來的）。
   *
   * `pay *= 1.1` 的語義是 `pay = pay * 1.1`，而 `pay` 是 `int`
   * ⟹ 結果**截斷**（不是四捨五入）。第 8 課〈做一個：三次加薪〉整題靠這個
   *（22000 → 24200 → 26620 → 29282，而**不是** 22000 × 1.1³ ＝ 29282.0）。
   *
   * ⚠️ **這一族在此之前一條測試都沒有**：既有的複合指定測試全部是
   * `int op= int`，而那一種**不會暴露截斷**。
   *
   * > **一族運算子測了十條而十條都是同一種型別組合，
   * > 那是一條測試，不是十條。**
   */
  ['🔴 截斷①：int *= 小數（第 8 課〈三次加薪〉）', '',
    '  int pay = 22000;\n  pay *= 1.1;\n  pay *= 1.1;\n  pay *= 1.1;\n  cout << pay;', []],
  ['🔴 截斷②：int += 小數', '', '  int a = 10;\n  a += 1.9;\n  cout << a;', []],
  ['🔴 截斷③：int -= 小數', '', '  int b = 10;\n  b -= 0.5;\n  cout << b;', []],
  ['🔴 截斷④：int /= 小數', '', '  int c = 10;\n  c /= 3.0;\n  cout << c;', []],
  ['🔴 截斷⑤：int *= 小於一的小數', '', '  int d = 7;\n  d *= 0.5;\n  cout << d;', []],
  ['🔴 截斷⑥：一般指定也一樣 pay = pay * 1.1', '',
    '  int pay = 22000;\n  pay = pay * 1.1;\n  cout << pay;', []],
  ['★ 截斷⑦錨點：左邊是 double 就【不】截斷', '', '  double x = 10;\n  x *= 1.1;\n  cout << x;', []],
  ['★ 截斷⑧錨點：long long 也截斷', '', '  long long n = 22000;\n  n *= 1.1;\n  cout << n;', []],
  ['★ 截斷⑨錨點：int op= int 照舊（這一族原本只有這一種）', '',
    '  int n = 10;\n  n += 5;\n  n -= 3;\n  n *= 2;\n  n /= 4;\n  n %= 3;\n  cout << n;', []],
  ['布林輸入①：合法的 0 與 1', '', '  bool a, b;\n  cin >> a >> b;\n  cout << a << b;', ['1', '0']],
  ['布林輸入②：數字但不是 0/1 ⟹ failbit ＋ 存 true', '', '  bool a = false, z = false;\n  cin >> a >> z;\n  cout << a << z;', ['12', '1']],
  ['布林輸入③：不是數字 ⟹ failbit ＋ 存 false', '', '  bool a = true, z = true;\n  cin >> a >> z;\n  cout << a << z;', ['abc', '1']],
  ['布林輸入④：failbit 之後每一格都不動', '', '  bool a = false, b = false, c = false;\n  cin >> a >> b >> c;\n  cout << a << b << c;', ['1', '12', '1']],
  ['布林輸入⑤：一整片（語料 AP325/1/1_11 的形狀）', 'bool d2[4][4];',
    '  int m = 2, n = 2;\n  bool x;\n  for (int i = 1; i <= m; i++) for (int j = 1; j <= n; j++) { cin >> x; d2[i][j] = x; }\n'
    + '  cout << d2[1][1] << d2[1][2] << d2[2][1] << d2[2][2];', ['1', '12', '1', '0']],
  ['★ 錨點：整數的讀取失敗照舊存零值', '', '  int x = 9, z = 5;\n  cin >> x >> z;\n  cout << x << "," << z;', ['abc', '3']],
  /**
   * 🔴 **巨集體不是一個值的物件形巨集**（2026-09-20，語料 `w/APCS/j607_trash`）。
   *
   * `#define z -'0'` 的展開文字是**一段運算子片段**，不是一個名字
   * ——別名表裝不下它，而 tree-sitter 在那個位置給一個 `ERROR` 節點。
   * 在這一刀之前**兩條投影都錯，而兩條都不出聲**：執行把 `z` 整個忽略
   *（算成 52），產回去 `(s[0]z)` 變成 `(s[0])`。
   *
   * > **一個「這一段我看不懂」的節點，如果兩條投影都不說，
   * > 那它就不是降級，是一個錯的答案。**
   */
  ['片段巨集①：`-\'0\'`（語料 w/APCS/j607_trash）', "#define z -'0'", '  string s = "47";\n  int x = 0;\n  x = x*10+(s[0]z);\n  x = x*10+(s[1]z);\n  cout << x;', []],
  ['片段巨集②：單獨一次', "#define z -'0'", '  string s = "47";\n  cout << (s[0]z);', []],
  ['片段巨集③：展開文字是一個二元運算', '#define plus1 +1', '  int a = 5;\n  cout << (a plus1);', []],
  ['★ 錨點：一般的物件形巨集照舊', '#define N 100', '  cout << N << N + 1;', []],
  ['★ 錨點：取小名那一族照舊', '#define F first\n#define S second', '  pair<int,int> p = {3,4};\n  cout << p.F << p.S;', []],
  ['★ 錨點：片段巨集不得影響同一支裡的一般巨集', "#define z -'0'\n#define N 3", '  string s = "47";\n  cout << N << (s[1]z);', []],
]

describe('解譯器與參照編譯器：同一段程式，印出來的要一樣', () => {
  it('★ 入口條件：真的有參照編譯器', () => {
    expect(hasReferenceCompiler(), '🔴 沒有 g++ → 下面每一條都在驗空氣').toBe(true)
  })

  for (const [name, glob, body, stdin] of CASES) {
    it(`🔴 ${name}`, async () => {
      /**
       * 🔴 **標頭不手列**（2026-09-18，CI 抓到）。
       *
       * 這裡本來手列八個標頭，而註解寫著「⚠️ 這一行是【判準的一部分】：
       * 少一個標頭，那一題會以『參照編譯器收不下』紅掉」——**那句話是對的，
       * 而它描述的是一個陷阱，不是一個想要的性質**。
       *
       * 它咬過兩次：2026-09-17 缺 `<set>`，2026-09-18 缺 `<queue>` 與 `<tuple>`。
       * 而第二次**本機全綠**——因為本機是 Apple clang（libc++），
       * 它從 `<map>` 遞移帶進那些，而 CI 的 GNU libstdc++ 不會。
       *
       * > **「參照編譯器」不是一個東西。本機那一台比 CI 那一台寬鬆的地方，
       * > 量不出來的不是缺陷——是【我的判準有多寬】。**
       *
       * ⚠️ `bits/stdc++.h` 在 CI 上是真的 GCC 標頭，在本機由
       *    `tests/fixtures/refcc-shim` 提供（`SEMORPHE_REFCC_INCLUDE`）。
       */
      const src = '#include <bits/stdc++.h>\n'
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

  /**
   * 🔴 **[UNSUPPORTED:多維陣列的一格沒有元素型別] `g[0][1].set(1)`**（2026-09-20）
   *
   * 這一刀讓「一格」問得出自己的型別（`bitset<8> d[3]` → `d[i]` 是 `bits`），
   * 而判別走的是**接收者的原文**：`^名字[…]$`，**只認一層下標**。
   *
   * ```
   * bitset<8> d[3];     d[0].set(1)      🟢
   * bitset<8> g[2][2];  g[0][1].set(1)   🔴 兩層，認不出
   * ```
   *
   * **為什麼不是現在**：放寬成「名字後面接幾層都算」是**錯的**——
   * 同一張表會讓 `g[0]`（它是一排 bitset，不是一個 bitset）也答出 `bits`，
   * 而那是一個**猜錯的專屬身分**。`method-components.ts` 逐字：
   * 「型別查不到時不猜——猜一個錯的專屬身分比誠實降級更糟。」
   *
   * 要做對得先記下**維度數**，而宣告表今天只記一個型別字串。
   *
   * > **一個放寬判準就能多接住一族的修法，先問它同時多接住了哪些【不該接】的。**
   *
   * 🟢 而它今天**誠實**：丟 `UNDECLARED_VAR` 並指名
   *「`cpp:array_2d_at` 不是一個物件」——不是一個安靜的錯答案。
   *
   * **何時該修**：宣告表記得住陣列維度數的那一刀（與元素型別同一張表）。
   * ⚠️ 語料 0 處——`AP325/2/2_7_TLE` 用的是一維。
   */
  /**
   * 🔴 **[UNSUPPORTED:串流的狀態查詢] `cin.fail()`／`cin.eof()`**（2026-09-20）
   *
   * 量布林輸入那一族的時候順手撞到的：`cin.fail()` 掉進泛用的方法呼叫，
   * 而求值 `cin` 會丟 `STREAM_NOT_VARIABLE`——**整支程式停住**。
   *
   * 🟢 而 `while (cin >> n)` 那一種**是好的**（`cpp:input` 自己回報成敗），
   *    所以最常見的那條路沒有被擋住。
   *
   * **為什麼不是現在**：`cin` 在這個直譯器裡不是一個物件（`cpp:method_call`
   * 的 `STREAMS` 白名單只放行**不讀走東西**的那幾個方法），要讓
   * `fail`／`eof`／`good`／`clear` 有意義，得先決定「串流的狀態」住在哪裡
   * ——那是一顆元件的設計題，不是一個分支。
   * ⚠️ 語料 0 處。
   *
   * **何時該修**：`cin` 變成一個有狀態的接收者的那一刀。
   */
  it.fails('[UNSUPPORTED:串流的狀態查詢] 🔴 cin.fail() 讀不出來', async () => {
    const src = '#include <bits/stdc++.h>\nusing namespace std;\n'
      + 'int main(){   int x;\n  cin >> x;\n  cout << cin.fail(); return 0; }\n'
    const ref = runCppDetailed(src, 'abc\n')
    expect(ref.ok, '★ 正向錨點：參照編譯器收得下這一段').toBe(true)
    const tree = lifter.lift(parser.parse(src).rootNode as never) as SemanticNode
    const out: string[] = []
    const interp = new SemanticInterpreter({ maxSteps: 200_000 })
    interp.setOutputCallback((x) => out.push(x))
    await interp.execute(tree, ['abc'])
    expect(out.join('')).toBe(ref.output)
  }, 60_000)

  it.fails('[UNSUPPORTED:多維陣列的一格沒有元素型別] 🔴 g[0][1].set(1)', async () => {
    const src = '#include <bits/stdc++.h>\nusing namespace std;\n'
      + 'int main(){   bitset<8> g[2][2];\n  g[0][1].set(1);\n  cout << g[0][1].count(); return 0; }\n'
    const ref = runCppDetailed(src, '\n')
    expect(ref.ok, '★ 正向錨點：參照編譯器收得下這一段').toBe(true)
    const tree = lifter.lift(parser.parse(src).rootNode as never) as SemanticNode
    const out: string[] = []
    const interp = new SemanticInterpreter({ maxSteps: 200_000 })
    interp.setOutputCallback((x) => out.push(x))
    await interp.execute(tree, [])
    expect(out.join('')).toBe(ref.output)
  }, 60_000)
})
