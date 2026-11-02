/**
 * `cpp:string_empty` 的自證測。
 *
 * ## ⚠️ 這一顆**沒有 lift 那一路**（第三個「路徑滿的但到不了」）
 *
 * `.empty()` 在辨識層被判成中性的 `cpp:container_empty`，所以這顆身分
 * **從程式碼永遠得不到**，只能從積木拖。
 * `#30` 的判定落點把它記為「**辨識到不了**」——補再多語料也碰不到。
 *
 * → `paths.views.code.lift` 是 `null` ＋ `_lift_why`，而這裡**不假裝測得到 lift**。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser } from 'web-tree-sitter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'
import { generateCode } from '../../../core/projection/code-generator'
import { createNode } from '../../../core/semantic-tree'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { StylePreset } from '../../../core/types'

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  registerCppLanguage()
})

describe('膠囊自證：cpp:string_empty', () => {
  it('★ generate：產回 s.empty()', () => {
    const tree = createNode('cpp:program', {}, { body: [createNode('cpp:string_empty', {}, { obj: [createNode('cpp:var_ref', { name: 's' })] })] })
    expect(generateCode(tree, 'cpp', apcs as unknown as StylePreset)).toContain('s.empty()')
  })

  // spec 198（重構 6c-1）：執行的判準從 JS 直譯器換成 Cella。
  // ⚠️ 原本是手搭的語義樹（`cpp:string_empty`）；改成同一個語義的最小程式。
  // 而這顆身分**從程式碼得不到**（見檔頭）——`s.empty()` lift 成中性的 `cpp:container_empty`，
  // 所以這一條驗的是「字串的 empty() 該印什麼」，不是這顆身分自己的 formalize 路。
  it('★ execute：空字串回 1、非空回 0', async () => {
    const run = (value: string, expected: string) => expectCellaOut(
      `#include <iostream>\n#include <string>\nusing namespace std;\nint main(){ string s = "${value}"; cout << s.empty(); }`, expected)
    // ⚠️ C++ 的 cout 印 bool 是 1／0，不是 true／false
    await run('', '1')     // 空字串
    await run('hi', '0')   // 非空字串
  })
})
