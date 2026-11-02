/**
 * 🔴 檔案最外層的東西，不得被搬進進入點。
 *
 * 2026-09-01 錄 GIF 時量到：貼一段 `#define SQ(x) …` ＋ int main（…） 進去，
 * 產出的程式碼把那行 `#define` 放進了 `main` 裡面（還縮排了）。
 * 字沒被改，位置被改了——而它在 `main` 之前的任何使用都會壞掉。
 *
 * > 一句「我不會動你的東西」的承諾，要連【它在哪裡】一起算。
 *
 * ## ⚠️ 這支測試走的是【真的那條路】
 *
 * ⚠️ **註解裡不寫含大括號／分號的反引號**：第五十三與第三十一條護欄把
 * `tests/integration/` 裡的反引號片段當成 C++ 語料，於是一段長得像 C++ 的
 * 註解會被餵進解析器，把殘差與形狀的數字一起弄髒（實作時當場撞到兩次）。
 *
 * > **一個從原始碼裡撈語料的掃描器，撈得到的不只有語料。**
 *
 * `generateCode` ＋ `setProgramScaffold` ＋ `setScaffoldConfig` 的 cognitiveLevel 0
 * ——`scaffold-codegen.test.ts` 的註解逐字寫著它「是 `SyncController.handleEditBlocks`
 * 呼叫的同一支」。
 *
 * 🔴 而 2026-09-02 我一度以為 `generateCode` 不在產品路徑上（`project_dead_exports`
 * 記著它「384 次測試引用而零產品呼叫者」）——**那是把兩件事混在一起**：
 * 不在產品路徑上的是「沒有設好鷹架全域就呼叫它」的那種用法。
 *
 * > **一個「這支函式沒有產品呼叫者」的結論，要問清楚是【這支】還是
 * > 【這種呼叫方式】——否則它會讓人放棄唯一對的架子。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode, setDependencyResolver, setProgramScaffold, setScaffoldConfig } from '../../src/core/projection/code-generator'
import { createPopulatedRegistry } from '../../src/languages/cpp/std'
import { CppScaffold } from '../../src/languages/cpp/cpp-scaffold'
import { cppStripScaffoldNodes } from '../../src/languages/cpp/cpp-scaffold-filter'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const STYLE: StylePreset = {
  id: 'apcs',
  name: { 'zh-TW': 'APCS', en: 'APCS' },
  io_style: 'cout',
  naming_convention: 'camelCase',
  indent_size: 4,
  brace_style: 'K&R',
  namespace_style: 'using',
  header_style: 'individual',
}

let tp: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => process.cwd() + '/public/' + s })
  tp = new Parser()
  tp.setLanguage(await Language.load(process.cwd() + '/public/tree-sitter-cpp.wasm'))
  lifter = createTestLifter()
  registerCppLanguage()
  const resolver = createPopulatedRegistry()
  setDependencyResolver(resolver)
  setProgramScaffold(new CppScaffold(resolver))
  setScaffoldConfig({ cognitiveLevel: 0 })
})

/** 走真的那條路：程式碼 → 樹 → 積木看得到的樹 → 回到程式碼。 */
function roundTrip(src: string): string {
  const tree = lifter.lift(tp.parse(src)!.rootNode as never) as unknown as SemanticNode
  const shown = cppStripScaffoldNodes(tree, 'main')
  return generateCode(shown as never, 'cpp', STYLE)
}

const lineOf = (out: string, needle: string): number =>
  out.split('\n').findIndex((l) => l.includes(needle))

describe('最外層的東西留在最外層', () => {
  it('⚠️ 入口條件：一支普通的程式轉得回去，而且框是產生器補的', () => {
    const out = roundTrip('int main() {\n  return 0;\n}')
    expect(out, out).toContain('int main()')
  })

  it('🔴 `#define` 不得跑進 main 裡面', () => {
    const out = roundTrip('#define SQ(x) ((x)*(x))\nint main() {\n  return 0;\n}')
    expect(lineOf(out, '#define'), '產出：\n' + out).toBeGreaterThanOrEqual(0)
    expect(lineOf(out, '#define'), '#define 跑到 main 後面了：\n' + out)
      .toBeLessThan(lineOf(out, 'int main'))
  })

  it('🔴 使用者自己的函式也不得跑進 main 裡面', () => {
    const out = roundTrip('int twice(int x) {\n  return x * 2;\n}\nint main() {\n  return 0;\n}')
    expect(lineOf(out, 'twice'), '產出：\n' + out).toBeGreaterThanOrEqual(0)
    expect(lineOf(out, 'twice'), '函式跑到 main 後面了：\n' + out)
      .toBeLessThan(lineOf(out, 'int main'))
  })

  // 🔴 第 223 刀（218 的瀏覽器驗收翻出來的）：隱藏骨架下，積木一動、轉回程式碼，**頂層的 struct 跑進了 main**。
  //    區域類別在 C++ 合法、輸出不變，所以來回測試抓不到——而 main 外面的函式一用到那個型別就編不過。
  it.each([
    ['struct', 'struct P {\n  int x;\n};', 'struct P'],
    ['class', 'class C {\npublic:\n  int v;\n};', 'class C'],
    ['enum', 'enum Color { RED, GREEN };', 'enum Color'],
    ['樣板函式（函式裡根本不能宣告樣板）', 'template <typename T>\nT big(T a, T b) {\n  return a > b ? a : b;\n}', 'template'],
  ])('🔴 型別定義不得跑進 main 裡面：%s', (_n, decl, needle) => {
    const out = roundTrip(`${decl}\nint main() {\n  return 0;\n}`)
    expect(lineOf(out, needle), '產出：\n' + out).toBeGreaterThanOrEqual(0)
    expect(lineOf(out, needle), `${needle} 跑到 main 後面了：\n` + out).toBeLessThan(lineOf(out, 'int main'))
  })

  it('🔴 struct 與用到它的函式：兩個都在 main 外面、順序不變（否則那個函式編不過）', () => {
    const out = roundTrip('struct P {\n  int x;\n};\nint get(P p) {\n  return p.x;\n}\nint main() {\n  P p;\n  p.x = 3;\n  return get(p);\n}')
    const s = lineOf(out, 'struct P'), f = lineOf(out, 'int get'), m = lineOf(out, 'int main')
    expect(s, '產出：\n' + out).toBeGreaterThanOrEqual(0)
    expect(s < f && f < m, '產出：\n' + out).toBe(true)
  })

  it('★ 錨點：main 裡的區域變數宣告留在 main 裡（只搬型別與函式，不是什麼都搬出去）', () => {
    const out = roundTrip('int main() {\n  int n = 3;\n  return n;\n}')
    expect(lineOf(out, 'int n'), '產出：\n' + out).toBeGreaterThan(lineOf(out, 'int main'))
  })
})

