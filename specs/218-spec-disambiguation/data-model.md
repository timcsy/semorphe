# Data Model: 規格消歧試驗

## Interpretation（課文任務的一欄）
- `id: string`（課文內唯一；只准 `[a-z0-9-]`）
- `label: string`（給老師看的名稱，例：「讀到 0 停」）
- 參考解答：`lessons/<課>/solutions/<task>~<id>.<ext>`（R3）
- 驗證：宣告了的每個 id 都要有解答檔（護欄）；沒有宣告 ⟹ 照今天（單一解答 `<task>.<ext>`）

## Scenario
- `kind: string`（由領域套件註冊；核心只當作不透明的鍵）
- `payload: unknown`（C 的 `stdin`：`{ text: string }`；Arduino 的 `board-inputs`：`{ events: {t,key,value}[] }`）
- `label: string`（給人看的一句：「空輸入」「第 300 ms 按下按鈕」）

## ScenarioKind（登記處的一筆）
- `kind`、`generate(tree): Scenario[]`（上限 20）

## RunOutcome（Judge 回的）
- `verdict: 'accept' | 'reject' | 'unknown' | 'untranslated' | 'pending'`
- `out: string`（accept／unknown 時的輸出）、`board?`（腳位最後狀態，Arduino）
- `problems: {kind, reason}[]`

## ComparisonResult
- 每個解讀一筆：`{ id, label, status: 'consistent' | 'inconsistent' | 'incomparable', firstMismatch?: { scenario, student, reference }, incomparable: { scenario, side, verdict, reason }[] }`
- 狀態：全部可比情境都相同 ⟹ consistent；有一個不同 ⟹ inconsistent（附第一個）；一個可比的都沒有 ⟹ incomparable
- 另回：`indistinguishable: string[][]`（在這批情境下輸出完全相同的解讀群——「這批情境分不出這兩種讀法」）

## TeacherChoice
- `(lessonId, taskId) → interpretationId`；存 localStorage（R6）
