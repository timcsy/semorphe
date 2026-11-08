# Feature Specification: 跨語言互轉第二對的反方向——Python → C++（第一版）

**Feature Branch**: `374-python-to-cpp`
**Created**: 2026-11-09
**Status**: Draft
**Input**: vision〈跨語言互轉：以 Cella 為根基〉第二對的反方向（C++ → Python 已上線：history/353，spec 219／224）。型別由 Cella 的 Python 型別表給（`python.observedTypes`，2026-11-09 談定：見下）。

## 背景

C++ → Python 換得過去，因為 Python 不必寫型別。反方向不行：C++ 每一個變數都要宣告型別，而 Python 程式裡沒有寫。
「意思歸 Cella」——我們不自己推型別。Cella 的 Python 型別表（2026-11-09 談定）：

- 入口 `python.observedTypes(程式 JSON, 輸入, 步數)` → `{verdict, nodes, basis}`；鍵是我們程式 JSON 的節點（同 C 家族）。
- `nodes`：節點 → 型別字串（聯集用 `|`、空容器 `list[?]`）；`basis`：節點 → `observed`／`unreached`。
- 只有 verdict 是 accept 才有表；容器的型別是那一刻的值（`xs = []` 是 `list[?]`，之後的讀取各有自己的一筆）。
- ⚠️ **型別是「在這一份輸入上觀察到的」**——不是對所有輸入成立。這是這一對與第一對最不一樣的地方。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 學過 Python 入門的學生切到 C++，拿到一支同樣意思的 C++ 程式 (Priority: P1)

學生寫好一支 Python 入門程式（讀幾個整數、用 if 與迴圈算、印出來），把目標換成 C++。
編輯器裡換成 C++ 的寫法（`int main()`、`cin`／`cout`、宣告型別、`vector`），提示說出換了幾行。執行結果與原本相同。

**Independent Test**: python-beginner 課文的 Python 解答各自換成 C++，兩邊交給 Cella 判（同一份輸入），判決、輸出、assumes 相同。

**Acceptance Scenarios**:

1. **Given** 一支只用入門子集的 Python 程式，**When** 換到 C++，**Then** 每個變數的宣告型別來自 Cella 在這份輸入上觀察到的型別，兩邊的判決、輸出、assumes 相同。
2. **Given** 換好的 C++ 程式，**When** 再改、再執行，**Then** 它就是一支普通的 C++ 程式。

---

### User Story 2 - 型別說不準的地方照實保留 (Priority: P1)

同一個名字有時是整數、有時是字串（`int|str`）；空清單之後的元素型別看不到（讀取全是 `list[?]`）；有一段程式在這份輸入下沒有跑到（`unreached`）；讀輸入的程式而手上沒有輸入。
這些情況都**不換**，說出卡在哪一行、為什麼——不猜一個型別（猜錯是一支看起來對、意思不同的 C++）。

**Acceptance Scenarios**:

1. **Given** 一個變數先後放過整數與字串，**When** 換到 C++，**Then** 整支不換，原因指出那個變數。
2. **Given** `xs = []` 而之後沒有任何讀取看得出元素型別，**When** 換，**Then** 不換，原因是「元素型別看不出來」。
3. **Given** 一段在這份輸入下沒跑到的程式（例如某個 else），**When** 換，**Then** 不換，原因是那一段沒有觀察到的型別。
4. **Given** 讀輸入的程式而沒有輸入可用，**When** 換，**Then** 不換，說「需要一份輸入」。

---

### User Story 3 - 意思會變的構造照實保留 (Priority: P1)

Python 的整數沒有上限（C++ 會溢位）、`/` 永遠是浮點、`//` 與 `%` 向下取整（C++ 向零）、`print` 的浮點格式與 `cout` 不同、字串可以乘、清單可以混型別……
這些地方要嘛換成意思相同的 C++ 寫法並由判決證明，要嘛保留並說出原因。

**Acceptance Scenarios**:

1. **Given** 一支在這份輸入下會超過 C++ 整數範圍的程式，**When** 換，**Then** C++ 那側判決會說溢位（或結果不同）⟹ 不換，說「整數溢位」。
2. **Given** `a // b` 而負數可能出現，**When** 換，**Then** 換成向下取整的寫法並由判決證明，或保留並說出原因。
3. **Given** 印出浮點數，**When** 換，**Then** 輸出與 Python 相同（`2.0` 不得變成 `2`），否則保留。

---

### User Story 4 - 常駐的檢查 (Priority: P2)

python-beginner 課文的每一支解答：換過去而判決相同，或保留並附原因；兩份加起來等於解答總數。

### Edge Cases

- 輸入從哪來：課文題目的 `stdin`；學生自己的程式用上一次執行的輸入（「重播上一次」那份）；都沒有而程式讀輸入 → 不換。
- 型別在一個輸入下觀察到的不代表別的輸入——換過去之後學生換一份輸入，C++ 的行為可能與 Python 不同。換過去的提示要說「型別依這一份輸入」。
- 函式的參數型別：由呼叫時觀察到的值決定；呼叫時傳過不同型別 → 聯集 → 不換。
- 沒有被呼叫過的函式：參數 `unreached` → 不換。

## Requirements *(mandatory)*

- **FR-001**: 使用者把目標從 Python 換到 C++ 時，系統 MUST 嘗試把程式換成 C++ 寫法；換好的放進編輯器與積木。
- **FR-002**: 每一個宣告的型別 MUST 來自 Cella 在給定輸入上觀察到、而且單一的型別（`basis` 是 `observed`、不是聯集、不含 `?`）；否則整支不換並說出原因。
- **FR-003**: 判準同第一對與 C++ → Python：兩邊交給 Cella 判（同一份輸入），判決、輸出、assumes 相同。
- **FR-004**: 意思會變的構造（無上限整數、`/`、`//`、`%`、浮點的印法、子集以外的構造）MUST 換成意思相同的寫法（由判決證明）或保留並說原因。
- **FR-005**: 整支換或不換（C++ 程式裡不能留一行 Python）。
- **FR-006**: 換完說出換了幾行，並說型別依哪一份輸入；不換說出原因清單。
- **FR-007**: 常駐的檢查：python-beginner 課文每一支解答換過去而判決相同，或保留附原因。
- **FR-008**: 沒有輸入可用而程式讀輸入 MUST 不換並說「需要一份輸入」（不拿空輸入去觀察——那會把後面都標成沒跑到）。

## Success Criteria *(mandatory)*

- **SC-001**: python-beginner 課文的解答，換過去的每一支判決、輸出、assumes 相同（換錯 = 0）；其餘每一支附保留原因。
- **SC-002**: 一批反例（聯集、空清單、沒跑到、沒有輸入、溢位、負數的 `//`／`%`、浮點的印法）每一種都保留或換對，原因類別正確。
- **SC-003**: 換好的 C++ 再轉一趟積木、回到程式碼，形狀不變。
- **SC-004**: 學生換目標後 3 秒內看到換好的 C++ 程式（或保留的說明）。

## Assumptions

- 依賴 Cella 下一版（預估 2026-11-09 晚上）的 `python.observedTypes`；在那之前做 spec／plan／tasks 與不需要型別表的部分（入口、引擎骨架、每顆元件的 C++ 寫法），判決測試等發布後接。
- 換法住在 **Python 元件自己的膠囊**（`to-cpp.ts`），對稱於 spec 219 的 `to-python.ts`；引擎在 `src/languages/python/`。
- 產出 C++ 原始碼、交給 C++ 自己的 lift 畫積木（同 219 的 R7）。

## 不做

- Python 的類別、例外、推導式、lambda、字典與集合（入門課後段）——第一版保留並說原因。
- 依「所有輸入」證明型別（那是型別推導，不是觀察）。
