# Specification Quality Checklist：一種投影 ＝ 一份宣告

**Purpose**：規劃前先驗規格的完整與品質
**Created**：2026-09-01
**Feature**：[spec.md](../spec.md)

## Content Quality

- [x] 沒有實作細節（語言、框架、API）
  ——⚠️ 提到了 `app-shell`／`layout-presets` 等**既有檔名**，而那是**現況的量測**
  （SC-001／SC-002 的基準線），不是規定怎麼做。
- [x] 聚焦使用者價值：使用者逐字的「好維護管理」＝ SC-001／SC-002
- [x] 寫給非技術讀者
- [x] 必要章節齊全

## Requirement Completeness

- [x] 沒有 [NEEDS CLARIFICATION] 殘留
- [x] 需求可測且不含糊
- [x] 成功條件可量（0／1／4→0／7~8→0 都是可數的）
- [x] 成功條件與技術無關（數的是「要改幾個檔」「有幾個分支」，不是框架）
- [x] 驗收情境齊全（三個 user story 各有）
- [x] 邊界情形有列（同層兩份宣告／壞的 i18n 鍵／一層都沒有／id 撞名）
- [x] 範圍有界（Out of Scope 三條，各附理由與出處）
- [x] 相依與假設有寫

## Feature Readiness

- [x] 每一條 FR 都有對應的驗收
- [x] User story 涵蓋主要流程（加一種／頭統一／少層的宿主）
- [x] 成功條件量得到本功能的產出
- [x] 沒有實作細節滲進規格

## Notes

🔴 **這份規格最容易失敗的方式，是 SC-001 變成一句話。**
它必須由一支**真的加一種投影**的測試釘住（合成 `probe`），
與 `tests/integration/assembly-speaks-up.test.ts` 同一個形狀
——否則「0 個既有檔」只是宣稱。

⚠️ 三個**刻意留在 Out of Scope 而不是 NEEDS CLARIFICATION** 的問題
（見 draft 第七節）：head 的動作要不要進 `CONTROLS`、`state` 那一層兩個分頁
怎麼宣告、版面的 `areas` 要不要改用面板 id。它們都**不阻擋這一刀**，
而且各自會動到別的護欄。
