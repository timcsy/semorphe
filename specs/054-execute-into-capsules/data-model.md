# Phase 1 資料模型：模組的第五面牆

## 契約 1：模組型別加一欄，且**必填**

```ts
export interface StdModule {
  header: string
  concepts: ConceptDefJSON[]
  blocks: BlockProjectionJSON[]
  registerGenerators: (g: Map<string, NodeGenerator>, style: StylePreset) => void
  registerLifters: (lifter: Lifter) => void
  registerExecutors: (register: RegisterExecutor) => void   // ← 新增
}
```

**必填不是選填。** 選填的話，忘了接上的模組會靜靜地少一條路——那正是這個專案反覆遇到的病。**編譯器擋得住的東西不要留給人。**

沒有執行器的模組寫一個空函式，並在旁邊註明為什麼——**顯式的空**與**遺漏的空**要分得出來（同 `skipPaths` 的道理）。

---

## 契約 2：落點由概念註冊表決定，不由檔名決定

| 執行器來源 | 概念數 | 落點 |
|---|---|---|
| 字串 | 17 ／ 10 | `std/string/executors.ts` ／ `std/cstring/executors.ts` |
| 容器 | 4／3／2／2／2 | `std/vector` ／ `queue` ／ `map` ／ `set` ／ `stack` 各自的 `executors.ts` |
| 容器（跨容器泛用） | 7 | `core/executors/containers.ts` |
| 指標 | 8 | `core/executors/pointers.ts` |
| 數學 | 3 | `std/cmath/executors.ts` |
| | **58** | |

**兩份跨模組**（字串跨 2、容器跨 6）。用檔名推歸屬會錯——檔名反映的是誰跟誰寫在一起方便，不是誰屬於誰。

**不變式**：每個概念只屬於一個模組。已驗證（149 個概念，0 個重複宣告）。

---

## 契約 3：接線與既有兩條路同形

```
語言套件載入
  → 走訪各模組
      → registerGenerators(...)   （既有）
      → registerLifters(...)      （既有）
      → registerExecutors(...)    （新增，同形）
  → 推進核心的執行器註冊表
```

核心**不知道**有哪些模組，只知道「有人推東西進來」。與上一輪的宣告推送是同一個形狀。

---

## 契約 4：漏失的主防線是集合比對

```
搬移前：把「執行引擎認得哪些概念」寫成固定清單（測試資產）
搬移後：斷言集合完全相同 —— 少一個就指名少了哪一個
```

| 防線 | 漏一個會怎樣 |
|---|---|
| 逐一比對輸出 | **不會現形**（測試沒覆蓋到就過了） |
| **集合比對** | **現形**，且說得出少了誰 |

主防線用後者。這與既有教訓同一招：**換一個讓錯誤無法被表達的形式**。

**方向也要釘**：集合不得**多**出來——多出來代表某個概念被註冊了兩次，那是另一條護欄在看的病。

---

## 契約 5：「沒載入語言套件」要說得出原因

現況：未知概念 → 錯誤只說「未知概念：`cpp_string_length`」。

之後：若**執行器註冊表是空的**（沒有任何語言套件推過東西），錯誤要多一句：

> 可能是沒有載入語言套件。

**判準是「註冊表空的」而不是「概念名長得像 C++」**——後者又會讓核心去認識語言。

---

## 本功能不新增任何概念

不動語義樹、不新增元件、不改概念定義。改的是**檔案位置**與**誰負責註冊**。
