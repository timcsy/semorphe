/**
 * **盲測的回歸：範圍演算法（第一輪）** —— 2026-09-18，管線 188 的階段四。
 *
 * ## 出題的人看不到原始碼
 *
 * 出題者在一個隔離的 worktree 裡，只知道 C++ 與「寫真實的學生程式」。
 * 它寫的十支**每一支都真的編過、跑過兩次、輸出逐位元相同**。
 *
 * ## 讀數：**2/10 PASS**，而那是一個好消息
 *
 * 八支失敗**沒有一支是語義錯**——全部是 `UNDEFINED_FUNC`（缺元件），
 * 加上**一個真缺陷**：
 *
 * ```
 * int a[8];  max_element(&a[0], &a[8]);     🔴 INDEX_OUT_OF_RANGE: 8
 * ```
 *
 * `&a[n]` 是**結尾指標的慣用寫法**，而**取位址不讀那一格**
 * ——那一條當場修了（`cpp:address_of`）。
 *
 * > **一個「不會讀」的運算，不該被「讀得到嗎」擋下來。**
 *
 * ## 🟠 其餘八支釘在這裡，而它們的阻斷者與觸發條件都寫死了
 *
 * 缺的那些範圍演算法**語料 0 處**（218 支學生程式一次都沒用到），
 * 而盲測抓到它們，是因為出題者寫的是**競賽風格的真實學生程式**——
 * 兩個母體不一樣。
 *
 * 🔴 **何時該修：管線 189「範圍演算法的第二批」**——
 * 而它們現在做得起來了，理由是這一刀：`resolveRange` 換成「求值兩個接點」之後，
 * 一顆新的範圍演算法只剩下「它自己那幾行」。
 *
 * ⚠️ 上一次有一根釘子寫了「那一天回來拔」而沒有人回來，缺陷換了一個形狀活下去
 *（見 `set_insert/execute.ts`）。**這一批不要重蹈。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { runCppDetailed, hasReferenceCompiler } from '../helpers/run-cpp'
import type { SemanticNode } from '../../src/core/types'

let parser: Parser
let lifter: ReturnType<typeof createTestLifter>
beforeAll(async () => {
  await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  lifter = createTestLifter()
}, 120_000)

/**
 * ⚠️ **標頭不手列**——`bits/stdc++.h` 在 CI 上是真的 GCC 標頭，在本機由
 *    `tests/fixtures/refcc-shim` 提供。手列的話本機綠而 CI 紅（第一百二十條）。
 */
const H = '#include <bits/stdc++.h>\nusing namespace std;\n'

async function same(body: string, hint: string): Promise<void> {
  const src = `${H}int main() {\n${body}\n  return 0;\n}\n`
  const ref = runCppDetailed(src)
  expect(ref.ok, `🔴 參照編譯器收不下（測試自己的問題）：${ref.ok ? '' : ref.message}`).toBe(true)
  const out: string[] = []
  const interp = new SemanticInterpreter({ maxSteps: 400_000 })
  interp.setOutputCallback((x) => out.push(x))
  await interp.execute(lifter.lift(parser.parse(src)!.rootNode as never) as SemanticNode, [])
  expect(out.join(''), hint).toBe(ref.output)
}

describe.runIf(hasReferenceCompiler())('模糊測試的回歸：範圍演算法（第一輪）', () => {
  it.fails('[UNSUPPORTED:adjacent_difference] 🟠 fuzz_1｜Pointer ranges over a raw array with an in-place partial_sum and adjacent_difference that undoes it, plus an empty accumulate range.', async () => {
    // 🟠 **為什麼不現在修**：缺的是 `adjacent_difference`——**新元件，不是做不到**。
    //    語料 **0 處**（218 支學生程式一次都沒用到），而盲測抓到它是因為
    //    出題者寫的是競賽風格的真實學生程式——**兩個母體不一樣**。
    // 🔴 何時該修：管線 189「範圍演算法的第二批」。
    //    它們現在做得起來了：`resolveRange` 換成「求值兩個接點」之後，
    //    一顆新的範圍演算法只剩下「它自己那幾行」。
    await same(`int a[8] = {3, -1, 4, 1, -5, 9, 2, -6};
    int n = 8;
    partial_sum(a, a + n, a);
    for (int i = 0; i < n; i++) cout << a[i] << (i + 1 < n ? ' ' : '\\n');
    int *p = max_element(&a[0], &a[n]);
    cout << "max=" << *p << " at " << (p - &a[0]) << '\\n';
    cout << "empty=" << accumulate(&a[0], &a[0], 100) << '\\n';
    adjacent_difference(a, a + n, a);
    cout << "back=" << a[4] << " len=" << (end(a) - begin(a)) << '\\n';`, '🟠 這一支在等 189')
  }, 60_000)

  it('🟢 fuzz_2｜unique called as a bare statement with its return value thrown away, next to the correct erase-remove form on other vectors.', async () => {
    // 🟢 **這一支一開始就綠**——The discarded unique must not change the container’s size, while the tail past the returned iterator is unspecified so only the kept prefix may be printed.
    await same(`vector<int> v = {1, 1, 2, 2, 2, 3, 1, 1}, w = {5, 5, 5, 9};
    sort(v.begin(), v.end());
    unique(v.begin(), v.end());
    cout << v.size() << ' ' << v[0] << v[1] << v[2] << '\\n';
    vector<int> u = {1, 1, 1, 1, 2, 2, 2, 3};
    auto it = unique(u.begin(), u.end());
    cout << "kept=" << (it - u.begin()) << " isend=" << (it == u.end()) << '\\n';
    u.erase(it, u.end());
    cout << u.size() << ' ' << accumulate(u.begin(), u.end(), 0) << '\\n';
    w.erase(unique(w.begin(), w.end()), w.end());
    cout << w.size() << ' ' << *max_element(w.begin(), w.end()) << '\\n';`, '🔴 盲測的回歸')
  }, 60_000)

  it.fails('[UNSUPPORTED:rotate / count_if] 🟠 fuzz_3｜rotate’s returned iterator is stored and later reused as the middle of a second rotate that undoes the first.', async () => {
    // 🟠 **為什麼不現在修**：缺的是 `rotate / count_if`——**新元件，不是做不到**。
    //    語料 **0 處**（218 支學生程式一次都沒用到），而盲測抓到它是因為
    //    出題者寫的是競賽風格的真實學生程式——**兩個母體不一樣**。
    // 🔴 何時該修：管線 189「範圍演算法的第二批」。
    //    它們現在做得起來了：`resolveRange` 換成「求值兩個接點」之後，
    //    一顆新的範圍演算法只剩下「它自己那幾行」。
    await same(`vector<int> v(10);
    iota(v.begin(), v.end(), 1);
    auto mid = rotate(v.begin(), v.begin() + 3, v.end());
    cout << *mid << ' ' << (mid - v.begin()) << '\\n';
    for (int x : v) cout << x;
    cout << '\\n';
    reverse(v.begin(), v.begin());
    rotate(begin(v), mid, end(v));
    for (int x : v) cout << x;
    cout << '\\n';
    cout << count_if(v.begin(), v.end(), [](int x) { return x % 3 == 0; })
         << ' ' << (end(v) - begin(v)) << '\\n';`, '🟠 這一支在等 189')
  }, 60_000)

  it.fails('[UNSUPPORTED:greater<int>()] 🟠 fuzz_4｜Iterators returned by find used as accumulate endpoints, compared against end(), offset by +1, and handed to sort as a range boundary.', async () => {
    // 🟠 **為什麼不現在修**：缺的是 `greater<int>()`——**新元件，不是做不到**。
    //    語料 **0 處**（218 支學生程式一次都沒用到），而盲測抓到它是因為
    //    出題者寫的是競賽風格的真實學生程式——**兩個母體不一樣**。
    // 🔴 何時該修：管線 189「範圍演算法的第二批」。
    //    它們現在做得起來了：`resolveRange` 換成「求值兩個接點」之後，
    //    一顆新的範圍演算法只剩下「它自己那幾行」。
    await same(`vector<int> v = {5, 8, 13, 0, 21, 34, 0, 55};
    auto z = find(v.begin(), v.end(), 0);
    cout << (z == v.end() ? -1 : (int)(z - v.begin())) << ' ' << accumulate(v.begin(), z, 0) << '\\n';
    auto z2 = find(z + 1, v.end(), 0);
    cout << (z2 - v.begin()) << ' ' << accumulate(z + 1, z2, 0) << '\\n';
    auto q = find(v.begin(), v.end(), 99);
    cout << (q == v.end()) << ' ' << (q - v.begin()) << '\\n';
    sort(v.begin(), z, greater<int>());
    cout << v[0] << ' ' << v[1] << ' ' << v[2] << ' ' << v[3] << '\\n';`, '🟠 這一支在等 189')
  }, 60_000)

  it.fails('[UNSUPPORTED:transform / count（自由函式那一形）] 🟠 fuzz_5｜String ranges: in-place transform to uppercase, count over begin(s)/end(s), and substrings cut at the iterator find returned.', async () => {
    // 🟠 **為什麼不現在修**：缺的是 `transform / count（自由函式那一形）`——**新元件，不是做不到**。
    //    語料 **0 處**（218 支學生程式一次都沒用到），而盲測抓到它是因為
    //    出題者寫的是競賽風格的真實學生程式——**兩個母體不一樣**。
    // 🔴 何時該修：管線 189「範圍演算法的第二批」。
    //    它們現在做得起來了：`resolveRange` 換成「求值兩個接點」之後，
    //    一顆新的範圍演算法只剩下「它自己那幾行」。
    await same(`string s = "Competitive Programming";
    transform(s.begin(), s.end(), s.begin(), [](unsigned char c) { return (char)toupper(c); });
    cout << s << '\\n';
    cout << count(s.begin(), s.end(), 'M') << ' ' << count(begin(s), end(s), ' ') << '\\n';
    auto it = find(s.begin(), s.end(), ' ');
    string t(s.begin(), it);
    reverse(t.begin(), t.end());
    cout << t << ' ' << t.size() << '\\n';
    string rest(it + 1, s.end());
    cout << (end(s) - begin(s)) << ' ' << rest.substr(0, 4)
         << ' ' << (int)(find(rest.begin(), rest.end(), 'A') - rest.begin()) << '\\n';`, '🟠 這一支在等 189')
  }, 60_000)

  it.fails('[UNSUPPORTED:nth_element / stable_sort 的比較器 / min_element 的比較器] 🟠 fuzz_6｜nth_element’s partial ordering guarantees combined with stable_sort under a modular comparator and min_element with a custom comparator.', async () => {
    // 🟠 **為什麼不現在修**：缺的是 `nth_element / stable_sort 的比較器 / min_element 的比較器`——**新元件，不是做不到**。
    //    語料 **0 處**（218 支學生程式一次都沒用到），而盲測抓到它是因為
    //    出題者寫的是競賽風格的真實學生程式——**兩個母體不一樣**。
    // 🔴 何時該修：管線 189「範圍演算法的第二批」。
    //    它們現在做得起來了：`resolveRange` 換成「求值兩個接點」之後，
    //    一顆新的範圍演算法只剩下「它自己那幾行」。
    await same(`vector<int> v = {9, 4, 7, 1, 8, 2, 6, 3, 5};
    int n = (int)v.size();
    nth_element(v.begin(), v.begin() + n / 2, v.end());
    cout << "median=" << v[n / 2] << '\\n';
    cout << "leftmax=" << *max_element(v.begin(), v.begin() + n / 2)
         << " rightmin=" << *min_element(v.begin() + n / 2 + 1, v.end()) << '\\n';
    vector<int> w = {9, 4, 7, 1, 8, 2, 6, 3, 5};
    stable_sort(w.begin(), w.end(), [](int a, int b) { return (a % 3) < (b % 3); });
    for (int x : w) cout << x % 3;
    cout << '\\n';
    auto m = min_element(v.begin(), v.end(), [](int a, int b) { return abs(a - 5) < abs(b - 5); });
    cout << *m << ' ' << count_if(v.begin(), v.end(), [](int x) { return x > 5; }) << '\\n';`, '🟠 這一支在等 189')
  }, 60_000)

  it.fails('[UNSUPPORTED:copy / is_sorted / equal / binary_search / next_permutation / prev_permutation] 🟠 fuzz_7｜A next_permutation do-while loop over three elements, ending with the wrap-around, then equal/binary_search including empty ranges.', async () => {
    // 🟠 **為什麼不現在修**：缺的是 `copy / is_sorted / equal / binary_search / next_permutation / prev_permutation`——**新元件，不是做不到**。
    //    語料 **0 處**（218 支學生程式一次都沒用到），而盲測抓到它是因為
    //    出題者寫的是競賽風格的真實學生程式——**兩個母體不一樣**。
    // 🔴 何時該修：管線 189「範圍演算法的第二批」。
    //    它們現在做得起來了：`resolveRange` 換成「求值兩個接點」之後，
    //    一顆新的範圍演算法只剩下「它自己那幾行」。
    await same(`vector<int> p = {1, 2, 3}, q = {1, 2, 3};
    int cnt = 0;
    do {
        copy(p.begin(), p.end(), ostream_iterator<int>(cout, ""));
        cout << (++cnt % 3 ? ' ' : '\\n');
    } while (next_permutation(p.begin(), p.end()));
    cout << "cnt=" << cnt << " sorted=" << is_sorted(p.begin(), p.end()) << '\\n';
    cout << equal(p.begin(), p.end(), q.begin())
         << binary_search(q.begin(), q.end(), 2)
         << binary_search(q.begin(), q.begin(), 2)
         << equal(p.begin(), p.begin(), q.begin()) << '\\n';
    prev_permutation(q.begin(), q.end());
    cout << q[0] << q[1] << q[2] << '\\n';`, '🟠 這一支在等 189')
  }, 60_000)

  it('🟢 fuzz_8｜Nested ranges: begin(d2[i])/end(d2[i]) on rows of a 2D vector and m[k].begin() on the vectors stored inside a map.', async () => {
    // 🟢 **這一支一開始就綠**——An empty row makes end(row) - begin(row) zero, and map element access inside the range expression creates the vector the iterators come from.
    await same(`vector<vector<int>> d2 = {{4, 1, 3}, {9, 7}, {}, {5, 5, 2, 8}};
    for (auto &row : d2) sort(begin(row), end(row));
    long long tot = 0;
    for (size_t i = 0; i < d2.size(); i++)
        tot += accumulate(begin(d2[i]), end(d2[i]), 0LL) * (long long)(end(d2[i]) - begin(d2[i]));
    cout << tot << '\\n';
    map<int, vector<int>> m;
    for (int x : {7, 3, 7, 1, 3, 7}) m[x].push_back(x * x);
    for (auto &kv : m) cout << kv.first << ':' << accumulate(kv.second.begin(), kv.second.end(), 0) << ' ';
    cout << '\\n';
    cout << *min_element(m[7].begin(), m[7].end()) << ' ' << m[3].size() << ' '
         << accumulate(m[1].begin(), m[1].begin(), 42) << '\\n';`, '🔴 盲測的回歸')
  }, 60_000)

  it.fails('[UNSUPPORTED:distance] 🟠 fuzz_9｜A vector sorted, grown with push_back, sorted again, then queried with lower_bound/upper_bound before an erase-remove shrinks it.', async () => {
    // 🟠 **為什麼不現在修**：缺的是 `distance`——**新元件，不是做不到**。
    //    語料 **0 處**（218 支學生程式一次都沒用到），而盲測抓到它是因為
    //    出題者寫的是競賽風格的真實學生程式——**兩個母體不一樣**。
    // 🔴 何時該修：管線 189「範圍演算法的第二批」。
    //    它們現在做得起來了：`resolveRange` 換成「求值兩個接點」之後，
    //    一顆新的範圍演算法只剩下「它自己那幾行」。
    await same(`vector<int> v = {40, 10, 30, 20};
    sort(v.begin(), v.end());
    v.push_back(25);
    v.push_back(15);
    sort(v.begin(), v.end());
    for (int x : v) cout << x << ' ';
    cout << '\\n';
    auto lo = lower_bound(v.begin(), v.end(), 20), hi = upper_bound(v.begin(), v.end(), 30);
    cout << (lo - v.begin()) << ' ' << (hi - v.begin()) << ' ' << accumulate(lo, hi, 0) << '\\n';
    v.erase(remove(v.begin(), v.end(), 25), v.end());
    cout << v.size() << ' ' << *(v.end() - 1) << ' '
         << v[distance(v.begin(), lower_bound(v.begin(), v.end(), 15))] << '\\n';
    cout << (int)(upper_bound(v.begin(), v.end(), 99) - v.begin()) << ' '
         << (lower_bound(v.begin(), v.end(), 5) == v.begin()) << '\\n';`, '🟠 這一支在等 189')
  }, 60_000)

  it.fails('[UNSUPPORTED:all_of / any_of / none_of / find_if_not] 🟠 fuzz_10｜all_of/any_of/none_of over both a full range and the zero-length range at the iterator find_if_not returned, plus sort(a, a).', async () => {
    // 🟠 **為什麼不現在修**：缺的是 `all_of / any_of / none_of / find_if_not`——**新元件，不是做不到**。
    //    語料 **0 處**（218 支學生程式一次都沒用到），而盲測抓到它是因為
    //    出題者寫的是競賽風格的真實學生程式——**兩個母體不一樣**。
    // 🔴 何時該修：管線 189「範圍演算法的第二批」。
    //    它們現在做得起來了：`resolveRange` 換成「求值兩個接點」之後，
    //    一顆新的範圍演算法只剩下「它自己那幾行」。
    await same(`vector<int> v = {2, 4, 6, 8, 7};
    auto even = [](int x) { return x % 2 == 0; };
    cout << all_of(v.begin(), v.end(), even) << any_of(v.begin(), v.end(), even)
         << none_of(v.begin(), v.end(), even) << '\\n';
    auto bad = find_if_not(v.begin(), v.end(), even);
    cout << (bad - v.begin()) << ' ' << *bad << ' ' << all_of(v.begin(), bad, even) << '\\n';
    cout << all_of(bad, bad, even) << any_of(bad, bad, even) << none_of(bad, bad, even) << '\\n';
    int a[5] = {5, 1, 3, 2, 4};
    sort(a, a);
    sort(a + 1, a + 4, greater<int>());
    for (int x : a) cout << x;
    cout << ' ' << accumulate(a + 5, a + 5, 7) << '\\n';`, '🟠 這一支在等 189')
  }, 60_000)

})
