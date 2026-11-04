# Feature Specification: 形態檢查與判決的界線（收尾第一段）

**Feature Branch**: `268-form-verdict-boundary` | **Created**: 2026-11-05 | **Status**: 部分完成（一題待使用者）
**Input**: vision〈形態檢查與判決的界線盤點〉；設計依據 [draft](../../knowledge/draft/2026-11-05-判決文案與形態檢查的界線.md)。

## 範圍
- FR-001 護欄：讀判決的檔案裡，對 Cella 的 `reason` 做字串比對——硬性零（`audit-verdict-reason-unparsed`，有注入）。
- FR-002 積木側「通用那一句」（`CELLA_OTHER`）不顯示 reason 原文，改說種類名稱（`DIAG_KIND_<種類>`，41 種中英文）；護欄數名稱完備。
- FR-003 名字不合法（`BAD_NAME_*`，形態）與 Cella 對同一顆的 reject 去重，只留形態那一則。
- FR-004 「名字合不合法」的盤點寫進 draft，交 cos-mos。
- 範圍外（待使用者）：`REJECT`／`TYPE_MISMATCH`／`UNSUPPORTED`／`TERMINATION` 等其餘文案的 reason 給不給學生看（推薦 A：積木側不給、程式碼側保留像編譯器的原文）。

## 驗收
- 三支新測試（護欄、積木側文案、去重）綠；改了使用者看得到的文字 ⟹ 長測試含 e2e 綠。
