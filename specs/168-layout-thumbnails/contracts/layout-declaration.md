# Contract：版面宣告

**誰是消費者**：套用（`app-shell.applyLayout`）· 示意圖（版面選單）· 護欄（第八十一條）。
**契約的本體**：`src/core/host/layout-presets.ts` 匯出的 `LAYOUT_PRESETS` 與三個純函數。

## 匯出

```ts
LAYOUT_PRESETS: readonly LayoutPresetSpec[]
layoutPreset(id): LayoutPresetSpec | undefined
gridTemplateAreas(preset, focusLayer?): string      // '*' 用 focusLayer 代換
thumbnailCells(preset): readonly ThumbnailCell[]    // { layer, row, col, rowSpan, colSpan }
```

## 保證

1. **一份宣告，三個消費者**——套用、畫圖、護欄讀同一個 `areas`。
   ⟹ 加一個版面只改 `LAYOUT_PRESETS` 一處（SC-004）。
2. **圖與畫面同構**——`thumbnailCells` 與 `gridTemplateAreas` 由同一份 `areas` 導出，
   圖上的格數與位置**不可能**與套用後不同（SC-001）。
3. **`state` 恆在**——I4 由護欄硬性零保證（SC-002）。
4. **不得印 id**——畫面上的字一律走 `nameKey` 與層的 i18n 鍵（FR-008）。

## 反例（護欄會擋下的）

```ts
areas: [['space','element'], ['state','state']]          // ❌ I3：鏡像
areas: [['element','space'], ['relation','space']]       // ❌ I5：space 兩塊
areas: [['element','space'], ['relation','relation']]    // ❌ I4：沒有 state
areas: [['element','space'], ['state']]                  // ❌ I1：不是矩形
```
