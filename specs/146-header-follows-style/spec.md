# Feature Specification：標頭跟著風格走 —— C 目標產出的程式碼要編得過

**Feature Branch**: `146-header-follows-style`
**Created**: 2026-08-19
**Status**: Draft
**路線圖位置**: 未清的債「`provides`／`reference` 兩格」的第三格（`requires` 缺一維）
**設計脈絡**: `knowledge/draft/2026-08-13-C和C++難分難捨.md`（**in-flight**）

---

## 出發點：一個實測到的、學生面的硬錯誤

「C 語言教學」目標（`style: c` → `io_style: printf`）今天產出：

```c
原文【有】 include  →  #include <iostream>   原樣保留，而它在 .c 裡編不過
原文【沒有】include →  （完全沒有標頭）      printf 沒有 <stdio.h>，也編不過
```

**兩條路都不是合法的 C。**

而兩層機制都證實了：

```
🔴 HeaderStyle = 'iostream' | 'bits'   風格系統【表達不出】C 的標頭
🔴 componentRequires()                 機制在 registry.ts:145，而【零個生產消費者】
```

⚠️ 而既有的測試 `c-style-parity.test.ts:87` 斷言「**不得有** iostream」——**它綠著**，
因為沒有 include 的那條路確實不含 iostream。

> **一條只驗「不得有 X」的測試，通不出「該有的 Y 在不在」。**

---

## 🔴 那個取捨：使用者決定「**換掉**」

原文帶 `<iostream>` 而目標是 C 時，三個選項：

| | |
|---|---|
| 保留 | 忠於原文，**而它編不過** |
| **換掉 ✅** | 產出 `<stdio.h>` |
| 不管 | 只處理沒有 include 的路徑 |

**而「換掉」不是「投影改寫真實」**——這一點要說清楚，否則它看起來違反 P1：

```
語義（真實）   這段程式需要【輸出的能力】
投影（標頭）   iostream 或 stdio.h —— 哪一個，由風格決定
```

> **`<iostream>` 從來不是語義，語義是「需要輸出」
> ——標頭是那個需求在某個風格下的投影。**

⚠️ 所以換掉標頭與「把 `cout` 換成 `printf`」是**同一件事**，而後者早就在做了。
**真正的不一致是：語句換了風格，而它的標頭沒有。**

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 學 C 的學生拿到編得過的程式碼 (Priority: P1)

**Acceptance Scenarios**:

1. **Given** C 目標、原文**沒有** include，**When** 產生，**Then** 含 `#include <stdio.h>`
2. **Given** C 目標、原文**有** `<iostream>`，**When** 產生，**Then** 那一行變成 `<stdio.h>`
3. **Given** 兩者，**When** 用 `gcc` 真的編，**Then** **編得過**

### User Story 2 - 🔴 C++ 一個字都不能變 (Priority: P1)

**Why this priority**: 與 US1 同級。⚠️ 這一刀動的是**所有** include 的產生路徑。

**Acceptance Scenarios**:

1. **Given** C++ 目標（`apcs`／`google`），**When** 產生，**Then** 輸出與今天**逐位元組相同**
2. **Given** `competitive`（`header_style: bits`），**Then** 仍然產出 `<bits/stdc++.h>`

### Edge Cases

- ~~**原文有 `<stdio.h>` 而目標是 C++**：對稱處理——換成 `<iostream>`~~
  🔄 **實作中否決**：C++ **看得懂 `<stdio.h>`**（它是合法的 C++ 標頭），
  所以那不是「編不過」而是「風格不一致」——**而風格不一致不值得改寫使用者寫的東西**。
  🔴 這一刀治的是**編不過**，不是不好看。重開條件是「有人抱怨它」。
- **與 I/O 無關的標頭**（`<vector>`／`<cmath>`）：🔴 **完全不動**
- **原文有兩個 include**（`<iostream>` ＋ `<vector>`）：只動 I/O 那一個，且**不重複**

---

## Requirements *(mandatory)*

- **FR-001**：I/O 標頭 MUST 跟著 `io_style` 走（`cout` → `<iostream>`、`printf` → `<stdio.h>`）。
- **FR-002**：C 目標、原文沒有 include 時 MUST **補上** `<stdio.h>`。
- **FR-003**（🔄 **實作中修正**）：與 I/O 無關的標頭 MUST 仍然換成**它在該方言的名字**
  （`<cmath>` → `<math.h>`），而**不得被換成別的標頭**。
  > 🔄 原文寫「**完全不動**」——**而那是錯的**：`<cmath>` 在 C 裡就叫 `<math.h>`，
  > 那是**同一個標頭的兩個名字**，早就由 `header-aliases` 那張表在做。
  > 🔴 而 `<iostream>` → `<stdio.h>` 是**同一個需求的兩個實作**，**不同的一件事**
  > ——所以它寫在 `toCHeader` 的分支裡，不進那張表。
- **FR-004**：C++ 目標的輸出 MUST 逐位元組不變；`bits` 風格 MUST 不受影響。
- **FR-005**：🔴 驗收 MUST 用 **`gcc` 真的編**，不得只做字串比對。
- **FR-006**：MUST NOT 產生重複的 include。

## Key Entities

- **I/O 標頭**：`<iostream>` ⟷ `<stdio.h>` 是**同一個需求的兩個投影**。
  ⚠️ 判準是元件的 `traits.ioStyle`（既有），**不是**一份手寫的標頭對照表。

---

## Success Criteria

- **SC-001**：C 目標的中性語料，`gcc` 編譯成功率 **100%**（今天是 0%）。
- **SC-002**：C++ 目標的輸出**逐位元組不變**。
- **SC-003**：與 I/O 無關的標頭**沒有被換成別的標頭**（換名字是對的）。
- **SC-004**：新增第三種 I/O 風格時，需要編輯的**既有共用檔為 0 個**。

---

## 明確排除

- **`tree-sitter-c` 接上**（draft §四①）——「有人決定要支援 C，裝了文法然後停在那裡」，另一件事。
- **`io_style` 與 `ioStyle` 兩套詞彙的統一**（draft §四②）——⚠️ 這一刀**會用到**它們，
  但**不重新命名**（那是一次改名，代價與風險完全不同）。
- **`reference` 那一格**。
- **`bits` 風格的行為**。

## Assumptions

- **C 的輸出只需要 `<stdio.h>`**——⚠️ 中性語料不用 `malloc`／`string.h`；
  🔴 而 `gcc` 真的編那一條會否證它（FR-005）。

## 已知的坑

1. 🔴 **只驗「不得有 X」不夠**——`c-style-parity.test.ts:87` 就是這樣綠著的。
   驗收要**兩個方向**：不得有 iostream ＋ **必須有 stdio.h**。
2. **不要手寫標頭對照表**——判準走既有的 `traits.ioStyle`
   （`experience.md`：「列舉已知的，等於保證下一個會被漏掉」）。
3. **`gcc` 在 CI 與本機可能是兩個實體**（`experience.md` 記過 Apple clang 那次）
   ——⚠️ 而這一刀驗的是**編不編得過**，不是輸出比對，那個差異不影響。
