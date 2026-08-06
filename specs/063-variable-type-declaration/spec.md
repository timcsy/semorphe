# Feature Specification: 一個事實被寫死了兩次

**Feature Branch**: `063-variable-type-declaration` ｜ **Created**: 2026-08-06

## 為什麼做這個

「`cpp_string_declare` 宣告的是一個字串變數」這件事，被寫死在**兩個不同的檔案**裡：

| 消費者 | 原本怎麼寫的 |
|---|---|
| 同步控制器的降級 | `node.concept === 'cpp_string_declare' ? 'string' : undefined` |
| 積木註冊處的下拉選單 | `if (block.type === 'cpp_string_declare')` 掃工作區 |

兩處都**只認得那一個概念**。

**危險的不是它現在錯了，是它以後會錯而且不會有人發現**：加一個同類概念時，
下拉選單少一個選項，使用者只會覺得「怎麼選不到」，而測試全綠。

## Requirements

- **FR-001**: 這件事 MUST 由概念自己宣告
- **FR-002**: 兩個消費者 MUST 讀同一個宣告
- **FR-003**: 宣告 MUST 是開放的——多一個同類概念，兩個消費者都要自動涵蓋它，**不需要改任何消費者的程式碼**
- **FR-004**: 行為 MUST 完全不變
- **FR-005**: MUST 有測試釘住**宣告鏈本身**，不只釘某一次的輸出

## Success Criteria

- **SC-001**: 中立性 **2 → 1**
- **SC-002**: 完備性各數字不變
- **SC-003**: 既有測試全數通過

## Out of Scope

- ❌ 最後 1 筆（`Blockly.Blocks['cpp_string_at']` 的動態定義）——那是雙重真相的結構問題

## Notes

062 才剛加的 `downgradeTypePrefix` 在本功能被改名為 `declaresVariableType`。
理由是**一個事實一個名字**：前者描述的是「降級時會用到它」——那是**消費者的
角度**，而第二個消費者（下拉選單）根本不做降級。改成描述事實本身。
