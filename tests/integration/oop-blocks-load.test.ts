import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import * as Blockly from 'blockly'
import { registerFieldMultilineInput } from '@blockly/field-multilineinput'
import { registerDynamicDropdownField, declareDropdownSource } from '../../src/ui/dynamic-dropdown-field'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { BlockSpecRegistry } from '../../src/core/blocks/block-spec-registry'
import { allCppProjections } from '../../src/languages/cpp/all-declarations'
import { allComponentDefs } from '../helpers/component-scan'
import { componentLabels } from '../../src/core/component/labels'
import i18nBlocks from '../../src/i18n/zh-TW/blocks.json'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { RenderStrategyRegistry } from '../../src/core/registry'
import { registerCppRenderStrategies } from '../../src/languages/cpp/renderers/strategies'
import { renderToBlocklyState, setPatternRenderer } from '../../src/core/projection/block-renderer'
import { setDegradationLanguage } from '../../src/core/blocks/degradation-blocks'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'


let parser: Parser
let ws: Blockly.Workspace

beforeAll(async () => {
  await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()

  registerFieldMultilineInput()
  registerDynamicDropdownField()
  // ⚠️ **產品宣告哪些，這裡就要宣告哪些**——少一個的症狀是「每一支都紅」，
  //    而那是護欄壞了，不是產品壞了。
  for (const k of ['names', 'vars', 'funcs', 'arrays',
    'cpp_var_types', 'cpp_param_types', 'cpp_return_types', 'python_types']) {
    declareDropdownSource(k, () => [])
  }
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(allComponentDefs(), allCppProjections())
  ws = new Blockly.Workspace()
  Object.assign(Blockly.Msg as Record<string, string>, i18nBlocks, componentLabels('zh-TW'))
  const { BlockRegistrar } = await import('../../src/ui/block-registrar')
  new BlockRegistrar(reg).registerAll({ getWorkspace: () => ws })
  const rsr = new RenderStrategyRegistry()
  registerCppRenderStrategies(rsr)
  const renderer = new PatternRenderer()
  renderer.setRenderStrategyRegistry(rsr)
  renderer.loadBlockSpecs(reg.getAll())
  setPatternRenderer(renderer)
  setDegradationLanguage('cpp')
}, 180_000)


/**
 * **四種 OOP 寫法的積木，真的載進 Blockly 之後欄位還在**（spec 209 T007 瀏覽器驗收抓到）。
 *
 * `oop-roundtrip` 讀的是渲染出來的 JSON 狀態——那裡面有 `ARROW: 'true'`，測試就綠了。
 * 而 `cpp_method_call` 有一份**命令式定義**（`block-registrar.ts`，為了 ± 增減參數）蓋過 JSON 宣告：
 * 真的建出來的積木沒有 `ARROW` 這一格，載入時那個值被默默丟掉——畫面上只看得到「對／執行」。
 * > **一個欄位在狀態裡、而不在積木上，載入時不會報錯——它會消失。**
 */
const lift = (src: string): SemanticNode =>
  createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
const SRC = `#include <iostream>
using namespace std;
struct A {
    virtual int v() const {
        return 1;
    }
    virtual ~A() {
    }
};
struct B : A {
    int v() const override {
        return 2;
    }
};
int main() {
    B b;
    A* p = &b;
    cout << p->v();
    p->v();
    return 0;
}
`
describe('四種 OOP 寫法：載進 Blockly 之後欄位還在', () => {
  it('🔴 每一格新屬性都在真的積木上，值也對', () => {
    ws.clear()
    const { blockMappings: _drop, ...state } = renderToBlocklyState(lift(SRC))
    Blockly.serialization.workspaces.load(state as never, ws)
    const got = (type: string, field: string): (string | null)[] =>
      ws.getAllBlocks(false).filter((b) => b.type === type).map((b) => (b.getField(field) ? String(b.getFieldValue(field)) : null))
    expect(got('cpp_method_call', 'ARROW'), '敘述位置的 p->v()').toEqual(['true'])
    expect(got('cpp_method_call_expression', 'ARROW'), '運算式位置的 p->v()').toEqual(['true'])
    expect(got('cpp_destructor', 'IS_VIRTUAL')).toEqual(['true'])
    expect(got('cpp_method_virtual', 'IS_CONST')).toEqual(['true'])
    expect(got('cpp_method_override', 'IS_CONST')).toEqual(['true'])
    expect(got('cpp_struct_declare', 'BASE_CLASS')).toEqual(['', 'A'])
    expect(got('cpp_struct_declare', 'BASE_ACCESS')).toEqual(['implicit', 'implicit'])
  })
})
