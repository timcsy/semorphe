# Feature Specification: 元件動詞改名——每個視圖一對 render／lift

**Feature Branch**: `181-view-paths`

**Created**: 2026-10-31

**Status**: Draft

**Input**: 重構階段 2（vision〈重構：語意交給 Cella〉）。使用者 2026-10-31 定的形狀：`component.json` 的 `paths` **視圖優先，包一層 `views`**——
每個元件在它出現的每個視圖上有一對 render／lift（只能單向的視圖只寫 render）；formalize 與 execute 不是視圖，放在 `views` 之外。
舊的四個平鋪鍵（`render` 畫成積木、`extract` 從積木抽回、`generate` 產程式碼、`lift` 從程式碼辨識）退場；檔名不改，只改宣告。
同一刀改 P2 原文與檢驗表、五槽的「行為」槽換成「形式」槽、元件代數的完備性 ⑤ 換成「formalize 存在」，並留一筆 history。
設計：`knowledge/draft/2026-10-31-重構的設計-能力介面與降級路徑.md` 五之四、五之五。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 學生什麼都沒感覺到（Priority: P1）

學生打開任一堂課（C++、C、Python、Arduino），寫程式碼、拉積木、在兩邊之間同步、執行、除錯——行為與今天逐字相同。
這一刀改的是元件**怎麼宣告自己有哪幾路**，不是任何一路的行為。

**Why this priority**: 349 顆元件的宣告一次全部改寫；任何一顆讀錯一路，學生看到的就是「某個積木不見了」或「某段程式碼轉不過去」。

**Independent Test**: 全部 e2e、課文判題、語料往返測試在改動前後結果相同。

**Acceptance Scenarios**:

1. **Given** 任一份課文解答，**When** 從程式碼轉成積木再轉回程式碼，**Then** 與改動前得到同一棵語義樹、同一段程式碼。
2. **Given** 工具箱裡的任一顆積木，**When** 學生把它拉到畫布上並同步，**Then** 產出的程式碼與改動前相同。

---

### User Story 2 - 加一個視圖不必發明新動詞（Priority: P1）

開發者要讓一顆元件出現在新的視圖上（之後的流程圖、電路圖，或程式以外的領域）：在那顆元件的宣告裡加一個視圖名，底下寫它的 render（與 lift，若那個視圖能回推），
不需要新增任何動詞、不需要改核心的動詞清單。刪一個視圖則是把那一塊整個拿掉。

**Why this priority**: 這是改名的目的。使用者的理由：未來有程式以外的領域進來；今天的 `generate`／`extract` 把「哪個視圖」編進了動詞，加一個視圖就得發明兩個新動詞。

**Independent Test**: 在測試裡給一顆元件加一個只有 render 的假視圖，確認完備性檢查接受它（單向視圖合法），而給它一個只有 lift 沒有 render 的視圖會被擋下。

**Acceptance Scenarios**:

1. **Given** 一顆元件宣告了 `blocks` 與 `code` 兩個視圖，**When** 完備性檢查跑，**Then** 兩個視圖各自檢查 render 與 lift 成對。
2. **Given** 一個只寫 render 的視圖，**When** 完備性檢查跑，**Then** 接受（單向視圖）。
3. **Given** 一個只寫 lift 的視圖，**When** 完備性檢查跑，**Then** 擋下並說出是哪一顆、哪個視圖。

---

### User Story 3 - 原則與概念文件說的是現在的事（Priority: P2）

讀 `principles.md` 的人看到的 P2 與檢驗表，與程式裡真正檢查的是同一件事；讀 `concepts/元件.md` 的人看到的元件槽位，與宣告檔裡真正有的是同一組。

**Why this priority**: knowie 的 judge 已經量到兩處對不上（P2 還寫著已刪除的 `ComponentRegistry` 與「五條路徑」；五槽還有「行為」，而元件已不再自帶執行）。
原則與實作不一致時，下一個讀的人會照錯的那份做。

**Independent Test**: 知識庫的連結與引用檢查全綠；P2 檢驗表的每一句都能對到一條在跑的護欄。

**Acceptance Scenarios**:

1. **Given** 改完的 `principles.md`，**When** 讀 P2，**Then** 它說「每顆元件在元件登錄表中有唯一條目；每個它出現的視圖都有一對 render／lift，並有 formalize」，檢驗表同步。
2. **Given** 改完的 `concepts/元件.md`，**When** 讀五槽表，**Then** 槽位是「身分・接點・參數・形態・形式」，「行為」仍是投影的一族但不再是元件的槽。

---

### Edge Cases

- **刻意沒有某一路的元件**：今天有 7 顆 `lift` 是 `null`、3 顆 `generate` 是 `null`、23 顆 `execute` 是 `null`、1 顆 `render`／`extract` 是 `null`，多數附 `_why`。
  新形狀裡這些「顯式的空」要原地保留（`null` 照樣是 `null`，`_why` 跟著搬到同一個視圖底下），不得被當成「漏寫」，也不得被當成「沒有這個視圖」。
- **附屬鍵**：78 顆有 `liftStrategy`（從程式碼辨識的具名策略）、數十顆有 `_lift_why`／`_execute_why` 等說明鍵——它們跟著所屬的那一路搬，不得遺失。
- **同一個檔服務兩個方向**：積木視圖的 render 與 lift 今天都指向 `./forms/blocks.json`；新形狀照樣兩邊都指它（一個檔、兩個宣告）。
- **進行中的分支**：其他分支若還用舊鍵，合併時要一次改完，不留新舊並存（P8 不做向後相容）。
- **formalize 只有部分元件有**（102 / 250 顆 C++；Python 0 顆）：formalize 不在 `views` 裡，缺了不算視圖不完整；它的覆蓋由既有的 formalize 覆蓋護欄管。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 每顆元件的宣告 MUST 用新形狀：`paths.views.<視圖名>.render`／`.lift`，以及 `views` 之外的 `formalize`、`execute`。
- **FR-002**: 舊的平鋪鍵 `render`／`extract`／`generate`／`lift` MUST 從所有元件宣告中消失；任何讀取宣告的程式碼 MUST 不再讀它們（不留轉接層，P8）。
- **FR-003**: 今天的四個鍵 MUST 依「視圖 × 方向」對應：`render` → `views.blocks.render`、`extract` → `views.blocks.lift`、`generate` → `views.code.render`、`lift` → `views.code.lift`；
  `liftStrategy` 與各 `_*_why` 說明鍵 MUST 跟著它所屬的那一路搬到對應的視圖底下。
- **FR-004**: 顯式的空（值為 `null`）MUST 原地保留，語意不變：「這顆在這個視圖的這個方向上刻意沒有」。
- **FR-005**: 元件的檔名（`generate.ts`、`lift-pattern.json`、`forms/blocks.json`……）MUST 不改；只改宣告的鍵。
- **FR-006**: 路徑完備性檢查 MUST 改成：每個宣告的視圖都有 render；有 lift 的視圖 render 與 lift 成對；只有 lift 沒有 render 的視圖被擋下；每個宣告指到的檔都存在。
- **FR-007**: 「每一路由誰判定」的對照 MUST 改用視圖化的鍵（每個視圖的每個方向各一格，加上 formalize 與 execute），覆蓋數字與改動前相同。
- **FR-008**: 載入與註冊（掃出各元件的實作檔、確認宣告與實作檔一致）MUST 讀新形狀，而且宣告與實作不一致時照舊擲錯、不安靜地少一路。
- **FR-009**: `principles.md` 的 P2 原文與檢驗表 MUST 改成定案的文字；`concepts/元件.md` 的五槽表與名詞表、`concepts/元件代數.md` 的完備性 ⑤ MUST 改成「形式（formalize）」；
  MUST 新增一筆 history 記這次轉變與它的理由。
- **FR-010**: componentId MUST 不變；語義樹、存檔、匯出入的格式 MUST 不受影響。

### Key Entities

- **元件宣告（component.json 的 paths）**：一顆元件有哪幾個視圖、每個視圖的 render 與 lift 指到哪個檔；另有 formalize（語意交給 Cella）與 execute（階段 6 退場）。
- **視圖**：今天兩個——`blocks`（積木）與 `code`（程式碼）。視圖名是宣告裡的鍵，不是核心寫死的動詞。
- **判定者對照**：每個視圖的每個方向、formalize、execute 各由哪條測試判定、覆蓋多少。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 349 顆元件宣告 100% 是新形狀；舊的四個平鋪鍵在整個 repo 的元件宣告與讀取程式碼中出現 0 次。
- **SC-002**: 改動前後，全套測試與全部 e2e 的結果相同（全綠 → 全綠）；課文解答往返的語義樹逐一相同。
- **SC-003**: 顯式的空在改動前後一顆不差（各方向的 `null` 數量相同：lift 7、generate 3、execute 23、render／extract 1）；`liftStrategy` 78 顆、各 `_why` 鍵的總數相同。
- **SC-004**: 給一顆元件加一個新視圖，只需要改那一顆的宣告與加實作檔；核心的動詞清單改動 0 處。
- **SC-005**: 判定者對照的覆蓋數字在改動前後相同（只是鍵換了）。
- **SC-006**: knowie 的 judge 對 P2 與五槽不再報「與現行決定對不上」。

## Assumptions

- 視圖名就用 `blocks` 與 `code`（設計 draft 五之五）；流程圖、電路圖等視圖等它們真的需要宣告時再加。
- 「只能單向的視圖只寫 render」指的是未來的視圖（診斷、對照圖）；今天兩個視圖對所有元件都是雙向的（除了顯式的空）。
- 這一刀不碰任何一路的實作邏輯，也不改檔名；檔名留到各自被碰到時再改，避免與進行中的分支大面積衝突。
- execute 照樣宣告到階段 6 才退場（使用者第 4 題：execute.ts 留到階段 6 一起刪）。
- 這一刀的前置（第二套產碼路徑拆掉、formalize 進膠囊）已在 main（第 384、389 刀）。
