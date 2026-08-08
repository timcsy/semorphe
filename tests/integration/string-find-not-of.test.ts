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
 * | 語義 | `concepts.json` 的概念定義 |
 * | 投影 | `blocks.json` 的積木 |
 * | 產生 | 積木的 `codeTemplate` |
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
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
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

function concepts(body: string): string[] {
  const out: string[] = []
  const walk = (n: SemanticNode | null | undefined): void => {
    if (!n) return
    if (n.conceptId) out.push(n.conceptId)
    for (const k of Object.keys(n.children ?? {}))
      for (const c of (n.children as Record<string, SemanticNode[]>)[k] ?? []) walk(c)
  }
  walk(lift(body))
  return out
}

async function run(body: string): Promise<string> {
  const interp = new SemanticInterpreter({ maxSteps: 50000 })
  await interp.execute(lift(body) as never)
  return interp.getOutput().join('')
}

describe('辨識：兩個方法各自拿到專屬身分', () => {
  it('★ find_first_not_of', () => {
    expect(concepts('string s = "  hi"; cout << s.find_first_not_of(" ");'))
      .toContain('cpp:string_find_first_not_of')
  })

  it('★ find_last_not_of', () => {
    expect(concepts('string s = "hi  "; cout << s.find_last_not_of(" ");'))
      .toContain('cpp:string_find_last_not_of')
  })

  it('★ 一般的 find 不得被混進來', () => {
    const c = concepts('string s = "abc"; cout << s.find("b");')
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
  it('★ 去頭尾空白的兩個位置（g++ 印 `2 3`）', async () => {
    expect((await run('string s = "  hi  "; cout << s.find_first_not_of(" ") << " " << s.find_last_not_of(" ");')).trim())
      .toBe('2 3')
  })

  it('★ 全部都屬於那組字元時回 -1', async () => {
    // C++ 回 npos；這個直譯器統一回 -1（理由見 092——使用者常寫 `!= -1`）
    expect((await run('string s = "   "; cout << s.find_first_not_of(" ");')).trim()).toBe('-1')
  })

  it('★ 多個字元的集合', async () => {
    expect((await run('string s = "aab1"; cout << s.find_first_not_of("ab");')).trim()).toBe('3')
  })

  it('★ 空集合 → 第一個字元就不屬於它', async () => {
    expect((await run('string s = "xy"; cout << s.find_first_not_of("");')).trim()).toBe('0')
  })
})
