# Quickstart: 規格消歧試驗

1. 示範題（C）：`lessons/c-bridge/<課>/lesson.json` 的某題宣告兩個解讀，`solutions/<task>~<id>.c` 各一份。
2. 跑比對的測試（Node 宿主）：`npx vitest run tests/integration/disambiguation-c.test.ts`——三支示範程式的結果分別是 {A}、{B}、{}，每個不一致附情境與兩邊輸出。
3. Arduino：`npx vitest run tests/integration/disambiguation-arduino.test.ts`——按鈕題兩種讀法。
4. 兩個宿主同結果：`tests/integration/disambiguation-hosts.test.ts`（同一份比對，經 Node 的判決與瀏覽器 worker 的判決協定，結果相同）。
5. 護欄：`npx vitest run tests/integration/audit-disambiguation.test.ts`。
6. 畫面：`npx playwright test e2e/disambiguation.spec.ts`——打開示範課文、交一支程式、看到兩欄並排、點選後再判只照被選的。
7. 退化：全部既有課文的對錯判斷不變（`npm run test:e2e` 的課文那一族全綠）。
