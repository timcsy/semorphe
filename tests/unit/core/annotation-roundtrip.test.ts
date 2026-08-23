/**
 * 註解 Roundtrip 測試
 *
 * 驗證行尾註解、獨立註解、表達式內部註解在 lift → generate roundtrip 後保留
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { setCommentLanguage } from '../../../src/core/comment-syntax'
// ⚠️ 這支測試自己組 lifter／直接叫產生器，所以要明說語言——
//    走 `generateCode` 的那些不用（它從 `language` 參數自己設）。
setCommentLanguage('cpp')
import { Lifter } from '../../../src/core/lift/lifter'
import { PatternLifter } from '../../../src/core/lift/pattern-lifter'
import { LiftContextData } from '../../../src/core/lift/lift-context'
import { registerExpressionLifters } from '../../../src/languages/cpp/core/lifters/expressions'
import { createNode } from '../../../src/core/semantic-tree'
import type { AstNode, LiftContext } from '../../../src/core/lift/types'
import type { BlockSpec, LiftPattern, SemanticNode, ComponentDefJSON, BlockProjectionJSON } from '../../../src/core/types'
import { BlockSpecRegistry } from '../../../src/core/block-spec-registry'

import { universalComponents, universalBlocks } from '../../../src/core/universal'
import { coreComponents, coreBlocks } from '../../../src/languages/cpp/core'
import { allStdModules } from '../../../src/languages/cpp/std'
import liftPatternsJson from '../../../src/languages/cpp/lift-patterns.json'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
// ⚠️ **不要自己列宣告來源。**
// 手列 `universalComponents ＋ coreComponents ＋ allStdModules` 會**漏掉膠囊**
// ——而症狀是「那顆元件的積木不見了／辨識不出來」，指向被害者不是兇手。
// `allCppComponents()`／`allCppProjections()` 是組裝函式，它們含膠囊。
// 見 `tests/integration/audit-declaration-assembly.test.ts`（第三十七條護欄）。
import { allCppComponents, allCppProjections } from '../../../src/languages/cpp/all-declarations'

// 見上：行尾註解的語法（` // text`）也搬進了語言套件
beforeAll(() => registerCppLanguage())

function mockNode(
  type: string,
  text: string,
  children: AstNode[] = [],
  fields: Record<string, AstNode | null> = {},
): AstNode {
  const namedChildren = children.filter(c => c.isNamed)
  return {
    type,
    text,
    isNamed: true,
    children,
    namedChildren,
    childForFieldName: (name: string) => fields[name] ?? null,
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: text.length },
  }
}

function mockNodeAt(
  type: string,
  text: string,
  row: number,
  col: number,
  children: AstNode[] = [],
  fields: Record<string, AstNode | null> = {},
): AstNode {
  const namedChildren = children.filter(c => c.isNamed)
  return {
    type,
    text,
    isNamed: true,
    children,
    namedChildren,
    childForFieldName: (name: string) => fields[name] ?? null,
    startPosition: { row, column: col },
    endPosition: { row, column: col + text.length },
  }
}

function unnamed(type: string, text: string): AstNode {
  return { ...mockNode(type, text), isNamed: false }
}

describe('Annotation Roundtrip', () => {
  let lifter: Lifter

  function setup() {
    lifter = new Lifter()
    const patternLifter = new PatternLifter()
patternLifter.setGrammar('tree-sitter-cpp')

    const specRegistry = new BlockSpecRegistry()
    const allComponents = allCppComponents()
    const allProjections = allCppProjections()
    specRegistry.loadFromSplit(allComponents, allProjections)
    const allSpecs = specRegistry.getAll()

    const liftSkipNodeTypes = new Set(['call_expression', 'using_declaration'])
    patternLifter.loadBlockSpecs(allSpecs, liftSkipNodeTypes)
    patternLifter.loadLiftPatterns(liftPatternsJson as unknown as LiftPattern[])
    lifter.setPatternLifter(patternLifter)
    registerExpressionLifters(lifter)
  }

  describe('獨立註解', () => {
    it('should lift standalone comment as comment semantic node', () => {
      setup()
      // Simulate: // section header\nint x = 1;
      const commentNode = mockNodeAt('comment', '// section header', 0, 0)
      const stmtNode = mockNodeAt('number_literal', '42', 1, 0)

      const data = new LiftContextData()
      const results = lifter.liftStatements([commentNode, stmtNode])
      expect(results.length).toBe(2)
      expect(results[0].componentId).toBe('cpp:comment')
      expect(results[0].properties.text).toBe('// section header')
    })

    it('should keep two consecutive comments as separate nodes', () => {
      setup()
      const c1 = mockNodeAt('comment', '// first', 0, 0)
      const c2 = mockNodeAt('comment', '// second', 1, 0)

      const results = lifter.liftStatements([c1, c2])
      expect(results.length).toBe(2)
      expect(results[0].componentId).toBe('cpp:comment')
      expect(results[1].componentId).toBe('cpp:comment')
    })
  })

  describe('行尾註解＝擺在它上面的一顆註解積木', () => {
    /**
     * 🔴 **2026-08-23 換了形式**：以前它是前一句身上的 `annotation`
     * ——存得住，而**積木上看不到**。使用者：「用灰色註解積木就好」、
     * 「這樣的原因是**可以讓學生比較容易看到註解**，對學習更有幫助。」
     *
     * > **一顆看得到、拖得動的積木，勝過一個藏在狀態裡的欄位。**
     */
    it('前一句的行末註解變成一顆註解節點，而且排在它【前面】', () => {
      setup()
      // x = 1; // set x  （同一列）
      const stmtNode = mockNodeAt('number_literal', '42', 0, 0)
      const commentNode = mockNodeAt('comment', '// set x', 0, 10)

      const results = lifter.liftStatements([stmtNode, commentNode])
      expect(results.length, '註解自己是一顆節點，不再被吸收成標註').toBe(2)
      expect(results[0].componentId, '它說的是下一行——所以排在前面').toBe('cpp:comment')
      // ⚠️ 這支測試自組的 lifter 沒有註冊剝除註解符號的轉換——所以比內容不比形式
      expect(String(results[0].properties.text)).toContain('set x')
      expect(results[1].annotations ?? [], '不可以兩邊都留一份').toEqual([])
    })
  })

  describe('raw_code 節點上的行尾註解', () => {
    it('降級的那一句也一樣——註解是它上面的一顆節點', () => {
      setup()
      const unknownNode = mockNodeAt('co_await_expression', 'co_await x', 0, 0)
      const commentNode = mockNodeAt('comment', '// lambda', 0, 10)

      const results = lifter.liftStatements([unknownNode, commentNode])
      expect(results.length).toBe(2)
      expect(results[0].componentId).toBe('cpp:comment')
      expect(results[1].componentId).toBe('raw_code')
    })
  })
})
