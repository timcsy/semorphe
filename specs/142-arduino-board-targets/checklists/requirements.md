# Specification Quality Checklist：板子成為目標

**Purpose**: 進入 planning 之前，驗證規格的完整性與品質
**Created**: 2026-08-19
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] 沒有實作細節（語言、框架、API）
- [x] 聚焦使用者價值（學生拉不到編不過的積木）
- [x] 非技術讀者看得懂
- [x] 必要章節齊全

⚠️ **一處刻意的例外**：規格點名了 `TargetRegistry`、`topics/arduino.json`、
`experience.md:818` 等**既有事實**。判準：那些不是「怎麼做」的指定，是
**出發點的證據**——本專案的規格慣例是「一個查到的事實，不是一個計畫」（spec 136 同形）。

## Requirement Completeness

- [x] 沒有殘留 [NEEDS CLARIFICATION]
- [x] 需求可測且無歧義
- [x] 成功判準可量測
- [x] 成功判準與技術無關
- [x] 驗收情境齊全（三個 user story 各自可獨立測）
- [x] 邊界案例已列（既有存檔、三板皆有的概念、非 Arduino 目標、核心版本）
- [x] 範圍界線清楚（明確排除四項，每一項附理由與指標）
- [x] 相依與假設已列

## Feature Readiness

- [x] 每條功能需求都有對應的驗收
- [x] User story 覆蓋主要流程
- [x] 🔴 **最容易做錯的方向被寫成 P1 的 User Story 2**（拿不到 ≠ 認不得）
- [x] 實作細節沒有滲進規格

## Notes

- **FR-008 是順序性需求**（護欄先改、功能後做），⚠️ 它在 `/speckit-tasks`
  必須落在第一批任務，否則 6.5 那條教訓會再被違反一次。
- **SC-005**（新增第四塊板子要編輯 0 個既有共用檔）是本刀**唯一有長期效力**的判準
  ——其餘四條驗的是這一次，它驗的是**下一次**。
