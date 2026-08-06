/**
 * 執行器清冊（US2 的主防線）
 *
 * ## 為什麼是「集合比對」而不是「輸出比對」
 *
 * 搬移最可能出的錯是**某個概念的執行器掉了**，而測試剛好沒覆蓋到它。
 *
 * | 防線 | 漏一個會怎樣 |
 * |---|---|
 * | 逐一比對輸出 | **不會現形**——測試沒覆蓋到就過了 |
 * | **比對「執行引擎認得哪些概念」的集合** | **現形**，而且說得出少了誰 |
 *
 * 這與專案既有的教訓同一招：**與其偵測錯誤，不如換一個讓錯誤無法被表達的形式。**
 *
 * ## 這份清冊必須在搬移**之前**產生
 *
 * 搬完才想比對就沒有基準了。這是整個功能唯一無法事後補救的一步。
 *
 * 見 specs/054-execute-into-capsules/data-model.md 契約 4
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'

const ASSET = path.resolve(__dirname, '../assets/executor-inventory.json')

interface Inventory {
  _meta: { note: string; capturedAt: string }
  concepts: string[]
}

/** 目前執行引擎認得的所有概念 */
function currentConcepts(): string[] {
  const interp = new SemanticInterpreter({ maxSteps: 1 })
  const reg = (interp as unknown as {
    executorRegistry: { list(): string[] }
  }).executorRegistry
  return [...reg.list()].sort()
}

beforeAll(() => {
  // 執行器由語言套件推進來；不載入的話清冊會是空的
  registerCppLanguage()
})

describe('執行器清冊：搬移前後認得的概念必須完全相同', () => {
  it('清冊存在——它是搬移唯一無法事後補救的基準', () => {
    expect(
      fs.existsSync(ASSET),
      `找不到 ${ASSET}。這份清冊必須在搬移**之前**產生：\n` +
        '  GENERATE_INVENTORY=1 npx vitest run tests/integration/executor-inventory.test.ts',
    ).toBe(true)
  })

  it('★ 集合完全相同——少一個或多一個都要指名', () => {
    const now = currentConcepts()
    const base = (JSON.parse(fs.readFileSync(ASSET, 'utf8')) as Inventory).concepts

    const 少了 = base.filter((c) => !now.includes(c))
    const 多了 = now.filter((c) => !base.includes(c))

    expect(
      少了,
      `搬移途中掉了 ${少了.length} 個概念的執行器：\n  ${少了.join('\n  ')}\n` +
        '**這正是這支測試存在的理由**——輸出比對漏掉它們不會現形。',
    ).toEqual([])

    expect(
      多了,
      `多出 ${多了.length} 個概念：\n  ${多了.join('\n  ')}\n` +
        '多出來通常代表同一個概念被註冊了兩次（另有護欄在看），或是這次刻意新增——' +
        '若是刻意的，重新產生清冊並在 commit 訊息說明。',
    ).toEqual([])
  })

  it('清冊不是空的——空的話代表語言套件沒載入，這支測試什麼都沒驗到', () => {
    expect(currentConcepts().length).toBeGreaterThan(50)
  })
})

/** 產生清冊：`GENERATE_INVENTORY=1 npx vitest run tests/integration/executor-inventory.test.ts` */
if (process.env.GENERATE_INVENTORY) {
  describe('產生清冊', () => {
    it('寫入', () => {
      registerCppLanguage()
      const concepts = currentConcepts()
      fs.mkdirSync(path.dirname(ASSET), { recursive: true })
      fs.writeFileSync(
        ASSET,
        JSON.stringify(
          {
            _meta: {
              note:
                '搬移前的執行器清冊。搬移是純位置改動，這個集合必須一字不差。' +
                '刻意新增或移除概念時才重新產生，並在 commit 訊息說明。',
              capturedAt: new Date().toISOString().slice(0, 10),
            },
            concepts,
          },
          null,
          2,
        ) + '\n',
        'utf8',
      )
      expect(concepts.length).toBeGreaterThan(0)
    })
  })
}
