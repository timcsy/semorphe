# Feature Specification: P5 核心型別改名——型別感知的 codemod

**Feature Branch**: `089-p5-concept-rename` ｜ **Created**: 2026-08-06

## 為什麼做這個

`SemanticNode.concept` → `conceptId`。**058 用正規表示式試過，翻車**：
除了改錯欄位，腳本還刪掉一整段執行器、把一個刻意擺在建構式最後的區塊移到中間。
121 檔改動、10 支紅，全部回退。

路線圖當時寫下的結論：

> 改名要用**型別層級的 codemod**，不是正規表示式。實測「值是物件才不改」這條
> 判準**不夠**——真正夠用的判準是「**這個 `.concept` 的接收者是什麼型別**」，
> 而那只有 AST 分析答得出來。

## 工具

`tools/codemod/rename-concept.mjs`——用 TypeScript 自己的型別檢查器問
「這個 `.concept` 的接收者是什麼型別」。專案已經有 TypeScript，不需要新相依。

第一次乾跑的結果就證明了它值得：

```
接收者是 SemanticNode 的 .concept：101 處／26 檔
接收者是**別的型別**、刻意不動：6 處
    ↳ pattern-lifter.ts:76   接收者型別=LiftPattern      lp.concept
    ↳ executor-registry.ts   接收者型別=__object         a.concept
    ↳ sync-controller.ts     接收者型別=__object         downgrade.concept
```

**那六處逐一看過**，全部確認不是語義節點——`LiftPattern.concept`（物件值）、
兩個報表用的區域物件、062 的降級提示。

## 型別檢查器改不到的三類，而它們各自被不同的東西抓到

| 類型 | 誰抓到 |
|---|---|
| 物件字面的鍵（`{ concept: 'program' }`） | **型別檢查器**——「不存在的屬性，你是不是想寫 conceptId」 |
| 物件簡寫（`{ concept, … }`） | **測試**——十個檔的輔助函式 |
| `any` 節點的存取（測試裡的 `node: any`） | **測試** |

## ⚠️ 而我自己也翻了三次車，全部靠測試抓到

1. **正則回溯繞過 lookahead**——`(concept:\s*(?!string))` 在 `concept: string`
   上仍然匹配（`\s*` 退讓零字元）。改到了參數宣告，留下無定義的簡寫。**全部還原重做。**
2. **改了 `lift-patterns.json`**——那是 `LiftPattern.concept`（刻意不動的那個）。
   全套從 16 紅變成 91 紅，當場現形。
3. **改了給人看的訊息文字**——`⟨unknown concept:` 變成 `⟨unknown conceptId:`。
   那是字，不是欄位名。

三次都不是靠檢查程式碼發現的，是**測試變紅**。

## Requirements

- **FR-001**: 判準 MUST 是「接收者的型別」，MUST NOT 是正規表示式
- **FR-002**: 刻意不動的每一處 MUST 逐一看過
- **FR-003**: 工具 MUST 有乾跑模式，且 MUST 列出被跳過的位置與理由
- **FR-004**: 既有測試 MUST 全數通過

## Success Criteria

- **SC-001**: `SemanticNode.concept` 全數改名（131 檔／560 處）
- **SC-002**: `LiftPattern.concept` 一處未動
- **SC-003**: 型別檢查乾淨；既有測試全數通過
- **SC-004**: 工具留在 `tools/codemod/`——下一次改名不必重寫
