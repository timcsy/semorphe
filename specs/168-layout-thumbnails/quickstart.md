# Quickstart：驗這一刀真的做到了

## 前置

```bash
npm run dev          # http://localhost:5199
```

## ① 圖選得到（US1）

1. 點狀態列的版面那一格
2. **預期**：看到**四張圖**（不是四行字），目前那一張有標示
3. 點第四張（四格的那一張）
4. **預期**：畫面變成四格

## ② 切過去時東西不跳走（US2 · SC-003）

```js
// 在 devtools 主控台，切換前後各跑一次
const r = (sel) => document.querySelector(sel).getBoundingClientRect()
;({ code: r('#code-column'), blocks: r('#blocks-column') })
```

1. 在「對照」量一次
2. 切到「十字」再量一次
3. **預期**：`code` 與 `blocks` 的 `x`／`y`／`width` **完全相同**（位移 0）

## ③ 主控台不會不見（US3 · SC-002）

逐一套用四張圖，每一次都要找得到主控台。
**預期**：三張在底部橫幅、十字在右下格。

## ④ 十字裡主控台格是分頁（FR-007）

**預期**：那一格上緣有「主控台／變數」兩個分頁，切得動。

## ⑤ 加一個版面只要改一份宣告（SC-004）

在 `LAYOUT_PRESETS` 加一筆（例如 `[['element'],['space'],['state']]`），**不動任何別的檔**。
**預期**：選單多一張圖、點下去套用得了、護欄照樣綠。

## 自動化

```bash
npx vitest run tests/integration/audit-layout-presets.test.ts   # 護欄（六條不變式）
npx playwright test e2e/layout-presets.spec.ts                  # 四張圖 ＋ 位移 0 ＋ 主控台恆在
```
