# Specification Quality Checklist：擴充長成能用的

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-17
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
  - 🔴 **這一份特別難守，而我逐條清過**：規格裡**沒有**出現
    `TextDocument.version`／`undoStopBefore`／`setRecordUndo`／`WorkspaceEdit`／
    `settings.json`／`language-overridable`／`setDecorations`／`zelos`／`wasm-unsafe-eval`。
  - 那些**全部在 draft 與 vision 裡**，而規格只說「用**身分**不用**等待**」、
    「存在**使用者看得見、改得到、可進版控**的地方」、「支援**按語言覆寫**」。
  - ⚠️ **一處刻意的例外**：`experience.md:2866` 與 `history/07x` 的編號
    ——那是**出處**，不是做法。
- [x] Focused on user value and business needs（八個故事全部從學生／老師出發）
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
  - 🟢 四個大決定（面板跟誰／設定住哪／執行怎麼做／一次做完）
    **在寫規格之前由使用者拍板**。
- [x] Requirements are testable and unambiguous（14 條 FR，每條都對得到一條 SC）
- [x] Success criteria are measurable（12 條，全部有數字或是非）
- [x] Success criteria are technology-agnostic
  - ⚠️ SC-011 指名 0.07%／0 漂移 —— 那是**回歸底線**，保留。
- [x] All acceptance scenarios are defined（8 個故事 × 3～4 個場景）
- [x] Edge cases are identified（7 個，含兩個我原本沒想到的：
      「面板開著而所有編輯器都關掉」、「同一份文件開在兩欄」）
- [x] Scope is clearly bounded（明確排除 5 條）
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

### 🔴 這份規格最重要的一段不是需求，是它開頭的那個警告

「一次做完」是使用者拍板的。而這個專案有一份**正是在「一次做很多」時
發生的病歷**（`history/072`：`c-style-parity` 10/10 全綠，
**而瀏覽器上仍然產出 `<iostream>`**）。

> **它不是因為某一項做錯了，是因為「每一項都有人看」
> 與「整體有人看」不是同一件事。**

處置寫進了結構本身：**八個故事按「使用者做得到什麼」切，
而每一個都必須自己獨立可驗**。
⚠️ **判準**：一個「要等全部做完才驗得了」的故事，就是切錯了。

### ⚠️ 第二件不尋常的是 FR-005 —— 它禁止一種【做法】而不是要求一個結果

> 「MUST NOT 依賴**等待**——它必須依賴**身分**。」

規格通常不該管做法。**而這一條該管**，理由是它有病歷：
`experience.md:2866` 記著防迴圈的等待版本，並自己標了
「⚠️ **那個常數是猜的**（50ms 沒有人驗過夠不夠）」。

> **一個沒有上界的猜測，寫在需求裡才擋得住。**

### ⚠️ 而第三件：SC-012 是一條「把主場景釘住」的驗收

「未存檔的暫存分頁上，SC-001～SC-010 **全部同樣成立**」。

它存在是因為 2026-08-17 實測撞到過：使用者開了一個 `Untitled-1`，
而入口沒出現——**因為條件只認副檔名**。
🔴 而那正是使用者說的主場景（「AI 給的 Code 他們貼上來」）。

> **一個場景如果只在「正常情況」被測，它就會在「最常見的情況」壞掉。**
