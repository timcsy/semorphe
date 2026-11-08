# Quickstart: 規格消歧試驗

1. 示範題（C）：`lessons/c-bridge/<課>/lesson.json` 的某題宣告兩個解讀，`solutions/<task>~<id>.c` 各一份。
2. 跑比對的測試（Node 宿主）：`npx vitest run tests/integration/disambiguation-c.test.ts`——三支示範程式的結果分別是 {A}、{B}、{}，每個不一致附情境與兩邊輸出。
3. Arduino：`npx vitest run tests/integration/disambiguation-arduino.test.ts`——按鈕題兩種讀法。
4. 兩個宿主同結果：`tests/integration/disambiguation-hosts.test.ts`（同一份比對，經 Node 的判決與瀏覽器 worker 的判決協定，結果相同）。
5. 護欄：`npx vitest run tests/integration/audit-disambiguation.test.ts`。
6. 畫面：`npx playwright test e2e/disambiguation.spec.ts`——打開示範課文、交一支程式、看到兩欄並排、點選後再判只照被選的。
7. 退化：全部既有課文的對錯判斷不變（`npm run test:e2e` 的課文那一族全綠）。

## 量到的（2026-11-08，T026）

- Node 宿主：C 示範題一位學生的完整比對（11 個情境 × 學生＋兩份解答＝33 次判決），冷啟動約 3.4 秒（`disambiguation-c.test.ts`；判決快取命中時 < 1 秒）。
- Arduino 示範題：一位學生（5 條時間序列＋「沒有輸入」× 3 支程式）約 5～16 秒（板子模擬每條跑 200 萬步；冷啟動那一次最慢）。
- 瀏覽器：沒有單獨計時——e2e `disambiguation.spec.ts` 從按執行到並排畫面出現在等待上限（120 秒）內，整支 41 秒（含建置之外的暖機與兩次執行）。**SC-005（10 秒內）在瀏覽器還沒量**，下一步在 e2e 裡加計時。
