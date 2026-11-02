/**
 * `find_first_not_of` / `find_last_not_of`（093）——五路齊備的新概念
 *
 * ## 這是「加功能」，不是清理
 *
 * 前面七批查阻斷者，發現的多是**過期的標記**。這一批不同：
 * 標成 `[UNSUPPORTED:字串搜尋函式 find_first_not_of／find_last_not_of
 * 尚無對應概念]` 的那些，**標記是對的**——那兩個概念真的不存在。
 *
 * ## 五路齊備，不是只補一條
 *
 * | 路 | 交付 |
 * |---|---|
 * | 語義 | `components.json` 的概念定義 |
 * | 投影 | `blocks.json` 的積木 |
 * | 產生 | 膠囊的 `generate.ts`（`components/cpp/string_find_first_not_of/`）——🪦 原本寫「積木的 `codeTemplate`」，那一套產品從不裝，第 384 刀刪除 |
 * | 辨識 | `lifters/io.ts` 的方法分派 |
 * | 執行 | `std/string/executors.ts` |
 *
 * 只補執行那一條的話，孤兒實作護欄會報出來——082 就撞過一次
 * （順手加了五個字元分類的執行器而沒有其他四路）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { expectCellaOut, knownCellaGap } from '../helpers/cella-run'
import type { Lifter } from '../../src/core/lift/lifter'
import type { StylePreset, SemanticNode } from '../../src/core/types'
import apcs from '../../src/languages/cpp/styles/apcs.json'

let tp: Parser
let lifter: Lifter
const style = apcs as unknown as StylePreset

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tp = new Parser()
  tp.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})

const wrap = (body: string): string =>
  `#include <iostream>\n#include <string>\nusing namespace std;\nint main(){ ${body} return 0; }`

const lift = (body: string): SemanticNode | null => lifter.lift(tp.parse(wrap(body))!.rootNode as never)

function components(body: string): string[] {
  const out: string[] = []
  const walk = (n: SemanticNode | null | undefined): void => {
    if (!n) return
    if (n.componentId) out.push(n.componentId)
    for (const k of Object.keys(n.slots ?? {}))
      for (const c of (n.slots as Record<string, SemanticNode[]>)[k] ?? []) walk(c)
  }
  walk(lift(body))
  return out
}

// 🔴 spec 202（重構 6c-2d）：執行判準從 JS 直譯器換成 Cella（`tests/helpers/cella-run.ts`）
const run = (body: string, want: string) => expectCellaOut(wrap(body), want)
// Cella 未支援：0.1.202611020258 的 std::string 模型沒有 find_first_not_of／find_last_not_of（判 unknown／unsupported）
const UNSUPPORTED = /unsupported：the model's 'std::string' has no member 'find_(first|last)_not_of'/

describe('辨識：兩個方法各自拿到專屬身分', () => {
  it('★ find_first_not_of', () => {
    expect(components('string s = "  hi"; cout << s.find_first_not_of(" ");'))
      .toContain('cpp:string_find_first_not_of')
  })

  it('★ find_last_not_of', () => {
    expect(components('string s = "hi  "; cout << s.find_last_not_of(" ");'))
      .toContain('cpp:string_find_last_not_of')
  })

  it('★ 一般的 find 不得被混進來', () => {
    const c = components('string s = "abc"; cout << s.find("b");')
    expect(c).toContain('cpp:string_find')
    expect(c).not.toContain('cpp:string_find_first_not_of')
  })
})

describe('產生：來回轉換保住方法名', () => {
  it('★ 兩個方法名各自產回', () => {
    const g1 = generateCode(lift('string s = "  hi"; cout << s.find_first_not_of(" ");') as never, 'cpp', style)
    expect(g1).toContain('find_first_not_of')
    const g2 = generateCode(lift('string s = "hi  "; cout << s.find_last_not_of(" ");') as never, 'cpp', style)
    expect(g2).toContain('find_last_not_of')
  })
})

describe('執行：期望值由 g++ 決定', () => {
  it('🟡 已知缺陷（修好時這條會紅）：★ 去頭尾空白的兩個位置（g++ 印 `2 3`）', async () => {
    await knownCellaGap(UNSUPPORTED, () =>
      run('string s = "  hi  "; cout << s.find_first_not_of(" ") << " " << s.find_last_not_of(" ");', '2 3'))
  })

  // 依據：g++ -std=c++17 印 18446744073709551615（npos = size_t(-1)）；原本的 -1 是 JS 直譯器的取捨（理由見 092）
  it('🟡 已知缺陷（修好時這條會紅）：★ 全部都屬於那組字元時回 npos', async () => {
    await knownCellaGap(UNSUPPORTED, () => run('string s = "   "; cout << s.find_first_not_of(" ");', '18446744073709551615'))
  })

  it('🟡 已知缺陷（修好時這條會紅）：★ 多個字元的集合', async () => {
    await knownCellaGap(UNSUPPORTED, () => run('string s = "aab1"; cout << s.find_first_not_of("ab");', '3'))
  })

  it('🟡 已知缺陷（修好時這條會紅）：★ 空集合 → 第一個字元就不屬於它', async () => {
    await knownCellaGap(UNSUPPORTED, () => run('string s = "xy"; cout << s.find_first_not_of("");', '0'))
  })
})
