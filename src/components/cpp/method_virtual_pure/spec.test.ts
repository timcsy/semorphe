/**
 * `cpp:method_virtual_pure` 的自證測（第 386 刀）：回傳指標或參照、尾端 const。
 *
 * 形狀放不下的（多層指標、`* const`、noexcept）照實降級原文，不吃掉修飾。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'
import { renderToBlocklyState } from '../../../core/projection/block-renderer'
import { setupTestRenderer } from '../../../../tests/helpers/setup-renderer'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { Lifter } from '../../../core/lift/lifter'
import type { SemanticNode, StylePreset } from '../../../core/types'

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

const S = apcs as unknown as StylePreset
const lift = (code: string): SemanticNode => lifter.lift(tsParser.parse(code)!.rootNode as never) as SemanticNode
const all = (n: SemanticNode): SemanticNode[] => [n, ...Object.values(n.slots ?? {}).flat().flatMap(all)]
const ofId = (t: SemanticNode, id: string): SemanticNode[] => all(t).filter((n) => n.componentId === id)
const inClass = (line: string): string => `class S {\npublic:\n    ${line}\n};\n`

describe('cpp:method_virtual_pure', () => {
  it.each([
    ['virtual void f() = 0;', 'void', 'false'],
    ['virtual int area() const = 0;', 'int', 'true'],
    ['virtual const char* nm() const = 0;', 'const char*', 'true'],
    ['virtual const string& label() = 0;', 'const string&', 'false'],
    ['virtual S* clone() const = 0;', 'S*', 'true'],
  ])('★ lift 與 generate 一字不差：%s', (line, ret, isConst) => {
    const t = lift(inClass(line))
    const [n] = ofId(t, 'cpp:method_virtual_pure')
    expect(n.properties.return_type).toBe(ret)
    expect(n.properties.is_const).toBe(isConst)
    expect(generateCode(t, 'cpp', S)).toContain(`    ${line}\n`)
  })

  it('★ 來回一趟語義不漂移', () => {
    const once = generateCode(lift(inClass('virtual const char* nm(int k) const = 0;')), 'cpp', S)
    expect(generateCode(lift(once), 'cpp', S)).toBe(once)
  })

  it('★ 積木：const 是一格下拉，回傳型別帶星號', () => {
    const state = JSON.stringify(renderToBlocklyState(lift(inClass('virtual const char* nm() const = 0;'))))
    expect(state).toContain('cpp_method_virtual_pure')
    expect(state).toContain('"IS_CONST":"true"')
    expect(state).toContain('"RETURN_TYPE":"const char*"')
  })

  it('★ 執行（Cella）：經基底指標呼叫覆寫 const 的版本', async () => {
    await expectCellaOut(`#include <iostream>
using namespace std;
class S {
public:
    virtual const char* nm() const = 0;
};
class G : public S {
public:
    const char* nm() const override {
        return "green";
    }
};
int main() {
    G g;
    const S* p = &g;
    cout << p->nm() << endl;
    return 0;
}
`, 'green\n')
  })

  it.each(['virtual int** f() = 0;', 'virtual char* const f() = 0;', 'virtual void f() noexcept = 0;'])('🔴 放不下的照實降級，原文不動：%s', (line) => {
    const t = lift(inClass(line))
    expect(ofId(t, 'cpp:method_virtual_pure')).toHaveLength(0)
    expect(generateCode(t, 'cpp', S)).toContain(line)
  })
})
