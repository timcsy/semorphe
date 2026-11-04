# 340 · `@semorphe/arduino` 拆出，從「匯出契約」翻成「核對自己符合契約」

> 日期：2026-11-05
> 轉變：`@cos-mos/arduino` 的正本從 semorphe 的匯出工具，翻轉到 cos-mos（`vocab/arduino/`，0.1.2）；semorphe 這側改成**核對自己符合它**。對照表（契約名 ↔ semorphe 元件身分）搬出契約，成為 `@semorphe/arduino` 的第一個內容。
> 決定：使用者 2026-11-04（經 cos-mos 主持人，cos-mos history/015）——每個領域三方各一個套件，`@semorphe/<領域>` 與 `@cella-lang/<領域>` 只依賴契約；任何一方都能提修改，cos-mos 收件、第 1 層過就合併。
> 做法：第 266 刀（cos-mos 草案六步的 ①＋③＋④ 的 semorphe 側）。

## 為什麼

[history/014（cos-mos）]那時是 semorphe 從元件宣告抽出第一版——**正本在我們這裡**。三方各一個套件之後，契約要有一個不屬於任何實作端的家；
否則「兩邊都接得上」只是 semorphe 單方面宣稱。正本翻轉之後，我們的元件宣告是**實作**，不是**定義**：它可以和契約不一樣，而那就是一個要提的修改。

## 做了什麼

- 契約副本原樣固定在 `tests/fixtures/cos-mos-arduino/`（附來源 commit 與 sha256，改了會紅）。
- `packages/semorphe-arduino/`：`package.json` 宣告 `implements: { "@cos-mos/arduino": "sha256:a9c293cd…" }`，帶 `semorphe-map.json`。
- `audit-arduino-contract`：推出的那一份與契約逐欄相同、contentHash／版本相同、`implements` 對得上、對照表最新；第 1 層十條由我們**自己寫一份**（不匯入 cos-mos 的 `vocab-check.mjs`——兩邊各寫，結果不同就是其中一邊有缺陷），每一條有反例。
- `export-arduino-vocab` → `propose-arduino-vocab`：不一致時產出提案（vocab.json ＋ 差在哪 ＋ contentHash 新舊值 ＋ commit）。反證過：改 `arduino:tone` 一個參數型別，護欄紅、提案指得出那一顆。

## 量到的

- 我們推出的 contentHash 與契約 0.1.2 相同（`sha256:a9c293cd…`）——搬走對照表不影響雜湊（它只涵蓋 components），所以 cos-mos 只升修補位（原本說的 0.2.0 作廢）。

## 待續

- ⑤ 結構頻道樣本加上 Cella 判決成為契約的 examples（等 Cella 的 ubOrder 結構化那一版）。
- ⑥ 第一次發布 `@cos-mos/arduino` 前，由 cos-mos 主持人問使用者；`@semorphe/arduino` 的發布同樣問使用者。
- 積木與流程圖的畫法、顏色、i18n、C++ 產碼搬進 `@semorphe/arduino`——跟〈面板拆成可獨立掛載的視圖套件〉一起走（A'：接點與角色讀契約，呈現留在這裡）。
