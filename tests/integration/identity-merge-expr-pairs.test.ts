/**
 * B 項：statement／expression 雙版本的身分整併
 *
 * 元件身分健檢護欄（第十八條）的「**確定**」桶裡最大的一類——六對元件，
 * properties 與 children **完全相同**，只差 `role`：
 *
 * ```
 * func_call / func_call_expr · cpp_method_call / …_expr · cpp_increment / …_expr
 * cpp_compound_assign / …_expr · var_declare / …_expr · cpp_scanf / …_expr
 * ```
 *
 * ## 為什麼它們是一個概念
 *
 * `i++` 當敘述用是遞增、當運算式用也是遞增——**差別只在值有沒有被用到**。
 * 協定裡 `role` 是**屬性**，同一個概念兩個 id 就是雙重身分。
 *
 * 而它已經咬過人：memory 記著「同概念的 statement/expression 版本的
 * `saveExtraState`／`loadExtraState` 格式**必須完全相同**，因為
 * `STATEMENT_TO_EXPRESSION` 映射直接搬移 extraState」。
 * **那個契約之所以要人工維護，正是因為它們是兩個身分。**
 *
 * ## 這一步動到語義詞彙本身
 *
 * 存檔裡的語義樹帶著 `*_expr` 身分。合併之後那些身分不存在了 →
 * **必須附一次性轉換**（`knowledge/history/026`：P8 的範圍不含語義詞彙本身）。
 * 這是那條範圍釐清的第一次真正使用。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { setupTestRenderer, clearTestRenderer } from '../helpers/setup-renderer'
import { renderToBlocklyState } from '../../src/core/projection/block-renderer'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import type { SemanticNode } from '../../src/core/types'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { coreConcepts, coreBlocks } from '../../src/languages/cpp/core'
import { allStdModules } from '../../src/languages/cpp/std'
import universalConcepts from '../../src/blocks/semantics/universal-concepts.json'
import universalBlocks from '../../src/blocks/projections/blocks/universal-blocks.json'
import type { ConceptDefJSON, BlockProjectionJSON } from '../../src/core/types'
import apcs from '../../src/languages/cpp/styles/apcs.json'

let treeParser: Parser

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  treeParser = new Parser()
  treeParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  setupTestRenderer()
})
afterAll(() => clearTestRenderer())

/** 被合併掉的那六個身分 */
const 已合併的 = [
  'func_call_expr',
  'cpp_method_call_expr',
  'cpp_increment_expr',
  'cpp_compound_assign_expr',
  'var_declare_expr',
  'cpp_scanf_expr',
] as const

function 全部概念(): ConceptDefJSON[] {
  return [
    ...(universalConcepts as unknown as ConceptDefJSON[]),
    ...coreConcepts,
    ...allStdModules.flatMap((m) => m.concepts),
  ]
}

function 登錄表(): BlockSpecRegistry {
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(全部概念(), [
    ...(universalBlocks as unknown as BlockProjectionJSON[]),
    ...coreBlocks,
    ...allStdModules.flatMap((m) => m.blocks),
  ])
  return reg
}

function lift(body: string): SemanticNode {
  const src = `#include <iostream>\n#include <cstdio>\nusing namespace std;\nint main(){ ${body} return 0; }`
  const tree = treeParser.parse(src)
  if (!tree) throw new Error('parse 失敗')
  return createTestLifter().lift(tree.rootNode as never) as SemanticNode
}

function collect(node: SemanticNode, pred: (n: SemanticNode) => boolean): SemanticNode[] {
  const out: SemanticNode[] = []
  const walk = (n: SemanticNode): void => {
    if (!n) return
    if (pred(n)) out.push(n)
    for (const list of Object.values(n.children ?? {})) for (const c of list ?? []) walk(c as SemanticNode)
  }
  walk(node)
  return out
}

function blockTypes(tree: SemanticNode): string[] {
  const state = renderToBlocklyState(tree) as { blocks?: { blocks?: unknown[] } }
  const out: string[] = []
  const walk = (b: unknown): void => {
    if (!b || typeof b !== 'object') return
    const blk = b as { type?: string; inputs?: Record<string, { block?: unknown }>; next?: { block?: unknown } }
    if (blk.type) out.push(blk.type)
    for (const v of Object.values(blk.inputs ?? {})) walk(v?.block)
    walk(blk.next?.block)
  }
  for (const b of state.blocks?.blocks ?? []) walk(b)
  return out
}

// ─── 身分：六個 `_expr` 概念不再存在 ────────────────────────────────

describe('六對雙版本已合併成六個身分', () => {
  it('★ 六個 `_expr` 概念都不在登錄表裡', () => {
    const ids = new Set(全部概念().map((c) => c.conceptId))
    for (const id of 已合併的) {
      expect(ids.has(id), `${id} 還在——雙重身分沒有消掉`).toBe(false)
    }
  })

  it('★ 而它們的積木**仍然存在**（形態不得跟著消失）', () => {
    const reg = 登錄表()
    for (const bt of ['c_increment_expr', 'c_compound_assign_expr', 'c_var_declare_expr', 'c_scanf_expr']) {
      expect(reg.getByBlockType(bt), `${bt} 不見了 → 既有存檔裡那顆積木會變成不認得的型別`).toBeDefined()
    }
  })

  it('★ 運算式版的積木反推得到**合併後**的身分（C-4）', () => {
    const reg = 登錄表()
    expect(reg.getByBlockType('c_increment_expr')?.conceptMapping?.conceptId).toBe('cpp_increment')
    expect(reg.getByBlockType('c_increment')?.conceptMapping?.conceptId).toBe('cpp_increment')
  })

  it('★ 一個身分查得到兩個形態', () => {
    const forms = 登錄表().getFormsByConceptId('cpp_increment')
    expect(forms.map((s) => (s.blockDef as Record<string, unknown>).type).sort()).toEqual(
      ['c_increment', 'c_increment_expr'],
    )
  })
})

// ─── 行為：兩個位置都要對（期望值來自 g++）──────────────────────────

describe('兩個位置的行為都不變', () => {
  const run = async (body: string): Promise<string> => {
    const i = new SemanticInterpreter({ maxSteps: 100000 })
    await i.execute(lift(body))
    return i.getOutput().join('')
  }

  it('★ i++ 當敘述：g++ 說是 1', async () => {
    expect(await run('int i = 0; i++; cout << i;')).toBe('1')
  })

  it('★ i++ 當運算式：後置產出舊值，g++ 說是 01', async () => {
    expect(await run('int i = 0; int j = i++; cout << j << i;')).toBe('01')
  })

  it('★ ++i 當運算式：前置產出新值，g++ 說是 11', async () => {
    expect(await run('int i = 0; int j = ++i; cout << j << i;')).toBe('11')
  })

  it('★ 複合指定當運算式：g++ 說是 55', async () => {
    expect(await run('int a = 2; int b = (a += 3); cout << a << b;')).toBe('55')
  })
})

// ─── 投影：敘述位置與運算式位置選到不同積木 ─────────────────────────

describe('同一個身分，兩個位置選到不同積木', () => {
  it('★ 敘述位置用敘述版積木', () => {
    expect(blockTypes(lift('int i = 0; i++;'))).toContain('c_increment')
  })

  it('★ 運算式位置用運算式版積木', () => {
    expect(blockTypes(lift('int i = 0; int j = i++;'))).toContain('c_increment_expr')
  })

  it('★ 而語義樹裡**兩者都是同一個身分**', () => {
    const 敘述 = collect(lift('int i = 0; i++;'), (n) => n.conceptId === 'cpp_increment')
    const 運算式 = collect(lift('int i = 0; int j = i++;'), (n) => n.conceptId === 'cpp_increment')
    expect(敘述.length).toBeGreaterThan(0)
    expect(運算式.length, '運算式位置沒有拿到合併後的身分 → 合併只做了一半').toBeGreaterThan(0)
  })
})

// ─── 產生：兩個位置都產得回去 ───────────────────────────────────────

describe('產生路徑不變', () => {
  it('★ 敘述位置產出 i++;', () => {
    const code = generateCode(lift('int i = 0; i++;'), 'cpp', apcs as never)
    expect(code).toContain('i++;')
    expect(code).not.toContain('⟨')
  })

  it('★ 運算式位置產出 int j = i++;', () => {
    const code = generateCode(lift('int i = 0; int j = i++;'), 'cpp', apcs as never)
    expect(code).toContain('i++')
    expect(code).not.toContain('⟨')
  })
})

// ─── 存檔：舊的樹裡有 `_expr` 身分，必須轉得過來 ─────────────────────

describe('存檔轉換——語義詞彙變更的第一次真正使用', () => {
  it('★ 舊樹裡的 `_expr` 身分會被轉成合併後的身分', async () => {
    const { UPGRADES, CURRENT_VERSION } = await import('../../src/core/storage-version')
    expect(CURRENT_VERSION, '詞彙變了卻沒有升版 → 舊存檔會帶著不存在的身分').toBeGreaterThan(1)
    const 舊存檔 = {
      version: 1,
      tree: {
        id: 'n1', conceptId: 'program', properties: {}, children: {
          body: [{ id: 'n2', conceptId: 'cpp_increment_expr', properties: { name: 'i', operator: '++', position: 'postfix' }, children: {} }],
        },
      },
      blocklyState: {}, code: '', language: 'cpp', styleId: 'apcs', lastModified: '',
    }
    const 升級後 = UPGRADES[1](舊存檔 as unknown as Record<string, unknown>)
    const body = (升級後.tree as { children: { body: { conceptId: string }[] } }).children.body
    expect(body[0].conceptId, '舊身分沒被轉換 → 那棵樹裡有一個不存在的概念').toBe('cpp_increment')
  })

  it('★ 負向：沒有 `_expr` 的樹**原樣通過**，不得被亂改', async () => {
    const { UPGRADES } = await import('../../src/core/storage-version')
    const 存檔 = {
      version: 1,
      tree: { id: 'n1', conceptId: 'var_declare', properties: { name: 'x', type: 'int' }, children: {} },
      blocklyState: {}, code: '', language: 'cpp', styleId: 'apcs', lastModified: '',
    }
    const 後 = UPGRADES[1](存檔 as unknown as Record<string, unknown>)
    expect((後.tree as { conceptId: string }).conceptId).toBe('var_declare')
  })

  it('★ 積木型別**不轉**——加法式，`c_increment_expr` 仍然有效', async () => {
    const { UPGRADES } = await import('../../src/core/storage-version')
    const 存檔 = {
      version: 1, tree: null,
      blocklyState: { blocks: { blocks: [{ type: 'c_increment_expr', id: 'b1' }] } },
      code: '', language: 'cpp', styleId: 'apcs', lastModified: '',
    }
    const 後 = UPGRADES[1](存檔 as unknown as Record<string, unknown>)
    const blocks = (後.blocklyState as { blocks: { blocks: { type: string }[] } }).blocks.blocks
    expect(blocks[0].type, '積木型別被改掉了 → 那是不必要的，形態本來就保留').toBe('c_increment_expr')
  })
})
