# Feature Specification: 靜默回退掩蓋辨識歧義

**Feature Branch**: `110-silent-fallback-size`
**Created**: 2026-08-10
**Status**: Draft
**Input**: `s.size()` 在字串上被判成 vector，而 vector 的執行器對非陣列靜靜回 0。

## 這個 spec 在治什麼

```
s.length()  →  cpp:string_size{obj:s}   ✅ 執行正確
s.size()    →  cpp:vector_size{obj:s}   ← 身分錯
```

而 `cpp:vector_size` 拿到一個字串時：

```ts
if (arr.type !== 'array' || !Array.isArray(arr.value)) {
  return { type: 'int', value: 0 }        // ← 靜靜回 0
}
```

**兩個已命名的病疊在一起**，而第二個讓第一個看不見：

| | 病 | 出處 |
|---|---|---|
| ① | **辨識歧義**——`.size()` 不看目標型別，字串一律判成 vector | P3 的執行機構 |
| ② | **靜默降級反模式**——「空容器」與「不是容器」都回 0 | `concepts/執行機構.md` |

**後果**：19 筆剩餘誤差裡的 **5 筆整叢**（`fuzz-cpp-cctype`）。那五段都寫
`for (int i = 0; i < s.size(); i++)`——迴圈條件回 0，**一次都不跑**，字串原樣輸出。

### ⚠️ 既有的辨識歧義護欄看不見它

那條量「**有多少規則在搶同一種語法**」。而 `.size()` 只有一條規則——
**問題不是兩條規則搶，是一條規則判別不足**。基線裡沒有 `size`。

### ⚠️ 而我在規劃時連續診斷錯兩次，記在這裡以免重犯

1. **「`s.size()` 完全沒有被 lift」**——錯的。它有 lift，而我的探測腳本用
   `x.includes('string')` 過濾語義節點，**剛好把答案（`cpp:vector_size`）濾掉了**。
   > **探測的過濾器濾掉了答案，而輸出看起來像一個發現。**
   > 這是「語料錯看起來像世界的性質」的近親：**篩選條件也是語料的一部分**。
2. 據此推薦「蓋一條量得到**靜默丟棄**的護欄」——**前提不成立**，沒有東西被丟棄。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - `s.size()` 與 `s.length()` 行為相同（Priority: P1）

學生寫 `for (int i = 0; i < s.size(); i++)`，迴圈**一次都不跑**，
而換成 `s.length()` 就正常。兩者在 C++ 裡是同義詞。

**Independent Test**：`string s="abc"; cout << s.size();` 輸出 `3`。

**Acceptance Scenarios**：

1. **Given** 一個字串，**When** 取它的 `size()`，**Then** 得到字元數
2. **Given** 同一個字串，**When** 取 `length()`，**Then** 得到相同的值
3. **Given** 一個真的容器，**When** 取 `size()`，**Then** 行為不變（不得回歸）
4. **Given** 用 `size()` 當迴圈條件的程式，**Then** 迴圈跑滿

### User Story 2 - 執行器拿到處理不了的輸入時要出聲（Priority: P1）

`vector_size` 拿到字串時回 0。**「空容器」與「這根本不是容器」在輸出上一模一樣**，
所以 US1 那個辨識缺陷可以躲很久。

**Independent Test**：對非容器目標取 `size()` 會產生錯誤而非 0。

**Acceptance Scenarios**：

1. **Given** 一個非容器目標，**When** 取它的容器長度，**Then** **出聲**而非回 0
2. **Given** 一個真的空容器，**When** 取長度，**Then** 仍然回 0（雙向）

### User Story 3 - 同族的靜默回退被清點（Priority: P2）

掃描顯示這不是單一實例：**7 處**「檢查失敗 → 回傳預設值」。

**Independent Test**：清單存在，每一筆有判定與理由。

**Acceptance Scenarios**：

1. **Given** 掃描完成，**Then** 每一筆標明是**合法**（如比較函式回 0 表示相等）還是**靜默回退**
2. **Given** 一筆被判為合法，**Then** 有理由，且理由不是「看起來還好」

### Edge Cases

- **合法的 0**：`strcmp` 相等時回 0——**那是語義，不是回退**，不得誤報
- **真的空容器**：長度就是 0，不得因為這次改動而開始丟錯
- **`.size()` 用在 `map`／`set`／`stack`** 等其他容器上——不得因為改判別而壞掉
- **靜態掃描只能排順序**：合法與回退在語法上一模一樣（都是 `return {value:0}`），
  判定需要人看

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**：字串的 `size()` MUST 回傳字元數，且 MUST 與 `length()` 相同。
- **FR-002**：真正容器的 `size()` 行為 MUST 不變。
- **FR-003**：容器長度的執行器拿到**非容器**目標時 MUST 出聲，MUST NOT 回傳 0。
- **FR-004**：真正的**空容器** MUST 仍然回傳 0。
- **FR-005**：「檢查失敗 → 回傳預設值」的同族 MUST 被清點，每筆 MUST 有判定與理由。
- **FR-006**：判定 MUST 區分「合法的預設值」與「靜默回退」，MUST NOT 只給總數。
- **FR-007**：`.size()` 的辨識規則 MUST 照 `.length()` 既有的形狀，MUST NOT 另寫一套判別。
- **FR-008**：誤差基線下降時 MUST 註明是「因為實作了」。

### Key Entities

- **靜默回退**：輸入不合預期時回傳一個與合法結果無法區分的預設值
- **判定**：每筆回退的分類（合法／靜默回退）＋ 理由

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**：`string s="abc"; cout << s.size();` 顯示 `3`。
- **SC-002**：用 `size()` 當迴圈條件的程式跑滿；`length()` 版本行為不變。
- **SC-003**：對非容器取容器長度會出聲；對空容器仍回 0。
- **SC-004**：7 處同族全部有判定與理由。
- **SC-005**：誤差基線 19 → 14，`_meta` 註明「因為實作了」。
- **SC-006**：全部測試通過。

## Assumptions

- `.size()` 在其他容器上的既有辨識正確，本輪只補字串那一支。
- 「出聲」沿用既有的執行期錯誤機制，不新增使用者介面。

## Out of Scope

- `islower`／`isupper` 的五路（**宣告過的缺口，是新功能不是缺陷**）
- fuzz 檔斷言改寫（可讀性問題，不是覆蓋缺口）
- 剩下 9 筆其他叢的誤差

## 給實作者的警告

### ⚠️ 順序：先掃描，再決定要不要蓋護欄

使用者要求「護欄先蓋，再修」。而 `build-guardrail` 的那條規則有前提——
**先確認同族夠多**。掃描已跑：**7 處**，其中 2 處（`strcmp` 回 0 表示相等）
是**合法的**。

→ 所以護欄的形狀是**排順序不下結論**（第 6 步）：報出「這裡有一個檢查失敗
後的預設值」，由人判定並留下理由（第 11 步的 `decisions.json`）。
**不要寫一個自以為分得出合法與回退的判準**——它們在語法上一模一樣。

### ⚠️ 既有教訓

- 「**沉默的正確和沉默的缺失撞在一起時，讓正確的那個說話**」——這條的處方是
  把**推斷**改成**宣告**。這裡對應：合法的預設值要說得出它為什麼合法。
- 「**低報到零沒得救**：一筆看不見的缺陷與一筆不存在的缺陷長得一模一樣。」
- 「**照抄已驗證的形狀，不要自己換一個判準**」（2026-08-10 新增）——`.size()`
  照抄 `.length()` 的規則。**上一輪就是換判準造成 `strcat` 回歸的。**
- 「**修一條路時要問：同一個缺陷在別的路上長什麼樣**」——所以掃描是 in scope。

## 相關

- `specs/109`——上游，誤差 31 → 19
- `knowledge/concepts/執行機構.md`——靜默降級反模式、三階病、辨識歧義護欄
- `knowledge/skills/build-guardrail/SKILL.md` 第 6 步、6.8、第 11 步
