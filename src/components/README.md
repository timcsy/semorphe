# components —— 一顆元件一個資料夾

這裡是**膠囊**。每一個資料夾是一顆元件的家。

```
components/<scope>/<name>/
  component.json      身分／參數／接點／requires   ← 規格，紅燈的來源
  forms/              積木與形態
  generate.ts         產生那一路
  execute.ts          執行那一路
  lift.ts             lift 那一路
  labels/<locale>.json  標籤，一個語言一個檔
  spec.test.ts        自證測（人寫，強制正負兩向）
```

## 為什麼 scope 要分一層

身分是 `<scope>:<name>`（`cpp:vector_declare`）。scope 是**所有權**，
所以第三方套件（`@someone:boost_vector`）要有地方住，而它不該和第一方混在一起。

## 為什麼共同測不在這裡

共同測從 `component.json` **推導**，不複製進膠囊。
500 份長得一樣的共同測 = 複製了 500 份同一個真相，而且會漂移：
改了協定，改不到的那幾份會安靜地繼續綠。

## 加一顆元件

新增一個資料夾。**不需要編輯任何既有檔案**——`import.meta.glob` 會掃到它。
那正是這個目錄存在的理由：碎裂的痛不在「碰幾個檔」，在「碰幾個既有的共用檔」。

## 契約

`specs/104-component-vertical-slice/contracts/component.md`（C1–C8），
含**本契約抓不到什麼**那一節——語義正確性機器判不出來。
