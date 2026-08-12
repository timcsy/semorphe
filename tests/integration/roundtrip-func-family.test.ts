/**
 * 函式族的參數：**原始碼 → 語義樹 → 積木 → 語義樹 → 原始碼** 逐字相同
 *
 * ## 為什麼需要這一支
 *
 * 第二十九條護欄（符合性）第一次跑抓到七筆，其中六筆是同一個形狀：
 * 宣告了 `params` 接點、積木形態表達不出來，於是走一次投影參數就消失。
 *
 * ```
 * [](int a, int b) { return a + b; }   →   []() { return a + b; }
 * C(int a) {}                          →   C() {}
 * ```
 *
 * **產出仍然是合法的 C++**，所以沒有任何錯誤訊息——程式只是**不再是使用者
 * 寫的那一段**。而任何一次工作區重新序列化（切語言、切風格、存檔重載）
 * 都會走這條路。
 *
 * ## 這支測試不檢測什麼
 *
 * - **不檢測積木長什麼樣**——它比的是走完來回之後的**原始碼**。
 *   一顆積木把參數顯示成亂碼但存得對，這裡照樣綠。
 * - **不檢測 Blockly**——量的是「語義樹 → Blockly state → 語義樹」，
 *   不是「Blockly state → 畫面」。畫面要靠瀏覽器實測。
 * - **不檢測執行語義**——參數保住不代表函式跑得對。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { renderToBlocklyState } from '../../src/core/projection/block-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { registerCppExtractStrategies } from '../../src/languages/cpp/extractors/extract-strategies'
import { allCppConcepts, allCppProjections } from '../../src/languages/cpp/all-declarations'
import { createNode } from '../../src/core/semantic-tree'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode, StylePreset } from '../../src/core/types'
import apcs from '../../src/languages/cpp/styles/apcs.json'

const style = apcs as unknown as StylePreset
let tsParser: Parser
let lifter: Lifter
let extractor: PatternExtractor

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
  setupTestRenderer()
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(allCppConcepts() as never, allCppProjections() as never)
  extractor = new PatternExtractor()
  extractor.loadBlockSpecs(reg.getAll())
  registerCppExtractStrategies(extractor)
})

/** 原始碼 → 語義樹 → Blockly state → 語義樹 → 原始碼。 */
function walkAll(code: string): string {
  const tree = lifter.lift(tsParser.parse(code)!.rootNode as never)
  if (!tree) return '<lift 失敗>'
  const st = renderToBlocklyState(tree)
  const back = (st.blocks.blocks as never[])
    .map((b) => extractor.extract(b as never))
    .filter(Boolean) as SemanticNode[]
  if (!back.length) return '<extract 失敗>'
  return generateCode(createNode('cpp:program', {}, { body: back }), 'cpp', style)
}

/** 直接產生（不走積木）——對照組，用來分辨「投影掉了」與「lift 或 generate 本來就掉」。 */
function directGenerate(code: string): string {
  const tree = lifter.lift(tsParser.parse(code)!.rootNode as never)
  return tree ? generateCode(tree, 'cpp', style) : '<lift 失敗>'
}

interface samples { name: string; code: string; expectContains: string[] }

/** 六顆元件 × （有參數／無參數）。 */
const sampleGroup: samples[] = [
  // ── cpp:lambda ──
  { name: 'lambda 有參數', code: 'int main() { auto f = [](int a, int b) { return a + b; }; }', expectContains: ['int a', 'int b'] },
  { name: 'lambda 無參數', code: 'int main() { auto f = []() { return 1; }; }', expectContains: ['[]()'] },
  // ── cpp:constructor ──
  { name: 'constructor 有參數', code: 'class C { public: C(int a) {} };', expectContains: ['int a'] },
  { name: 'constructor 無參數', code: 'class C { public: C() {} };', expectContains: ['C()'] },
  // ── cpp:method_virtual ──
  { name: 'method_virtual 有參數', code: 'class C { public: virtual int f(int a) { return a; } };', expectContains: ['int a'] },
  // ── cpp:method_override ──
  { name: 'method_override 有參數', code: 'class C : public B { public: int f(int a) override { return a; } };', expectContains: ['int a'] },
  // ── cpp:method_virtual_pure ──
  // ⚠️ 它**沒有 body 接點**（research 的未驗項）——缺 body 會不會影響渲染。
  { name: 'method_virtual_pure 有參數', code: 'class C { public: virtual int f(int a) = 0; };', expectContains: ['int a'] },
  // ── cpp:template_function ──
  { name: 'template_function 有參數', code: 'template<typename T> T f(T a) { return a; }', expectContains: ['T a'] },
  // ── 邊界：型別自己含分隔符（research R2，SC-003）──
  { name: '型別含逗號', code: 'int main() { auto f = [](map<int,int> m, int k) { return k; }; }', expectContains: ['map<int,int> m', 'int k'] },
  // ── 邊界：型別含空白 ──
  { name: '型別含空白', code: 'int main() { auto f = [](long long n) { return n; }; }', expectContains: ['long long n'] },
]

describe('函式族的參數走得過投影嗎', () => {
  it('★ 對照組：直接產生（不走積木）必須保住參數——否則紅的是 lift 或 generate，不是投影', () => {
    // 沒有這一則的話，下面每一支紅燈都可能是 lift 沒抓到參數，
    // 而修錯地方的成本比修對高得多。
    for (const s of sampleGroup) {
      const direct = directGenerate(s.code)
      for (const expect2 of s.expectContains) {
        expect(direct, `${s.name}：直接產生就掉了 → 紅的不是投影`).toContain(expect2)
      }
    }
  })

  for (const s of sampleGroup) {
    it(`${s.name}：走完投影來回，參數還在`, () => {
      const produced = walkAll(s.code)
      for (const expect2 of s.expectContains) {
        expect(produced, `走完來回之後「${expect2}」不見了`).toContain(expect2)
      }
    })
  }

  it('★ 零參數不得長出空的參數表示', () => {
    const produced = walkAll('int main() { auto f = []() { return 1; }; }')
    expect(produced).not.toContain('[]( )')
    expect(produced).not.toContain('[](void)')
    expect(produced).not.toContain('[](,')
  })
})
