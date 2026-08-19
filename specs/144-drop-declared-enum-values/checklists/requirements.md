# Specification Quality Checklist：刪掉 `properties[].values`

**Created**: 2026-08-19 · **Feature**: [spec.md](../spec.md)

## Content Quality
- [x] 沒有實作細節 · [x] 聚焦價值（加一顆元件只寫一個地方）
- [x] 非技術讀者看得懂 · [x] 必要章節齊全

## Requirement Completeness
- [x] 沒有 [NEEDS CLARIFICATION] · [x] 需求可測 · [x] 判準可量測（40 → 0、逐位元組）
- [x] 驗收情境齊全 · [x] 邊界案例已列 · [x] 範圍清楚 · [x] 假設已列

## Feature Readiness
- [x] 🔴 **方向是被一個數字決定的**（234 選項裡 182 個顯示文字是 i18n key）
- [x] 「積木外觀一格不變」寫成與主功能同級的 P1

## Notes
- 🔴 **Assumptions 裡那句安全網當場兌現了**：「若有隱藏消費者，它會紅」
  ——`audit-param-spec` 第 ③ 條就在守 `values`，刪完之後它紅了。
  ⚠️ 而它是**由建構保證的綠**（那些 values 本來就從下拉抄出來），
  所以隨抄件一起刪掉是對的。第 ② 條改成比**真下拉**，反而更強。
- **FR-005 兌現**：那 1 筆「對不上」的（`init_style`）**查證過是活的**
  ——它不是下拉，是 lift 推出來的內部屬性。刪的是 `values` 那一格，不是屬性。
