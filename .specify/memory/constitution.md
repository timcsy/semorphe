<!--
Sync Impact Report
==================
Version change: N/A → 1.0.0 (initial creation)
Modified principles: N/A (all new)
Added sections:
  - Core Principles (5 principles)
  - Development Workflow
  - Governance
Removed sections: N/A
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ no changes needed (Constitution Check section is generic)
  - .specify/templates/spec-template.md ✅ no changes needed (structure aligns)
  - .specify/templates/tasks-template.md ✅ no changes needed (TDD flow aligns)
Follow-up TODOs: None
-->

# Code-Blockly Constitution

## Core Principles

### I. 簡約優先

- 不得過度設計：僅實作當前需求，禁止為假設性未來需求預留擴充
- YAGNI（You Aren't Gonna Need It）：三行相似程式碼優於一個過早的抽象
- 新增的複雜度 MUST 有明確的當前需求作為理由
- 不得新增非必要的文件（如未被要求的 README、變更紀錄等）
- 套用框架模板時 MUST 移除未使用的樣板程式碼，不得保留註解佔位符

### II. 測試驅動開發（非妥協）

- TDD 流程 MUST 嚴格遵守：寫測試 → 測試失敗（Red）→ 實作 → 測試通過（Green）→ 重構（Refactor）
- 測試 MUST 在實作程式碼之前撰寫
- 每個 User Story MUST 可獨立測試
- 測試 MUST 是具體的、可執行的，禁止僅有佔位符測試

### III. Git 紀律

- 每個邏輯步驟完成後 MUST 進行 commit
- Commit 訊息 MUST 清楚描述變更內容
- 實作階段每完成一個 task 或一組相關 task 後 SHOULD commit
- 禁止在未 commit 的狀態下進行大量跨檔案修改

### IV. 規格文件保護

- 實作階段 MUST NOT 刪除或覆蓋以下規格文件：spec.md、plan.md、tasks.md、constitution.md
- 套用框架模板或腳手架工具時 MUST 先確認不會覆蓋 specs/ 及 .specify/ 目錄下的既有文件
- 若框架模板與既有檔案衝突，MUST 手動合併而非直接覆蓋

### V. 繁體中文優先

- 規格文件、計畫文件、任務文件 MUST 以繁體中文撰寫
- 程式碼中的變數名、函式名 SHOULD 維持英文
- 程式碼註解僅在邏輯不明顯時才需添加，語言不限

## Development Workflow

- 開發流程依循 speckit 工作流：specify → clarify → plan → tasks → implement
- implement 階段 MUST 在 tasks.md 中勾選已完成的任務
- 每個階段完成後 MUST 進行 git commit
- 測試 MUST 在 CI 或本地環境中可重複執行

## Governance

- 本憲法為專案最高準則，所有開發活動 MUST 遵守
- 修訂本憲法需記錄變更原因並更新版本號
- 版本號遵循語意化版本：MAJOR（原則刪除/重新定義）、MINOR（新增原則/大幅擴充）、PATCH（措辭修正/澄清）

**Version**: 1.0.0 | **Ratified**: 2026-03-02 | **Last Amended**: 2026-03-02
