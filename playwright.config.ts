/**
 * **端對端測試** —— 補上「沒有任何自動化在看渲染出來的結果」那一格
 *
 * ## 為什麼要付這個成本
 *
 * `vision.md`「執行機構自己接上」那一節逐字：
 *
 * > 「**下一格（未承諾）：沒有任何自動化在看渲染出來的結果。**
 * > 五次使用者回報裡有四次現在有機械檢查，而它們全部停在瀏覽器之前。」
 *
 * 而 2026-08-12 那一輪把它的代價量了出來：`execution:at-node` 與斷點反轉
 * 做完之後，**有兩件事我沒能驗到**——
 *
 * - 斷點「命中時會停」：gutter 的點擊在自動化操作下不穩定，
 *   同一個座標時中時不中，而**畫面上看不出差別**（toggle 兩次等於沒設）
 * - 加速功能：同樣的時序問題
 *
 * 那不是「懶得測」，是**用截圖與座標點擊去驗 UI 本來就會這樣**。
 * 一個會 retry、會等元素、會用選擇器而不是座標的工具，才問得出那兩個問題。
 *
 * > **一條測不到的路，與一條沒有人測的路，在測試報告上長得一樣。**
 *
 * ## ⚠️ 它不取代 vitest
 *
 * 3952 個單元／整合測試仍然是主力，e2e 只覆蓋**必須看到渲染結果**的那幾件事。
 * e2e 慢、脆、而且失敗時難定位——把它當主力會讓「全套綠」這個訊號變鈍，
 * 而所有護欄的價值都建立在那個訊號上。
 *
 * 判準：**這件事在 DOM 之外驗得到嗎？** 驗得到就不要寫進這裡。
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // ⚠️ 序列執行：這些測試共用 localStorage（專案的存檔），平行跑會互相覆寫。
  workers: 1,
  fullyParallel: false,
  // CI 上失敗重跑一次——e2e 的偶發失敗多半是等待時機，不是真的壞。
  // ⚠️ 而本機**不重跑**：本機重跑會把「這支測試不穩」藏起來。
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // ⚠️ **viewport 要放在 `devices` 之後**——`devices` 自帶一組，
        // 寫在頂層 `use` 裡會被它覆蓋掉（而症狀是「設了沒用」）。
        //
        // 這個應用在窄寬度下切成行動版面，那時桌面工具列的按鈕是 `0x0`
        // ——症狀是 `click` timeout 30 秒，看起來像應用沒回應，
        // 實際上是**測試在看另一個版面**。
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  // ⚠️ 用 `preview`（build 後的產物）而不是 `dev`：
  // dev server 的熱重載會在測試中途重載頁面，而那正是手動驗證時反覆踩到的坑。
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
