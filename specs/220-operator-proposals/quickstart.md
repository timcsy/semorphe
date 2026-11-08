# Quickstart: 驗證「提議中」的變更

前置：worktree 368，`npm run dev`（或 e2e 的 preview）。

1. **單元**：`npx vitest run tests/unit/core/proposals` —— 四種操作、全有或全無、每一種拒絕原因各一支、過期判準、差異。
2. **整合**：`npx vitest run tests/integration/proposals-roundtrip.test.ts` —— C、C++、Python、Arduino 各一支課文程式，套四種操作後產碼再 lift 回同一棵樹（SC-005）。
3. **e2e**：`npx playwright test e2e/proposals.spec.ts`
   - `__app.proposals.submit({...})` 送一個插入輸出的提議 → 程式碼不變、提議列出現、差異有一行 `+`。
   - 按接受 → 程式碼等於差異的右邊；按復原 → 回到原樣（SC-004）。
   - 再送一個、按退回 → 程式碼不變。
   - 送一個合法提議，然後在程式碼編輯器改一個字 → 提議列顯示過期、接受停用（SC-003）。
   - 連送三個 → 顯示「還有 3 個」（US4）。
4. **SC-001**：e2e 量 submit 到提議列可見的時間 < 1 秒。
5. **護欄**：`npm run test:guard`（layering、portable-core、tests-import-reachable、four-independences、neutrality）。
6. **瀏覽器實測**：開 dev，主控台送一個提議，看列、差異、接受、退回、過期。
