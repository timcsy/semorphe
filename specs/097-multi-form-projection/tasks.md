# 任務：多形態機制——一個元件身分，多個積木形態

**Feature**: `097-multi-form-projection` ｜ **Plan**: [plan.md](plan.md) ｜ **Spec**: [spec.md](spec.md)

## ⚠️ 那條「不可調換的順序」已撤銷（2026-08-07，實作中實測）

> **原本寫著**：存檔轉換（T007–T009）必須先於積木型別改名（T024）。
>
> **實測推翻了它的前提。** 計畫假設「復活分開的形態＝改名既有積木型別」，而那個假設沒有被驗證：
>
> - `src/ui/app.ts:241`：載入時 `blocklyState` **原樣還原** → 舊存檔裡的積木型別必須仍然有效
> - `src/ui/sync-controller.ts:202`：**任何編輯都會從語義樹重新渲染**
>
> → 正確做法是**加法式**：`c_container_push` **保留**為 fallback 形態，**新增** `c_stack_push`／`c_queue_push`。
> 舊存檔照樣載得起來（型別還在），第一次編輯就重新渲染成新形態——**自癒**。
>
> **所以存檔轉換不需要**，硬邊也隨之消失。而這正是本專案記過的那條：
> **「加法式併行通道 >> 加寬共享型別」**（`concepts/元件.md` 引 ArduinoCAD）。
>
> ⚠️ **不 bump `CURRENT_VERSION`**：格式沒有變。為了「看起來有處理」而 bump，
> 會逼出一個什麼都不做的 upgrade 函式——那比不做更糟。

## TDD（憲章 II，非妥協）

每個實作 task **前面都有一支會紅的測試**，且測試 task 與實作 task **分開編號**。
「先寫測試」在這裡不是形式——`FR-002` 刻意寫成「MUST NOT 蓋掉先註冊的」，因為**蓋掉是現況**，可以直接對著它寫紅燈。

---

## Phase 1：Setup

- [X] T001 記錄動工前的基線數字到 `specs/097-multi-form-projection/baseline.md`：全套測試檔數、身分健檢／就近性／中立性／雙重真相／執行器重複註冊各護欄的當下值
- [X] T002 建立測試檔骨架 `tests/unit/core/form-selection.test.ts`（契約 C-1..C-5，全部 `it.fails` 或會紅的斷言，**不得用 `it.todo`**）

> T001 不是儀式：**護欄「不得上升」的驗收需要一個比較基準**，而全套跑一次就會有人手癢去改基線。

---

## Phase 2：Foundational（阻斷所有 User Story）

### 契約測試（先紅）

- [X] T003 [P] 在 `tests/unit/core/form-selection.test.ts` 寫 C-1（選擇是全函數：軸值取不到 → 回 default；取到但無對應 → 回 default 且出聲）
- [X] T004 [P] 在 `tests/unit/core/form-selection.test.ts` 寫 C-3（同一 conceptId 的任兩形態產出相同的碼）
- [X] T005 [P] 在 `tests/unit/core/form-selection.test.ts` 寫 C-4（任一形態反推得到同一個 conceptId）——**這條目前免費成立，測試是為了防它日後被改壞**
- [X] T006 [P] 在 `tests/unit/core/form-selection.test.ts` 寫 C-5（選擇只讀 node 與呈現位置，不走樹、不查全域）

### ~~存檔轉換~~ → 改為證明「不需要轉換」

- [X] ~~T007 UPGRADES[1] 的測試~~ **撤銷**——加法式不改名，舊存檔的積木型別仍然有效
- [X] ~~T008 實作 UPGRADES[1]~~ **撤銷**——同上
- [X] ~~T009 CURRENT_VERSION 1→2~~ **撤銷**——格式沒變，不得為了「看起來有處理」而 bump

**取代它們的**（同樣是 US3 要的保證，但驗的是加法式的正確性）：

- [ ] T007 在 `tests/integration/multi-form-container.test.ts` 寫「舊存檔裡的 `c_container_push` 積木型別**仍然註冊得到**」——這是加法式的核心保證，一旦有人手癢改名它就紅
- [ ] T008 寫「含舊積木型別的存檔載入後不報錯」
- [ ] T009 寫「舊存檔重新渲染後升級成新形態」（自癒），並釘住 `renderToBlocklyState` 是那條自癒路徑

### 核心型別與選擇函式

- [X] T010 在 `src/core/types.ts` 新增 `FormSet` 與 `FormAxis` 型別（依 `data-model.md` 的不變式 FS-1..FS-4）
- [X] T011 在 `src/core/projection/pattern-renderer.ts` 實作選擇函式，滿足 C-1..C-5。**函式內 MUST NOT 出現任何具體元件身分**（C-2）
- [X] T012 讓 T003–T006 轉綠

**Checkpoint**：契約測試全綠 ＋ 存檔轉換全綠 → User Story 可以開始

---

## Phase 3：User Story 1 —— 學生看得懂元素跑到哪裡（P1）

**目標**：`cpp_container_push` / `cpp_container_pop` 在堆疊上顯示「頂端」、在佇列上顯示「尾端」。

**獨立測試**：把 push 積木分別接到堆疊與佇列變數上，**讀積木上的文字（MSG0），不看 tooltip**。

### 測試（先紅）

- [ ] T013 [US1] 建 `tests/integration/multi-form-container.test.ts`，寫「堆疊上的 push 積木文字提到頂端、佇列上的提到尾端」——**斷言 MSG0 對應的字串，不是 tooltip**
- [ ] T014 [P] [US1] 在同檔寫「兩個形態產出相同的 C++」（都是 `.push(...)`）
- [ ] T015 [P] [US1] 在同檔寫「兩個形態執行結果相同」
- [ ] T016 [P] [US1] 在同檔寫**負向**：容器種類查不到時，用中性標籤且**不宣稱位置**（FR-007）

### 辨識側

- [ ] T017 [US1] 在 `tests/integration/multi-form-container.test.ts` 寫「辨識 `st.push(x)` 時節點帶 `container_kind: 'stack'`」與「查不到型別時**不寫**該屬性」（CK-1）
- [ ] T018 [US1] 在 `src/languages/cpp/core/lifters/strategies.ts` 辨識容器方法呼叫時寫入 `container_kind`，做法與 095 的 `input.from` 同型（用 `ctx.data.getType()`）
- [ ] T019 [US1] 寫一支測試釘住 **CK-3：執行器 MUST NOT 讀 `container_kind`**（把該屬性改成錯的值，執行結果必須不變）

### 形態宣告與標籤

- [ ] T020 [P] [US1] 在 `src/languages/cpp/core/blocks.json` 為 `cpp_container_push` 新增依 `container_kind` 分的兩個形態宣告（stack／queue），保留現有的中性形態當 default
- [ ] T021 [P] [US1] 同上，為 `cpp_container_pop` 新增兩個形態
- [ ] T022 [US1] 接上既有的死字串：`CPP_STACK_PUSH_MSG0`／`CPP_QUEUE_PUSH_MSG0`／`CPP_STACK_POP_MSG0`／`CPP_QUEUE_POP_MSG0`——**MUST NOT 另寫一份**（FR-011）
- [ ] T023 [US1] 檢查那四個字串的措辭是否**說出作用在哪裡**（FR-010）；英文 `CPP_QUEUE_PUSH_MSG0` 目前是 `"Push %2 onto queue %1"`，**onto 同樣是堆疊語義，要改**

### 接上活的路徑

- [ ] T024 [US1] 在 `src/core/projection/pattern-renderer.ts` 把 `renderSpecs` 從 `Map<conceptId, RenderSpec>` 改為承載 `FormSet`，`render()` 改走選擇函式
- [ ] T025 [US1] 讓 T013–T017 轉綠

**Checkpoint**：US1 可獨立驗收——跑 quickstart 的第 1、2 步

---

## Phase 4：User Story 2 —— 同一個概念不再需要兩個身分（P1）

**目標**：機制支援一個 conceptId 註冊多個形態，後註冊不蓋掉先註冊。**本階段不執行任何身分整併。**

### 測試（先紅）

- [ ] T026 [US2] 在 `tests/unit/core/form-selection.test.ts` 寫 FR-002：同一 conceptId 註冊兩個形態後，**兩個都在**（這支對著現況會紅——現況是第二次 `set` 蓋掉第一次）
- [ ] T027 [P] [US2] 寫 FS-4 的違反注入：兩個 conceptId 共用同一個 blockType **必須被擋下並出聲**

### 實作

- [ ] T028 [US2] 在 `src/core/block-spec-registry.ts` 把 `byConceptId` 改為一對多，並讓 `conceptToBlockType` 一致
- [ ] T029 [US2] 讓 T026–T027 轉綠

> `byConceptId` **零呼叫者**，所以 T028 不會改變行為。做它是為了讓宣告與實作不分歧——**雙重真相護欄在看的正是這種分歧**。

- [ ] T030 [US2] 示範性驗證（**不改動任何既有身分**）：用合成的元件宣告，證明「一對 statement/expression 可以併成一個身分兩個形態」（SC-006）

---

## Phase 5：User Story 3 —— 既有存檔不會壞（P1）

> 實作已在 T007–T009 完成（硬性優先）。本階段補齊驗收與邊界。

- [ ] T031 [US3] 用改動前產生的真實存檔（從 git 取一份或現場產生）測「載入成功且語義等價」
- [ ] T032 [P] [US3] 測「載入後再存 → 存成 v2，舊格式不再出現」（SV-1）
- [ ] T033 [P] [US3] 測「轉不動的存檔要出聲」（SV-2），不得靜默丟棄

---

## Phase 6：Polish 與交叉驗證

- [ ] T034 跑 `tests/integration/audit-*.test.ts`，逐條比對 T001 的基線——**任一護欄上升即停下歸因**
- [ ] T035 中立性護欄特別複查：選擇函式裡不得出現具體元件身分（C-2 是這份契約唯一有機械檢查的一條）
- [ ] T036 執行器重複註冊維持 0（SC-004）
- [ ] T037 跑全套 `npm test`，**完整列出 FAIL 清單，不得用 `head` 截斷**
- [ ] T038 手動驗（機器驗不到的那一格）：開瀏覽器，拖 push 積木接到堆疊變數上，**不滑鼠停留**，讀積木上的字，問自己「我知道等一下 pop 會拿到什麼嗎」
- [ ] T039 更新 `specs/097-multi-form-projection/spec.md` 的量測欄；把 research.md 對規格的那處更正（阻斷點是 `PatternRenderer` 不是 `BlockSpecRegistry`）回填到 spec

---

## 依賴圖

```
Setup (T001–T002)
   ↓
Foundational
   ├─ 契約測試 T003–T006  [可並行]
   ├─ 加法式保證 T007–T009  [可並行]  ← 原本的「存檔轉換」，前提被實測推翻
   └─ 核心型別 T010→T011→T012
   ↓
US1 (T013–T025)  ← MVP，交付學生看得到的價值
   ↓
US2 (T026–T030)  ← 解除 B 項阻斷
   ↓
US3 (T031–T033)  ← 驗收（實作已在 Foundational 完成）
   ↓
Polish (T034–T039)
```

**原本的硬邊已消失**（加法式不改名）。剩下的順序約束只有一般的 TDD：測試先於實作。

## 可並行的機會

| 群組 | 任務 |
|---|---|
| 契約測試 | T003、T004、T005、T006（同檔不同 `it`，可同時寫） |
| US1 測試 | T014、T015、T016 |
| 形態宣告 | T020、T021（不同概念） |
| US3 驗收 | T032、T033 |

## MVP 範圍

**Phase 1 + Phase 2 + Phase 3（US1）** = T001–T025。

跑完就交付了這個功能存在的理由：**學生從積木上的文字看得出元素跑到哪一端**。
US2 解除下一步的阻斷，US3 是安全網——兩者都重要，但都不是「使用者看得到的價值」。
