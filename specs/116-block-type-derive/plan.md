# Implementation Plan: 積木型別從概念身分導出

**Feature**: `116-block-type-derive` ｜ **Date**: 2026-08-11
**Spec**: [spec.md](spec.md) ｜ **路線圖**: 階段 6.5 **F1**

## Summary

把「積木型別」從一份獨立宣告的名字，改成從概念身分**導出**的值——
一個名字取代兩份會漂移的命名。附這個專案的**第一次積木狀態存檔遷移**，
以及一條收硬性零的機械檢查。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Blockly 12.4.1、Vitest
**Storage**: localStorage（`semorphe-state`）＋ 匯出／匯入 JSON
**Testing**: Vitest ＋ **瀏覽器實測**（存檔遷移不能只靠測試）
**Target Platform**: 瀏覽器
**Project Type**: 單一前端專案
**Scale**: 186 顆積木、175 顆有積木的身分、153 顆待改名

### 研究解掉的四個未知（詳見 [research.md](research.md)）

| 未知 | 結論 |
|---|---|
| 存檔管道幾個 | 存檔 **2 個且共用同一個升級入口**；但積木型別入口是 **3 個**（第三個是使用者自訂積木，**要在護欄裡排除**） |
| 多形態怎麼導出 | 慣例已存在：`_` + `form.value`，**9 顆裡 7 顆已符合**。不發明新規則 |
| 有沒有「拿形狀當判斷」的消費者 | ⚠️ **有**：`toolbox-builder.ts:100-101` 的 `startsWith(\'u_\')`——改名會讓它靜靜失效 |
| 非字面形狀幾種 | 裸物件鍵 155 處、**模板字串 1 處**（掃描器看不到）、拿形狀當判斷 1 處 |

## Constitution Check

| 條款 | 判定 |
|---|---|
| I. 簡約優先 | ✅ 這件事**減少**一份宣告（兩個名字 → 一個） |
| II. 測試驅動（非妥協） | ✅ 護欄先蓋、第一次必須紅；四個轉換契約各一支測試 |
| III. Git 紀律 | ✅ 分段提交：護欄／膠囊 5 顆／前綴 67 顆／化石 86 顆／消費者改寫 |
| IV. 規格文件保護 | ✅ 規格已寫，研究的三處修正建議記在 research.md 而非直接改規格 |
| V. 繁體中文優先 | ✅ |

**無違規需要記進 Complexity Tracking。**

## Project Structure

### Documentation (this feature)

```
specs/116-block-type-derive/
├── spec.md
├── plan.md              ← 本檔
├── research.md          ← Phase 0
├── data-model.md        ← Phase 1
├── contracts/
│   ├── derive-rule.md
│   └── save-migration.md
├── quickstart.md
└── checklists/requirements.md
```

### Source Code（會被碰到的區域）

```
src/
├── blocks/
│   ├── projections/blocks/universal-blocks.json   27 顆 u_
│   └── id-migrations.ts                           既有身分改名表（形狀範本）
├── languages/cpp/
│   ├── **/blocks.json                             其餘積木宣告
│   ├── std/cctype/generators.ts                   ⚠️ 模板字串的積木型別
│   └── block-input-names.ts                       讀 blockDef.type
├── components/*/*/forms/blocks.json               10 顆膠囊（先改這批的 5 顆）
├── core/storage-version.ts                        v9 → v10 掛這裡
├── ui/
│   ├── block-registrar.ts                         裸物件鍵的大宗
│   └── toolbox-builder.ts                         ⚠️ startsWith(\'u_\') 要改成問 layer
tests/
├── integration/audit-block-type-derive.test.ts    新護欄
├── integration/save-migration-v10.test.ts         四個契約
├── baselines/block-type-derive.json               基線（**最後才產**）
└── assets/                                        v9 真實存檔回歸樣本
```

## 實作順序（依賴決定，不是喜好）

```
① 護欄先蓋，確認紅（153），逐項指名        ← 沒有它，後面每一步都看不見自己漏了什麼
② v9 存檔樣本先錄（改名前的真實資料）      ← 改完就錄不到了
③ 導出規則的單一實作 + 撞名檢查（I1）
④ 膠囊那 5 顆改名，全套綠                  ← 驗證管線，最便宜
⑤ 存檔轉換 v9 → v10 + 四個契約測試
⑥ 前綴那 67 顆
⑦ 化石那 86 顆
⑧ 消費者改寫：toolbox-builder 問 layer
⑨ 瀏覽器實測 + 產基線（_meta 註明「因為實作了」）
```

⚠️ **② 必須在任何改名之前**。改完之後就沒有 v9 的真實存檔可以錄了，
而那份樣本是「舊檔還打得開」唯一的機械證據。

⚠️ **⑧ 不能更早也不能更晚**：早了會與舊前綴打架，晚了那段時間排序是壞的。

## Complexity Tracking

無。這件事是**移除**一層間接（第二份命名），不是增加。
