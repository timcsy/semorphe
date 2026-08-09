import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    // 元件膠囊的**自證測住在膠囊裡**（`src/components/<scope>/<name>/spec.test.ts`）。
    // 那是刻意的：一顆元件的語義主張與它的實作住在一起，審查者只需要讀一個資料夾。
    include: ['tests/**/*.test.ts', 'src/components/**/*.test.ts'],
    /**
     * 十七個測試檔會**真的呼叫 `g++`**——期望值由編譯器決定，不是推想出來的。
     *
     * ⚠️ 預設的 5 秒對編譯來說本來就不夠，而全套並行時更不夠。症狀是
     * `fuzz-cpp-*` 兩三個檔隨機變紅，單獨跑又全綠——於是它被當成「已知的
     * 載入敏感 flake」帶過了很多次。**它不是 flaky 的邏輯，是設太短的逾時。**
     *
     * 每次「單獨跑就綠」的解釋都讓下一次更容易略過真正的紅。
     *
     * 為什麼是 60 秒：單次編譯只要 0.77 秒，但每支測試編**兩次**（原始碼與
     * 產回去的程式碼各一），而全套並行時十個 worker 同時搶 CPU。20 秒仍會
     * 逾時兩支——**量過才知道，不是猜的**。
     *
     * 放寬到這裡不會讓真的卡住逃掉：直譯器有 maxSteps 上限跑不出無窮迴圈，
     * 執行產物那一步自己還有 5 秒的 timeout。通過時這個數字不花任何時間。
     */
    testTimeout: 60000,
  },
})
