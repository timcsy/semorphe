# Feature Specification: IDE 宿主的程式碼也跟著收合

**Feature Branch**: `371-ide-folding`
**Created**: 2026-11-09
**Status**: Draft
**Input**: vision〈分子：組合階層與粒度切換〉的最後一格——原文「⏳ IDE 宿主的摺疊另一刀」；history/315：「VSCode／Theia 宿主：程式碼在宿主的編輯器裡，摺疊要走宿主的 API——另一刀。」

## 背景

收合是同一份狀態的多個投影（history/313～315）：流程收成有埠的框、積木摺成一行、網頁版的程式碼按行摺。
在 IDE（VSCode／Theia）裡，程式碼不在我們的編輯器，而在宿主的——於是在積木或流程上收起一段，IDE 的程式碼照樣攤開。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 在積木上收起一段，IDE 的程式碼也摺起來 (Priority: P1)

學生在 IDE 裡開著一支程式與積木面板，在積木（或流程）上收起一個迴圈；IDE 編輯器裡那個迴圈也摺起來。展開時跟著展開。

**Acceptance Scenarios**:

1. **Given** IDE 開著一支有迴圈的程式，**When** 在積木上收起那個迴圈，**Then** 編輯器裡從迴圈那一行開始摺起來。
2. **Given** 同上已摺，**When** 在積木上展開，**Then** 編輯器裡展開。
3. **Given** 單行的節點被收起，**When** 狀態送到程式碼這一側，**Then** 不摺（沒有東西可摺）——與網頁版同一個判準。
4. **Given** 另一個檔案在 IDE 的前景，**When** 收合狀態改變，**Then** 不摺錯檔（這份文件不在前景就不摺）。

### Edge Cases

- 使用者在 IDE 裡自己摺：宿主的 API 沒有「摺疊改變」的事件，**不回推**成收合狀態（單向，照實寫）。
- 我們只展開自己摺過的那幾行；使用者自己摺的不動。
- 程式碼上面多了一行：要摺的行跟著挪。

## Requirements *(mandatory)*

- **FR-001**: 收合狀態改變時，IDE 的程式碼視圖 MUST 告訴宿主要摺與要展開的起始行；判準與網頁版同一支（跨多行、那一行上最長的那顆）。
- **FR-002**: 只送變了的；只展開自己摺過的。
- **FR-003**: 宿主 MUST 只在這份文件是使用中的編輯器時摺。
- **FR-004**: 網頁版的摺疊行為不變（改用同一支核心判準）。

## Success Criteria *(mandatory)*

- **SC-001**: 送給宿主的行與網頁版會摺的行相同（同一支函式，測試在量）。
- **SC-002**: 手動驗收清單（`acceptance.md`）在 VSCode 裡逐條通過。
