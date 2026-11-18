/**
 * `cpp:pin_constant_level` 的自證測。
 *
 * 2026-11-18（使用者：「HIGH/LOW INPUT/INPUT_PULLUP/OUTPUT 還有數字等等的可以是不同的積木」）：
 * 電位與腳位模式原本同在 `cpp:pin_constant` 一顆下拉裡，現在各自一顆。
 * 「認名字之前先問 notDeclared」那兩支從 pin_constant 搬過來（spec 174 的病歷在那顆的 component.json）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'
import { generateCode } from '../../../core/projection/code-generator'
import apcs from '../../../languages/cpp/styles/apcs.json'
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
const find = (n: SemanticNode, id: string, out: SemanticNode[] = []): SemanticNode[] => {
  if (n.componentId === id) out.push(n)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) find(k, id, out)
  return out
}
const gen = (n: SemanticNode) => generateCode(n, 'cpp', apcs as unknown as StylePreset)

describe('膠囊自證：cpp:pin_constant_level', () => {
  it('★ lift：沒有人宣告時，HIGH／LOW 都認成這一顆', () => {
    const nodes = find(lift('void setup(){ digitalWrite(2, HIGH); digitalWrite(2, LOW); }\nvoid loop(){}\n'), 'cpp:pin_constant_level')
    expect(nodes.map((n) => n.properties.value)).toEqual(['HIGH', 'LOW'])
  })

  it('★ 而使用者宣告了同名的，樣式不得認領', () => {
    const t = lift('int main(){ int HIGH = 7; int x = HIGH; }')
    expect(find(t, 'cpp:pin_constant_level'), '🔴 名字又被樣式搶走了').toHaveLength(0)
    expect(find(t, 'cpp:var_ref').length).toBeGreaterThan(0)
  })

  it('★ round-trip：程式碼 → 樹 → 程式碼，一字不差', () => {
    const once = gen(lift('void setup(){ digitalWrite(2, HIGH); digitalWrite(2, LOW); }\nvoid loop(){}\n'))
    expect(gen(lift(once))).toBe(once)
    for (const v of ['HIGH', 'LOW']) expect(once).toContain(v)
  })

  it('★ execute：ESP32-C3 上算得出板子的值', async () => {
    await expectCellaOut('void setup(){ Serial.begin(115200); Serial.print(HIGH); Serial.print(LOW); }\nvoid loop(){}\n', '10', { board: 'esp32c3' })
  })
})
