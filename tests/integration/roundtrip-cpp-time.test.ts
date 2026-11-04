/**
 * 2026-11-04（spec 212，6c-5）：判準從參照編譯器換成 Cella——原本 g++ 跑原始碼與產回的碼比輸出，現在 Cella 跑兩份比輸出
 * （兩份都必須判 accept、印出的東西逐字相同；不再因為「沒有參照編譯器」而跳過）。
 *
 * **`cpp:time`（`time(0)`）的往返**（第 395 刀，component-roundtrip）。
 *
 * 判準三層：
 * 1. **輸出等價**：原始程式與 lift → generate 產回來的，Cella 跑出同樣的輸出（兩份都 accept）。
 *    ⚠️ `time(0)` 的值每次不同——程式只印與時間無關的結果（「大於某一年」「兩次相差不到一秒」）。
 * 2. **元件身分**：樹裡真的是 `cpp:time`，不是退化成通用的函式呼叫而碰巧產出同樣的字。
 * 3. **二次往返**：產回來的程式碼再 lift 一次，元件身分的序列相同。
 *
 * 另：只認 `time(0)`——`time(NULL)`／`time(nullptr)`／`std::time(0)` 照舊是通用函式呼叫，文字不變。
 * ⚠️ 「補丁器補得到 `<ctime>`」由膠囊自己的 `src/components/cpp/time/spec.test.ts` 驗。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { runCella, describeCellaResult, expectCellaOut, knownCellaGap } from '../helpers/cella-run'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const S = apcs as unknown as StylePreset
let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const lift = (c: string): SemanticNode => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const ids = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) ids(k, out)
  return out
}
const H = '#include <bits/stdc++.h>\nusing namespace std;\n'

/**
 * `clock`：期望值依賴真實的時鐘（`time(0)` 大於某一年）。Cella 對一般的 C++ 程式把時鐘固定在 0，
 * 判決的 `assumes` 列了 `environment／time.now`——這兩支在 Cella 上印 0，見下面的 knownCellaGap。
 */
const CASES: { name: string; body: string; expect: string; clock?: true }[] = [
  { name: '亂數種子（課文第 12 課的寫法）', body: 'int main() { srand(time(0)); int r = rand() % 6 + 1; cout << (r >= 1 && r <= 6) << endl; return 0; }', expect: '1\n' },
  { name: '當運算式比較', body: 'int main() { cout << (time(0) > 1700000000) << endl; return 0; }', expect: '1\n', clock: true },
  { name: '存進變數、兩次相差不到一秒', body: 'int main() { long t = time(0); long u = time(0); cout << (u - t <= 1) << endl; return 0; }', expect: '1\n' },
  { name: '當函式的引數', body: 'int pos(long s) { return s > 0; }\nint main() { cout << pos(time(0)) << endl; return 0; }', expect: '1\n', clock: true },
]

describe('往返：cpp:time', () => {
  for (const c of CASES) {
    it(`★ ${c.name}：元件身分、二次往返、輸出等價`, async () => {
      const src = H + c.body
      const tree = lift(src)
      expect(ids(tree), '🔴 元件身分：time(0) 沒有被認成 cpp:time').toContain('cpp:time')
      expect(ids(tree)).not.toContain('cpp:raw_code')
      const gen = generateCode(tree, 'cpp', S)
      expect(gen).toContain('time(0)')
      const again = lift(gen)
      expect(ids(again), '🔴 二次往返：元件序列變了').toEqual(ids(tree))
      const want = await runCella(src)
      expect(want.verdict, `原始程式在 Cella 判不是 accept——是題目壞了，或 Cella 的缺口：\n${describeCellaResult(want)}`).toBe('accept')
      const mine = await runCella(gen)
      expect(mine.verdict, `🔴 產回來的程式在 Cella 判不是 accept：\n${describeCellaResult(mine)}`).toBe('accept')
      expect(mine.out, '🔴 產回來的程式輸出不同').toBe(want.out)
      const fixedClock = want.assumes.some((a) => a.choice === 'time.now')
      if (!c.clock) {
        expect(want.out, '原始程式自己就跑不出預期——是題目壞了').toBe(c.expect)
        return
      }
      // 歸類：Cella 未支援——一般的 C++ 程式沒有真實時鐘，`time(0)` 固定是 0（判決 assumes 列了 environment／time.now）。
      //   來回一趟的行為不變照舊驗（上面三行）；寫死的期望值要真實時鐘，Cella 給得出時鐘的那天這裡會紅——那時拿掉包裝。
      await knownCellaGap(/Cella 的時鐘固定在 0/, async () => {
        if (fixedClock && want.out !== c.expect) throw new Error(`Cella 的時鐘固定在 0（assumes：environment／time.now），印出 ${JSON.stringify(want.out)}`)
        expect(want.out, '原始程式自己就跑不出預期——是題目壞了').toBe(c.expect)
      })
    })
  }

  it('★ 只認 time(0)：其他寫法照舊是通用函式呼叫，文字原封不動', async () => {
    expect(ids(lift(H + 'int main() { srand(time(0)); }')), '正向錨點').toContain('cpp:time')
    for (const call of ['time(NULL)', 'time(nullptr)', 'std::time(0)']) {
      const src = H + `int main() { srand(${call}); cout << 1 << endl; return 0; }`
      const tree = lift(src)
      expect(ids(tree), call).not.toContain('cpp:time')
      expect(ids(tree), call).not.toContain('cpp:raw_code')
      const gen = generateCode(tree, 'cpp', S)
      expect(gen, call).toContain(`srand(${call})`)
      await expectCellaOut(gen, '1\n')
    }
  })
})
