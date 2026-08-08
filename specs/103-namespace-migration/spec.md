# Feature Specification: 元件身分命名空間遷移（`<scope>:<name>`）

**Feature Branch**: `103-namespace-migration`
**Created**: 2026-08-08
**Status**: Draft
**Input**: 階段 6.5 的 D 項。177 顆元件身分從 `cpp_vector_declare`／`if` 遷移到 `cpp:vector_declare`／`lang:if`。

## 這份規格治什麼

今天一個元件身分是**沒有擁有者的裸字串**。`if` 是誰的？`cpp_vector_declare` 的 `cpp_`
是前綴慣例，不是宣告——沒有任何東西攔得住第二個人也叫 `cpp_sort`。

第三方要能加入自己的元件（`@timcsy:my-sensor`），前提是身分先有命名空間。
硬體域併入（`hw:led`）同理。**D 是那些事的地基，不是整理工作。**

> ⚠️ **這不是「加一個欄位」，是改真實。** 元件身分寫在使用者的存檔裡，
> 改名等於讓每一份既有存檔指向不存在的東西。P8「不做向後相容」的範圍已釐清為
> **不含語義詞彙本身**（`knowledge/history/026`）——這類變更 **MUST** 附一次性轉換。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 既有使用者打開舊存檔（Priority: P1）

一位學生兩週前存了一份 C++ 作業，今天打開。他不知道也不該知道元件身分改過名。

**Why this priority**: 沒有這一條，遷移就是**資料破壞**。它必須先於任何改名動作被驗證。

**Independent Test**: 拿一份 `version: 2` 的存檔（語義樹裡是 `cpp_vector_declare`、`if`），
載入後檢查：程式碼一字不差、積木長得一樣、可以繼續編輯並存回 `version: 3`。

**Acceptance Scenarios**:

1. **Given** 一份 v2 存檔含 `cpp_` 前綴與裸名身分，**When** 載入，**Then** 語義樹的
   身分全部是 `<scope>:<name>`，而產出的程式碼與遷移前逐字相同
2. **Given** 一份 v2 存檔含**已經是** `cpp:math_pow` 的身分（樹裡本來就有三顆），
   **When** 載入，**Then** 那三顆原樣通過，不被重複加前綴
3. **Given** 一份 v2 存檔含轉換表認不得的身分，**When** 載入，**Then** 該節點原樣保留
   （不丟棄、不改寫），其餘節點正常轉換
4. **Given** 一份 v3 存檔，**When** 載入，**Then** 不觸發任何轉換

### User Story 2 - 開發者新增一顆元件（Priority: P2）

貢獻者加一顆 `cpp:string_starts_with`。他忘了加 scope，寫成 `cpp_string_starts_with`。

**Why this priority**: 遷移完成的隔天就會有人用舊格式新增。**沒有機械檢查，格式會退回去**
——`knowledge/concepts/執行機構.md`「一條規範沒有機械化的檢查，它本身就是殼」。

**Independent Test**: 在登錄表裡放一顆不含冒號的身分，跑護欄，必須被指名。

**Acceptance Scenarios**:

1. **Given** 一顆身分不含 `:`，**When** 跑格式護欄，**Then** 該顆被指名並附檔案位置
2. **Given** 一顆身分的 scope 不在允許清單（`lang`／`cpp`）內，**When** 跑護欄，**Then** 被指名
3. **Given** 全部身分格式正確，**When** 跑護欄，**Then** 零違規

### User Story 3 - 遷移過程中任一段出錯要指得出是哪一項（Priority: P1）

**Why this priority**: 這是**分段的唯一理由**。`draft/2026-08-07-元件目錄與膠囊契約.md:187`：
「181 顆同時重寫會拿到一份**紅得無法歸因**的套件——歸因不了時，17 條護欄全部失效。」
而 089 的機械改名（560 處）**出錯三次**，這一次是 11 倍。

**Independent Test**: 每一段結束時全套測試綠、25 條護欄數字不上升；任一段紅，回退該段即恢復。

**Acceptance Scenarios**:

1. **Given** 第 ① 段（142 顆 `cpp_*`）完成，**When** 跑全套，**Then** 全綠且護欄數字不上升
2. **Given** 第 ② 段（32 顆裸名）進行中，**When** 跑「舊格式引用數」棘輪，**Then** 數字只降不升
3. **Given** 任一段造成紅，**When** 回退該段的變更，**Then** 恢復全綠

### Edge Cases

- **裸名與普通英文單字撞名**：`if`／`print`／`comment`／`return` 這些身分同時是 tree-sitter
  節點型別、Blockly 欄位值、列舉成員、使用者看到的提示文字。`knowledge/experience.md:150`
  記著中立性護欄踩過這個坑：「**六筆裡三筆是誤報**」。→ 第 ② 段**不得**用字串比對遷移。
- **冒號被當成複合鍵的分隔符**：`src/languages/cpp/core/generators/statements.ts:46`
  組出 `` `${n.conceptId}:${normalizeHeader(...)}` ``。身分含冒號之後
  `cpp:include:iostream` 的切法變得曖昧。
- **`abstractConcept` 也是身分引用**：10 顆通用身分被其他元件指著，必須同步遷移，
  否則指向會斷（而 `abstractConcept` 目前只有 33/131 指得到，斷了也不會有症狀
  ——`concepts/執行機構.md` 的第二個實例）。
- **課程清單引用身分**：`topics/cpp-beginner.json`（148 筆）與 `cpp-competitive.json`（146 筆）
  按身分列舉可見元件。漏遷移的後果是**元件從工具箱消失**，而使用者看得到、測試看不到
  ——與 E 項那次「使用者拿不到的積木」同型。
- **積木型別不在範圍內**：`u_*`／`c_*` 是投影層的名字，B 項已定「加法式保留」。
  混進來會讓變更量倍增而沒有對應的收益。

## Requirements *(mandatory)*

### Functional Requirements

**格式**

- **FR-001**: 每一顆元件身分 MUST 形如 `<scope>:<name>`，`scope` 與 `name` 都不得為空
- **FR-002**: 允許的 scope MUST 是一份**明列的清單**（本次為 `lang`、`cpp`），
  而不是「任何冒號前的東西」——否則打錯字會變成一個新的命名空間
- **FR-003**: 跨語言元件的 scope MUST 是 `lang`，不是 `universal`
- **FR-004**: 核心元件 MUST NOT 使用裸名。沒有例外，不留「沒有冒號就是核心」的解析特例

**遷移**

- **FR-005**: 系統 MUST 提供 v2 → v3 的存檔轉換，改寫語義樹中的身分
- **FR-006**: 轉換 MUST 只改寫**認得的**身分，其餘原樣通過（不丟棄、不猜測）
- **FR-007**: 轉換 MUST 對已是新格式的身分是**冪等**的（不重複加前綴）
- **FR-008**: 轉換 MUST NOT 改寫積木型別（`u_*`／`c_*`）——B 項已定加法式保留
- **FR-009**: 遷移 MUST 分三段執行，每段結束時全套測試綠且既有護欄數字不上升
- **FR-010**: 第 ② 段（裸名）MUST 以登錄表交叉驗證決定每一處是否為身分引用，
  MUST NOT 單靠字串比對

**護欄**

- **FR-011**: MUST 新增一條「身分格式」護欄，違規時**指名元件與檔案位置**，不只給數字
- **FR-012**: MUST 提供一條「舊格式引用數」的棘輪，遷移期間只准下降。
  該計數器 MUST 依**角色**（呼叫位置／欄位位置）判定，MUST NOT 用純字串比對
  ——字串計數器會被 `'input'` 這類非身分字串卡在非零，而一條永遠紅的護欄會被忽略
- **FR-013**: 遷移完成後該棘輪 MUST 收成硬性零
- **FR-014**: 護欄 MUST 附自我否證：注入一顆舊格式身分必須被報出，
  注入一顆正確身分必須不被報出

**引用完整性**

- **FR-015**: `abstractConcept` 的指向 MUST 一併遷移，且遷移後指得到的比例不得下降
- **FR-016**: 課程清單（topics）引用的身分 MUST 一併遷移，且遷移後
  「使用者拿不到的積木」數量 MUST 維持 0

### Key Entities

- **元件身分（componentId）**：`<scope>:<name>`。`scope` 表示**所有權**，不是分類也不是位置
  ——域已經是宣告裡的欄位，把它再編進 id 就是雙重真相，而且是最糟的那種
  （id 進了存檔改不動）
- **轉換表**：舊身分 → 新身分的一次性映射，隨存檔版本發布
- **scope 白名單**：本次允許的 scope 集合。它的存在讓「打錯字」與「新命名空間」分得開

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 177 顆元件身分中，格式為 `<scope>:<name>` 的比例從 **3/177 → 177/177**
- **SC-002**: 舊格式引用數從 **4657 → 0**（`cpp_*` 在 .ts 2055 ＋ 在 .json 1164 ＋ 裸名角色分類 1438）

> ⚠️ **這個數字被 research 修正過。** 原本寫的是 6228——那是**原始字串出現次數**，
> 含 `'input'`（DOM 標籤）、`'continue'`（除錯動作）、`'comment'`（tree-sitter 節點型別）
> 這類永遠不會消失的東西。照那個數字訂目標，棘輪**永遠收不到零**。
> 見 `research.md` 發現三。這是本輪第二次「數字看起來像已經量過」。
- **SC-003**: 一份遷移前存的檔案，載入後產出的程式碼與遷移前**逐字相同**
- **SC-004**: 既有 25 條護欄的數字**一條都不上升**
- **SC-005**: 「使用者拿不到的積木」維持 **0**（E 項的成果不得因遷移倒退）
- **SC-007**: JSON 裡的 `blockDef.type` 出現在身分清單中的 **66 處必須原地不動**
  ——66 顆元件身分與積木型別同名，這是「改壞了不會馬上發現」的那一類
- **SC-006**: 身分格式護欄在注入舊格式身分時**會紅**——證明它接上了，而不是恰好沒東西可報

> ⚠️ **SC-006 不能省，理由是這一輪剛付過學費**：C1 加的「values 必須等於積木下拉選項」
> 第一次跑就是綠，因為那些 values **本來就是從下拉抄出來的**——同一份來源比對自己，
> 永遠一致（`knowledge/experience.md`「量測工具的第一版」第八個實例）。
> 一條由建構保證的綠，看起來與一條真的守住了的綠完全一樣。

## Assumptions

- **格式不需要原型**：`cpp:math_pow`／`cpp:math_unary`／`cpp:math_binary` 三顆已經在樹裡
  跑通（lifter／executor／blocks 全通），而 `src/core/types.ts:35` 早就宣告過
  `` LanguageSpecificConcept = `${string}:${string}` ``。**這不是填空白，是接回一個沒人接上的決定。**
- **存檔轉換機制已存在**：`src/core/storage-version.ts` 有 v1→v2 的先例（B 項的六對合併），
  含「每一步都必須有註冊」的測試。本次是沿用，不是新建。
- **scope 命名已收斂**：`lang:`／`cpp:`／`hw:`／`@timcsy:` 的理由已在
  `draft/2026-08-07-元件目錄與膠囊契約.md:66-130` 逐條寫定並拍板，本規格不重議。
  本次只落地 `lang` 與 `cpp`。
- **不採 `id = 位置`**：Go／Modelica 的路線（買到「就近性不可能違反」，代價是搬家＝改名）
  已在同一份 draft 明確否決。
- **測試檔的引用也算**：4516 處在 tests/ 底下。它們不遷移的話，護欄收不了硬性零，
  而且下一個人會照著舊格式寫新測試。

## Dependencies

- **B 身分整併** ✅（`specs/098`／`099`）——膠囊會固化身分，整併必須先於改名
- **C3 引用完備性** ✅（`specs/101`）——「程式碼不得建出登錄表裡沒有的身分」這條護欄
  是遷移期間唯一抓得到「改了一半」的東西
- **阻擋 F 膠囊搬家**——F 的依賴列著 D

## Out of Scope

- 積木型別（`u_*`／`c_*`）改名
- `hw:`／`@user:` scope 的落地（硬體域未併入，第三方機制未存在）
- 身分的**型別化**（字面聯集型別需要 codegen；C3 已判定 branded type 攔不到打錯的 id，
  應在 D 之後才評估）
- i18n 鍵、CSS class、檔案路徑的命名
