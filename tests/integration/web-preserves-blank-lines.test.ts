/**
 * **網頁版的程式碼面板也要把空行還回去。**
 *
 * ## 這條規範從哪來
 *
 * `preserve-blank-lines.ts` 是 2026-08-19 為**擴充那側**做的，而網頁版一直沒接。
 * 那個檔頭自己寫著這件事的形狀：
 *
 * > 「一個機制只接了一個宿主，那它的另一半是不存在的
 * > ——而『不存在』與『這個宿主不需要』在畫面上完全相同。」
 *
 * 掛著沒接的理由是一個**真的未決**：
 * **網頁版的程式碼面板，是使用者的東西，還是投影的產物？**
 *
 * 使用者 2026-08-24 拍板，逐字：
 *
 * > 「網頁版的程式碼面板**也是投影的產物**，與 VSCode 的面板**應該行為一致**。」
 *
 * 🔴 **兩個判斷合起來才是答案**：它是投影，而**投影的行為只有一套**。
 *
 * > **同一個東西在兩個宿主裡有兩種行為，那不是兩個實作，是一個沒被回答的問題。**
 *
 * ## 本測試【不】檢測什麼
 *
 * - ❌ 不檢測 `preserveBlankLines` 演算法本身（那有它自己的測試）——
 *   這裡只問**網頁版那條路有沒有走過它**。
 * - ⚠️ 靜態檢查守得住「有沒有接」，守不住「接對了沒」——後者由瀏覽器驗收。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { preserveBlankLines } from '../../src/core/projection/preserve-blank-lines'

const ROOT = path.resolve(__dirname, '../..')
const read = (p: string): string => readFileSync(path.join(ROOT, p), 'utf8')
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('兩個宿主的程式碼面板行為一致', () => {
  it('★ 錨點：那個機制本身是活的（否則下面在斷言一個不存在的東西）', () => {
    const before = 'int main() {\n    int x = 1;\n\n    return 0;\n}\n'
    const after = 'int main() {\n    int x = 1;\n    return 0;\n}\n'
    expect(preserveBlankLines(before, after), '機制壞了 → 下面兩支斷言沒有意義')
      .toContain('\n\n')
  })

  it('🔴 兩個宿主【都】要走過它——少一個，那個宿主的空行會被抹平', () => {
    for (const f of ['src/vscode/webview/vscode-code-view.ts', 'src/ui/panels/monaco-panel.ts']) {
      expect(strip(read(f)), `${f} 沒有接上——而「沒接」與「這個宿主不需要」在畫面上完全相同`)
        .toContain('preserveBlankLines(')
    }
  })

  it('★ 反向：它比的是【產生出來的碼】與【面板現在的碼】，不是憑空造空行', () => {
    // 原本沒有空行 → 不該生出空行（否則每次同步都會長高）
    const flat = 'int main() {\n    int x = 1;\n    return 0;\n}\n'
    expect(preserveBlankLines(flat, flat)).toBe(flat)
  })
})
