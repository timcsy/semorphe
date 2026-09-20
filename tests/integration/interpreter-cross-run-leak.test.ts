/**
 * **上一支程式不得影響下一支**——行程級的全域表。
 *
 * ## 🔴 它從哪來（2026-09-20）
 *
 * `aliases.ts` 的 `resetAliases()` 檔頭逐字寫著
 *「⚠️ 每一次執行前要清——別名是那一份程式的，不是這個行程的」，
 * 而在這一刀之前它的**呼叫者是零**。填表的（`cpp:define`／`cpp:typedef`／
 * `cpp:using_alias`）與讀表的都在執行那一路，所以它跨程式殘留。
 *
 * 🔴 **抓到它的不是哪一支測試在紅**——是 `interpreter-matches-compiler`
 * 的 251 條一起跑會紅三條，而每一條**單獨跑都綠**。
 *
 * > **一個只在「跑過別的東西之後」才錯的缺陷，
 * > 單獨重現它的每一次嘗試都會告訴你它不存在。**
 *
 * ## ⚠️ 這個檔的形狀
 *
 * 每一條都是**兩支程式、同一個行程**，而第二支**完全沒有提到**第一支的東西。
 * 🔴 **順序是判準的一部分**：反過來跑會綠。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import type { SemanticNode } from '../../src/core/types'

const ROOT = process.cwd()
let parser: Parser
let lifter: ReturnType<typeof createTestLifter>

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${ROOT}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${ROOT}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
}, 120_000)

async function run(src: string): Promise<string> {
  const full = `#include <bits/stdc++.h>\nusing namespace std;\n${src}\n`
  const tree = lifter.lift(parser.parse(full).rootNode as never) as SemanticNode
  const out: string[] = []
  const interp = new SemanticInterpreter({ maxSteps: 200_000 })
  interp.setOutputCallback((x) => out.push(x))
  await interp.execute(tree, [])
  return out.join('')
}

describe('上一支程式不得影響下一支', () => {
  it('🔴 `#define S second` 之後，另一支的 `struct S` 仍然是一個結構', async () => {
    // ★ 正向錨點：第一支自己是對的——別名真的生效了
    expect(
      await run('#define F first\n#define S second\nint main(){ pair<int,int> p = {3,4}; cout << p.F << p.S; return 0; }'),
      '★ 第一支要跑對，否則下面在驗空氣（別名根本沒被填進去）',
    ).toBe('34')

    // 第二支完全沒有提到 `#define`
    expect(
      await run('struct S{ int a; };\nint main(){ S s; s.a = 6; cout << s.a; return 0; }'),
      '🔴 上一支程式的別名活到了這一支：`S` 被解成 `second`，於是 `s` 變成一個 int',
    ).toBe('6')
  }, 120_000)

  /**
   * ⚠️ **這兩條今天【抓不到】那個洩漏**——實測：把 `resetAliases()` 註解掉，
   * 只有上面那一條紅。它們是**錨點**，守的是「這一族的其他形狀不得開始洩漏」。
   *
   * 🔴 **標成 🔴 會是一句謊話**：一支不會紅的測試與一支健康的長得一模一樣，
   * 而下一個讀到它的人會以為這一族已經被守住了。
   */
  it('★ 錨點：`#define ll long long` 之後，另一支的同名變數照舊', async () => {
    expect(
      await run('#define ll long long\nint main(){ ll x = 5; cout << x; return 0; }'),
      '★ 第一支要跑對',
    ).toBe('5')
    // 第二支把 `ll` 當成一個**變數名**——上一支的型別別名不得讓它變成別的東西
    expect(
      await run('int main(){ int ll = 9; cout << ll; return 0; }'),
      '上一支的型別別名影響了這一支的同名變數',
    ).toBe('9')
  }, 120_000)

  it('★ 錨點：`typedef` 取的小名也不得殘留', async () => {
    expect(
      await run('typedef pair<int,int> P;\nint main(){ P p = {1,2}; cout << p.first << p.second; return 0; }'),
      '★ 第一支要跑對',
    ).toBe('12')
    expect(
      await run('struct P{ int v; };\nint main(){ P p; p.v = 8; cout << p.v; return 0; }'),
      '上一支的 typedef 小名活到了這一支',
    ).toBe('8')
  }, 120_000)
})
