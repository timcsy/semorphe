/**
 * `cpp:pair_declare` 的**自證測**——一顆被宣告成「顯式的空」的元件
 *
 * ## 這裡放什麼
 *
 * 推導不出來的那件事：**這顆元件的三路曾經互相矛盾**，而每一路單獨看都合理。
 *
 * ```
 * generate.ts            讀 type1 / type2          ✅
 * forms/blocks.json      TYPE1→type1、TYPE2→type2   ✅
 * lift（共用判別式）      產出 type: "int,string"    🔴  ← 唯一錯的那一路
 * component.json         skipPaths: ["execute"]     🔴  ← 一個假的「顯式的空」
 * ```
 *
 * 兩個錯法的症狀不同，而都很安靜：
 *
 * - **`type` 是一個要 parse 回結構才能用的字串**——缺陷帳記過
 *   （`defect-ledger.json` 的 `_meta`：「宣告寫的 type1/type2 才是對的設計，
 *   所以**刻意不改宣告**，改了會讓護欄變綠而缺陷還在」）
 * - **`skipPaths: ["execute"]` ＋ 理由 `"declarative"`**——而 `pair<int,int> p;`
 *   當然有執行語義。🔴 **一個假的「顯式的空」比一個誠實的遺漏危險：
 *   完備性護欄看到它會變綠。**
 *
 * 兩者合起來讓 `p.first` 丟 `UNDECLARED_VAR: p`，佔第三十二條護欄
 * 18 段缺口裡的 **5 段**。2026-08-13 修。
 *
 * ## ⚠️ 而初始值的遺失是**對稱**的
 *
 * `pair<int,string> p = make_pair(…)` 的 `= …` 原本辨識掉、產生也掉，
 * 於是**來回轉換比對一直是綠的**（見 `strategies.ts` 的 `hasInitSourceDecl` 檔頭）。
 *
 * > **一個對稱的資料遺失，比不對稱的難發現——因為它不會讓任何比對變紅。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { setupTestRenderer } from '../../../../tests/helpers/setup-renderer'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
import type { Lifter } from '../../../core/lift/lifter'
import type { SemanticNode, StylePreset } from '../../../core/types'
import apcs from '../../../languages/cpp/styles/apcs.json'

const style = apcs as unknown as StylePreset
let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
  setupTestRenderer()
})

const lift = (code: string): SemanticNode | null => lifter.lift(tsParser.parse(code)!.rootNode as never)

function find(n: SemanticNode | null, id: string): SemanticNode | null {
  if (!n) return null
  if (n.componentId === id) return n
  for (const kids of Object.values(n.children ?? {})) {
    for (const k of kids as SemanticNode[]) {
      const hit = find(k, id)
      if (hit) return hit
    }
  }
  return null
}

async function run(code: string): Promise<string> {
  const i = new SemanticInterpreter({ maxSteps: 100000 })
  await i.execute(lift(code) as SemanticNode)
  return i.getOutput().join('')
}

const H = '#include <iostream>\n#include <utility>\n#include <string>\nusing namespace std;\n'

describe('cpp:pair_declare', () => {
  it('★ 正向錨點：這段碼真的產生了 cpp:pair_declare', () => {
    expect(find(lift(`${H}int main(){ pair<int,int> p; return 0; }`), 'cpp:pair_declare')).not.toBeNull()
  })

  it('🔴 兩個型別參數拆成 type1／type2，不是一個 "int,string" 字串', () => {
    const n = find(lift(`${H}int main(){ pair<int,string> p; return 0; }`), 'cpp:pair_declare')!
    expect(n.properties.type1).toBe('int')
    expect(n.properties.type2).toBe('string')
    // ⚠️ 釘住那個字串**不得回來**。它回來的話 generate 與 forms 兩路會同時錯，
    // 而它們錯得很安靜（產出 `pair<int, int>` 而使用者寫的是 `pair<int,string>`）。
    expect(n.properties.type).toBeUndefined()
  })

  it('宣告 + 欄位讀寫——這 5 段是第三十二條護欄的缺口', async () => {
    expect(await run(`${H}int main(){ pair<int,int> p; p.first=1; p.second=2; cout << p.first << " " << p.second << endl; return 0; }`)).toBe(
      '1 2\n',
    )
  })

  it('make_pair 初始化——初始值不再被對稱地丟掉', async () => {
    expect(await run(`${H}int main(){ pair<int,string> p = make_pair(42,"hello"); cout << p.first << " " << p.second << endl; return 0; }`)).toBe(
      '42 hello\n',
    )
  })

  it('★ 而產生器要把初始值產回去——對稱遺失的另一半', () => {
    const src = `${H}int main(){ pair<int,string> p = make_pair(42,"hello"); return 0; }`
    const out = generateCode(lift(src)!, 'cpp', style)
    expect(out).toContain('make_pair(42, "hello")')
    // 不動點：把產出的碼再走一次，結果必須一樣。
    // ⚠️ 這一句才是真正釘住「不再對稱遺失」的那一句——初始值若還是兩邊都掉，
    // 上面那個 toContain 會紅，而**如果只有一邊掉，只有這一句會紅**。
    expect(generateCode(lift(out)!, 'cpp', style)).toBe(out)
  })

  it('函式回傳 pair', async () => {
    expect(
      await run(
        `${H}pair<int,int> mm(int a,int b){ if(a<b) return make_pair(a,b); return make_pair(b,a); }\nint main(){ pair<int,int> r = mm(7,3); cout << r.first << " " << r.second << endl; return 0; }`,
      ),
    ).toBe('3 7\n')
  })

  it('未初始化的欄位用型別的預設值', async () => {
    expect(await run(`${H}int main(){ pair<int,double> p; cout << p.first << endl; return 0; }`)).toBe('0\n')
  })

  it('🔴 反向：初始值是複製不是共用', async () => {
    // 與 vector_declare 同一條理由。共用的話改一個另一個跟著變，
    // 而那種錯只在「先複製再改」的程式裡現形。
    expect(
      await run(
        `${H}int main(){ pair<int,int> a = make_pair(1,2); pair<int,int> b = a; b.first = 99; cout << a.first << " " << b.first << endl; return 0; }`,
      ),
    ).toBe('1 99\n')
  })
})
