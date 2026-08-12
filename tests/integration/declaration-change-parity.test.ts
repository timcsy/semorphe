/**
 * 宣告改動**不得改變行為**——`specs/106` 的對照組
 *
 * ## 為什麼需要這一支
 *
 * 這一輪要動 15 顆元件的宣告（`args`／`params` 從屬性移到接點、補上漏掉的接點）。
 * 而**宣告不是描述，是驅動抽取與合成的資料**——C1 那次就是因為這個，
 * 兩度改動、兩度來回轉換變紅、兩度還原。
 *
 * 少了這支測試，任何行為變化都會被當成「大概是宣告變了的副作用」而放過。
 * 有了它，「這是宣告改動」才是一句**可以驗證的話**，不是一句宣稱。
 *
 * ## 這支測試不檢測什麼
 *
 * - **不檢測宣告改對了沒有**——那是護欄 #30 的事。這裡只問「行為變了沒有」。
 * - **不檢測沒被樣本覆蓋到的元件**——樣本涵蓋 15 顆裡實際跑得到的那些，
 *   其餘由全套測試兜底。
 * - **不檢測積木畫面**——量的是產生碼、執行輸出與來回轉換。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
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
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { createNode } from '../../src/core/semantic-tree'
import { REPO_ROOT } from '../helpers/guardrail'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode, StylePreset } from '../../src/core/types'
import apcs from '../../src/languages/cpp/styles/apcs.json'

const style = apcs as unknown as StylePreset
const BASELINE = path.join(REPO_ROOT, 'tests/baselines/declaration-change-parity.json')

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

/** 涵蓋這一輪要動的 15 顆元件。每一段都用到至少一顆。 */
const 樣本: { name: string; 碼: string; 執行?: boolean }[] = [
  { name: 'func_def + func_call', 碼: 'int add(int a, int b) { return a + b; }\nint main() { cout << add(1, 2) << endl; }', 執行: true },
  { name: 'method_call', 碼: 'int main() { string s = "hello"; cout << s.substr(1, 2) << endl; }', 執行: true },
  { name: 'print_formatted', 碼: 'int main() { printf("%d %d\\n", 1, 2); }', 執行: true },
  { name: 'input_formatted', 碼: 'int main() { int a; scanf("%d", &a); }' },
  { name: 'forward_decl', 碼: 'int f(int a);\nint main() { return 0; }' },
  { name: 'array_declare + values', 碼: 'int main() { int a[3] = {1, 2, 3}; cout << a[1] << endl; }', 執行: true },
  { name: 'var_declare 多變數', 碼: 'int main() { int a = 1, b = 2; cout << a + b << endl; }', 執行: true },
  { name: 'class_def', 碼: 'class C { public: int x; private: int y; protected: int z; };' },
  { name: 'input', 碼: 'int main() { int a; cin >> a; }' },
  { name: 'string_declare', 碼: 'int main() { string s = "abc"; cout << s << endl; }', 執行: true },
  { name: 'string_find', 碼: 'int main() { string s = "abcabc"; cout << s.find("b", 2) << endl; }', 執行: true },
  { name: 'string_append_char', 碼: 'int main() { string s = "ab"; s += \'c\'; cout << s << endl; }', 執行: true },
  { name: 'fstream', 碼: 'int main() { ifstream fin("in.txt"); ofstream fout("out.txt"); }' },
]

interface 基準 {
  _meta: { guard: string; measuredAt: string; note: string }
  產生碼: Record<string, string>
  來回: Record<string, string>
  執行: Record<string, string>
}

const lift = (code: string): SemanticNode | null => lifter.lift(tsParser.parse(code)!.rootNode as never)

function 來回一圈(code: string): string {
  const tree = lift(code)
  if (!tree) return '<lift 失敗>'
  const st = renderToBlocklyState(tree)
  const back = (st.blocks.blocks as never[]).map((b) => extractor.extract(b as never)).filter(Boolean) as SemanticNode[]
  return back.length ? generateCode(createNode('cpp:program', {}, { body: back }), 'cpp', style) : '<extract 失敗>'
}

async function 跑(code: string): Promise<string> {
  const tree = lift(code)
  if (!tree) return '<lift 失敗>'
  const interp = new SemanticInterpreter()
  try {
    await interp.execute(tree, [])
  } catch (e) {
    return `<例外：${(e as Error).message.slice(0, 60)}>`
  }
  return `${interp.getState().status}|${interp.getOutput().join('')}`
}

async function 量一次(): Promise<Omit<基準, '_meta'>> {
  const 產生碼: Record<string, string> = {}
  const 來回: Record<string, string> = {}
  const 執行: Record<string, string> = {}
  for (const s of 樣本) {
    const tree = lift(s.碼)
    產生碼[s.name] = tree ? generateCode(tree, 'cpp', style) : '<lift 失敗>'
    來回[s.name] = 來回一圈(s.碼)
    if (s.執行) 執行[s.name] = await 跑(s.碼)
  }
  return { 產生碼, 來回, 執行 }
}

describe('宣告改動不得改變行為（specs/106 的對照組）', () => {
  it('基準：錄下產生碼、來回轉換與執行輸出', async () => {
    const 現況 = await 量一次()
    if (process.env.GENERATE_BASELINE) {
      fs.writeFileSync(
        BASELINE,
        JSON.stringify(
          {
            _meta: {
              guard: 'declaration-change-parity',
              measuredAt: new Date().toISOString().slice(0, 10),
              note:
                '**這不是棘輪，是對照組**——它不准變。任何一筆差異都代表「宣告改動」改變了行為，' +
                '而 specs/106 的前提是它不會。要重產必須說明是哪一筆為什麼變，' +
                '而「為什麼變」的合法答案只有「修了一個真的 bug」。',
            },
            ...現況,
          },
          null,
          2,
        ) + '\n',
        'utf8',
      )
    }
    expect(fs.existsSync(BASELINE), '基準檔不存在——先用 GENERATE_BASELINE=1 錄一次').toBe(true)
  })

  it('★ 證明基準真的量到了東西（不是一堆 <lift 失敗>）', () => {
    // `build-guardrail` 第 10 步：測試通過之前，先證明它真的測到了東西。
    // 全部失敗的基準與健康的基準在「逐字相同」的比對下**行為一模一樣**。
    const base: 基準 = JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
    const 壞掉的 = Object.entries(base.產生碼).filter(([, v]) => v.startsWith('<'))
    expect(壞掉的.map(([k]) => k), '這些樣本連 lift 都沒過').toEqual([])
    const 有輸出的 = Object.values(base.執行).filter((v) => v.includes('|') && v.split('|')[1].length > 0)
    expect(有輸出的.length, '一個執行樣本都沒有輸出 → 執行那一路沒被覆蓋').toBeGreaterThan(4)
  })

  it('產生碼逐字相同', async () => {
    const base: 基準 = JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
    expect((await 量一次()).產生碼).toEqual(base.產生碼)
  })

  it('來回轉換逐字相同', async () => {
    const base: 基準 = JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
    expect((await 量一次()).來回).toEqual(base.來回)
  })

  it('執行輸出逐字相同', async () => {
    const base: 基準 = JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
    expect((await 量一次()).執行).toEqual(base.執行)
  })
})
