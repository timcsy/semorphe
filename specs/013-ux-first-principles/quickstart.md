# Quickstart: 前端 UI/UX 第一性原理合規

## 測試場景

### 場景 1: 降級視覺區分

**輸入程式碼**:
```cpp
int x = 5;           // 正常（high）
int y = ;            // 語法錯誤（syntax_error）
auto f = [](){ };    // lambda — 進階寫法（nonstandard_but_valid）
```

**預期積木結果**:
- `int x = 5;` → 正常 `u_var_declare` 積木，標準橘色
- `int y = ;` → `c_raw_code` 積木，紅色背景 (#FF6B6B)，tooltip「程式碼含語法錯誤」
- `auto f = [](){ };` → `c_raw_code` 積木，綠色邊框 (#4CAF50)，tooltip「進階寫法」

### 場景 2: Confidence 視覺

**輸入程式碼**:
```cpp
int main() {
    int x = 5;           // confidence: high → 正常顯示
    some_wrapper(42);     // confidence: inferred → 淡色邊框
}
```

**預期**:
- `int x = 5;` → 正常積木
- `some_wrapper(42)` → 部分可辨識結構，淡色/虛線邊框

### 場景 3: Annotation 可見

**輸入程式碼**:
```cpp
int x = 1; // set x
// section header
int y = 2;
```

**預期積木**:
- `int x = 1` 積木上有 📝 comment icon，點擊顯示 `// set x`
- 獨立的 `c_comment_line` 積木顯示 `section header`
- `int y = 2` 正常積木

### 場景 4: Code Style 影響工具箱

**操作**:
1. 選擇 APCS Code Style
2. 開啟 I/O 工具箱類別

**預期**: `u_print`、`u_input`、`u_endl` 在前，`c_printf`、`c_scanf` 在後

**操作**:
1. 切換到 competitive Code Style

**預期**: `c_printf`、`c_scanf` 在前，`u_print`、`u_input` 在後

### 場景 5: Toolbox 動態生成 + 層級過濾

**操作**:
1. 設定認知層級 L0（beginner）
2. 檢查工具箱

**預期**: 只有 level ≤ 0 的積木可見（~18 個基礎積木）

**操作**:
1. 切換到 L2（advanced）

**預期**: 所有積木可見，包括 pointers、containers、templates 等

### 場景 6: Style 切換 UI

**操作**:
1. 在 toolbar 找到 Code Style dropdown
2. 從 APCS 切換到 google

**預期**: 程式碼面板立即以 2-space indent 重新生成，積木不變

**操作**:
1. 在 toolbar 找到 Block Style dropdown
2. 切換到「經典」風格

**預期**: 積木渲染器從 zelos 切換為 geras（方角積木）

### 場景 7: 顏色集中管理驗證

**開發者操作**:
1. 修改 `category-colors.ts` 中 `data` 類別的顏色值
2. 重新載入應用

**預期**: 所有 data 類別積木（u_var_declare、u_var_assign、u_var_ref、u_number、u_string）和 toolbox「資料」分類都使用新顏色

## 整合驗證

1. `npm test` — 所有現有測試通過
2. 將含三種降級原因的程式碼轉為積木 → 顏色正確區分
3. Code Style 切換 → toolbox I/O 順序更新 + 程式碼重新生成
4. 認知層級切換 → toolbox 積木數量正確過濾
5. 積木 → 程式碼 roundtrip → annotation 保留
