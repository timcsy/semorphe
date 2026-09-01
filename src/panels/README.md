# 面板宣告

**一種投影一個子目錄，各含一份 `panel.ts`。**

```
src/panels/
  code/panel.ts       程式碼（element）
  flow/panel.ts       流程（relation）
  blocks/panel.ts     積木（space）
  console/panel.ts    主控台（state）
  variables/panel.ts  變數（state）← ⚠️ 同一層兩份宣告，是分頁不是兩格
```

## 🔴 為什麼是宣告

2026-09-01 量到：加第五種投影要動**八個既有檔**（`LAYER_ORDER`、四張版面的
`areas`、`app-shell` 的五處「四個一起列」、兩個語系的 i18n 鍵、
`controlSurfaces`、兩份宿主宣告）。

> **一個東西如果要在七個地方各寫一次，那七個地方遲早會有一個沒跟上
> ——而它不會報錯。**

使用者（spec 170）：「面板可以模組化就更好了……**我的重點是要好維護管理**」。

## ⚠️ `mount` 刻意是程式碼不是資料

一個面板真正獨特的是**它怎麼畫**（Blockly／SVG／文字）。把那個也塞進宣告，
宣告就會變成一個難懂的 DSL。

> **宣告該吃掉的是【重複的那些】，不是【真的不一樣的那個】。**

## 加一種要做什麼

1. 開一個子目錄，寫一份 `panel.ts`（`export default` 一個 `PanelSpec`）
2. 加它的 i18n 鍵
3. **沒有第三步。** 版面、選單、槽的選擇器、那條頭全部自己長出來。

🔴 由 `tests/integration/panel-declaration-open.test.ts` 釘住——那支測試
**只 import 登錄表與組裝點**，它跑得起來本身就是「不用碰別的」的證明。

## 這裡不做什麼

**第三方外掛。** 這份宣告是 build-time 的（`import.meta.glob`），
執行期載入別人的面板是另一刀。

> **「可擴充」有兩種：我們自己加很便宜、與別人加得進來。
> 先做到前者，而不要在講前者的時候用後者的詞。**
