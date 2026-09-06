/**
 * **匯出是一份帶得走的作品**（spec 177）——使用者按得到的那一條路。
 *
 * ## 🔴 為什麼要 e2e 而不是只有單元測試
 *
 * 匯出這件事在 2026-09-06 之前**一支 e2e 都沒有**（實測 `grep -rln
 * "export-btn\|import-btn" e2e/` 是空的）——而它是使用者按得到的東西。
 *
 * > **`npm test` 驗的是「這些函式做對了嗎」；
 * > e2e 驗的是「使用者按得到的東西還在不在」。**
 *
 * ## ⚠️ 它驗得到，而 vision 曾經說它驗不到
 *
 * vision 上寫著這一族「卡在 **File System Access API 驗不到**」。
 * 🔴 而匯出走的是 `<a download>`、匯入走 `<input type=file>`
 * ——**兩者都不碰 FSA**，而 Playwright 兩者都抓得到。
 */
import { test, expect } from '@playwright/test'
import { freshApp } from './helpers'
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
import type { Download } from '@playwright/test'

/** 按下匯出，把下載的 zip 讀成 `{ 路徑: 內容 }`。 */
async function exportZip(page: import('@playwright/test').Page): Promise<Record<string, string>> {
  await page.locator('#file-menu-btn').click()
  const wait = page.waitForEvent('download', { timeout: 15_000 })
  await page.locator('#export-btn').click()
  const download: Download = await wait
  expect(download.suggestedFilename(), '🔴 匯出的不是一個容器').toMatch(/\.zip$/)
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const c of stream) chunks.push(c as Buffer)
  const entries = unzipSync(new Uint8Array(Buffer.concat(chunks)))
  return Object.fromEntries(Object.entries(entries).map(([p, b]) => [p, strFromU8(b)]))
}


/**
 * 按下匯入並餵一個檔案。
 *
 * ⚠️ **不能用 `locator('input[type=file]')`**——那個 input 是
 * `document.createElement` 出來的，**沒有加進 DOM**，所以定位器找不到它
 * （症狀是 30 秒 timeout，看起來像匯入壞了）。
 *
 * 🟢 正解是攔 `filechooser` 事件：瀏覽器開啟檔案選擇器時它就會來。
 */
async function importFile(
  page: import('@playwright/test').Page,
  name: string, buffer: Buffer, mimeType: string,
): Promise<void> {
  await page.locator('#file-menu-btn').click()
  const chooser = page.waitForEvent('filechooser', { timeout: 15_000 })
  await page.locator('#import-btn').click()
  await (await chooser).setFiles({ name, mimeType, buffer })
}

test('★ SC-001／SC-002：解開之後，原始碼是一個【純程式碼】的檔', async ({ page }) => {
  await freshApp(page)
  const files = await exportZip(page)
  const paths = Object.keys(files)
  const codePath = paths.find((p) => !p.startsWith('.semorphe/'))
  expect(codePath, `🔴 容器裡沒有獨立的原始碼檔——只有 ${paths.join(' | ')}`).toBeTruthy()
  expect(codePath, '🔴 副檔名沒跟著語言走').toMatch(/\.cpp$/)

  const code = files[codePath!]!
  expect(
    code.trimStart().startsWith('{'),
    '🔴 原始碼檔是 JSON → 別人用編輯器打開看到的不是程式，\n'
      + '   而 P1 的唯一真實**是程式碼**。',
  ).toBe(false)
  expect(code, '🔴 程式碼看起來不像 C++').toContain('main')
})

test('★ 側檔在 `.semorphe/` 底下，而程式碼【不在裡面】', async ({ page }) => {
  await freshApp(page)
  const files = await exportZip(page)
  const sidePath = Object.keys(files).find((p) => p.startsWith('.semorphe/'))
  expect(sidePath, '🔴 沒有側檔 → 擺放與設定回不來').toBeTruthy()
  const side = JSON.parse(files[sidePath!]!) as Record<string, unknown>
  expect(
    side['code'],
    '🔴 程式碼在容器裡出現兩次 → **兩個真相**，\n'
      + '   而它們只在有人編輯過其中一份之後才會不一樣。',
  ).toBeUndefined()
  expect(side['language'], '⚠️ 語言要留在側檔裡——副檔名暗示得到它，但**反推是錯的**').toBe('cpp')
})

test('★ SC-005：匯出 → 匯入，程式碼逐字相同', async ({ page }) => {
  await freshApp(page)
  const files = await exportZip(page)
  const codePath = Object.keys(files).find((p) => !p.startsWith('.semorphe/'))!
  const before = files[codePath]!

  // 把它壓回一個 zip，餵給匯入
  const zipped = zipSync(Object.fromEntries(
    Object.entries(files).map(([p, t]) => [p, strToU8(t)]),
  ))
  await importFile(page, 'work.zip', Buffer.from(zipped), 'application/zip')
  await expect(page.locator('.toast, [class*=toast]').first()).toBeVisible({ timeout: 10_000 })

  const after = await exportZip(page)
  const afterPath = Object.keys(after).find((p) => !p.startsWith('.semorphe/'))!
  expect(after[afterPath], '🔴 來回一趟之後程式碼變了').toBe(before)
})

/**
 * 🔴 **SC-004：那些舊檔已經在別人的硬碟上了。**
 *
 * 我們改不動它，而它一定要能回來。
 */
test('★ SC-004：舊的單一 `.json` 匯出，仍然匯得進來', async ({ page }) => {
  await freshApp(page)
  // 先拿一份真的側檔內容（＝舊格式少了 code 之外的全部）
  const files = await exportZip(page)
  const sidePath = Object.keys(files).find((p) => p.startsWith('.semorphe/'))!
  const codePath = Object.keys(files).find((p) => !p.startsWith('.semorphe/'))!
  const legacy = JSON.stringify({ ...JSON.parse(files[sidePath]!), code: files[codePath]! })

  await importFile(page, 'old.json', Buffer.from(legacy, 'utf8'), 'application/json')
  await expect(page.locator('.toast, [class*=toast]').first()).toBeVisible({ timeout: 10_000 })
  const after = await exportZip(page)
  const afterPath = Object.keys(after).find((p) => !p.startsWith('.semorphe/'))!
  expect(after[afterPath], '🔴 舊格式匯入之後程式碼不對').toBe(files[codePath])
})

/**
 * 🟢 **SC-008：側檔不在不是壞掉。**
 *
 * 有人在別的編輯器改過程式碼、把 `.semorphe/` 刪了。
 */
test('★ SC-008：只有原始碼的容器 → 程式碼進得來，【不是匯入失敗】', async ({ page }) => {
  await freshApp(page)
  const onlyCode = zipSync({ 'w.cpp': strToU8('int main() { return 7; }\n') })
  await importFile(page, 'w.zip', Buffer.from(onlyCode), 'application/zip')
  await expect(page.locator('.toast, [class*=toast]').first()).toBeVisible({ timeout: 10_000 })
  const after = await exportZip(page)
  const afterPath = Object.keys(after).find((p) => !p.startsWith('.semorphe/'))!
  expect(after[afterPath], '🔴 沒有側檔就把程式碼弄丟了').toContain('return 7')
})
