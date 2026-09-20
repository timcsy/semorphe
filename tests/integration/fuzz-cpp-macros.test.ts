/**
 * **資訊隔離盲測：`#define` 這一族**（管線 201 第四關，2026-09-20）
 *
 * 出題的那一側**看不到原始碼**——它只知道「競賽風格的 C++，難度 hard，
 * 會用到 `#define`」。這一關存在的理由逐字寫在 `literal_number/execute.ts`：
 *
 * > 「我寫測試時**不會想到去寫 `5L`**，因為我知道實作只做了 `Number()`。」
 *
 * ## 🔴 這一輪抓到的那一個，我一輩子不會自己寫出來
 *
 * ```cpp
 * cout << MAX((x = 3, x + 1), 2) << " x=" << x;   g++ 印 4 x=3｜我們印 2 x=1
 * ```
 *
 * 根因**不在巨集**，在 tree-sitter：**括號裡的逗號運算式它解錯**，
 * 給出一個 `assignment_expression` ＋ 一個 `ERROR` 節點（`3` 在裡面）
 * ——而我們**把那個 ERROR 安靜吞掉**，產出 `(x = x + 1)`。
 *
 * > **一個解析器的 ERROR 節點如果沒有人看它，
 * > 它會變成一段「乾淨的樹」——而乾淨正是它活下來的原因。**
 *
 * 🟢 修在 `lang/misparse.ts` 的第三條樹修復：同一段文字在**語句位置**
 * tree-sitter 解得完全正確，所以把它搬過去重解。
 *
 * ## ⚠️ 十支裡有九支一次就過——而那不是「這一刀很穩」
 *
 * 出題者寫的是**整片**的 `#define` 家族（字串化、`##`、`#ifdef`／`#undef`
 * 中途改值、巨集名與變數同名、缺括號的優先級陷阱、`#define endl '\n'`）。
 * 九支過的理由是**它們本來就不需要展開**——那些巨集在我們這裡是
 * 常數、別名或函式呼叫，各自誠實。
 *
 * > **一個「九成通過」的盲測，先問那九成裡有幾成是【走到了新程式碼】。**
 *
 * ## ⚠️ 標頭被換成 `bits/stdc++.h`，而那不是改題目
 *
 * 出題者寫的是**手列的標準標頭**（它在 macOS 上沒有 `bits/stdc++.h`）。
 * 而第 120 條護欄**當場擋下**：手列 2 → 3。
 *
 * > **手列 ＝ 宣稱「我列的這幾個在兩套標準函式庫上都夠」，
 * > 而沒有人在檢查那件事。**（那條護欄自己的話）
 *
 * 這個 repo 被同一個坑咬過三次（`<set>`／`<queue>`／`<tuple>` 的遞移引入
 * 在 libc++ 與 libstdc++ 上不同），所以處方是**一律 `bits/stdc++.h`**
 * （本機由 `SEMORPHE_REFCC_INCLUDE` 指到墊片，CI 上是真的 GCC 標頭）。
 * 🟢 換完之後**十支的輸出逐字不變**（重新用 g++ 量過）——換的是標頭，不是題目。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { runCppDetailed, hasReferenceCompiler } from '../helpers/run-cpp'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const S = apcs as unknown as StylePreset
let parser: Parser
let lifter: ReturnType<typeof createTestLifter>

beforeAll(async () => {
  await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  lifter = createTestLifter()
}, 180_000)

const lift = (src: string): SemanticNode =>
  lifter.lift(parser.parse(src)!.rootNode as never) as SemanticNode

/** `[編號, 這支在測什麼, 難在哪, 原始碼, g++ 量到的輸出]` */
const CASES: { id: string; what: string; tricky: string; code: string; out: string }[] = [
  {
    id: "fuzz_1",
    what: "Standard competitive-programming macro header (MAXN, ll, pb, F, S, all, rep, FOR) driving pair sorting, a 2-D DP table and a sort/unique/erase dedup.",
    tricky: "Object-like type and member-access macros (ll, F, S) are spliced into template arguments and member expressions, all() expands to two comma-separated arguments inside a call, and one macro is defined but never used.",
    code: "#include <bits/stdc++.h>\nusing namespace std;\n\n#define MAXN 200005\n#define ll long long\n#define pb push_back\n#define F first\n#define S second\n#define all(v) (v).begin(), (v).end()\n#define rep(i, n) for (int i = 0; i < (n); i++)\n#define FOR(i, a, b) for (int i = (a); i <= (b); i++)\n#define UNUSED_LIMIT 1000000007\n\nint cnt[MAXN];\nll grid[12][12];\n\nint main() {\n    vector<pair<int, ll> > v;\n    rep(i, 8) v.pb(make_pair((int)((i * 37) % 11), (ll)i * i - 3));\n    sort(all(v));\n\n    rep(i, (int)v.size()) cout << v[i].F << \":\" << v[i].S << (i + 1 == (int)v.size() ? '\\n' : ' ');\n\n    FOR(i, 1, 10) FOR(j, 1, 10) grid[i][j] = grid[i - 1][j] + grid[i][j - 1] + ((i == 1 && j == 1) ? 1 : 0);\n    cout << grid[10][10] << \"\\n\";\n\n    rep(i, 8) cnt[v[i].F]++;\n    ll tot = 0;\n    FOR(k, 0, 10) tot += (ll)cnt[k] * k;\n    cout << \"tot=\" << tot << \"\\n\";\n\n    vector<int> w;\n    rep(i, 20) w.pb((i * i) % 7);\n    sort(all(w));\n    w.erase(unique(all(w)), w.end());\n    rep(i, (int)w.size()) cout << w[i] << \" \";\n    cout << \"\\n\";\n    cout << \"sz=\" << w.size() << \" max=\" << *max_element(all(w)) << \"\\n\";\n    return 0;\n}\n",
    out: "0:-3 1:6 2:33 4:-2 5:13 6:46 8:1 9:22\n48620\ntot=35\n0 1 2 4 \nsz=4 max=4\n",
  },
  {
    id: "fuzz_2",
    what: "The classic missing-parentheses precedence traps: SQ(1+2), CUBE(2+0), HALF(3+3), 100/SQ(5), NEG(4-9) and 2*ADD(3,4) next to their correctly parenthesised counterparts.",
    tricky: "Every unparenthesised macro yields a surprising but well-defined answer (SQ(1+2) is 5 and 100/SQ(5) is 100), so anything that reads the macro as a function instead of a token substitution gets different numbers.",
    code: "#include <bits/stdc++.h>\nusing namespace std;\n\n/* The classic missing-parentheses traps. Every line below is legal C++,\n   but the answers are not what a careless reader expects. */\n#define SQ(x) x*x\n#define SAFE_SQ(x) ((x) * (x))\n#define CUBE(x) x*x*x\n#define HALF(x) x / 2\n#define NEG(x) -x\n#define ADD(a, b) a + b\n\nint a[6] = {1, 2, 3, 4, 5, 6};\n#define DBL(i) a[i] * 2\n\nint main() {\n    cout << \"SQ(1+2)=\" << SQ(1 + 2) << \"\\n\";\n    cout << \"SAFE_SQ(1+2)=\" << SAFE_SQ(1 + 2) << \"\\n\";\n    cout << \"CUBE(2+0)=\" << CUBE(2 + 0) << \"\\n\";\n    cout << \"HALF(3+3)=\" << HALF(3 + 3) << \"\\n\";\n    cout << \"100/SQ(5)=\" << 100 / SQ(5) << \"\\n\";\n    cout << \"NEG(4-9)=\" << NEG(4 - 9) << \"\\n\";\n    cout << \"2*ADD(3,4)=\" << 2 * ADD(3, 4) << \"\\n\";\n    cout << \"DBL(1)+1=\" << DBL(1) + 1 << \"\\n\";\n\n    int bad = 0, good = 0;\n    for (int i = 0; i < 5; i++) {\n        bad += SQ(i + 1);\n        good += SAFE_SQ(i + 1);\n    }\n    cout << \"bad=\" << bad << \" good=\" << good << \"\\n\";\n\n    vector<int> v;\n    for (int i = 0; i < 6; i++) v.push_back(SAFE_SQ(i) - HALF(i + 1));\n    sort(v.begin(), v.end());\n    for (size_t i = 0; i < v.size(); i++) cout << v[i] << (i + 1 == v.size() ? '\\n' : ',');\n\n    long long acc = 0;\n    for (int i = 1; i <= 4; i++) acc += (long long)CUBE(i) + SQ(i);\n    cout << \"acc=\" << acc << \"\\n\";\n    return 0;\n}\n",
    out: "SQ(1+2)=5\nSAFE_SQ(1+2)=9\nCUBE(2+0)=2\nHALF(3+3)=4\n100/SQ(5)=100\nNEG(4-9)=-13\n2*ADD(3,4)=10\nDBL(1)+1=5\nbad=25 good=55\n0,0,2,6,12,20\nacc=130\n",
  },
  {
    id: "fuzz_3",
    what: "Loop-header macros (rep/per/FOR/ROF) used nested, as the body of another loop macro, and as the brace-free body of if/else, over Pascal's triangle and a reverse-iterated knapsack.",
    tricky: "A macro that expands to a bare for-header is a single statement, so `rep(i,6) if(...) ...; else ...;` and `rep(i,4) ROF(w,W,wt[i]) if(...)...;` bind in ways that depend on parsing the expansion, not the source line.",
    code: "#include <bits/stdc++.h>\nusing namespace std;\n\n#define rep(i, n) for (int i = 0; i < (n); i++)\n#define per(i, n) for (int i = (n) - 1; i >= 0; i--)\n#define FOR(i, a, b) for (int i = (a); i <= (b); i++)\n#define ROF(i, a, b) for (int i = (a); i >= (b); i--)\n#define sz(v) ((int)(v).size())\n\nint main() {\n    // loop macro as the body of an if / else, with no braces anywhere\n    rep(i, 6) if (i & 1) cout << \"o\" << i;\n    else cout << \"E\" << i;\n    cout << \"\\n\";\n\n    // loop macro directly as the body of another loop macro\n    vector<vector<int> > tri(6);\n    rep(i, 6) {\n        tri[i].assign(i + 1, 1);\n        FOR(j, 1, i - 1) tri[i][j] = tri[i - 1][j - 1] + tri[i - 1][j];\n    }\n    rep(i, 6) {\n        rep(j, sz(tri[i])) cout << tri[i][j] << (j + 1 == sz(tri[i]) ? \"\" : \" \");\n        cout << \"\\n\";\n    }\n\n    // reverse loop macro rewriting a knapsack in place\n    const int W = 15;\n    vector<int> dp(W + 1, 0);\n    int wt[4] = {3, 4, 5, 9};\n    int val[4] = {4, 5, 8, 10};\n    rep(i, 4) ROF(w, W, wt[i]) if (dp[w - wt[i]] + val[i] > dp[w]) dp[w] = dp[w - wt[i]] + val[i];\n    cout << \"knap=\" << dp[W] << \"\\n\";\n\n    // nested three deep, innermost is an if/else with no braces\n    string s;\n    per(i, 3) rep(j, 3) if ((i + j) % 2 == 0) s += char('a' + i * 3 + j);\n    else s += char('A' + i * 3 + j);\n    cout << s << \"\\n\";\n\n    long long acc = 0;\n    FOR(i, 1, 5) ROF(j, 5, i) acc += (long long)i * j;\n    cout << \"acc=\" << acc << \"\\n\";\n    return 0;\n}\n",
    out: "E0o1E2o3E4o5\n1\n1 1\n1 2 1\n1 3 3 1\n1 4 6 4 1\n1 5 10 10 5 1\nknap=18\ngHiDeFaBc\nacc=140\n",
  },
  {
    id: "fuzz_4",
    what: "Conditional compilation with #ifdef/#ifndef/#else/#endif and #if defined(...), plus a mid-file #undef and redefinition of LIMIT, around modular exponentiation.",
    tricky: "The value of LIMIT changes half-way through main, so the same spelled token means 100 on one line and 7 twenty lines later, and the debug macro compiles away to ((void)0).",
    code: "#include <bits/stdc++.h>\nusing namespace std;\n\n#define ONLINE_JUDGE 1\n\n#ifdef LOCAL\n#define dbg(x) cout << \"[dbg] \" << (x) << \"\\n\"\n#define TRACE_ON 1\n#else\n#define dbg(x) ((void)0)\n#define TRACE_ON 0\n#endif\n\n#ifndef MOD\n#define MOD 1000000007LL\n#endif\n\n#ifdef ONLINE_JUDGE\n#define LIMIT 100\n#else\n#define LIMIT 10\n#endif\n\n#if defined(ONLINE_JUDGE) && !defined(LOCAL)\n#define MODE \"judge\"\n#else\n#define MODE \"local\"\n#endif\n\ntypedef long long ll;\n\nll pw(ll b, ll e) {\n    ll r = 1;\n    b %= MOD;\n    while (e > 0) {\n        if (e & 1) r = r * b % MOD;\n        b = b * b % MOD;\n        e >>= 1;\n    }\n    return r;\n}\n\nint main() {\n    cout << \"mode=\" << MODE << \" trace=\" << TRACE_ON << \" limit=\" << LIMIT << \"\\n\";\n    dbg(12345);\n\n    ll s = 0;\n    for (int i = 1; i <= 20; i++) s = (s + pw(i, LIMIT)) % MOD;\n    cout << \"s=\" << s << \"\\n\";\n\n// LIMIT gets retired half-way through the file, then comes back smaller\n#undef LIMIT\n#define LIMIT 7\n    cout << \"limit2=\" << LIMIT << \"\\n\";\n\n    vector<ll> f(LIMIT + 1, 1);\n    for (int i = 2; i <= LIMIT; i++) f[i] = f[i - 1] * i % MOD;\n    for (int i = 0; i <= LIMIT; i++) cout << f[i] << (i == LIMIT ? '\\n' : ' ');\n\n    cout << \"inv2=\" << pw(2, MOD - 2) << \"\\n\";\n    cout << \"check=\" << (2 * pw(2, MOD - 2)) % MOD << \"\\n\";\n    return 0;\n}\n",
    out: "mode=judge trace=0 limit=100\ns=11630002\nlimit2=7\n1 1 2 6 24 120 720 5040\ninv2=500000004\ncheck=1\n",
  },
  {
    id: "fuzz_5",
    what: "A function-like macro MAX/MIN whose name is also a global variable, alongside an ordinary function sq() shadow-named against the macro SQ().",
    tricky: "`MAX` with no following '(' is the variable 1000 while `MAX(3,9)` is the macro, and both spellings appear in the same expression (`MIN(SQ(b[i].hi), MAX)`).",
    code: "#include <bits/stdc++.h>\nusing namespace std;\n\n#define MAX(a, b) ((a) > (b) ? (a) : (b))\n#define MIN(a, b) ((a) < (b) ? (a) : (b))\n#define SQ(x) ((long long)(x) * (x))\n#define rep(i, n) for (int i = 0; i < (n); i++)\n\n// MAX is a function-like macro, so a bare `MAX` with no '(' after it is just\n// an ordinary identifier -- this global variable is perfectly legal.\nlong long MAX = 1000;\nint MIN = -5;\n\n// an ordinary function whose name only differs in case from the macro\nlong long sq(int x) { return (long long)x * x; }\n\nstruct Box {\n    int lo, hi;\n    int width() const { return hi - lo; }\n};\n\nint main() {\n    cout << \"MAX=\" << MAX << \" MIN=\" << MIN << \"\\n\";\n    cout << MAX(3, 9) << \" \" << MIN(3, 9) << \"\\n\";\n\n    MAX += MAX(100, 250);\n    cout << \"MAX=\" << MAX << \"\\n\";\n\n    cout << \"sq(7)=\" << sq(7) << \" SQ(7)=\" << SQ(7) << \" SQ(sq(2))=\" << SQ(sq(2)) << \"\\n\";\n\n    vector<Box> b;\n    b.push_back({2, 9});\n    b.push_back({-3, 4});\n    b.push_back({0, 0});\n    b.push_back({5, 20});\n\n    int best = MIN;\n    rep(i, (int)b.size()) best = MAX(best, b[i].width());\n    cout << \"best=\" << best << \"\\n\";\n\n    sort(b.begin(), b.end(), [](const Box &x, const Box &y) { return MAX(x.lo, x.hi) < MAX(y.lo, y.hi); });\n    rep(i, (int)b.size()) cout << \"[\" << b[i].lo << \",\" << b[i].hi << \"]\";\n    cout << \"\\n\";\n\n    long long tot = 0;\n    rep(i, (int)b.size()) tot += MIN(SQ(b[i].hi), MAX);\n    cout << \"tot=\" << tot << \" MAXvar=\" << MAX << \"\\n\";\n    return 0;\n}\n",
    out: "MAX=1000 MIN=-5\n9 3\nMAX=1250\nsq(7)=49 SQ(7)=49 SQ(sq(2))=16\nbest=15\n[0,0][-3,4][2,9][5,20]\ntot=497 MAXvar=1250\n",
  },
  {
    id: "fuzz_6",
    what: "Macro arguments containing commas inside parentheses: MAX(add2(1,2),3), nested MIN3, a comma operator argument, and an object-like macro hiding a template comma.",
    tricky: "Argument splitting happens on unparenthesised commas only, MIN3 is defined before MIN exists and is only rescanned at use, and PII hides a comma that would otherwise split the argument list.",
    code: "#include <bits/stdc++.h>\nusing namespace std;\n\n// MIN3 is written before MIN exists -- legal, because the body is only\n// rescanned when MIN3 is actually used.\n#define MIN3(a, b, c) MIN(a, MIN(b, c))\n#define MIN(a, b) ((a) < (b) ? (a) : (b))\n#define MAX(a, b) ((a) > (b) ? (a) : (b))\n#define PII pair<int, int>\n#define APPLY2(f, a, b) ((f)((a), (b)))\n#define GAP(p) ((p).second - (p).first)\n\nint add2(int a, int b) { return a + b; }\nint mul2(int a, int b) { return a * b; }\n\nint main() {\n    // every comma below sits inside parentheses, so each call has the arity it looks like\n    cout << MAX(add2(1, 2), 3) << \"\\n\";\n    cout << MIN3(add2(4, 5), 7, add2(1, 1)) << \"\\n\";\n    cout << MAX(mul2(3, 4), MIN(add2(2, 2), 10)) << \"\\n\";\n    cout << APPLY2(add2, mul2(2, 3), mul2(4, 5)) << \"\\n\";\n\n    // a comma operator inside a macro argument\n    int x = 0;\n    cout << MAX((x = 3, x + 1), 2) << \" x=\" << x << \"\\n\";\n\n    // an object-like macro hides the comma in the template argument list\n    cout << \"pairsz=\" << (int)sizeof(PII) << \" ok=\" << MAX((int)sizeof(PII), 4) << \"\\n\";\n\n    vector<PII> v;\n    v.push_back(PII(1, 9));\n    v.push_back(PII(4, 5));\n    v.push_back(PII(-2, 8));\n    v.push_back(PII(3, 3));\n    sort(v.begin(), v.end(), [](const PII &p, const PII &q) { return MAX(GAP(p), 0) > MAX(GAP(q), 0); });\n    for (size_t i = 0; i < v.size(); i++) cout << \"(\" << v[i].first << \",\" << v[i].second << \")\";\n    cout << \"\\n\";\n\n    int best = -1000;\n    for (size_t i = 0; i < v.size(); i++)\n        for (size_t j = i + 1; j < v.size(); j++)\n            best = MAX(best, MIN3(GAP(v[i]), GAP(v[j]), add2(v[i].first, v[j].second)));\n    cout << \"best=\" << best << \"\\n\";\n\n    cout << MIN3(MAX(1, 2), MAX(3, 0), MAX(add2(0, 0), mul2(1, 1))) << \"\\n\";\n    return 0;\n}\n",
    out: "3\n2\n12\n26\n4 x=3\npairsz=8 ok=8\n(-2,8)(1,9)(4,5)(3,3)\nbest=7\n1\n",
  },
  {
    id: "fuzz_7",
    what: "Whole-statement macros: a do/while(0) SWAP and YESNO, a brace-block SUMINTO, and a brace-less UPDATE if-statement, driving a bubble sort and an in-place reversal.",
    tricky: "SWAP expands to a do/while(0) so `if (a>b) SWAP(a,b); else PRINT2(a,b);` is legal with no braces anywhere, while SUMINTO expands to a compound statement followed by a stray empty statement.",
    code: "#include <bits/stdc++.h>\nusing namespace std;\n\n#define SWAP(a, b) do { int _t = (a); (a) = (b); (b) = _t; } while (0)\n#define YESNO(c) do { if (c) cout << \"YES\\n\"; else cout << \"NO\\n\"; } while (0)\n#define PRINT2(a, b) cout << (a) << ' ' << (b) << '\\n'\n#define SUMINTO(s, v) { s = 0; for (size_t _i = 0; _i < (v).size(); _i++) s += (v)[_i]; }\n#define UPDATE(best, cand) if ((cand) > (best)) best = (cand)\n#define rep(i, n) for (int i = 0; i < (n); i++)\n\nint main() {\n    int a = 9, b = 4;\n    // the do/while(0) wrapper is what makes this brace-free if/else legal\n    if (a > b) SWAP(a, b);\n    else PRINT2(a, b);\n    PRINT2(a, b);\n\n    YESNO(a < b);\n    YESNO(a * b == 35);\n\n    vector<int> v;\n    rep(i, 9) v.push_back(((i * 5) % 7) - 3);\n\n    long long s = 0;\n    SUMINTO(s, v);\n    cout << \"s=\" << s << \"\\n\";\n\n    int best = -100;\n    rep(i, (int)v.size()) UPDATE(best, v[i] * (i % 3 == 0 ? 2 : 1));\n    cout << \"best=\" << best << \"\\n\";\n\n    // bubble sort where the swap macro is the whole body of a brace-free if\n    rep(i, (int)v.size()) rep(j, (int)v.size() - 1) if (v[j] > v[j + 1]) SWAP(v[j], v[j + 1]);\n    rep(i, (int)v.size()) cout << v[i] << (i + 1 == (int)v.size() ? '\\n' : ' ');\n\n    int lo = 0, hi = (int)v.size() - 1;\n    string pal;\n    while (lo < hi) {\n        SWAP(v[lo], v[hi]);\n        lo++;\n        hi--;\n    }\n    rep(i, (int)v.size()) pal += to_string(v[i]) + (i + 1 == (int)v.size() ? \"\" : \"|\");\n    cout << pal << \"\\n\";\n\n    long long s2 = 0;\n    SUMINTO(s2, v);\n    YESNO(s2 == s);\n    return 0;\n}\n",
    out: "4 9\nYES\nNO\ns=-1\nbest=3\n-3 -3 -2 -1 0 1 2 2 3\n3|2|2|1|0|-1|-2|-3|-3\nYES\n",
  },
  {
    id: "fuzz_8",
    what: "Macros interleaved with typedef and using aliases: `#define ll long long` feeding `typedef ll big;` and `using bigger = ll;`, plus `#define endl '\\n'` shadowing std::endl.",
    tricky: "A macro standing for a multi-token type keyword is fed through typedef and using declarations, and endl is redefined to a char literal so every stream insertion of endl is really a character, not the std manipulator.",
    code: "#include <bits/stdc++.h>\nusing namespace std;\n\n#define ll long long\n#define endl '\\n'\n#define pb push_back\n#define mp make_pair\n\n// aliases built on top of a macro that is itself a type keyword sandwich\ntypedef pair<int, int> pii;\ntypedef ll big;\nusing vi = vector<int>;\nusing vll = vector<ll>;\nusing ull = unsigned long long;\nusing bigger = ll;\ntypedef vector<pii> vpii;\n\n#define vpll vector<pair<ll, ll> >\n\nbig tri(int n) { return (big)n * (n + 1) / 2; }\n\nbigger mix(bigger a, ll b) { return a * 31 + b; }\n\nint main() {\n    vll xs;\n    for (int i = 1; i <= 8; i++) xs.pb((ll)i * i * i - 10 * i);\n    sort(xs.begin(), xs.end());\n    for (size_t i = 0; i < xs.size(); i++) cout << xs[i] << (i + 1 == xs.size() ? ' ' : ',');\n    cout << endl;\n\n    vpii ps;\n    ps.pb(mp(3, 1));\n    ps.pb(mp(1, 4));\n    ps.pb(mp(1, 2));\n    sort(ps.begin(), ps.end());\n    for (size_t i = 0; i < ps.size(); i++) cout << ps[i].first << \"/\" << ps[i].second << \" \";\n    cout << endl;\n\n    vpll q;\n    q.pb(mp((ll)1 << 40, (ll)-3));\n    q.pb(mp((ll)5, (ll)7));\n    cout << q[0].first + q[1].first << \" \" << q[0].second * q[1].second << endl;\n\n    map<string, vi> m;\n    m[\"odd\"] = vi();\n    m[\"even\"] = vi();\n    for (int i = 0; i < 10; i++) m[i % 2 ? \"odd\" : \"even\"].pb(i * i);\n    for (map<string, vi>::iterator it = m.begin(); it != m.end(); ++it) {\n        cout << it->first << \":\";\n        for (size_t k = 0; k < it->second.size(); k++) cout << \" \" << it->second[k];\n        cout << endl;\n    }\n\n    ull h = 1469598103934665603ULL;\n    for (char c = 'a'; c <= 'f'; c++) h = (h ^ (ull)c) * 1099511628211ULL;\n    cout << \"h=\" << h << endl;\n\n    big t = tri(1000);\n    bigger r = mix(t, (ll)xs.size());\n    cout << \"tri=\" << t << \" mix=\" << r << endl;\n    cout << \"sizes \" << sizeof(ll) << \" \" << sizeof(big) << \" \" << sizeof(bigger) << endl;\n    return 0;\n}\n",
    out: "-12,-9,-3,24,75,156,273,432 \n1/2 1/4 3/1 \n1099511627781 -21\neven: 0 4 16 36 64\nodd: 1 9 25 49 81\nh=7212980802197362836\ntri=500500 mix=15515508\nsizes 8 8 8\n",
  },
  {
    id: "fuzz_9",
    what: "Stringification (#), token pasting (##), the STR/XSTR expand-then-stringify idiom, a macro that forward-references a later-defined macro, and a macro that is never used.",
    tricky: "STR(VERSION) prints VERSION while XSTR(VERSION) prints 7, XSTR(TWICE(4)) prints the fully expanded text `(((4) * 2))`, and DECL(11) pastes a brand-new identifier var11 into existence.",
    code: "#include <bits/stdc++.h>\nusing namespace std;\n\n#define NEVER_USED 424242\n#define VERSION 7\n\n// TWICE is defined before DOUBLE_IT exists; the body is only rescanned at use\n#define TWICE(x) (DOUBLE_IT(x))\n#define DOUBLE_IT(x) ((x) * 2)\n\n// one macro whose whole body is another macro's name\n#define LIMIT_NAME MAXV\n#define MAXV 50\n\n#define STR(x) #x\n#define XSTR(x) STR(x)\n#define CAT(a, b) a##b\n#define DECL(n) int CAT(var, n) = (n) * (n)\n#define DBG(...) cout << #__VA_ARGS__ << \" = \" << (__VA_ARGS__) << \"\\n\"\n\nint add2(int a, int b) { return a + b; }\n\nint main() {\n    cout << TWICE(5) << \" \" << TWICE(1 + 2) << \" \" << DOUBLE_IT(TWICE(3)) << \"\\n\";\n    cout << \"limit=\" << LIMIT_NAME << \" twice=\" << TWICE(LIMIT_NAME) << \"\\n\";\n\n    // the classic stringify-vs-expand pair\n    cout << STR(VERSION) << \" \" << XSTR(VERSION) << \"\\n\";\n    cout << STR(add2(1, 2)) << \" \" << XSTR(TWICE(4)) << \"\\n\";\n\n    DECL(3);\n    DECL(11);\n    cout << var3 << \" \" << var11 << \" \" << CAT(var, 3) + CAT(var, 11) << \"\\n\";\n\n    DBG(add2(1, 2) + 3);\n    DBG(MAXV);\n    DBG(TWICE(6));\n\n    vector<int> v;\n    for (int i = 0; i < 10; i++) v.push_back(TWICE(i) % LIMIT_NAME);\n    sort(v.begin(), v.end(), [](int a, int b) { return DOUBLE_IT(a) > DOUBLE_IT(b); });\n    for (size_t i = 0; i < v.size(); i++) cout << v[i] << (i + 1 == v.size() ? '\\n' : ' ');\n\n    string tag = XSTR(MAXV) + string(\"-\") + STR(MAXV);\n    cout << tag << \" len=\" << tag.size() << \"\\n\";\n\n    long long acc = 0;\n    for (int i = 1; i <= 6; i++) acc += TWICE(i * i) - DOUBLE_IT(i);\n    cout << \"acc=\" << acc << \"\\n\";\n    return 0;\n}\n",
    out: "10 6 12\nlimit=50 twice=100\nVERSION 7\nadd2(1, 2) (((4) * 2))\n9 121 130\nadd2(1, 2) + 3 = 6\nMAXV = 50\nTWICE(6) = 12\n18 16 14 12 10 8 6 4 2 0\n50-MAXV len=7\nacc=140\n",
  },
  {
    id: "fuzz_10",
    what: "Contest shorthand macros (all, rall, sz, rep, per, each, lb) over dedup, an LIS by patience sorting, a recursive lambda and a custom string comparator.",
    tricky: "`all(v)` is deliberately unparenthesised and expands to two arguments, `lb(v,x)` nests all() inside another macro inside a subtraction, and sz()/each() are used inside lambda bodies and reverse loop headers.",
    code: "#include <bits/stdc++.h>\nusing namespace std;\n\n#define all(v) v.begin(), v.end()\n#define rall(v) v.rbegin(), v.rend()\n#define sz(v) ((int)(v).size())\n#define per(i, a, b) for (int i = (a); i >= (b); i--)\n#define rep(i, n) for (int i = 0; i < (n); i++)\n#define each(x, v) for (auto &x : v)\n#define lb(v, x) ((int)(lower_bound(all(v), x) - v.begin()))\n#define ll long long\n\nll gcdrec(ll a, ll b) { return b == 0 ? a : gcdrec(b, a % b); }\n\nint main() {\n    vector<int> v;\n    rep(i, 12) v.push_back((i * 7 + 3) % 13);\n    sort(all(v));\n    v.erase(unique(all(v)), v.end());\n    each(x, v) cout << x << \" \";\n    cout << \"\\n\";\n    cout << \"sz=\" << sz(v) << \" lb(6)=\" << lb(v, 6) << \" lb(100)=\" << lb(v, 100) << \"\\n\";\n\n    vector<int> r(v);\n    sort(rall(r));\n    rep(i, sz(r)) cout << r[i] << (i + 1 == sz(r) ? '\\n' : '-');\n\n    // longest increasing subsequence, patience style, macros all the way down\n    int arr[10] = {5, 1, 6, 2, 8, 3, 9, 4, 7, 0};\n    vector<int> tails;\n    rep(i, 10) {\n        int p = lb(tails, arr[i]);\n        if (p == sz(tails)) tails.push_back(arr[i]);\n        else tails[p] = arr[i];\n    }\n    cout << \"lis=\" << sz(tails) << \"\\n\";\n\n    // recursive lambda plus a reverse loop macro in its body\n    function<ll(int)> fib = [&](int n) -> ll {\n        if (n < 2) return n;\n        return fib(n - 1) + fib(n - 2);\n    };\n    vector<ll> fs;\n    per(i, 15, 10) fs.push_back(fib(i));\n    each(f, fs) cout << f << \" \";\n    cout << \"\\n\";\n\n    ll g = 0;\n    each(f, fs) g = gcdrec(g, f);\n    cout << \"g=\" << g << \" gcd(462,1071)=\" << gcdrec(462, 1071) << \"\\n\";\n\n    vector<string> names;\n    names.push_back(\"delta\");\n    names.push_back(\"al\");\n    names.push_back(\"charlie\");\n    names.push_back(\"bo\");\n    sort(all(names), [](const string &a, const string &b) {\n        if (sz(a) != sz(b)) return sz(a) < sz(b);\n        return a < b;\n    });\n    each(s, names) cout << s << \"(\" << sz(s) << \")\";\n    cout << \"\\n\";\n\n    ll tot = 0;\n    per(i, sz(v) - 1, 0) tot = tot * 2 + v[i];\n    cout << \"tot=\" << tot << \"\\n\";\n    return 0;\n}\n",
    out: "0 1 2 3 4 5 6 7 8 10 11 12 \nsz=12 lb(6)=6 lb(100)=12\n12-11-10-8-7-6-5-4-3-2-1-0\nlis=5\n610 377 233 144 89 55 \ng=1 gcd(462,1071)=21\nal(2)bo(2)delta(5)charlie(7)\ntot=44546\n",
  },
]

describe('盲測：`#define` 這一族（10 支，g++ 當權威）', () => {
  it('★ 入口條件——參照編譯器在不在（否則下面每一支都在驗空氣）', () => {
    expect(hasReferenceCompiler()).toBe(true)
  })

  for (const c of CASES) {
    /**
     * 三件事一起量：
     * ① **產回去跑出來一樣**——拿 g++ 當權威（不是拿我記下來的字串）
     * ② **不動點**——再 lift 一次產出逐字相同
     * ③ **入口條件**——原文自己在 g++ 上真的印出那一段
     */
    it(`${c.id}：${c.what}`, () => {
      const ref = runCppDetailed(c.code)
      expect(ref.ok, `🔴 參照編譯器收不下（測試自己的問題）：${ref.ok ? '' : ref.message}`).toBe(true)
      expect(ref.output, '🔴 原文在 g++ 上印的東西變了——先修這一支的入口條件').toBe(c.out)

      const once = generateCode(lift(c.code), 'cpp', S)
      expect(generateCode(lift(once), 'cpp', S), '🔴 來回一趟就走樣了').toBe(once)

      const mine = runCppDetailed(once)
      expect(mine.ok, `🔴 產出的程式碼編不過：${mine.ok ? '' : mine.message}`).toBe(true)
      expect(mine.output, `🔴 產出的程式碼跑出別的東西——${c.tricky}`).toBe(c.out)
    }, 60_000)
  }
})
