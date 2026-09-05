/**
 * **第一百零五條護欄：骨架告示只有一條路。**
 *
 * ## 🔴 為什麼需要它
 *
 * 「哪幾顆是骨架」是**真相**的一部分，而它送到視圖的路今天有兩條：
 *
 * ```
 * 流程視圖   真相 → semantic:update（帶 scaffold 告示） → 面板自己決定怎麼畫    ✅
 * 積木視圖   真相 → 組裝點算好 → 組裝點【直接呼叫】面板，順便決定用哪一種模式   🔴
 * ```
 *
 * 而第二條路上，組裝點替視圖做了**兩個**決定：算出哪幾顆是骨架（可以），
 * 以及**這個深度該用 `ghost` 還是 `editable`**（不可以——那是視圖的事）。
 *
 * > **一個模式如果在某個視圖上與另一個模式長得一樣，那個視圖就沒有實作它
 * > ——而選單仍然讓人選得到。**
 * > （[history/191](../../knowledge/history/191-骨架在流程視圖上是一句謊話.md)）
 *
 * ## ⚠️ 為什麼 `private` 不夠
 *
 * 把方法改成 `private` 只擋 TypeScript，而**擋不住有人把它改回 `public`**
 * ——這條債今天就是那樣長出來的（2026-08-30 交付時明知而留下）。
 *
 * `concepts/執行機構.md` 的判準：**一個沒有機械檢查的規範，
 * 會被下一次順手還原，而還原不會有人發現。**
 *
 * ## 本護欄不檢測什麼
 *
 * - **不管骨架怎麼判定**（`scaffoldNodeIds`）——那是真相那一側的事
 * - **不管三段模式各自表示什麼**（`hidden`／`ghost`／`editable`）
 * - **不管視圖【怎麼畫】骨架**——那正是 P1 說的「各式投影」，
 *   每個視圖自己決定
 * - **不管「超出範圍」的標記**（`markOutOfScopeBlocks`）——它是另一件事，
 *   2026-09-02 刻意把兩者分開過
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { listSourceFiles, REPO_ROOT } from '../helpers/guardrail'
import path from 'node:path'

/** 骨架標記的方法名——⚠️ 改名的話這裡要跟著改，不然這條護欄會靜默失效。 */
const MARK = 'markScaffoldBlocks'

/** 只有它自己可以呼叫自己的私有方法。 */
const OWNER = 'src/ui/panels/blockly-panel.ts'

interface Hit { file: string; line: number; text: string }

/**
 * 掃出所有**呼叫**——⚠️ 不是所有「提到」。
 *
 * 🔴 判準是後面接著 `(`：`markScaffoldBlocks(` 是呼叫，
 * 而 `markScaffoldBlocks` 出現在一句註解裡不是。
 * 少了這個判準，這條護欄會紅在「解釋這條護欄的那幾行註解」上
 * ——而那會逼下一個人把註解刪掉，那是最糟的結果。
 */
export function callsOf(files: readonly string[], read = (f: string): string =>
  fs.readFileSync(path.join(REPO_ROOT, f), 'utf8')): Hit[] {
  const out: Hit[] = []
  for (const f of files) {
    read(f).split('\n').forEach((text, i) => {
      // ⚠️ 跳過註解行——`// this.panel.markScaffoldBlocks(...)` 不是一次呼叫。
      const t = text.trim()
      if (t.startsWith('//') || t.startsWith('*')) return
      if (text.includes(`${MARK}(`)) out.push({ file: f, line: i + 1, text: t })
    })
  }
  return out
}

const FILES = listSourceFiles('src')
const OUTSIDE = callsOf(FILES.filter((f) => f !== OWNER))

describe('第一百零五條護欄：骨架告示只有一條路', () => {
  /**
   * ★ **入口條件**——⚠️ 掃不到檔案時下面那條會「空過」，
   * 而空過與通過在報表上長得一模一樣。
   */
  it('★ 入口條件——真的掃到 src 了', () => {
    expect(FILES.length, '🔴 一個檔都沒掃到 → 下面每一條都是空過的').toBeGreaterThan(100)
    expect(FILES, `🔴 掃不到 ${OWNER}——路徑或檔名改了`).toContain(OWNER)
  })

  it('🔴 硬性零：組裝點不得直接呼叫視圖的骨架標記', () => {
    expect(
      OUTSIDE.map((h) => `${h.file}:${h.line}  ${h.text}`),
      '🔴 有人在【視圖外面】決定積木該畫成什麼樣。\n' +
        '   骨架告示應該走 `SemanticUpdateEvent.scaffold`——流程視圖已經是這樣了。\n' +
        '   ⚠️ 而「順便決定用 ghost 還是 editable」是這條規矩真正擋的那一半：\n' +
        '      算出哪幾顆是骨架是真相的事，畫成什麼樣是【視圖】的事。',
    ).toEqual([])
  })

  /**
   * ★ **注入**（第四十九條：每一條掃描式護欄都要有）——
   * 沒有它，一個掃錯路徑的護欄會永遠是綠的。
   */
  it('★ 注入：組裝點裡有一行 → 報得出檔名與行號', () => {
    const hits = callsOf(['src/ui/app.ts'], () =>
      ['class App {', '  private remark(): void {', `    this.blocklyPanel?.${MARK}(ids, 'ghost')`, '  }', '}'].join('\n'))
    expect(hits).toHaveLength(1)
    expect(hits[0].line, '🔴 報不出行號——那使用者只知道「有問題」，不知道在哪').toBe(3)
    expect(hits[0].file).toBe('src/ui/app.ts')
  })

  it('★ 注入：乾淨的檔案 → 不得報', () => {
    expect(callsOf(['src/ui/app.ts'], () =>
      ['class App {', '  private remark(): void {', '    this.sync?.republishScaffold()', '  }', '}'].join('\n'))).toEqual([])
  })

  /**
   * ★ ⚠️ **註解裡提到它不算**——這一條擋的是一個很容易犯的錯：
   * 一條掃「這個字串有沒有出現」的護欄，會紅在**解釋它自己的那幾行註解**上，
   * 而那會逼下一個人把註解刪掉。
   *
   * > **一條讓人想刪註解才能過的護欄，正在教一件錯的事。**
   */
  it('★ 註解裡提到不算一次呼叫', () => {
    expect(callsOf(['x.ts'], () =>
      [`// 舊的做法是 this.panel.${MARK}(ids, 'ghost')`, ` * 而 ${MARK}(…) 會動拖曳策略`].join('\n'))).toEqual([])
  })
})
