# Quickstart: 積木系統 UX 深度改善（第二波）

**Date**: 2026-03-04 | **Branch**: `004-deep-ux-improve`

## 開發環境

```bash
npm install
npm run dev     # 啟動開發伺服器 (Vite)
npm test        # 執行測試 (Vitest)
```

## 測試驗證情境

### 情境 1: 預設模板

1. 清除 localStorage (`localStorage.removeItem('code-blockly-state')`)
2. 重新載入頁面
3. 驗證 workspace 中出現 `#include <iostream>` → `using namespace std;` → `int main() { return 0; }` 骨架
4. 點擊「積木→程式碼」按鈕，驗證產出完整的 C++ 程式碼
5. 點擊「清空」按鈕，驗證 workspace 變為空白

### 情境 2: 工具箱分級

1. 開啟頁面，預設為初級模式
2. 計算工具箱中的積木數量，應 ≤ 18 個
3. 確認看不到 `c_printf`、`c_scanf`、指標、結構等進階積木
4. 點擊「進階模式」按鈕
5. 確認所有 67 個積木都可見
6. 切換回初級模式，確認工具箱恢復
7. 重新載入頁面，確認模式保持

### 情境 3: 變數 Dropdown

1. 從工具箱拖出 `u_var_declare`，命名為 `score`
2. 從工具箱拖出 `u_var_ref`
3. 點擊 u_var_ref 的 dropdown，確認選項包含 `score`
4. 新增另一個 `u_var_declare`（`total`），確認 dropdown 更新包含兩者
5. 刪除 `score` 宣告，確認 dropdown 不再包含 `score`

### 情境 4: 連接型別檢查

1. 從工具箱拖出 `u_arithmetic`
2. 嘗試將 `u_if` 拖入 A 插槽 → 應被拒絕（彈回）
3. 將 `u_number` 拖入 A 插槽 → 應成功連接
4. 從工具箱拖出 `u_if`
5. 嘗試將 `u_number` 拖入 BODY → 應被拒絕
6. 將 `u_print` 拖入 BODY → 應成功

### 情境 5: 快捷列

1. 確認 workspace 上方有快捷列按鈕
2. 點擊「輸出」按鈕 → u_print 出現在 workspace 可見區域中央
3. 再點擊一次 → 第二個 u_print 出現，與第一個不重疊

### 情境 6: 即時錯誤提示

1. 在 workspace 中建立 `u_func_def`（RETURN_TYPE='int'），不加 return
2. 等待 ~500ms，確認函式積木顯示警告圖示
3. Hover 警告圖示，確認顯示「函式需要 return 語句」
4. 加入 `u_return`，確認警告消失
5. 拖出 `u_var_ref`（NAME='y'），但不宣告 y
6. 確認 var_ref 顯示警告「變數 'y' 未宣告」
