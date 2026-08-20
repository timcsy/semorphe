/**
 * `cpp:pin_constant` 的自證測——每一條負向前面先釘一個正向。
 *
 * ## 🔴 為什麼它不是 `cpp:builtin_constant` 的一個新列舉值
 *
 * 語義上 `HIGH` 就是「環境提供的具名常數」，與 `EOF`／`NULL` 同族
 * ——**而併進去會讓目標機制失效**：
 *
 * > **課程清單（`levelTree`）過濾得了一顆【概念】，
 * > 過濾不了一顆概念裡的一個【列舉值】。**
 *
 * 併進去的話，學 C++ 的學生會在下拉選單裡看到 `HIGH`／`INPUT_PULLUP`，
 * 而沒有任何機制擋得住。⚠️ 與 spec 136 的 C 課程清單同一條理由。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
import { generateCode } from '../../../core/projection/code-generator'
import apcs from '../../../languages/cpp/styles/apcs.json'
import { PIN_CONSTANTS } from './execute'
import type { SemanticNode, StylePreset } from '../../../core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const lift = (c: string): SemanticNode =>
  createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const collect = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) collect(k, out)
  return out
}
const run = async (c: string): Promise<string> => {
  const i = new SemanticInterpreter({ maxSteps: 100_000 })
  await i.execute(lift(c))
  return i.getOutput().join('')
}

describe('膠囊自證：cpp:pin_constant', () => {
  /**
   * 🔴 **這顆【沒有】lift 路，而那是一次翻車換來的。**
   *
   * 第一版有 `lift-pattern.json`，靠識別字的名字認人。第三十二條護欄當場抓到：
   * 語料裡有 `enum Level { LOW = -1, MEDIUM = 0, HIGH = 1 };`，
   * 而 `cout << LOW` 印出 **0** 而不是 **-1**。
   *
   * > **一個靠「識別字的名字」認人的樣式，會把使用者自己宣告的名字搶走。**
   * > 而 `HIGH`／`LOW`／`INPUT`／`OUTPUT` 正是【最常見的列舉成員名】。
   *
   * ⚠️ 既有的 `builtin_constant` 用同一個做法（`EOF`／`NULL` 靠名字 lift）
   * ——差別**不在做法，在那些名字幾乎沒有人會重新宣告**。
   */
  it('★ 從程式碼進來時它是變數參照——而【那是對的】', () => {
    const ids = collect(lift('int main(){ int x = HIGH; }'))
    expect(ids, '🔴 名字又被樣式搶走了').not.toContain('cpp:pin_constant')
    expect(ids).toContain('cpp:var_ref')
  })

  it('★ 而使用者自己宣告的同名東西不會被搶走', async () => {
    const out = await run('#include <iostream>\nusing namespace std;\n' +
      'int main(){ enum Level { LOW = -1, MEDIUM = 0, HIGH = 1 }; cout << LOW; }')
    expect(out, '🔴 使用者宣告的 LOW = -1 被腳位常數搶成 0').toBe('-1')
  })

  /**
   * ⚠️ 從**積木**來的節點才會有 `cpp:pin_constant` 這顆身分
   * ——程式碼那一側進來的是 `var_ref`（見上面那兩支）。
   * 所以這一支**直接餵一顆合成的節點**給產生器。
   */
  it('★ generate：從積木來的節點產得出名字', () => {
    const node = { componentId: 'cpp:pin_constant', properties: { value: 'INPUT_PULLUP' }, children: {} } as unknown as SemanticNode
    const code = generateCode(
      { componentId: 'cpp:program', properties: {}, children: { body: [
        { componentId: 'cpp:pin_mode', properties: {}, children: {
          pin: [{ componentId: 'cpp:literal_number', properties: { value: '2' }, children: {} } as unknown as SemanticNode],
          mode: [node],
        } } as unknown as SemanticNode,
      ] } } as unknown as SemanticNode, 'cpp', apcs as unknown as StylePreset)
    expect(code, '🔴 積木上的腳位常數產不出名字').toContain('pinMode(2, INPUT_PULLUP)')
  })

  it('★ round-trip：程式碼 → 樹 → 程式碼，名字不變', () => {
    const src = 'int main(){ int a = HIGH; int b = A0; }'
    const once = generateCode(lift(src), 'cpp', apcs as unknown as StylePreset)
    const twice = generateCode(lift(once), 'cpp', apcs as unknown as StylePreset)
    expect(twice).toBe(once)
    expect(once).toContain('HIGH')
    expect(once).toContain('A0')
  })

  it('★ execute：真的算得出數字（不是回 0 了事）', async () => {
    const out = await run('#include <iostream>\nusing namespace std;\nint main(){ cout << HIGH << "," << INPUT_PULLUP << "," << A0; }')
    expect(out, '🔴 執行路沒有實際輸出——一個全錄成空字串的基準等於沒被覆蓋').toBe('1,2,14')
  })

  /**
   * 🔴 **這一支釘的是一個【真的】會咬人的巧合。**
   *
   * `LOW` 與 `INPUT` 都是 0、`HIGH` 與 `OUTPUT` 都是 1——那是 Arduino 自己的定義。
   * 於是 `digitalWrite(13, OUTPUT)` **編得過、跑得動，而意思是 `HIGH`**。
   *
   * ⚠️ 本輪**不擋這個誤用**（擋它要知道引數的角色，那是診斷系統的事），
   * 而**把這個事實釘下來**，免得未來有人「順手」把數值改成不重疊的。
   */
  it('★ LOW/INPUT 都是 0、HIGH/OUTPUT 都是 1——那是 Arduino 的定義，不是筆誤', () => {
    expect(PIN_CONSTANTS.LOW).toBe(PIN_CONSTANTS.INPUT)
    expect(PIN_CONSTANTS.HIGH).toBe(PIN_CONSTANTS.OUTPUT)
    expect(PIN_CONSTANTS.INPUT_PULLUP).toBe(2)
  })
})
