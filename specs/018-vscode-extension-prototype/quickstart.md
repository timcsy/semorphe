# 快速驗證：VSCode Extension 原型

**分支**: `018-vscode-extension-prototype` | **日期**: 2026-03-10

## 場景 1：基本 round-trip（US1 核心驗證）

1. 在 VSCode 中開啟任意 `.cpp` 檔案
2. 執行命令 `Code Blockly: Toggle Blocks Panel`
3. 在程式碼編輯器中輸入：
   ```cpp
   #include <iostream>
   using namespace std;
   int main() {
     for (int i = 0; i < 10; i++) {
       cout << i << endl;
     }
     return 0;
   }
   ```
4. 確認積木面板在 2 秒內顯示對應的積木（count_loop + print）
5. 在積木面板中拖入一個 `if` 積木到迴圈體內
6. 確認程式碼編輯器在 2 秒內更新，在 for 迴圈內出現 `if` 敘述

**預期結果**: 雙向同步正常運作，程式碼和積木保持一致。

## 場景 2：文件切換（US2 驗證）

1. 開啟兩個 `.cpp` 檔案：`a.cpp`（含 for 迴圈）和 `b.cpp`（含 if 敘述）
2. 開啟積木面板，確認顯示 `a.cpp` 的積木
3. 切換到 `b.cpp` 分頁
4. 確認積木面板更新為 `b.cpp` 的積木（if 敘述）
5. 切換到非 C++ 檔案（如 `README.md`）
6. 確認積木面板顯示空狀態

**預期結果**: 積木面板跟隨作用中的編輯器。

## 場景 3：認知層級（US3 驗證）

1. 在 VSCode 設定中將 `codeBlockly.cognitiveLevel` 設為 `0`
2. 開啟積木面板
3. 確認工具箱只顯示 L0 積木（變數、while、if、列印、輸入）
4. 將設定改為 `2`
5. 確認工具箱顯示所有積木（含函式、陣列、指標等）

**預期結果**: 工具箱根據認知層級動態調整。

## 場景 4：語法錯誤容忍（邊界案例）

1. 在程式碼編輯器中輸入不完整的程式碼：
   ```cpp
   int main() {
     for (int i = 0; i < 10; i++) {
       // 缺少結尾括號
   ```
2. 確認積木面板不崩潰，顯示可解析的部分積木

**預期結果**: Extension 優雅降級，不白屏。

## 場景 5：瀏覽器版不受影響（FR-012 驗證）

1. 在專案根目錄執行 `npm test`
2. 確認所有現有測試通過（≥1507）
3. 執行 `npm run build`
4. 確認瀏覽器版建置成功
5. 在瀏覽器中開啟，確認功能正常

**預期結果**: Extension 的加入不影響瀏覽器版。
