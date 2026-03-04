# Quickstart: 架構重構 — 四維分離與語義模型

**Feature**: [spec.md](spec.md) | **Date**: 2026-03-04

## 驗證場景

以下場景用於驗證重構完成後系統的正確性。每個場景對應一個 User Story。

---

### 場景 1：Locale 分離驗證（US1）

**目的**: 確認所有積木文字從 i18n 翻譯檔載入

**步驟**:

1. 啟動應用程式
2. 確認所有 67+ 積木的 message、tooltip、dropdown label 顯示中文
3. 開啟 `src/blocks/universal.json`，搜尋中文字 → 應該找不到任何中文
4. 開啟 `src/languages/cpp/blocks/basic.json`、`advanced.json`、`special.json` → 同上
5. 開啟 `src/i18n/zh-TW/blocks.json` → 所有中文文字集中在這裡
6. 修改 `blocks.json` 中某個 tooltip 文字 → 重新載入後只有該 tooltip 改變

**預期結果**:
- 所有積木 JSON 中沒有中文字串，只有 `%{BKY_XXX}` key
- 所有中文集中在 `src/i18n/zh-TW/` 目錄
- 修改翻譯檔後效果立即反映

---

### 場景 2：Language Module 驗證（US2）

**目的**: 確認型別清單由語言模組動態注入

**步驟**:

1. 啟動應用程式
2. 拖出 `u_var_declare` 積木 → 檢查型別 dropdown 有 int、double、char、bool、string 等選項
3. 確認 `src/blocks/universal.json` 中 u_var_declare 的型別 dropdown 沒有具體選項
4. 開啟 `src/languages/cpp/types.ts` → 確認型別清單定義在這裡
5. 開啟 `src/i18n/zh-TW/types.json` → 確認 `TYPE_INT: "int（整數）"` 等翻譯

**預期結果**:
- universal.json 中型別 dropdown 為空（由語言模組注入）
- C++ 型別清單在 `src/languages/cpp/types.ts`
- 型別顯示文字在 `src/i18n/zh-TW/types.json`

---

### 場景 3：Coding Style 切換驗證（US3）

**目的**: 確認風格切換只影響程式碼，不影響積木

**步驟**:

1. 啟動應用程式，選擇「APCS」風格
2. 拖出積木：u_print + u_string("Hello")
3. 確認程式碼包含 `cout << "Hello"` 語法
4. 切換到「競賽」風格
5. 確認積木不變，但程式碼變為 `printf("Hello")` 語法
6. 貼入一段 `printf` 程式碼 → 確認系統偵測到競賽風格
7. 切回「APCS」→ 確認程式碼回到 `cout` 語法

**預期結果**:
- 積木在風格切換時保持不變
- 程式碼格式根據風格改變
- 風格偵測正確識別 I/O 偏好

---

### 場景 4：語義模型 Round-trip 驗證（US4）

**目的**: 確認 round-trip 轉換語義無損

**步驟**:

1. 在程式碼編輯器輸入一段完整的 C++ 程式：
   ```cpp
   #include <iostream>
   using namespace std;
   int main() {
       int x = 10;
       for (int i = 0; i < x; i++) {
           cout << i << endl;
       }
       return 0;
   }
   ```
2. 確認積木正確顯示（code → semantic model → blocks）
3. 在積木中修改 x 的初始值為 20
4. 確認程式碼更新（blocks → semantic model → code）
5. 比較 round-trip 前後的程式碼語義一致性
6. 使用包含多種語法的程式測試（變數、迴圈、函式、陣列、條件）

**預期結果**:
- 所有轉換經由語義模型
- Round-trip 後語義完全一致
- 格式可能不同（呈現資訊），但語義不丟失

---

### 場景 5：Python Stub 多語言驗證（US5）

**目的**: 確認 LanguageModule 架構可支援新語言

**步驟**:

1. 確認 Python stub 模組存在且可載入
2. 切換到 Python 語言
3. 確認工具箱型別 dropdown 顯示 Python 型別（int、float、str、bool）
4. 確認 C++ 專屬積木（指標、struct 等）不在工具箱中
5. 如果 workspace 中有 C++ 指標積木 → 確認使用降級策略顯示
6. 切回 C++ → 確認所有 C++ 功能恢復正常

**預期結果**:
- Python stub 模組正確註冊
- 型別清單根據語言動態變化
- 不支援的概念使用降級策略（不崩潰）
- 語言切換不影響其他語言的功能

---

### 場景 6：測試全數通過驗證

**目的**: 確認重構未破壞現有功能

**步驟**:

1. 執行 `npm test`
2. 確認所有現有測試通過
3. 確認新增測試覆蓋：
   - i18n locale 載入測試
   - language module 註冊測試
   - coding style 切換測試
   - round-trip 無損測試
   - python stub 測試

**預期結果**:
- 260+ 現有測試全數通過
- 新增測試全部通過
- 無跳過或待修復的測試

---

## 快速煙霧測試

最小驗證步驟（5 分鐘內完成）：

1. `npm test` → 全部通過
2. `npm run dev` → 開啟瀏覽器
3. 拖出 u_var_declare → 確認中文顯示正常、型別 dropdown 正常
4. 輸入一段 C++ 程式碼 → 確認積木正確顯示
5. 切換風格 → 確認程式碼格式改變、積木不變
