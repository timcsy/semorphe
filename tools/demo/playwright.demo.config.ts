/**
 * **錄 README 那段 GIF 的設定**——與 e2e 的那份分開。
 *
 * 🔴 **為什麼不放進 `e2e/`**：那個目錄底下的 `*.spec.ts` 會被全套掃到，
 * 而錄影是一支**慢而且不驗證任何事**的東西。混在一起的話，
 * 每一次 `npm run test:e2e` 都會多花時間錄一段沒有人看的影片。
 *
 * ⚠️ `reuseExistingServer` 開著——如果你已經有 `npm run preview` 在跑，
 * 它就接上去，不會再 build 一次。
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    ...devices['Desktop Chrome'],
    // 🔴 **1280×720**：GIF 要縮到 900 寬左右，而從大縮小比放大清楚。
    //    ⚠️ 而它不能太窄——這個應用在窄寬度下會切成行動版面。
    viewport: { width: 1280, height: 720 },
    video: { mode: 'on', size: { width: 1280, height: 720 } },
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173/',
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
