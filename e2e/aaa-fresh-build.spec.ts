/**
 * 🔴 **★ 入口條件：瀏覽器拿到的是【剛才建出來的】那一份。**
 *
 * ## 它為什麼存在
 *
 * `playwright.config.ts` 的 `reuseExistingServer: !process.env.CI` 讓本機
 * 接上一個**已經在跑的** preview。那在多數時候是對的（省一次建置），
 * 而它有一個安靜的失敗模式：**那個 preview 服務的是舊的 `dist/`**。
 *
 * 2026-09-05 一天之內因此判錯三次：
 *
 * ```
 * ①  一個缺陷被驗成「修好了」   → 其實沒有
 * ②  同一個缺陷被驗成「沒修好」 → 於是對的改動被收回去
 * ③  一次注入驗證「沒有變紅」   → 於是一條測試看起來擋得住，其實沒驗到
 * ```
 *
 * > **一次「我剛剛量到」的量測，如果沒有先確認量的是新的那一份，
 * > 它可以把任何結論翻成反的——而三次都長得像一次正常的測試。**
 *
 * ## 判準
 *
 * `dist/index.html` 裡的 entry 檔名（Vite 帶內容雜湊），要與伺服器送出來的相同。
 *
 * ⚠️ 檔名以 `aaa-` 開頭是為了**排在最前面**：它是入口條件，
 * 而一個在第 200 支才發現「量錯了」的入口條件，前面 199 支已經白跑了。
 *
 * ## ⚠️ 而這一條【沒有辦法在本機注入驗證】
 *
 * 把 `dist/index.html` 改壞再跑，Playwright 的 `webServer` 會先
 * `npm run build` **把它重建回去**——注入被洗掉，測試照樣綠。
 *
 * > **一條驗「環境對不對」的測試，它要驗的東西正好是那個環境
 * > ——而測試框架會先把環境弄成對的。**
 *
 * 🟢 它的邏輯只有一行（兩個字串相等），而它真正的價值在**失敗時那則訊息**：
 * 告訴你這一整輪的結果都不可信，以及去 `pkill` 什麼。
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ENTRY = /assets\/index-[A-Za-z0-9_-]+\.js/

test('★ 入口條件：伺服器送的是剛建出來的那一份', async ({ page }) => {
  const onDisk = fs.readFileSync(path.resolve('dist/index.html'), 'utf8').match(ENTRY)?.[0]
  expect(onDisk, '🔴 dist/index.html 裡找不到 entry——建置壞了？').toBeTruthy()

  await page.goto('/')
  const served = (await page.content()).match(ENTRY)?.[0]
  expect(
    served,
    '🔴 **伺服器送的不是剛才建出來的那一份**——多半是一個舊的 preview 還活著。\n' +
      '   這一整輪的結果都不可信：先 `pkill -f "vite preview"`，再重跑。\n' +
      `   dist：${onDisk}\n   伺服器：${served}`,
  ).toBe(onDisk)
})
