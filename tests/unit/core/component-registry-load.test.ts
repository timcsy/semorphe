import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { ComponentRegistry } from '../../../src/core/component-registry'
import type { ComponentDefJSON } from '../../../src/core/types'
import { universalConcepts } from '../../../src/core/universal'
import { coreConcepts } from '../../../src/languages/cpp/core'
import { allStdModules } from '../../../src/languages/cpp/std'
// ⚠️ **不要自己列宣告來源。**
// 手列 `universalConcepts ＋ coreConcepts ＋ allStdModules` 會**漏掉膠囊**
// ——而症狀是「那顆元件的積木不見了／辨識不出來」，指向被害者不是兇手。
// `allCppConcepts()`／`allCppProjections()` 是組裝函式，它們含膠囊。
// 見 `tests/integration/audit-declaration-assembly.test.ts`（第三十七條護欄）。
import { allCppConcepts, allCppProjections } from '../../../src/languages/cpp/all-declarations'

function loadConcepts(): ComponentDefJSON[] {
  return allCppConcepts()
}

describe('ComponentRegistry.loadFromJSON', () => {
  it('should load correct number of concepts', () => {
    const registry = new ComponentRegistry()
    const concepts = loadConcepts()
    registry.loadFromJSON(concepts)
    expect(registry.listAll().length).toBe(concepts.length)
  })

  it('should load var_declare with correct properties and children', () => {
    const registry = new ComponentRegistry()
    registry.loadFromJSON(loadConcepts())
    const varDecl = registry.get('cpp:var_declare')
    expect(varDecl).toBeDefined()
    expect(varDecl!.propertyNames).toContain('type')
    expect(varDecl!.propertyNames).toContain('name')
    expect(varDecl!.childNames).toContain('initializer')
  })

  // 🔄 **spec 152 移除**：這一支測的是 `listByLayer()`／`layer` 欄位本身，
  //    而那一格已退場（233 顆元件宣告它，生產路徑零消費者）。
  //    ⚠️ 紅掉不是「我漏了消費者」，是「被測的功能不存在了」。
  //    🟢 而它原本順帶驗的「登錄表真的載入了東西」由 `listAll()` 那幾支涵蓋。

  it('component-registry.ts should not import blockly (static analysis)', () => {
    const filePath = path.resolve(__dirname, '../../../src/core/component-registry.ts')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).not.toContain("from 'blockly'")
    expect(content).not.toContain('from "blockly"')
  })
})
