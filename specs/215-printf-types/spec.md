# Feature Specification: printf 產碼的型別表

**Feature Branch**: `265-printf-types` | **Created**: 2026-11-04 | **Status**: Ready
**Input**: vision〈printf 產碼的型別表〉；使用者 2026-11-04 定 **A**（經 cos-mos 主持人轉問）：推不出型別的那一行保留 `cout`、旁邊註明。
設計依據：[printf draft](../../knowledge/draft/2026-11-04-printf產碼的型別表.md)、[經過 Cella](../../knowledge/draft/2026-11-04-風格與跨語言轉換經過Cella.md)。

## 背景

學生按「printf 風格」時，今天每一個運算式都寫成 `%d`——課文 11 支切換之後執行結果就變了（字元印成數字、double／long long 判未定義行為、字串當指標）。
型別是意思，由 Cella 給：`types(program, [])` 回每個運算式節點（以語意樹節點 id 為鍵）在隱含轉換**之前**的型別，程式寫到一半、判決 unknown／reject 時也給（cella 2026-11-04 確認）。產品每次檢查本來就拿到這一份（語意診斷在用）。

## User Scenarios & Testing

### User Story 1 - 切成 printf 之後，程式跑出來的東西不變（P1）

**Independent Test**: `form-invariance` 的 I/O 切換那一條：課文切換前後判決與輸出逐字相同；「我們這側」那 10 根釘子全部轉正。

**Acceptance Scenarios**:
1. **Given** `char c = 'A'; cout << c << endl;`，**When** 切成 printf，**Then** 產出 `printf("%c\n", c);`，印 `A`。
2. **Given** `double d = 1.5; cout << d;`，**Then** `printf("%g", d)`（與 cout 預設格式一致——`%f` 會印 `1.500000`）。
3. **Given** `string s; cout << s;`，**Then** `printf("%s", s.c_str())`；`long long` → `%lld`；`size()` → `%zu`；`bool` → `%d`。
4. **Given** `cout << a << endl << b << endl;`，**Then** 換行在原位：`printf("%d\n%d\n", a, b)`。
5. **Given** 字串字面值裡有 `%`，**Then** 寫成 `%%`。

### User Story 2 - 推不出的那一行照實保留 cout（P1）

1. **Given** 一個型別推不出的運算式（Cella 那一句檢查不過、型別不在表上、或型別還沒到），**When** 切成 printf，**Then** 那一行保留 `cout <<`，行尾註明 `// 型別判斷不出來，保留 cout`。
2. **Given** 那一行之後型別到了，**When** 重新產碼，**Then** 換成 printf，**註明不留下**（讀回程式碼時認得那個標記、不收成使用者的註解）。
3. **Given** 程式出現黏著的串流操縱子（`fixed`、`setprecision`、`boolalpha`、`hex`…），**Then** 所有含運算式的輸出都保留 cout（格式狀態是執行期的，形式上保守）。
4. **Given** 程式有 `sync_with_stdio(false)` 而有任一行保留 cout，**Then** 整支都保留 cout（混用時輸出順序不保證）。

### User Story 3 - scanf 一側（P2）

`cin >> x` 切成 scanf：`int` `%d`、`long long` `%lld`、`double` `%lf`、`char` `" %c"`（與 cin 一樣跳過空白）；`std::string` 讀不進 → 保留 `cin`、同樣註明。

### Edge Cases
- C 目標（`c` 風格）：保留 `cout` 在 C 裡編不過——推不出的那一格暫用 `%d`，行尾照實註明（長測試的 `gcc -x c` 抓到，原本這裡寫「照樣保留」是錯的）。
- 型別帶修飾：`const int`、`int &` → 去掉修飾再查表。

## Requirements
- **FR-001**: 核心提供一個與語言無關的「運算式型別」來源（節點 id → 型別字串），產生器可讀；沒有設定時一律「不知道」。
- **FR-002**: 產品把 Cella 每次檢查回傳的 `types.nodes` 設進去；型別到了而輸出風格是 printf 時重新產碼。
- **FR-003**: 型別表（型別字串 → 格式與引數寫法）住在 C++ 語言套件；表外的型別一律「不知道」。
- **FR-004**: 保留 cout 的註明是一個固定標記；lift 認得它、不收成註解。
- **FR-005**: 驗收以 Cella 判：課文 I/O 切換的 10 根釘子轉正；學生語料同一套量一次並記進 history。

## Success Criteria
- **SC-001**: 課文 109 支切成 printf：判決與輸出逐字相同（今天 10 支不同）。
- **SC-002**: 推不出型別時沒有任何一行被寫成錯的格式（保守：寧可保留 cout）。
- **SC-003**: 保留 cout 的標記在型別到了之後不殘留。
