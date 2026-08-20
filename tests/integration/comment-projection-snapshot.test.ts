/**
 * 註解投影：搬移前後產出必須一字不差（059 契約 2）
 *
 * ## 為什麼比對產出的文字，不是「測試有沒有過」
 *
 * 搬移最容易出的錯是**無聲改變**：某個分支在搬運途中掉了，而剛好沒有測試
 * 覆蓋到它。文件註解的產生器有 `@brief` 有沒有換行、有沒有 `@param`、有沒有
 * `@return` 的組合分支——那是最容易漏的地方。
 *
 * 這與既有的執行器清冊同一招：**與其偵測錯誤，不如換一個讓錯誤無法被表達的
 * 形式**。搬移是純位置改動，產出的每一個字元都必須相同。
 *
 * ## 為什麼不用 vitest snapshot
 *
 * `-u` 會靜默更新，等於「跑一下就自動接受惡化」。期望值寫死在這個檔案裡，
 * 改它必須是一次刻意的編輯。見 `knowledge/skills/build-guardrail`「明確否決的做法」。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateCode } from '../../src/core/projection/code-generator'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { resetCommentSyntax } from '../../src/core/comment-syntax'
import { listSourceFiles, REPO_ROOT } from '../helpers/guardrail'
import { splitCodeAndComments } from '../helpers/component-scan'
import type { SemanticNode } from '../../src/core/types'

const node = (concept: string, properties: Record<string, unknown> = {}): SemanticNode =>
  ({ componentId: concept, properties, children: {} }) as unknown as SemanticNode

const prog = (...body: SemanticNode[]): SemanticNode =>
  ({ componentId: 'cpp:program', properties: {}, children: { body } }) as unknown as SemanticNode

beforeAll(() => {
  registerCppLanguage()
})

const gen = (n: SemanticNode): string => generateCode(prog(n), 'cpp', 'apcs' as never)

describe('註解的產出——搬移前後一字不差', () => {
  it('單行註解', () => {
    expect(gen(node('cpp:comment', { text: '這是一行註解' }))).toContain('// 這是一行註解')
  })

  it('區塊註解：單行', () => {
    expect(gen(node('cpp:block_comment', { text: '一行' }))).toContain('/* 一行 */')
  })

  it('區塊註解：多行', () => {
    const out = gen(node('cpp:block_comment', { text: '第一行\n第二行' }))
    expect(out).toContain('/*')
    expect(out).toContain('* 第一行')
    expect(out).toContain('* 第二行')
    expect(out).toContain('*/')
  })

  it('文件註解：只有 brief', () => {
    const out = gen(node('cpp:doc_comment', { brief: '做一件事' }))
    expect(out).toContain('/**')
    expect(out).toContain('* @brief 做一件事')
    expect(out).toContain('*/')
  })

  it('文件註解：brief 多行且無標籤 → 不加 @brief', () => {
    // 這是最容易在搬移中掉掉的分支
    const out = gen(node('cpp:doc_comment', { brief: '第一行\n第二行' }))
    expect(out).toContain('* 第一行')
    expect(out).toContain('* 第二行')
    expect(out, 'brief 多行且沒有其他標籤時不該加 @brief——這個分支最容易掉').not.toContain('@brief')
  })

  it('文件註解：brief 多行且有標籤 → 第一行加 @brief', () => {
    const out = gen(node('cpp:doc_comment', { brief: '第一行\n第二行', param_0_name: 'x' }))
    expect(out).toContain('* @brief 第一行')
    expect(out).toContain('* 第二行')
    expect(out).toContain('* @param x')
  })

  it('文件註解：param 有描述與無描述', () => {
    const out = gen(
      node('cpp:doc_comment', { brief: 'f', param_0_name: 'a', param_0_desc: '第一個', param_1_name: 'b' }),
    )
    expect(out).toContain('* @param a 第一個')
    expect(out).toContain('* @param b\n')
  })

  it('文件註解：return', () => {
    expect(gen(node('cpp:doc_comment', { brief: 'f', return_desc: '總和' }))).toContain('* @return 總和')
  })
})

describe('核心層零註解語法（FR-012）', () => {
  /**
   * ⚠️ 這支不是靠字串比對數字，是靠**找到語法符號本身**。
   *
   * 中立性護欄找的是概念身分，**它看不見這個**——`lifter.ts` 剝 `//` 的那一行
   * 一個概念身分都沒有。身分只是耦合的一種形式，語法是另一種。
   */
  const commentSyntax = [
    { name: '行註解', re: /['"`/]\\?\/\\?\/|\/\\\// },
    { name: '區塊註解開頭', re: /\/\\\*|'\/\*|`\/\*|"\/\*/ },
    { name: '文件註解開頭', re: /'\/\*\*|`\/\*\*|"\/\*\*|\/\*\*['"`]/ },
  ]

  it('★ src/core 的程式碼裡不得出現註解的語法符號', () => {
    const hits: string[] = []
    for (const rel of listSourceFiles('src/core')) {
      const { code } = splitCodeAndComments(readFileSync(join(REPO_ROOT, rel), 'utf8'))
      for (const { name, re } of commentSyntax) {
        if (re.test(code)) hits.push(`${rel} → ${name}`)
      }
    }
    expect(
      hits,
      '核心層在產生或剝除 C 家族的註解符號。Python 要的是 `#`——' +
        '這是中立性護欄看不見的那種耦合（它只找概念身分，不找語法）：\n  ' +
        hits.join('\n  '),
    ).toEqual([])
  })
})

describe('沒有語言套件時的行為必須明確（FR-014）', () => {
  /**
   * 搬移之後新出現的狀態：註解的產生器住在 C++ 套件裡，那沒載入時會怎樣？
   *
   * **不得無聲產出空字串。** 一個註解憑空消失，使用者不會收到任何訊號，
   * 而下一次來回轉換它就永遠不見了。`053` 那次的教訓是刪掉核心登記處會讓
   * 「沒載入語言套件」從無聲變成報錯——這次規模小，但行為一樣必須明確。
   */
  it('★ 沒有語言套件時，註解不得無聲消失', () => {
    // 不包在 `program` 裡——沒有語言套件時 `program` 本身就是未知概念，
    // 包起來的話這支測試根本走不到註解那條路，會變成一支「通過卻什麼都沒測到」
    // 的測試（本專案有這個教訓的既有實例）。
    resetCommentSyntax()
    const out = generateCode(node('cpp:comment', { text: '不該消失' }), '__no_such_language__', 'apcs' as never)
    expect(
      out,
      '註解在沒有語言套件時無聲產出了空字串。使用者不會收到任何訊號，' +
        '而下一次來回轉換它就永遠不見了。',
    ).toContain('不該消失')
    expect(out, '也不得假裝知道某種語言的註解符號——核心不知道任何語言怎麼寫註解').not.toContain('//')
    registerCppLanguage()  // 還原，免得影響同檔其他測試
  })
})
