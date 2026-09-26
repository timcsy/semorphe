# 285 — 照著 draft 填的表，沒有人讀過那些檔

**2026-09-26** · 第 248 刀

## 轉移

```
舊   PATH_JUDGE 的 evidence 是【照 draft 填的】—— 六格,沒有人打開過那些檔
🔴 新 讀完之後【三格是錯的】;而表多兩欄：judges（它判的是什麼）· coverage（覆蓋率）
```

## 為什麼變——而它是 [283](283-一個結構上必為零的分子與做完了長得一樣.md) 自己說的

那條護欄的檔頭逐字寫著它做不到這件事：

> 也不檢測 `evidence` 那個檔真的在判那一路——它只驗檔案存在。**那需要人讀。**

而「需要人讀」被當成一句免責聲明放了一天，**沒有人去讀**。

## 讀出來的三格

```
🔴 lift      指著 roundtrip-all,而那個檔 `lift` 出現【0 次】
             它的三個 describe 是 Render／Extract／Code generation
             ⟹ lift 【沒有逐元件的判定者】,只有 full-roundtrip 的 29 個手寫案例
🔴 generate  指著 audit-completeness（那條只驗「有沒有檔案」）
             真正逐元件的是 roundtrip-all,而【它的標題說謊】
🟡 render    指著 audit-lesson-loadable（只涵蓋課文用到的）
             真正逐元件的是 roundtrip-all 的 Render coverage：345 / 349
```

🔴 **而 `generate` 那一格是這一刀最該記的**。那個 describe 叫
「Code generation coverage: **every component** generates code」，而它第二行是：

```ts
if (!spec.codeTemplate?.pattern) continue   // skip blocks without templates
```

走**手寫產生器**的那 250 顆整批跳過——**覆蓋率 99 / 349（28%）**，
而被跳掉的正是最可能出錯的一批。

> **一個叫「every component」的檢查，可以在第二行就 `continue` 掉七成
> ——而它的名字與它的讀數都不會出聲。**

## 新增的兩欄，以及它們各自擋什麼

```
judges    它判的【是什麼】—— 人讀出來的一句
          🟢 用途不是文件,是【讓下一個人否證填表的人】（正向錨點的形狀）
coverage  逐元件覆蓋率,null ＝ 沒有人量過（棘輪數的就是它）
```

＋ 一條硬性零：**宣告了判定者而不說它判什麼 ＝ 0**。

## 狀態

✅ 已採用。棘輪 **5 → 1**（只剩 `lift` 真的沒人量過），而那個下降是真的
——三路本來就有逐元件覆蓋，填表的那一天不知道。

⚠️ **而「量過」不等於「覆蓋得好」**：`generate` 量過而它是 **28%**。
那是另一條該長出來的棘輪，第 248 刀刻意不拉它——**先讓數字存在，再決定要不要動**。
