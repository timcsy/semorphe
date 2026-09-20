/**
 * **帶著存檔回來的學生，從課文頁點進來也要看得到那一題。**
 *
 * ## 它從哪來（2026-09-16，使用者附兩張截圖）
 *
 * 「我從課程點擊進去，但是**都沒有積木**，只有程式那邊有」。
 *
 * 而 `task-link-seeds.spec.ts` 那三支**全綠**——因為它們每一支的第一行都是
 * `localStorage.clear()`。
 *
 * > **每一支測試都先把環境洗乾淨，於是「髒的環境」那條路一次都沒有人走過
 * > ——而使用者永遠走在那一條上。**
 *
 * ## 根因：兩次程式碼→積木同時在飛
 *
 * `restoreState()` 最後一行是**射後不理**的 `syncCodeToBlocks(state.code)`，
 * 它一回傳組裝點就開始種那一題。誰後落地誰說了算：
 *
 * ```
 * 存檔 code   using namespace std; int main() { return 0; }   ← 上一次留下的空骨架
 * 起點 code   int main() { int age = 16; cout << age …  }
 *
 * 輸掉的時候  程式碼欄位＝起點、語義樹＝空骨架
 *             而骨架在前幾課【隱藏】⟹ 畫布上一顆都沒有
 * ```
 *
 * 使用者實測到的三個數字（主控台）逐字：
 * `節點: ['cpp:using_namespace','cpp:func_def']`、`積木: 0`、`鷹架: 0`。
 *
 * ## ⚠️ 注入：把 `await restored` 拿掉，這一支要紅
 */
import { test, expect } from '@playwright/test'

/** 🔴 使用者那一份的逐字複本——空骨架 ＋ 空的積木快取。 */
const SAVED = JSON.stringify({
  version: 18,
  blocklyState: {},
  code: 'using namespace std;\nint main() {\n    return 0;\n}',
  language: 'cpp',
  styleId: 'apcs',
  lastModified: '2026-09-16T02:18:53.721Z',
  codeHash: '1d_ol0wor',
  flowLayout: [],
  topicId: 'cpp-beginner',
  targetId: 'cpp',
  blockStyleId: 'scratch',
  locale: 'zh-TW',
})

interface Seen { blocks: number; nodes: string[]; code1: string }

async function openWithSave(
  page: import('@playwright/test').Page, lesson: string, task: string,
): Promise<Seen> {
  // ⚠️ **刻意不 clear**——那正是這一支要守的東西
  await page.addInitScript((s: string) => window.localStorage.setItem('semorphe-state', s), SAVED)
  await page.goto(`/?lesson=${encodeURIComponent(lesson)}&task=${task}`)
  await page.waitForFunction(
    () => Boolean((window as never as { __app?: { blocklyPanel?: unknown } }).__app?.blocklyPanel),
    undefined, { timeout: 40_000 })
  await page.waitForFunction(
    () => ((window as never as Record<string, any>).__app?.blocklyPanel?.workspace
      ?.getAllBlocks(false)?.length ?? 0) > 0,
    undefined, { timeout: 25_000 }).catch(() => { /* 讓下面的斷言說話 */ })
  return page.evaluate(() => {
    const a = (window as never as Record<string, any>).__app
    return {
      blocks: a.blocklyPanel.workspace.getAllBlocks(false).length,
      nodes: (a.syncController?.getCurrentTree()?.slots?.body ?? []).map((n: any) => n.componentId),
      code1: (a.codeView?.getCode?.() ?? '').split('\n')[0],
    }
  })
}

test('🔴 有起始檔的題目：存檔裡有舊程式碼時也要種得進去', async ({ page }) => {
  const s = await openWithSave(page, 'cpp-beginner/03-變數', 'try')
  expect(s.blocks, `🔴 空畫布——樹是 ${JSON.stringify(s.nodes)}（存檔那份空骨架贏了賽跑）`)
    .toBeGreaterThan(0)
})

test('🔴 排回去：存檔裡有舊程式碼時也要打散在畫布上', async ({ page }) => {
  const s = await openWithSave(page, 'cpp-beginner/03-變數', 'rebuild')
  expect(s.blocks, `🔴 空畫布——樹是 ${JSON.stringify(s.nodes)}`).toBeGreaterThan(3)
})

/**
 * ★ **兩個投影不得說不一樣的話**——這是使用者截圖上那個症狀本身：
 * 程式碼欄位寫著起點，而畫布是空的。
 */
test('★ 程式碼與語義樹要是同一份東西', async ({ page }) => {
  const s = await openWithSave(page, 'cpp-beginner/03-變數', 'try')
  expect(s.nodes, '🔴 樹裡只有骨架，而程式碼欄位是起點——兩個投影在說不一樣的話')
    .not.toEqual(['cpp:using_namespace', 'cpp:func_def'])
})
