/**
 * v9 → v10 的四個契約（`specs/116-block-type-derive/contracts/save-migration.md`）
 *
 * ## ⚠️ 這是這個專案的第一次**積木狀態**遷移
 *
 * 既有的八個升級步驟每一個都只改寫語義樹。沒有先例可抄，所以四個契約
 * 每一個都要有自己的一支測試——而不是一支「跑得動就好」。
 *
 * | | 契約 |
 * |---|---|
 * | C1 | 表上的每一個舊型別都被換掉 |
 * | C2 | **冪等**——已轉換的再跑一次不變 |
 * | C3 | 表上沒有的型別**出聲**，不得靜默丟棄 |
 * | C4 | 語義樹**不被碰** |
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { UPGRADES, CURRENT_VERSION, upgrade, unknownBlockTypes } from '../../src/core/storage-version'
import {
  BLOCK_TYPE_MIGRATIONS_V9_TO_V10,
  registerBlockTypeMigration,
} from '../../src/migrations/block-type-migrations'
import '../../src/languages/cpp/all-declarations'

const samplePath = path.join(process.cwd(), 'tests/assets/v9-savedstate.json')

/** 一份最小的 v9 存檔，積木狀態有巢狀（inputs／next）與一顆影子積木。 */
function makeV9(blockType: string): Record<string, unknown> {
  return {
    version: 9,
    tree: { conceptId: 'cpp:program', properties: {}, children: { body: [] } },
    blocklyState: {
      blocks: {
        blocks: [
          {
            type: blockType,
            id: 'a',
            inputs: {
              VALUE: { block: { type: blockType, id: 'b' }, shadow: { type: blockType, id: 'c' } },
            },
            next: { block: { type: blockType, id: 'd' } },
          },
        ],
      },
    },
    code: '',
    language: 'cpp',
    styleId: 'apcs',
    lastModified: '',
  }
}

function collectTypes(state: unknown): string[] {
  const out: string[] = []
  const walk = (b: unknown): void => {
    if (!b || typeof b !== 'object') return
    const n = b as Record<string, unknown>
    if (typeof n.type === 'string') out.push(n.type)
    for (const v of Object.values(n)) {
      if (Array.isArray(v)) v.forEach(walk)
      else if (v && typeof v === 'object') walk(v)
    }
  }
  walk((state as { blocks?: unknown })?.blocks)
  return out
}

/** 表是模組層級的可變狀態——每支測試自己準備，不依賴別支留下的內容。 */
function runViaTable<T>(table: Record<string, string>, fn: () => T): T {
  const backup = { ...BLOCK_TYPE_MIGRATIONS_V9_TO_V10 }
  for (const k of Object.keys(BLOCK_TYPE_MIGRATIONS_V9_TO_V10)) delete BLOCK_TYPE_MIGRATIONS_V9_TO_V10[k]
  registerBlockTypeMigration(table)
  try {
    return fn()
  } finally {
    for (const k of Object.keys(BLOCK_TYPE_MIGRATIONS_V9_TO_V10)) delete BLOCK_TYPE_MIGRATIONS_V9_TO_V10[k]
    Object.assign(BLOCK_TYPE_MIGRATIONS_V9_TO_V10, backup)
  }
}

describe('v9 → v10：積木狀態遷移的四個契約', () => {
  it('★ 前提：v10 這一步真的存在，而且 CURRENT_VERSION 跟上了', () => {
    // ⚠️ 錨在「機制在不在」上，不是錨在「還有幾筆沒改名」上。
    expect(UPGRADES[9], '缺 9 → 10 的升級步驟').toBeTypeOf('function')
    expect(CURRENT_VERSION).toBe(10)
  })

  it('C1：表上的舊型別**全部**被換掉——含巢狀 inputs／shadow／next', () => {
    runViaTable({ cpp_if: 'cpp_if' }, () => {
      const r = UPGRADES[9](makeV9('cpp_if') as never) as Record<string, unknown>
      const types = collectTypes(r.blocklyState)
      expect(types.length, '樣本有 4 顆積木（本體＋input＋shadow＋next）').toBe(4)
      expect(types.every((t) => t === 'cpp_if'), `還留著舊型別：${types}`).toBe(true)
      expect(r.version).toBe(10)
    })
  })

  it('C2：**冪等**——已經是 v10 的內容再跑一次，不變也不丟錯', () => {
    // ⚠️ 這不是理論上的整潔。匯出那條路曾經把每一份檔案標成 `version: 1`
    // （2026-08-11 修掉），於是一份已經轉換過的內容會再被餵進這一步一次。
    // **一個「只跑一次才對」的轉換，遲早會被跑第二次。**
    runViaTable({ cpp_if: 'cpp_if' }, () => {
      const once = UPGRADES[9](makeV9('cpp_if') as never) as Record<string, unknown>
      const twice = UPGRADES[9]({ ...once, version: 9 } as never) as Record<string, unknown>
      expect(JSON.stringify(twice.blocklyState)).toBe(JSON.stringify(once.blocklyState))
    })
  })

  it('C3：表上沒有的型別**出聲**，不得靜默丟棄', () => {
    runViaTable({ cpp_if: 'cpp_if' }, () => {
      expect(() => UPGRADES[9](makeV9('u_不存在的東西') as never)).toThrow(unknownBlockTypes)
      try {
        UPGRADES[9](makeV9('u_不存在的東西') as never)
      } catch (e) {
        // ⚠️ 釘住**理由**，不只釘住「有丟錯」——一個因為錯誤理由而丟錯的檢查，
        // 看起來與健康的完全一樣。
        expect((e as unknownBlockTypes).types).toEqual(['u_不存在的東西'])
      }
    })
  })

  it('C3 的反面：表是**空的**時候不得丟錯——那是「還沒開始改名」，不是「檔案壞了」', () => {
    runViaTable({}, () => {
      expect(() => UPGRADES[9](makeV9('cpp_if') as never)).not.toThrow()
    })
  })

  it('C4：語義樹**逐字不變**——這一步只碰投影', () => {
    runViaTable({ cpp_if: 'cpp_if' }, () => {
      const original = makeV9('cpp_if')
      const treeBefore = JSON.stringify(original.tree)
      const r = UPGRADES[9](original as never) as Record<string, unknown>
      expect(JSON.stringify(r.tree)).toBe(treeBefore)
    })
  })

  it('★ 只改積木節點的 type，**不是所有叫 type 的欄位**', () => {
    // ⚠️ Blockly 積木定義的 `args` 裡也有 `type`（input_value…），
    // 字面一樣而意思完全無關。上一次「同一個欄位名長在三個型別上」的
    // 改名回退了 121 個檔。
    runViaTable({ cpp_if: 'cpp_if', input_value: '**不該被碰**' }, () => {
      const s = makeV9('cpp_if')
      ;(s.blocklyState as never as Record<string, never>)['args0' as never] = [
        { type: 'input_value', name: 'VALUE' },
      ] as never
      const r = UPGRADES[9](s as never) as Record<string, unknown>
      expect(JSON.stringify(r.blocklyState)).toContain('"type":"input_value"')
    })
  })
})

describe('回歸樣本：改名前的真實 v9 存檔還打得開', () => {
  it('★ 樣本存在且是真的（不是合成的）——17 種積木型別，四種情況都有', () => {
    expect(fs.existsSync(samplePath), 'tests/assets/v9-savedstate.json 不見了').toBe(true)
    const s = JSON.parse(fs.readFileSync(samplePath, 'utf8')) as Record<string, unknown>
    expect(s.version).toBe(9)
    const types = new Set(collectTypes(s.blocklyState))
    expect(types.size, '樣本應該有 17 種積木型別').toBe(17)
    // 四種情況各釘一顆——樣本被換掉時這一句會指出少了哪一種。
    //
    // ⚠️ **這些必須是 v9 的舊名。** 改名腳本曾經把這四行一起改成新名，
    // 於是「一份 v9 存檔」被拿去比對 v10 的名字——**斷言還在，但它問錯了問題**。
    // 資產描述的是過去，所以描述資產的斷言也停在過去。
    expect(types.has('c_stack_push'), 'container_kind 形態').toBe(true)
    expect(types.has('c_var_declare_expr'), 'role 形態').toBe(true)
    expect(types.has('cpp_stack_top'), '化石詞彙').toBe(true)
    expect(types.has('u_if'), '只差前綴').toBe(true)
  })

  it('★ 從 v9 升到最新版不丟錯，而且語義樹不變', () => {
    const s = JSON.parse(fs.readFileSync(samplePath, 'utf8')) as Record<string, unknown>
    const treeBefore = JSON.stringify(s.tree)
    const r = upgrade({ ...s }, 9)
    expect(r.ok, `升級失敗：${r.ok ? '' : (r as { reason: string }).reason}`).toBe(true)
    if (r.ok) {
      const v = r.value as Record<string, unknown>
      expect(v.version).toBe(CURRENT_VERSION)
      expect(JSON.stringify(v.tree), '語義樹被碰了——這一步只該改投影').toBe(treeBefore)
    }
  })
})
