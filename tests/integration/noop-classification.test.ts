/**
 * 「無執行行為」清單的實測分類（T002 — 只量不判）
 *
 * ## 為什麼這一步只量、不下結論
 *
 * 研究階段把分類自動化過一次，**答案是反的**：靜態掃描把壞掉的
 * `cpp_static_cast` 判成「由父概念消費」，把好的 `cpp_case` 判成「還沒實作」。
 * 抓到它的不是 code review，是先做的實測與它矛盾。
 *
 * **判準是對的，把它自動化的第一版仍然量錯。** 所以這支測試只做一件事：
 * 把每個概念放進一支最小程式跑一次，印出「期望 vs 實得」。分類在看完表之後
 * 才寫（T003），寫在 classification.md 裡。
 *
 * ## 期望輸出從哪來
 *
 * 人工寫定，與程式碼並列。不跟編譯器比對——那會把編譯器環境變成本測試的
 * 相依，而這裡需要的精度沒那麼高。
 *
 * ## 自我否證
 *
 * ⚠️ **如果 34 個全部通過，那不是好消息，是最小程式太簡單。**
 *
 * 錨點必須挑**這個功能不會修好的**東西——否則錨點自己會過期。第一版拿
 * `static_cast` 當錨（當時實測輸出 0），而 US1b 把它修好了，那句話就變成
 * 「叫未來的讀者不要相信一個正確的結果」。
 *
 * 現在的錨是**物件導向那十個**：直譯器不支援 OOP，本功能也不打算實作它。
 * `cpp_constructor` 若通過，代表這支測試沒有真的在跑。
 *
 * 見 specs/053-declare-noop-execute/research.md F2b、tasks.md T002
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode } from '../../src/core/types'
import { registerCppLanguage } from '../../src/languages/cpp/generators'

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  registerCppLanguage()
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
}, 60_000)

interface Case {
  /** 概念 id */
  id: string
  /** 最小程式（會被包進 #include <iostream> + using namespace std）*/
  code: string
  /** 人工寫定的期望輸出 */
  expect: string
  /** 為什麼這支程式能驗到這個概念 */
  why: string
}

/** main 之外的片段（函式、類別、命名空間）用 `%%` 分隔前置與 main 內容 */
const CASES: Case[] = [
  // ── 無子槽：宣告性概念。它們不執行，程式其餘部分照跑
  { id: 'cpp:comment', code: `// 一行註解\ncout << 1;`, expect: '1', why: '註解不影響輸出' },
  { id: 'cpp:block_comment', code: `/* 區塊 */ cout << 1;`, expect: '1', why: '註解不影響輸出' },
  { id: 'cpp:doc_comment', code: `/** doc */ cout << 1;`, expect: '1', why: '註解不影響輸出' },
  { id: 'cpp:include', code: `cout << 1;`, expect: '1', why: 'include 在標頭，不影響執行' },
  { id: 'cpp:include_local', code: `cout << 1;`, expect: '1', why: '同上' },
  { id: 'cpp:using_namespace', code: `cout << 1;`, expect: '1', why: 'using 不影響執行' },
  { id: 'cpp:define', code: `#define N 5\ncout << 1;`, expect: '1', why: '巨集展開是墓碑；本身不執行' },
  { id: 'cpp:stringstream_declare', code: `stringstream ss; cout << 1;`, expect: '1', why: '宣告本身無輸出' },
  { id: 'cpp:ifstream_declare', code: `ifstream f; cout << 1;`, expect: '1', why: '宣告本身無輸出' },
  { id: 'cpp:ofstream_declare', code: `ofstream f; cout << 1;`, expect: '1', why: '宣告本身無輸出' },
  { id: 'cpp:pair_declare', code: `pair<int,int> p; cout << 1;`, expect: '1', why: '宣告本身無輸出' },
  { id: 'cpp:raw_code', code: `cout << 1;`, expect: '1', why: '無法辨識時的兜底，不該有語義' },
  { id: 'cpp:raw_expression', code: `cout << 1;`, expect: '1', why: '同上' },

  // ── 有子槽：子槽裡是使用者的程式碼，跑得出來才算沒丟
  { id: 'cpp:case', code: `int x=2; switch(x){ case 2: cout << 22; break; }`, expect: '22', why: 'case 的 body 要跑' },
  { id: 'cpp:default', code: `int x=9; switch(x){ case 1: cout << 1; break; default: cout << 99; }`, expect: '99', why: 'default 的 body 要跑' },
  { id: 'cpp:ifdef', code: `#define N 1\n#ifdef N\ncout << 7;\n#endif`, expect: '7', why: 'N 已定義 → body 該跑（用未定義來測的話，noop 也會給同樣結果）' },
  { id: 'cpp:ifndef', code: `#ifndef N\ncout << 7;\n#endif`, expect: '7', why: 'N 未定義 → body 該跑' },
  { id: 'cpp:static_cast', code: `double d = 3.9; cout << static_cast<int>(d);`, expect: '3', why: '轉型結果要回傳' },
  { id: 'cpp:const_cast', code: `int a = 5; const int c = a; cout << const_cast<int&>(c);`, expect: '5', why: '轉型結果要回傳' },
  { id: 'cpp:dynamic_cast', code: `double d = 2.7; cout << dynamic_cast<int>(d);`, expect: '2', why: '轉型結果要回傳' },
  { id: 'cpp:reinterpret_cast', code: `double d = 1.9; cout << reinterpret_cast<int>(d);`, expect: '1', why: '轉型結果要回傳' },
  { id: 'cpp:namespace_def', code: `namespace N { int f(){ return 7; } }%%cout << N::f();`, expect: '7', why: 'namespace 內的函式要能呼叫' },
  { id: 'cpp:lambda', code: `auto f = [](int x){ return x*2; }; cout << f(21);`, expect: '42', why: 'lambda 的 body 要跑' },
  { id: 'cpp:struct_declare', code: `struct P { int x; };%%P p; p.x = 8; cout << p.x;`, expect: '8', why: '成員要能存取' },
  { id: 'cpp:class_def', code: `class C { public: int v = 3; };%%C c; cout << c.v;`, expect: '3', why: '成員要能存取' },
  { id: 'cpp:constructor', code: `class C { public: int v; C(){ v = 4; } };%%C c; cout << c.v;`, expect: '4', why: '建構式的 body 要跑' },
  { id: 'cpp:destructor', code: `class C { public: ~C(){ cout << 5; } };%%{ C c; } cout << 1;`, expect: '51', why: '解構式的 body 要跑（空 body 測不到，等於沒測）' },
  { id: 'cpp:virtual_method', code: `class C { public: virtual int f(){ return 6; } };%%C c; cout << c.f();`, expect: '6', why: '方法 body 要跑' },
  { id: 'cpp:override_method', code: `class B { public: virtual int f(){ return 1; } };\nclass D : public B { public: int f() override { return 9; } };%%D d; cout << d.f();`, expect: '9', why: '覆寫的 body 要跑' },
  { id: 'cpp:pure_virtual', code: `class B { public: virtual int f() = 0; };\nclass D : public B { public: int f() override { return 5; } };%%D d; cout << d.f();`, expect: '5', why: '純虛擬本身無 body；子類的要跑' },
  { id: 'cpp:operator_overload', code: `struct V { int n; V operator+(V o){ V r; r.n = n + o.n; return r; } };%%V a; a.n=1; V b; b.n=2; cout << (a+b).n;`, expect: '3', why: '運算子的 body 要跑' },
]

/** 概念註冊表裡不存在的死條目——舊命名，同名的底線版才是活的 */
const DEAD = ['cpp:include', 'cpp:include_local', 'cpp:using_namespace']

/** 蒐集樹中出現過的概念身分——沒出現的話，這一列什麼都沒測到 */
function conceptsIn(node: SemanticNode | null, acc = new Set<string>()): Set<string> {
  if (!node) return acc
  acc.add(node.conceptId)
  for (const arr of Object.values(node.children ?? {})) for (const c of arr) conceptsIn(c, acc)
  return acc
}

async function run(c: Case): Promise<{ got: string; err: string; present: boolean }> {
  const [prelude, body] = c.code.includes('%%') ? c.code.split('%%') : ['', c.code]
  const src = `#include <iostream>\n#include <sstream>\n#include <fstream>\n#include <utility>\nusing namespace std;\n${prelude}\nint main(){ ${body} return 0; }\n`
  const tree = lifter.lift(tsParser.parse(src).rootNode as never) as SemanticNode
  const present = conceptsIn(tree).has(c.id)
  const out: string[] = []
  const interp = new SemanticInterpreter({ maxSteps: 200000 })
  interp.setOutputCallback((s: string) => out.push(s))
  let err = ''
  try {
    await interp.execute(tree)
  } catch (e) {
    err = String(e).replace(/\s+/g, ' ').slice(0, 60)
  }
  return { got: out.join(''), err, present }
}

describe('「無執行行為」清單的實測（只量不判）', () => {
  it('34 列的表：每個概念一支最小程式', async () => {
    const rows: string[] = []
    let pass = 0
    for (const c of CASES) {
      const { got, err, present } = await run(c)
      // 概念沒出現在樹裡 → 這一列什麼都沒測到，**不算通過**
      const ok = present && got === c.expect
      if (ok) pass++
      const mark = !present ? '⬜' : ok ? '✅' : '🔴'
      rows.push(
        `  ${mark} ${c.id.padEnd(26)} 期望「${c.expect}」實得「${got}」` +
          (present ? '' : ' ← **概念未出現在語義樹，此列判不出來**') +
          (err ? ` ⚠ ${err}` : '') + `\n       ${c.why}`,
      )
    }
    console.log(
      [
        '',
        '─'.repeat(72),
        '  「無執行行為」清單的實測結果（分類依據，寫進 classification.md）',
        '─'.repeat(72),
        ...rows,
        '',
        `  ${pass}/${CASES.length} 通過｜死條目 ${DEAD.length} 個（概念註冊表中不存在）：${DEAD.join('、')}`,
        '',
        '  ⚠️ 全部通過的話不是好消息，是最小程式太簡單。錨點是物件導向那十個——',
        '     直譯器不支援 OOP，本功能也不實作它。cpp_constructor 若通過，',
        '     代表這支測試沒有真的在跑。',
        '',
      ].join('\n'),
    )
    expect(rows.length).toBe(CASES.length)
  }, 120_000)

  it('★ 自我否證：量測必須產得出「失敗」——用**合成**的壞樣本，不錨在真實狀態', async () => {
    // ## 這支測試被改過兩次，而兩次都是同一個原因
    //
    // 第一版錨在 `static_cast`（「它是壞的，通過就代表沒在跑」）——同功能的
    // 下一個 Story 修好了它。第二版改錨在物件導向那組（「直譯器不支援 OOP」）
    // ——`specs/071`–`073` 把它們實作了。
    //
    // **護欄修好了它要量的東西，就是它的錨點爛掉的時候。** 那不是意外，
    // 是設計上的必然：一條護欄的目的就是讓它量的東西變好。
    //
    // 所以錨點改成**合成的**：一段引用了不存在概念的程式，它**永遠**跑不出
    // 期望值，因為那個概念按定義不會被實作。見 `knowledge/history/022`。
    const r = await run({
      id: '__合成的壞樣本__',
      code: `cout << __這個概念永遠不會存在__;`,
      expect: '不可能出現的輸出',
      why: '合成錨點',
    })
    expect(
      r.present && r.got === '不可能出現的輸出',
      '一段引用不存在概念的程式「通過」了 → **量測根本沒有在跑**，' +
        '而它與健康的量測產出一模一樣。這支是唯一分得出來的地方。',
    ).toBe(false)
  }, 120_000)

  it('★ 對照組：清單外的普通函式必須通過（證明量測本身能給出通過）', async () => {
    const r = await run({ id: '對照', code: `int g(){ return 7; }%%cout << g();`, expect: '7', why: '' })
    expect(r.got, `對照組都跑不過，代表量測本身壞了：${r.err}`).toBe('7')
  })

  it('清單涵蓋完整：31 個活條目 + 3 個死條目 = 34', () => {
    expect(CASES.length + DEAD.length).toBe(34)
  })
})
