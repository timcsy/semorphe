# Specification Quality Checklist：擴充的第一刀

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-17
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
  - 🔴 **這一份特別容易破功，而我刻意守住了**：需求裡**沒有**出現
    `Webview`／`localResourceRoots`／`.vsix`／`@types/vscode`／Vite。
    FR 只說「可安裝的擴充封包」「看得到的面板」「積木登錄表」。
  - ⚠️ **兩處例外**：Assumptions 提到 `~/.arduinoIDE/`（那是**驗證環境的事實**），
    「已知的坑」引了 `history` 編號（那是**出處**，不是做法）。
- [x] Focused on user value and business needs（學生在他已經在的地方看到積木）
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
  - 🟢 三個大決定（合流形狀／目錄位置／寫回策略）**在寫規格之前就拍板了**。
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable（7 條）
- [x] Success criteria are technology-agnostic
  - ⚠️ SC-005／SC-006 指名 4283、47 條、0.07% —— 那是**回歸底線**，保留。
- [x] All acceptance scenarios are defined（3 個故事 × 3 個場景）
- [x] Edge cases are identified（5 個）
- [x] Scope is clearly bounded（明確排除 4 條，而其中兩條標 🔴）
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

🔴 **這份規格有一條前所未有的驗收：SC-007 說「失敗也算成功」。**

> 「**而如果畫布跑不動，這一刀【仍然成功】** ——
> 條件是：**如實記下來，並且不換一個更弱的驗收**。」

**為什麼要寫進去**：這一刀的性質是**否證**，不是交付。而一個以否證為目的的
工作有一個特有的失敗方式 —— **在發現壞消息時把驗收改軟**，讓它看起來完成了。

> **一個「不做就繞不過去」的否證，與一個「做到了」的交付，價值一樣。**

⚠️ **第二條不尋常的是 SC-004 要求「判準」而不是結論。**
`history/076` 記過同族的錯：我曾把「跑完了沒拋錯」當成「成功」。
**「看起來還好」是同一個病的 UI 版本。**

⚠️ **而 FR-004 是這一刀的靈魂**：積木必須**來自登錄表**。
手寫一顆假積木也能讓畫布上有東西 —— **而那證明的是「Blockly 能跑」，
不是「Semorphe 的核搬得過去」**，那是兩件完全不同的事。
