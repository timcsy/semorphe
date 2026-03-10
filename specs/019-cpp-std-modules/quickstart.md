# Quickstart: C++ Std Modules Reorganization

## 驗證場景

### 場景 1：無功能退化（US1）

```bash
# 重構完成後執行全部測試
npm test
# 預期：所有 1507+ 測試通過
```

### 場景 2：目錄結構驗證（US2）

```bash
# 檢查 std 目錄結構
ls src/languages/cpp/std/
# 預期輸出：index.ts types.ts iostream/ cstdio/ vector/ algorithm/ string/ cmath/

# 檢查每個模組包含四個檔案
ls src/languages/cpp/std/iostream/
# 預期輸出：concepts.json blocks.json generators.ts lifters.ts

# 檢查 core 目錄
ls src/languages/cpp/core/
# 預期輸出：concepts.json blocks.json generators/ lifters/ index.ts
```

### 場景 3：瀏覽器版正常運作（US1）

1. `npm run dev` 啟動開發伺服器
2. 開啟瀏覽器
3. 在 toolbox 中拖入各種積木（if, for, cout, printf, vector）
4. 切換 cognitive level（L1-L5）→ toolbox 正確更新
5. 切換 style preset（APCS, competitive, google）→ 程式碼輸出正確切換
6. 預期：所有行為與重構前一致

### 場景 4：VSCode 版正常運作（US1）

1. 在 VSCode 中開啟 C++ 檔案
2. 開啟 Code Blockly 面板
3. 積木正常顯示、同步正常
4. Toolbar 所有功能正常（level, style, block style, sync, undo/redo）

### 場景 5：借音偵測（US3）

1. 選擇 APCS style（偏好 iostream）
2. 拖入 printf 積木 → 應偵測到借音（cstdio 概念在 iostream preset 下）
3. 選擇 competitive style（偏好 cstdio）
4. 拖入 cout 積木 → 應偵測到借音（iostream 概念在 cstdio preset 下）

### 場景 6：Auto-include（US4）

1. 拖入 vector 相關積木
2. 生成程式碼 → 頂部自動出現 `#include <vector>`
3. 同時使用 cout 和 sort → 生成 `#include <iostream>` 和 `#include <algorithm>`
4. 手動加一個 `c_include <vector>` 積木 → `#include <vector>` 只出現一次（去重）
5. 移除所有 vector 積木 → `#include <vector>` 消失

### 場景 7：新增 std 模組（SC-001）

1. 建立 `src/languages/cpp/std/cstring/` 目錄
2. 新增 concepts.json、blocks.json、generators.ts、lifters.ts
3. 在 `std/index.ts` 新增一行 import
4. `npm test` 通過
5. 預期：新模組的積木出現在 toolbox，auto-include 自動加入 `#include <cstring>`
