# Quickstart：怎麼驗這次遷移沒有壞東西

## 前置

```bash
npm install
```

## 每一段結束時都要跑的三件事

```bash
npx tsc --noEmit          # 型別
npx vitest run            # 全套（基準：231 檔全綠）
```

**通過條件**：全綠，且下面兩個數字符合該段的期待值。

## 看棘輪的數字

```bash
npx vitest run tests/integration/audit-identity-namespace.test.ts
```

| 段 | 舊格式引用數 | 格式違規顆數 | `blockDef.type` |
|---|---|---|---|
| 第 0 段（護欄就位） | **4657** | 174 | 66 |
| 第 1 段（`cpp_` 完成） | 1438 | 32 | **66（不得變）** |
| 第 2 段（裸名完成） | 0 | 0 | **66** |
| 第 3 段（收硬性零） | 0（硬性） | 0（硬性） | **66** |

## 驗存檔沒壞（SC-003）

```bash
npx vitest run tests/unit/core/storage-version.test.ts
```

必須涵蓋：v2 舊身分轉得動、`cpp:math_pow` 冪等、不認得的身分原樣保留、v3 不重複轉。

## 驗使用者拿得到積木（SC-005）

```bash
npx vitest run tests/integration/audit-toolbox-reachability.test.ts
```

「使用者拿不到的積木」必須維持 **0**。課程清單漏遷移的症狀就是這個數字上升
——E 項踩過一次，7 顆積木使用者拿不到而測試全綠。

## 人要看的一件事（機器答不了）

遷移完成後開瀏覽器，確認工具箱的分類與順序沒變、隨手拖幾顆積木產出的程式碼正常。
**機器驗得了「身分還在」，驗不了「使用者看到的東西沒變」。**
