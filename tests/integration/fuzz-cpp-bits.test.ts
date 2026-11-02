/**
 * **盲測的回歸：一排位元**（管線 199 階段四）—— 2026-09-20。
 *
 * ## 出題的人看不到原始碼
 *
 * 出題者在隔離的 worktree 裡，只知道 C++ 與「寫真實的競賽風格學生程式」。
 * 十支**每一支都 `-Wall -Wextra` 零警告、跑過、再用 `-fsanitize=undefined,address`
 * 跑一次而消毒器一個字都沒印**，而且它還把 JSON 裡的 `code` 重新抽出來重編重跑對過一次。
 *
 * ## 讀數：**0/10 → 1/10**，而這一輪的價值不在分子上
 *
 * 十支各卡在不同的地方，而**逐支追下去修掉了九個真缺陷**——其中五個
 * 與 `bitset` 無關（十六進位字面、別名、印出來、裸識別字的樣板引數）。
 *
 * ## 🔴 而這一輪最重要的讀數是【同一個判斷被推翻四次】
 *
 * 探索報告用「語料 0 處」拒絕了四件事，而盲測四件都用上了：
 *
 * ```
 * prev(it, n) 的第二個引數     第 197 刀被推翻   盲測 2/10
 * bs.set(i) 的帶位置形式        這一刀被推翻      盲測多支 ＋ 【安靜的錯答】
 * to_ulong() / to_string()     這一刀被推翻      盲測 4/10
 * cout << bs                   這一刀被推翻      盲測 1/10 ＋ 印出 `[array]`
 * ```
 *
 * > **「語料 0 處」量到的是【這批語料的人怎麼寫】，
 * > 不是【這個寫法有多常見】——而它已經錯了四次。**
 *
 * 🔴 **而其中一次不只是缺功能，是一個安靜的錯答**：`bs.set(3)` 在修之前
 * 把**整排**設成 1（引數被丟掉），g++ 印 `11` 而我們印 `18`。
 * 那是「決定不做，而那個方法名已經被登錄了」的後果：
 *
 * > **一個「不做」的決定，如果那個名字已經被認領，
 * > 它不會變成誠實降級——它會變成一個錯的答案。**
 */
import { describe, it, expect } from 'vitest'
import { runCella, describeCellaResult, knownCellaGap } from '../helpers/cella-run'
import { runCppDetailed, hasReferenceCompiler } from '../helpers/run-cpp'


/** ⚠️ 標頭不手列——本機由墊片提供、CI 上是真的 GCC 標頭（第一百二十條）。 */
const H = '#include <bits/stdc++.h>\nusing namespace std;\n'

/**
 * **執行那一邊是 Cella**（spec 203，重構 6c-2e）——走產品同一條 lift → formalize → 判決。
 * 判決不是 accept 就丟出說得出原因的錯（判不出、翻不出、判定有錯都不是空字串）。
 * 比對的另一邊仍是參照編譯器（它整族的退場是 6c-5 的事），所以這裡是「Cella 對參照編譯器」的交叉檢查。
 */
const cellaOut = async (src: string): Promise<string> => {
  const r = await runCella(src)
  if (r.verdict !== 'accept') throw new Error(describeCellaResult(r))
  return r.out
}
const run = cellaOut
const whole = async (code: string, hint: string): Promise<void> => {
  const ref = runCppDetailed(code)
  expect(ref.ok, `🔴 參照編譯器收不下（測試自己的問題）：${ref.ok ? '' : ref.message}`).toBe(true)
  expect(await run(code), hint).toBe(ref.output)
}
const same = async (body: string, hint: string, glob = ''): Promise<void> =>
  whole(`${H}${glob}\nint main() {\n${body}\n  return 0;\n}\n`, hint)

describe.runIf(hasReferenceCompiler())('盲測的回歸：一排位元', () => {
  /**
   * 🔴 **十六進位的後綴**——`0xDEADBEEFUL` 讀不懂（拋錯）。
   * 那一行的註解寫著「十六進位不能剝後綴：`0xFF` 的 `F` 是數字」
   * ——**而 `U`／`L` 不是數字**。
   * > **一條「這一族不剝後綴」的規則，如果理由只對其中一個字母成立，
   * > 那它對其餘的字母都是錯的。**
   */
  it('🔴 十六進位帶 u／l 後綴', async () => {
    await same('  cout << 0xDEADBEEFUL << " " << 0xffULL << " " << 0b1011U;', '🔴 讀不懂那個字面')
  })

  /**
   * 🔴 **十六進位裡的 `E` 是一個數字，不是科學記號**。
   * 修完後綴之後 `0xDEADBEEF` 仍然被判成 double，印出 `3.73593e+09`。
   */
  it('🔴 十六進位裡的 E 不得被當成指數', async () => {
    await same('  cout << 0xDEADBEEF << " " << 0xE << " " << 1e3;', '🔴 被當成浮點數了')
  })

  /**
   * 🔴 **`bs.set(3)` 在修之前把整排設成 1**——引數被丟掉，而它不出聲。
   * g++ 印 `11`（第 3 格是 1、總共 1 個），我們印 `18`（總共 8 個）。
   */
  it('🔴 帶位置的 set／reset／flip 只改那一格', async () => {
    await same(
      '  bitset<8> a; a.set(3); bitset<8> b; b.set(); b.reset(2); bitset<8> c; c.flip(5);\n'
      + '  cout << a[3] << a.count() << b[2] << b.count() << c[5] << c.count();',
      '🔴 引數被丟掉了——整排都被改了')
  })

  /** ★ 正向錨點：**無引數的形式照舊是整排**。 */
  // 歸類：Cella 判錯——`std::bitset::flip()` 無引數的多載是標準的（[template.bitset]），Cella 判 reject
  it('★ 無引數的 set／reset／flip 仍然改整排', async () => {
    await same(
      '  bitset<4> a; a.set(); bitset<4> b; b.set(); b.reset(); bitset<4> c; c.flip();\n'
      + '  cout << a.count() << b.count() << c.count();', '')
  })

  /**
   * 🔴 **別名指向 bitset**——`typedef` 與 `using` 兩種寫法。
   *
   * 兩個獨立的洞：① `getType` 對別名回 C++ 的基底名（`bitset`）而容器宣告那條
   * 回身分推導名（`bits`）——**每一顆既有元件的兩個名字剛好相同，所以這個分歧
   * 一直看不見**；② `using X = Y` 的執行器是一個 **noop**，於是 `X r;` 被建成 `int 0`。
   *
   * > **一個一直成立的巧合，在第一個反例出現時看起來會像是那個反例的錯。**
   */
  // 歸類：我們這側缺——typedef 別名的 formalize（spec 202 同一根）
  it('🟡 已知缺陷（修好時這條會紅）：🔴 `typedef bitset<8> Row;` 之後 `Row r;` 認得出來', async () => {
    await knownCellaGap(/cpp:typedef：這顆頂層元件還沒有對應到 Cella 的建構子/, async () => {
      await same('  Row r; r.set(); cout << r.count() << r.size();',
        '🔴 別名沒有解開', 'typedef bitset<8> Row;')
    })
  })

  // 歸類：我們這側缺——using 別名的 formalize（spec 202 同一根）
  it('🟡 已知缺陷（修好時這條會紅）：🔴 `using Row = bitset<8>;` 之後也一樣（它的執行器原本是 noop）', async () => {
    await knownCellaGap(/cpp:using_alias：這顆頂層元件還沒有對應到 Cella 的建構子/, async () => {
      await same('  Row r; r.set(); r.reset(1); cout << r.count() << r[1];',
        '🔴 using 別名沒有被登記', 'using Row = bitset<8>;')
    })
  })

  /**
   * 🔴 **樣板引數是一個裸識別字**——`bitset<K>` 整句掉進 `raw_code`。
   *
   * tree-sitter 對裸識別字的樣板引數一律當成型別（語法上分不出型別參數與
   * 非型別參數），於是那一格被包在一層 `type_descriptor` 裡，
   * 而 lift 一個型別節點的結果是 `raw_code`——**症狀是整句宣告消失，不是報錯**。
   */
  it('🔴 `bitset<K>` 的 K 是一個 constexpr／const 識別字', async () => {
    await same('  bitset<K> a; a.set(); bitset<C> b; b.set();\n'
      + '  cout << a.size() << " " << b.size() << " " << a.count() << b.count();',
      '🔴 裸識別字的樣板引數掉了', 'constexpr int K = 8;\nconst int C = 5;')
  })

  /** ★ 正向錨點：**數字與運算式那兩種寫法照舊**。 */
  // 🟢 spec 203 拔掉釘子：arithmetic 的 formalize 有了 `constInt`（常數運算式當長度），`bitset<K + 1>` 翻得出、與參照編譯器一致
  it('★ `bitset<8>` 與 `bitset<K + 1>` 照舊', async () => {
    {
      await same('  bitset<8> a; bitset<K + 1> b; cout << a.size() << " " << b.size();',
        '', 'constexpr int K = 7;')
    }
  })

  /**
   * 🔴 **`cout << bs` 印出 `[array]`**——一個內部字串漏到使用者眼前。
   * ⚠️ 判準問 `elemType` 那一章，不問「它是不是一個 array」：
   *    一個 `vector<int>` 在執行期長得一樣，而 `cout << v` 在 C++ 裡**編不過**。
   */
  // 歸類：Cella 判錯——`operator<<(ostream&, const bitset<N>&)` 是標準的（[bitset.operators]），Cella 判 reject
  it('🟡 已知缺陷（修好時這條會紅）：🔴 整排印出來是一串 0 與 1（最高位在前）', async () => {
    await knownCellaGap(/template argument deduction failed/, async () => {
      await same('  bitset<8> b; b.set(0); b.set(3); bitset<4> z;\n  cout << b << " " << z;',
        '🔴 印出了內部字串')
    })
  })

  /**
   * 🔴 **`to_ulong`／`to_ullong`／`to_string`**——探索報告以「語料 0 處」拒絕過，
   * 而盲測十支裡有四支用它。
   * ⚠️ **第 0 格是最低位，而字串的第一個字元是最高位**——兩個方向相反。
   */
  // 歸類：Cella 未支援——bitset 的 to_ullong
  it('🟡 已知缺陷（修好時這條會紅）：🔴 整排換成一個整數或一串 0 與 1', async () => {
    await knownCellaGap(/has no member 'to_ullong'/, async () => {
      await same('  bitset<8> b; b.set(0); b.set(3);\n'
        + '  cout << b.to_ulong() << " " << b.to_ullong() << " " << b.to_string();',
        '🔴 換不出來，或方向反了')
    })
  })

  /** 🔴 **三個問句**（`any`／`none`／`all`）——不多一格，而它們擋住多支。 */
  it('🔴 整排的三個問句', async () => {
    await same('  bitset<4> a; bitset<4> b; b.set(); bitset<4> c; c.set(1);\n'
      + '  cout << a.any() << a.none() << a.all() << b.any() << b.none() << b.all()\n'
      + '       << c.any() << c.none() << c.all();', '🔴 問句答錯了')
  })

  /** ★ 正向錨點：**整數那一側與同族容器不得被弄壞**。 */
  // 歸類：我們這側缺——`__builtin_popcount` 是 GCC／clang 的內建，不是標準 C++；Cella 也沒有那一族（見下面 `__builtin_ctz` 那根）
  it('🟡 已知缺陷（修好時這條會紅）：★ 整數的位元運算與 popcount 照舊', async () => {
    await knownCellaGap(/__builtin_popcount」是編譯器內建函式，還沒有對應/, async () => {
      await same('  int x = 1337;\n'
        + '  cout << (x & 1) << (x | 2) << (x ^ 3) << (x << 1) << (x >> 3)\n'
        + '       << (x & -x) << (x >> 4 & 1) << __builtin_popcount(x);', '')
    })
  })

  it('★ `vector` 與 `string` 不得被當成一排位元', async () => {
    await same('  vector<int> v{1,2,3}; string s = "ab";\n'
      + '  cout << v.size() << s.size() << v[0] << s[1];', '')
  })

  // ────────────────────────────────────────────────────────────────
  // 🪦 釘子——每一根都寫了「為什麼不是現在」＋「何時該修」
  // ────────────────────────────────────────────────────────────────

  /**
   * 🟠 **`bs.test(i)`** —— 它要一個位置，而那讓它與「三個問句」不同形
   *（引數個數不同 ⟹ 另一顆身分，元件代數 250）。
   * **為什麼不是現在**：`bs[i]` 是**完全等價**的寫法而且今天就能跑，
   * 多一顆積木做同一件事是認知負載（`一個積木 = 一個語義概念`）。
   * **何時該修**：下一次有人碰一排位元的讀取那一族——那時把「第幾格」
   * 那個位置槽做成一顆讀取用的身分，同時涵蓋 `test(i)` 與 `bs[i]` 兩種寫法。
   */
  // 🟢 spec 203：執行那一邊換成 Cella 之後這一條判 accept、與參照編譯器一致（原本釘的是 JS 直譯器缺 `test`），釘子拔掉
  it('★ `bs.test(i)`', async () => {
    await same('  bitset<8> b; b.set(3); cout << b.test(3) << b.test(0);', '')
  })

  /**
   * 🟠 **從一個數字或一串字元建出一排位元**（`bitset<8>(0xF0)`／`bitset<8>("1010")`）。
   * **為什麼不是現在**：那是「內建型別的建構」整條路，不是一顆元件
   *——今天只有登記過的 `struct` 走得到建構那一路（`ctx.structs.construct`）。
   * 🔴 與第 197 刀那根 `[UNSUPPORTED:string_construct]` 是**同一族**。
   * **何時該修**：內建型別的建構那一刀，兩根一起拔。
   */
  // 歸類：我們這側——`bitset<8> a(0xF0UL)` 的建構引數原本在 lift 就安靜地掉了（判出全 0，參照編譯器 42）；spec 203 改成整句降級成原文，
  // 現在照實翻不出（cpp:raw_code）。bits_declare 真的收得下建構引數那天，這根會紅
  it('🟡 已知缺陷（修好時這條會紅）：🪦 `bitset<8>(0xF0)` 與 `bitset<8>("1010")`', async () => {
    await knownCellaGap(/cpp:raw_code/, async () => {
      await same('  bitset<8> a(0xF0UL); bitset<8> b(string("1010"));\n'
        + '  cout << a.count() << b.count();', '')
    })
  })

  /**
   * 🟠 **`__builtin_ctz`／`__builtin_clz`／`__builtin_parity`**。
   * **為什麼不是現在**：它們與「數 1 的個數」**語義不同**（數的是尾端／前端的 0、
   * 以及 1 的個數是奇是偶）⟹ 各是另一顆身分，而三顆一起做才不會又留下
   * 「同一族做了一半」的不一致（第 188 刀那 27 顆的教訓）。
   * **何時該修**：整數的位元查詢那一族一起做。
   */
  // 歸類：Cella 未支援——`__builtin_ctz`／`clz`／`parity` 是編譯器內建（非標準），Cella 判「未宣告的函式」
  it('🟡 已知缺陷（修好時這條會紅）：🪦 `__builtin_ctz`／`clz`／`parity`', async () => {
    await knownCellaGap(/call to an undeclared function '__builtin_ctz'/, async () => {
      await same('  unsigned x = 40u;\n'
        + '  cout << __builtin_ctz(x) << " " << __builtin_clz(x) << " " << __builtin_parity(x);', '')
    })
  })

  /**
   * 🟠 **別名的大小是一個識別字**——`const int B = 96; typedef bitset<B> Big; Big b;`
   * 那一排是**空的**，於是 `b.set(0)` 說「索引 0 超出範圍」。
   *
   * 根因：`defaultValue` 從**型別字串**解析大小（`Number('B')` 是 NaN），
   * 而它沒有 scope 可以查那個名字。
   * ⚠️ 直接宣告（`bitset<B> b;`）是好的——走的是容器宣告那條，大小是一個**接點**，
   *    由執行期求值。**兩條路徑對同一件事有兩個答案。**
   * **何時該修**：別名指向的容器宣告改成走容器那條路的那一天
   *（那會一併解決「別名的容器拿不到元素型別」那一族）。
   */
  // 歸類：我們這側缺——typedef 別名的 formalize
  it('🟡 已知缺陷（修好時這條會紅）：🪦 `typedef bitset<B> Big;` 的 B', async () => {
    await knownCellaGap(/cpp:typedef：這顆頂層元件還沒有對應到 Cella 的建構子/, async () => {
      await same('  Big b; b.set(0); cout << b.size() << b.count();',
        '', 'const int B = 96;\ntypedef bitset<B> Big;')
    })
  })

  /**
   * 🟠 **接收者是運算式時型別查不到**——`mk().count()`、`cal["ada"].count()`。
   * 依型別分派那張表是**用接收者的原文去查名字**的。
   * 🔴 與 `d[i].reset()` 是**同一根釘子的第二個形狀**（見那顆膠囊的自證測）。
   * **何時該修**：宣告表記得住「運算式的型別」的那一天。
   */
  // 歸類：我們這側缺——接收者是運算式（`mk().count()`）時 lift 沒認出 bits_count 的接收者，formalize 送出空槽
  it('🟡 已知缺陷（修好時這條會紅）：🪦 `mk().count()`', async () => {
    await knownCellaGap(/hole：an empty slot/, async () => {
      await same('  cout << mk().count();', '',
        'bitset<8> mk(){ bitset<8> b; b.set(); return b; }')
    })
  })

  /** ★ 正向錨點：**存起來再問就是好的**——證明上面那一根只卡在「接收者是運算式」。 */
  it('★ 先存起來再問，就認得出來', async () => {
    await same('  bitset<8> r = mk(); cout << r.count();', '',
      'bitset<8> mk(){ bitset<8> b; b.set(); return b; }')
  })
})
