# 308 · 元件的動詞：從四個平鋪的動詞到「每個視圖一對 render／lift」；行為槽換成形式槽

> 日期：2026-10-31（spec 181，重構階段 2）
> 轉變：元件的 `component.json` 用四個平鋪的動詞宣告自己的路——`render`（畫成積木）、`extract`（從積木抽回）、
> `generate`（產程式碼）、`lift`（從程式碼辨識），加上 `execute`。現在改成**視圖優先**：`paths.views.<視圖>.render／lift`，
> `formalize` 與 `execute` 在 `views` 之外。原則 P2、五槽、元件代數的完備性同一刀改寫。
> 定案過程：[設計 draft](../draft/2026-10-31-重構的設計-能力介面與降級路徑.md) 五之四、五之五。

## 新的形狀

```
paths.views.blocks   { render: ./forms/blocks.json, lift: ./forms/blocks.json }
paths.views.code     { render: ./generate.ts,       lift: ./lift-pattern.json, liftStrategy?: … }
paths.formalize      ./formalize.ts       ← 元件的槽（形式）
paths.execute        ./execute.ts         ← 階段 6 與 JS 直譯器一起退場
```

- 視圖是宣告裡的鍵；**雙向還是單向是視圖的性質**（`core/component/views.ts` 的視圖表），不是看元件有沒有寫 `lift`。
- P2：「每顆元件在元件登錄表中有唯一條目；每個它出現的視圖都有一對 render／lift，並有 formalize」。
- 五槽：身分・接點・參數・形態・**形式**。「行為」仍是投影的一族，但由應用層的執行器產出，不再是元件的槽。
- 完備性：「每個視圖一對 render／lift ＋ formalize 存在」取代「五層」。

## 舊的哪些前提換掉了

- **「動詞是固定的五個」**：四個裡有兩對其實是同一件事在兩個視圖上（render／extract 是積木的一對，generate／lift 是程式碼的一對）。
  名字把視圖編進了動詞，加一個視圖就得發明兩個動詞——而使用者要的是程式以外的領域也能進來。
- **「元件自帶行為」**：[306](306-語意交接從切換那天一次換到有系統的重構計劃.md) 定了語意進 formalize、驅動在應用層；
  五槽表與完備性 ⑤（「∃ execute path」）還停在舊的那一邊。
- **P2 指著已刪除的 `ComponentRegistry` 與「五條路徑」**：knowie 的 judge 量到它與現行決定對不上。

## 實作時多量到的一件事

`skipPaths`／`skipReasons`（「這一路刻意跳過」）與型別 `PathName` 用的是同一組舊動詞——不在 spec 的列舉裡，而它們會讓宣告同時存在兩套名字。
一併改成格子名（`code.lift`、`blocks.render`……）。

## 被否決的

- **動詞 → 視圖**（`render: { blocks, code }`）：我原本的推薦。使用者問「如果是先視圖呢？」——視圖優先字面上就是「每個視圖一對」，
  單向視圖只寫 render、刪一個視圖是整塊拿掉。
- **平鋪成 `renderBlocks`／`liftCode`**：視圖名被編進鍵名，加一個視圖就加兩個鍵。
- **「沒寫 lift 就是單向」**：遺漏的 lift 會被當成單向而安靜放行——正是「顯式的空 vs 遺漏的空」那條紀律要擋的。
- **載入器同時讀新舊兩種**：P8 不留轉接層；349 個宣告用一次性腳本改寫，前後逐格計數相同。
