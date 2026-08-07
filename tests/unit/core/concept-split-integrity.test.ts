import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import type { ConceptDefJSON, BlockProjectionJSON } from '../../../src/core/types'
import universalConcepts from '../../../src/blocks/semantics/universal-concepts.json'
import universalBlocks from '../../../src/blocks/projections/blocks/universal-blocks.json'
import { coreConcepts, coreBlocks } from '../../../src/languages/cpp/core'
import { allStdModules } from '../../../src/languages/cpp/std'

describe('Concept/BlockDef split integrity', () => {
  it('should have correct universal concept and block counts', () => {
    // 概念數 ≥ 積木數：有些概念**沒有積木投影**，那是真的缺口而不是巧合。
    // 補一個假的投影就能讓數字對齊，但那會把缺口藏回去——完備性報表已經
    // 把它們標成 render／extract 缺，讓它留在那裡被看見。
    // 見 specs/055-finish-executor-move（program 等三個概念補宣告後暴露的缺口）
    // 27 → 30（2026-08-06，059）：`comment` / `doc_comment` / `block_comment`
    // 從 lang-core 移入 universal。判準是 concepts/概念代數.md 的
    // 「Layer 0: Universal — 所有語言共有」；註解通過，`//` 不通過（那是
    // Layer 1 的語言核心語法，已下沉到語言套件）。
    // 30 → 29：B 項把 `var_declare_expr` 併進 `var_declare`（積木保留，身分合一）
    expect((universalConcepts as unknown as ConceptDefJSON[]).length).toBe(29)
    // 26 → 27（100，E 項）：`u_input_expr` 補上它缺的 JSON 投影。
    // 五顆 `_expr` 積木裡只有它沒有——它活在 `block-registrar.ts` 的命令式
    // 註冊裡，**登錄表看不見它**，於是導出導不到它。那不是設計，是漏掉。
    expect((universalBlocks as unknown as BlockProjectionJSON[]).length).toBe(27)
  })

  it('should have correct core concept and block counts', () => {
    // 79 → 76：上面那三個搬出去了
    // 76 → 72：B 項合併四對 statement／expression 雙版本
    // 72 → 71：`var_declarator` 進墓碑——有執行器、有抽取器、有定義，
    // 而**沒有任何辨識路徑產出過它**
    expect(coreConcepts.length).toBe(71)
    // 77 → 81：097 為 `cpp_container_push` / `cpp_container_pop` 各加了
    // **兩個形態**（堆疊／佇列）。**概念數不變**——那正是「一個身分、多個形態」：
    // 積木變多而元件沒有變多。若哪天概念數也跟著跳，那才是身分被拆了。
    expect(coreBlocks.length).toBe(81)
  })

  it('should have valid concepts and blocks arrays for each std module', () => {
    for (const mod of allStdModules) {
      expect(Array.isArray(mod.concepts), `${mod.header} concepts should be array`).toBe(true)
      expect(Array.isArray(mod.blocks), `${mod.header} blocks should be array`).toBe(true)
      // Some modules (iostream, cmath) use universal concepts so their concepts.json is empty
      // But modules with concepts should have matching blocks
      if (mod.concepts.length > 0) {
        expect(mod.blocks.length, `${mod.header} should have blocks if it has concepts`).toBeGreaterThan(0)
      }
    }
  })

  it('should have all concept IDs unique across core + std', () => {
    const allConceptIds: string[] = []
    for (const c of coreConcepts) allConceptIds.push(c.conceptId)
    for (const mod of allStdModules) {
      for (const c of mod.concepts) allConceptIds.push(c.conceptId)
    }
    expect(new Set(allConceptIds).size).toBe(allConceptIds.length)
  })

  it('should have every projection conceptId present in concepts', () => {
    const allConceptIds = new Set([
      ...(universalConcepts as unknown as ConceptDefJSON[]).map(c => c.conceptId),
      ...coreConcepts.map(c => c.conceptId),
      ...allStdModules.flatMap(m => m.concepts).map(c => c.conceptId),
    ])

    const allProjections = [
      ...(universalBlocks as unknown as BlockProjectionJSON[]) as Array<{ conceptId: string }>,
      ...coreBlocks as Array<{ conceptId: string }>,
      ...allStdModules.flatMap(m => m.blocks) as Array<{ conceptId: string }>,
    ]

    for (const proj of allProjections) {
      expect(allConceptIds.has(proj.conceptId), `Missing concept for projection conceptId: ${proj.conceptId}`).toBe(true)
    }
  })

  it('concepts should not contain blockDef field', () => {
    const allConcepts = [
      ...(universalConcepts as unknown as Array<Record<string, unknown>>),
      ...(coreConcepts as unknown as Array<Record<string, unknown>>),
      ...allStdModules.flatMap(m => m.concepts as unknown as Array<Record<string, unknown>>),
    ]

    for (const c of allConcepts) {
      expect(c).not.toHaveProperty('blockDef')
      expect(c).not.toHaveProperty('codeTemplate')
      expect(c).not.toHaveProperty('astPattern')
      expect(c).not.toHaveProperty('renderMapping')
    }
  })

  it('block projections should not contain concept semantic fields', () => {
    const allProjections = [
      ...(universalBlocks as unknown as Array<Record<string, unknown>>),
      ...(coreBlocks as unknown as Array<Record<string, unknown>>),
      ...allStdModules.flatMap(m => m.blocks as unknown as Array<Record<string, unknown>>),
    ]

    for (const p of allProjections) {
      // Should have conceptId (reference) but not concept definition fields
      expect(p).toHaveProperty('conceptId')
      expect(p).not.toHaveProperty('properties')
      expect(p).not.toHaveProperty('children')
      expect(p).not.toHaveProperty('role')
    }
  })
})
