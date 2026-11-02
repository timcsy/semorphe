/**
 * `cpp:queue_back` 的自證測。
 *
 * ## ⚠️ 這一顆**沒有 lift 那一路**，而那不是遺漏
 *
 * `q.back()` 在辨識層被判成 **`cpp:vector_back`**（`.back()` 不看容器型別）
 * ——所以 **`cpp:queue_back` 從程式碼永遠得不到**，只能從積木拖出來。
 *
 * 這是「**路徑滿的但到不了**」的第二個實例（第一個是 `cpp:if_else`）。
 * 完整診斷見 `draft/2026-08-11-容器方法的辨識不看型別.md`。
 *
 * → 所以 `component.json` 的 `paths.views.code.lift` **是 null**，而這裡也不假裝測得到它。
 *   **誠實地少一路，勝過一支永遠空過的測試。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { expectCellaOut, runCella } from '../../../../tests/helpers/cella-run'
import { generateCode } from '../../../core/projection/code-generator'
import { createNode } from '../../../core/semantic-tree'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { StylePreset } from '../../../core/types'

beforeAll(() => {
  registerCppLanguage()
})

const HQ = '#include <iostream>\n#include <queue>\nusing namespace std;\n'

describe('膠囊自證：cpp:queue_back', () => {
  it('★ generate：產回 q.back()', () => {
    const tree = createNode('cpp:program', {}, {
      body: [createNode('cpp:queue_back', {}, { obj: [createNode('cpp:var_ref', { name: 'que' })] })],
    })
    expect(generateCode(tree, 'cpp', apcs as unknown as StylePreset)).toContain('que.back()')
  })

  // spec 198（重構 6c-1）：執行的判準從 JS 直譯器換成 Cella（`tests/helpers/cella-run.ts`）
  it('★ execute：回傳最後一個元素', async () => {
    // ⚠️ `q.back()` lift 成 `cpp:vector_back`（見檔頭）；它證明的是行為對，不是「這顆元件被執行了」。
    await expectCellaOut(`${HQ}int main(){ queue<int> q; q.push(1); q.push(2); cout << q.back(); }`, '2')
  })

  it('★ 直接執行這顆身分：回傳最後一個元素', async () => {
    // 原本是**合成語義樹**（`cpp:queue_back`）交給 JS 直譯器；Cella 收的是程式碼，
    // 改寫成同一個語義的最小程式——而 `q.back()` 仍然 lift 成 `cpp:vector_back`（見檔頭），這一路程式碼到不了這顆身分。
    await expectCellaOut(`${HQ}int main(){ queue<int> q; q.push(3); q.push(9); cout << q.back(); }`, '9')
  })

  // 🔴 空佇列取 back() 是未定義行為——原本錨的「印 0」是 JS 直譯器的靜默回退，不是 C++ 的答案。
  //    換成 Cella 之後改錨判決：它必須被抓到（reject）。
  it('★ 空佇列取 back()：未定義行為要被抓到（reject）', async () => {
    const r = await runCella(`${HQ}int main(){ queue<int> q; cout << q.back(); }`)
    expect(r.verdict).toBe('reject')
    expect(r.problems.map((p) => p.kind)).toContain('ubBounds')
  })
})
