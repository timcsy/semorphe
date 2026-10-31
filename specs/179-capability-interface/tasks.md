# Tasks: 能力介面（179）

- [x] T001 [測試] `tests/unit/core/capabilities.test.ts`：挑第一個宣告者；缺項結果；重設
- [x] T002 [測試] `audit-layering`：core／ui 不得 import providers、ui 不得 import interpreter；注入一個違規要紅
- [x] T003 `src/core/capabilities.ts`：型別、`SessionStop`、登錄表
- [x] T004 `src/providers/js-interpreter/index.ts`：包 `SemanticInterpreter`，`RuntimeError` → `SessionStop`
- [x] T005 [測試] 提供者：同一段程式經提供者跑與直接跑，輸出、visitCounts、停止原因相同
- [x] T006 `ui/execution-controller.ts`：三處建構改向登錄表要 session；`instanceof SessionStop`；型別改從 `core/execution`
- [x] T007 組裝點：`src/main.ts`、`src/vscode/webview/main.ts`、`tests/helpers`（happy-dom 測試）
- [ ] T008 全套 ＋ e2e；更新 vision〈重構〉第 1 項與 history（若有轉移）
