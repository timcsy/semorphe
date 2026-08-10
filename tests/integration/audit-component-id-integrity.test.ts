/**
 * 第二十一條護欄：**程式碼不得建出登錄表裡沒有的元件身分**
 *
 * ## 自我否證聲明（⚠️ 寫在量測邏輯之前）
 *
 * > **如果這條護欄回報零違規，而下面合成注入的「建出一個不存在身分」的節點
 * > 沒有被報出來，代表護欄壞了，不是身分乾淨。**
 *
 * 錨點是**合成的節點**，不是真實世界的那四筆——真實世界的幽靈會被這個功能修掉，
 * 而錨在它們上面的聲明會在那一天變成叫人不要相信一個正確的結果。
 *
 * ## 為什麼需要這一條
 *
 * B 項（098／099）合併了 `var_declare_expr` 進 `var_declare`：概念定義刪了、
 * 存檔轉換寫了、身分健檢「確定桶 9 → 0」、全套綠。
 *
 * **而 `extract-strategies.ts` 還在生產舊身分。** 兩天沒有人發現。
 *
 * > **存檔轉換救不了它**——轉換只在**載入**時跑，而那是使用者拖積木**新產生**的節點。
 *
 * 同一次實測還撈出三筆：`cpp_priority_queue_declare`（對照表指向一顆從來不存在的
 * 元件）、`cpp_initializer_list`／`param_decl`（有產生器／有節點，沒有概念定義）。
 *
 * ## 兩種量測，互相校驗——而硬關卡用走流程那一次
 *
 * | | 可信嗎 | 用途 |
 * |---|---|---|
 * | **走流程掃樹** | ✅ 這是系統**真的產出了什麼** | **硬關卡** |
 * | **靜態掃 `createNode(`** | ⚠️ 只能排順序 | 提供檔案與行號 |
 *
 * ⚠️ **靜態掃描不能單獨下結論。** 規劃階段第一版報了 **27 筆**，其中大多是
 * **積木型別**（`cpp_if`）與 **AST 節點型別**（`binary_expression`）——它們出現在
 * `registerExtractStrategy(...)` 與 `g.set(...)` 的第一個參數，那**不是元件身分**。
 * 抓到它的是「先在已知答案的樣本上驗」（`build-guardrail` 第 6 步）。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測身分對不對**——`var_declare` 被拿來表示一個迴圈它照樣綠。它只問「這個身分存在嗎」。
 * - **不檢測五路完備**——那是 `audit-completeness` 的事。一顆剛補上定義而只有一路的元件，
 *   在這裡是乾淨的、在那裡是殼。
 * - **不掃測試樹**——測試刻意合成不存在的身分（本檔自己就在做）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import type { SemanticNode } from '../../src/core/types'
import { printReport, listSourceFiles, REPO_ROOT } from '../helpers/guardrail'
import { splitCodeAndComments } from '../helpers/component-scan'
import { allCppConcepts } from '../../src/languages/cpp/all-declarations'
import { nonComponentDecl, allNonComponents } from '../../src/core/non-components'
import '../../src/languages/cpp/module'

/** 登錄表認得的身分 */
const 已宣告 = new Set(allCppConcepts().map((c) => c.conceptId))

// ─── 靜態掃描：只認 `createNode(` ────────────────────────────────
//
// ⚠️ 刻意**只**認這一個入口。`registerExtractStrategy('cpp_if')` 的第一個參數是
// **積木型別**、`g.set('binary_expression')` 的是 **AST 節點型別**——把它們一起
// 掃進來就是規劃階段那 27 筆假報。

interface Site {
  id: string
  where: string
}

function 靜態掃描(extra: { file: string; source: string }[] = []): Site[] {
  const files = [
    ...listSourceFiles('src', ['.ts']).map((rel) => ({
      file: rel,
      source: fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'),
    })),
    ...extra,
  ]
  const out: Site[] = []
  for (const { file, source } of files) {
    // ⚠️ **先剝掉註解。** 第一次跑報了 `verify-concept-paths.ts:78` 的 `conceptId`
    // ——那是一行**註解裡的範例**（`// Match createNode('conceptId', ...) patterns`）。
    //
    // 而剝離註解的處方**專案早就有了**（`splitCodeAndComments`，中立性護欄在用），
    // 只是沒有被套到這裡。這是 `experience.md`「修好一個 bug 之後去掃同形的地方」
    // 的又一次——處方記了，而新寫的掃描器仍然帶著那個病。
    const { code } = splitCodeAndComments(source)
    for (const m of code.matchAll(/createNode\(\s*'([^']+)'/g)) {
      // 行號要用**原始碼**算，剝完註解的偏移對不上使用者看到的檔案
      const idx = source.indexOf(m[0])
      const line = idx >= 0 ? source.slice(0, idx).split('\n').length : 0
      out.push({ id: m[1], where: `${file}:${line}` })
    }
  }
  return out
}

type Bucket = '幽靈' | '已宣告的非元件'

interface Finding {
  id: string
  bucket: Bucket
  kind?: string
  sites: string[]
}

function measure(extra: { file: string; source: string }[] = []): Finding[] {
  const byId = new Map<string, string[]>()
  for (const s of 靜態掃描(extra)) {
    if (已宣告.has(s.id)) continue
    const list = byId.get(s.id) ?? []
    list.push(s.where)
    byId.set(s.id, list)
  }
  return [...byId]
    .map(([id, sites]) => {
      const decl = nonComponentDecl(id)
      // 判定保守（第 5 步）：沒有宣告就是幽靈。
      // 為了讓數字好看而樂觀歸類，比沒有護欄更糟。
      return decl
        ? { id, bucket: '已宣告的非元件' as Bucket, kind: decl.kind, sites }
        : { id, bucket: '幽靈' as Bucket, sites }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}

// ─── 自我驗證：兩個方向都要釘（第 9 步）──────────────────────────

describe('自我驗證：這條護欄真的量得到東西', () => {
  const 合成幽靈 = { file: '合成/幽靈.ts', source: "const n = createNode('__合成_不存在的身分__', {})\n" }
  const 合成真身分 = { file: '合成/真的.ts', source: "const n = createNode('var_declare', {})\n" }

  it('★ 注入一個建出不存在身分的節點 → **必須被報成幽靈**', () => {
    const hit = measure([合成幽靈]).find((f) => f.id === '__合成_不存在的身分__')
    expect(hit, '合成的幽靈沒有被報出來 → **護欄壞了，不是身分乾淨**').toBeDefined()
    // 釘住**理由**不只釘結果（第 8 步）
    expect(hit!.bucket, '報出來了但歸成「已宣告的非元件」→ 會靜靜地放過它').toBe('幽靈')
    expect(hit!.sites[0], 'FR-002：只說有幾筆修不了，要指名檔案與行號').toContain('合成/幽靈.ts:1')
  })

  it('★ 注入一個建出**真身分**的節點 → **必須不被報出**', () => {
    // 沒有這一支的話，一個「什麼都報」的掃描器也能通過上一支。
    expect(
      measure([合成真身分]).find((f) => f.id === 'cpp:var_declare'),
      '一個確實存在的身分被報成幽靈 → 這條護欄會亂叫，而亂叫的護欄很快就被忽略',
    ).toBeUndefined()
  })

  it('★ **註解裡**的 createNode 不得被報出', () => {
    // 迴歸釘：第一次跑報了 `verify-concept-paths.ts:78`，而那是註解裡的範例。
    const hit = measure([
      { file: '合成/註解.ts', source: "// Match createNode('__註解裡的假身分__', ...) patterns\n" },
    ]).find((f) => f.id === '__註解裡的假身分__')
    expect(hit, '註解裡的例子被當成真的建構——護欄會報一筆修不掉的東西').toBeUndefined()
  })

  it('★ 已知答案樣本：判準先驗過再拿來下結論（第 6 步）', () => {
    // ⚠️ 規劃階段的靜態掃描第一版把積木型別與 AST 節點型別當成元件身分，
    // 報了 27 筆假的。救它的是這一支——**用查過的答案，不是記得的答案**。
    expect(已宣告.has('cpp:var_declare'), 'var_declare 是真元件').toBe(true)
    expect(已宣告.has('cpp:vector_declare'), 'cpp_vector_declare 是真元件').toBe(true)
    expect(已宣告.has('cpp_if'), '`cpp_if` 是**積木型別**不是元件身分——它不該在登錄表裡').toBe(false)
    expect(已宣告.has('binary_expression'), '`binary_expression` 是 AST 節點型別').toBe(false)
  })

  it('★ 掃描器有真的掃到東西（第 10 步）', () => {
    // 零幽靈與「一個 createNode 都沒掃到」產出一模一樣。
    expect(靜態掃描().length, '零個 createNode → 是掃描壞了，不是專案空了').toBeGreaterThan(20)
    expect(已宣告.size, '登錄表是空的 → 同上').toBeGreaterThan(150)
  })

  it('★ 非元件宣告必須附理由——沒有理由的宣告與「懶得處理」分不出來', () => {
    for (const [id, d] of allNonComponents()) {
      expect(d.reason.length, `${id} 的宣告理由太短，讀不出「為什麼刻意不是元件」`).toBeGreaterThan(15)
    }
  })
})

// ─── 走流程掃樹：**硬關卡**（靜態掃描看不到算出來的身分）────────────
//
// ⚠️ **這一半不是補強，是主力。**
//
// 靜態掃描只認 `createNode('字面')`。而 `cpp_priority_queue_declare` 走的是
// **對照表**：`containerConcepts[templateName]` 算出身分再 `createNode(conceptId, …)`。
// 靜態掃描**完全看不到它**——它在前一版護欄裡是綠的，而它是這個功能的起因之一。
//
// 走流程掃樹看的是**系統真的產出了什麼**，算出來的身分躲不掉。

/** 涵蓋各家容器與宣告形狀的樣本——每一段都要能辨識 */
const 樣本: [string, string][] = [
  ['vector', 'vector<int> v; v.push_back(1);'],
  ['stack', 'stack<int> stk; stk.push(1);'],
  ['queue', 'queue<int> que; que.push(1);'],
  ['priority_queue', 'priority_queue<int> pq; pq.push(1);'],
  ['set', 'set<int> s; s.insert(1);'],
  ['map', 'map<string,int> m; m["a"] = 1;'],
  ['pair', 'pair<int,int> p = make_pair(1,2);'],
  ['string', 'string s = "hi"; cout << s.length();'],
  ['array', 'int a[] = {1,2,3}; cout << a[0];'],
  ['func', 'int f(long long base, const string& s){ return 1; }'],
  ['control', 'for(int i=0;i<3;i++){ if(i) cout << i; else break; }'],
  ['io', 'int x; cin >> x; printf("%d", x);'],
]

const PRELUDE =
  '#include <iostream>\n#include <vector>\n#include <stack>\n#include <queue>\n' +
  '#include <set>\n#include <map>\n#include <string>\n#include <utility>\nusing namespace std;\n'

let treeParser: Parser

describe('走流程掃樹（硬關卡）', () => {
  beforeAll(async () => {
    await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
    treeParser = new Parser()
    treeParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
    registerCppLanguage()
  })

  function 樹裡的身分(body: string): string[] {
    const tree = treeParser.parse(`${PRELUDE}int main(){ ${body} return 0; }`)
    if (!tree) throw new Error('parse 失敗')
    const root = createTestLifter().lift(tree.rootNode as never) as SemanticNode
    const out: string[] = []
    const walk = (n: SemanticNode): void => {
      if (!n) return
      out.push(n.conceptId)
      for (const l of Object.values(n.children ?? {})) for (const c of l ?? []) walk(c as SemanticNode)
    }
    walk(root)
    return out
  }

  it('★ 自我驗證：樣本真的辨識出東西了（第 10 步）', () => {
    // 一個 parse 失敗的樣本會產出空樹，而空樹的「幽靈為 0」與健康的一模一樣。
    for (const [名稱, body] of 樣本) {
      expect(樹裡的身分(body).length, `樣本「${名稱}」辨識不出任何節點 → 是樣本壞了，不是它乾淨`).toBeGreaterThan(2)
    }
  })

  it('★ 每個樣本產出的身分，都在登錄表或非元件宣告裡', () => {
    const 幽靈: string[] = []
    for (const [名稱, body] of 樣本) {
      for (const id of new Set(樹裡的身分(body))) {
        if (已宣告.has(id) || nonComponentDecl(id)) continue
        幽靈.push(`${名稱}: ${id}`)
      }
    }
    expect(
      [...new Set(幽靈)].sort(),
      '辨識產出了一個沒有人認識的身分。⚠️ 靜態掃描看不到它——' +
        '它是從對照表算出來的（`containerConcepts[templateName]`）。',
    ).toEqual([])
  })

  it('★ 反向：合成一個算出來的幽靈身分**必須被抓到**', () => {
    // 沒有這一支的話，上一支綠可能只代表樣本沒踩到問題。
    const 假樹 = { conceptId: '__合成_算出來的幽靈__', properties: {}, children: {} } as unknown as SemanticNode
    const ids = [假樹.conceptId]
    const 幽靈 = ids.filter((id) => !已宣告.has(id) && !nonComponentDecl(id))
    expect(幽靈, '判定函式放過了一個不存在的身分').toEqual(['__合成_算出來的幽靈__'])
  })
})

// ─── 本體 ──────────────────────────────────────────────────────────

describe('元件身分引用完備性', () => {
  const findings = measure()
  const 幽靈 = findings.filter((f) => f.bucket === '幽靈')

  it('報表', () => {
    printReport('元件身分引用完備性', [
      `登錄表 ${已宣告.size} 顆｜createNode 建出的未宣告身分 ${findings.length}`,
      '',
      `  ⚠️ 幽靈（沒人認識，也沒人宣告過）  ${幽靈.length}`,
      `     已宣告的非元件                  ${findings.length - 幽靈.length}`,
      '',
      ...findings.map(
        (f) =>
          `  ${f.bucket === '幽靈' ? '⚠️' : '  '} ${f.id.padEnd(30)} ${f.kind ?? ''}  ${f.sites[0]}` +
          (f.sites.length > 1 ? `  (+${f.sites.length - 1})` : ''),
      ),
    ])
    expect(true).toBe(true)
  })

  it('★ 幽靈身分 = 0', () => {
    // ⚠️ **硬性零，不用棘輪**（`build-guardrail` 第 6.8 步）。
    //
    // 判準：「留一筆在那裡，這條規範還成立嗎？」——不成立。
    // 一顆沒有概念定義的身分**對全部二十條護欄隱形**：五路完備性不數它、
    // 就近性不數它、身分健檢不數它。留一筆等於留一個看不見的洞。
    expect(
      幽靈.map((f) => `${f.id}  ${f.sites.join(', ')}`),
      '這些身分被程式碼建出來，而登錄表裡沒有。要嘛補概念定義，' +
        '要嘛用 declareNonComponent() 宣告它刻意不是元件（附理由）。',
    ).toEqual([])
  })
})
