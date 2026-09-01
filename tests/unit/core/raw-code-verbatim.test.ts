/**
 * 🔴 **灰積木裡的原文必須逐字等於原始碼**。
 *
 * README 上寫著：「認不出來的語法**不會被丟掉，也不會被猜**——它變成一顆
 * 灰色積木，**原文一字不動**地放在裡面」。
 *
 * 而 2026-09-01 錄 GIF 時量到那句話不成立：
 *
 * ⚠️ **這一段刻意用縮排而不是反引號圍欄**：語料掃描器
 * （`tests/helpers/backtick-corpus.ts`）撈的就是反引號，而一段長得像 C++ 的
 * 註解會被當成語料餵進解析器——第五十三條護欄當場抓到（`goto_statement`
 * 憑空「被語料碰到」，連帶把兩個幽靈也拉回來）。
 *
 * > **一個從原始碼裡撈語料的掃描器，撈得到的不只有語料
 * > ——註解裡長得像的那些也會進去。**
 *
 *     單獨一行                goto done;   ✅ 原文保留
 *     包在 if 的【大括號】裡    goto done;   ✅ 原文保留
 *     包在 if【沒有大括號】底下  done        🔴 「goto 」兩個字不見了
 *
 * ⚠️ 而它**靜靜地**發生：畫面上是一顆看起來正常的灰積木，只是裡面少兩個字。
 *
 * ## 🔴 為什麼它在 `tests/unit/` 而不是 `tests/integration/`
 *
 * 第五十三條護欄（語料自己夠不夠）**把 `tests/integration/` 裡的反引號片段
 * 當成 C++ 語料**。這個檔的註解裡有一堆行內的 `code`，於是它一放進去，
 * `goto_statement` 就「憑空被語料碰到了」——連帶把兩個已知的幽靈
 * （`literal_suffix`／`user_defined_literal`）也拉回來。
 *
 * > **一個從原始碼裡撈語料的掃描器，撈得到的不只有語料
 * > ——而一支測試不該因為它放在哪個資料夾，就改變別人量到的世界。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../helpers/setup-lifter'
import type { Lifter } from '../../../src/core/lift/lifter'

let tp: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tp = new Parser()
  tp.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
})

const lift = async (code: string): Promise<import('../../../src/core/types').SemanticNode | null> =>
  lifter.lift(tp.parse(code)!.rootNode as never) as never

/** 樹裡所有 `raw_code` 的原文。 */
function rawTexts(n: import('../../../src/core/types').SemanticNode | null): string[] {
  if (!n) return []
  const out: string[] = []
  const walk = (x: import('../../../src/core/types').SemanticNode): void => {
    if (x.componentId === 'raw_code') {
      out.push(String((x.metadata as { rawCode?: string })?.rawCode ?? ''))
    }
    for (const kids of Object.values(x.children ?? {})) {
      for (const k of kids as import('../../../src/core/types').SemanticNode[]) walk(k)
    }
  }
  walk(n)
  return out
}

describe('灰積木裡的原文，逐字等於原始碼', () => {
  it('單獨一行的 goto', async () => {
    const t = await lift('int main() {\n  goto done;\n  done: return 0;\n}')
    expect(rawTexts(t).join('\n')).toContain('goto done;')
  })

  it('包在 if 的大括號裡', async () => {
    const t = await lift('int main() {\n  if (1) {\n    goto done;\n  }\n  done: return 0;\n}')
    expect(rawTexts(t).join('\n')).toContain('goto done;')
  })

  it('🔴 包在 if【沒有大括號】底下——「goto 」不得消失', async () => {
    const t = await lift('int main() {\n  if (1) goto done;\n  done: return 0;\n}')
    const texts = rawTexts(t)
    // ⚠️ **不用 backtick 字串**——語料掃描器（`tests/helpers/backtick-corpus.ts`）
    //    harvest 的就是 backtick，而一個夾在兩段之間的 TypeScript 會被當成 C++
    //    餵進解析器，長出本來不存在的節點（第五十三條護欄的基線註解記著
    //    `literal_suffix`／`user_defined_literal` 這兩個幽靈的來歷）。
    expect(texts.join('\n'), '灰積木的內容：' + JSON.stringify(texts)).toContain('goto done;')
  })

  it('🔴 而規範是【每一塊灰積木的原文都出現在原始碼裡】', async () => {
    // ⚠️ 上一條的第一版寫成 `expect(texts).not.toContain('done')`——**那釘的是
    //    舊症狀的形狀，不是規範**。修好之後灰積木是 `['goto done;', 'done']`，
    //    而第二個 `done` 是**標籤**（`done: return 0;`）的，與 goto 無關。
    //
    // > **一條斷言如果描述的是「壞掉時長什麼樣」，它會在修好之後
    // > 因為別的原因而紅——而那時你分不出是回歸還是斷言太死。**
    //
    // 🟢 規範本身是這一句：每一塊灰積木的原文，都要**逐字出現在原始碼裡**。
    const src = 'int main() {\n  if (1) goto done;\n  done: return 0;\n}'
    const t = await lift(src)
    for (const raw of rawTexts(t)) {
      expect(src, '這塊灰積木的原文不在原始碼裡：' + JSON.stringify(raw)).toContain(raw)
    }
  })
})
