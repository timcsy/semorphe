# Specification Quality Checklist：Arduino 第 1–3 項

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-17
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
  - ⚠️ **兩處刻意違反，而理由不同**：
    FR-008／FR-009 指名了 `src/core/types.ts` 的 `io_style`——那是**約束**不是做法
    （「這個檔不准動」比「用某個技術」更接近需求）。
    「出發點」那一節引了 `if (ctx.functions.has('main'))`——**那是缺陷的所在**，
    抽掉它規格會失去出處。
- [x] Focused on user value and business needs（學生的 sketch 真的會動）
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
  - 🟢 兩個最大的未決（時鐘、Serial 放哪一層）**在寫規格之前就拍板了**，
    所以這裡是 0 個而不是靠猜。
  - ⚠️ 剩下的兩個（`String` 成本、`arduino:` scope）**寫成 Assumptions 與排除**，
    不是 marker——因為它們**不阻斷**這一輪。
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable（9 條）
- [x] Success criteria are technology-agnostic
  - ⚠️ SC-007 指名 `io_style`、SC-008 指名護欄數——那是**回歸底線**，保留。
- [x] All acceptance scenarios are defined（3 個故事 × 3–4 個場景）
- [x] Edge cases are identified（6 個，含「同時有 main 與 setup」與「腳位超範圍」）
- [x] Scope is clearly bounded（明確排除 5 條）
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

🔴 **這份規格有三條與眾不同的驗收，它們都來自本專案自己踩過的坑：**

**① SC-001 錨在「印得出東西」，不是「跑完了」。**
`draft`§一 逐字：

> 「**一個『沒有失敗』的訊號，與一個『成功』的訊號，在報表上長得一模一樣**」

而那正是本功能的起因——我曾據此宣稱「10/10 Arduino 跑完了」，
實際輸出是 `""`×10。**驗收若寫成「十段都跑得完」，這一輪會【重演】那次誤報。**

**② SC-006 要求「被測到的條數說得出來」。**
使用者選了「模擬為主、可切真實」，**而他是在看過 `🔴 兩條路 ＝ 兩份行為，
而只有一條會被測到` 之後選的**。所以那不是疏忽，是接受過的代價
——而接受過的代價要**看得見**，不能靜靜地變成「我們有兩條路」。

**③ SC-009 對 server 的啟動時機下了條件。**
spec 136 的最貴產出是一次誤診：開瀏覽器看到一個缺陷 → 寫了程式碼 →
**而 build 上重現不出來**，因為那個 dev server 是好幾個編輯之前啟動的。
**「開瀏覽器實測」這條規則本身需要一個前置條件，而它之前沒有。**

⚠️ **而本輪刻意【不新增護欄】。** 理由：`build-guardrail` 6.5 要求
「第一次跑必須是紅的」，而本功能要推動的量（Arduino 能不能跑）
**今天已經有一個誠實的探測在看**（`scenario-coverage` 標 `runnable: false`）。
→ 交付方式是**把那個 `false` 翻成 `true`**，而不是蓋一條新的。
🔴 **翻轉之後那個探測就有了目標值（執行不符 = 0），那時它才該變成護欄。**
