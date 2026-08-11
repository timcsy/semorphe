# `layer: universal` 是一份被放在內涵位置的外延主張

> 日期：2026-08-11
> 怎麼冒出來的：F 完成之後 `universal-concepts.json` 空了，於是
> 「身分是 `cpp:if`、層級是 `universal`、位置是 `components/cpp/`」
> 這個矛盾從**藏在檔案結構裡**變成**看得見**。
> 使用者提議：用**外延等價**的視角重看它，有沒有存在的必要。

## 一、`等價與觀察集` 已經把這條寫死了

剪枝力②（`concepts/等價與觀察集.md:44`）：

> 名字是內涵的，只需要對得起自己的定義。**「通用」是外延的，不住在名字裡。**
>
> **名字要說得出這顆元件自己是什麼，不必宣稱它跟誰一樣。**

而它下面掛著一次**已記錄的翻轉**——`draft/元件命名重新設計` 的第一版
「用命名去表達通用性」被判為踩線，已退場。

> **`layer: universal` 是同一個錯誤換一個欄位。**
> 名字不能宣稱通用性，那換一個欄位就可以嗎？它一樣是
> **把外延主張放在內涵的位置**。

§六 再補一刀：

> **一個抽象概念 = 某個容差底下的等價類。**
> **抽象概念是關係的產物，不是關係的前提。**

`universal` 正是「關係的前提」——先畫好分類，然後期待證據符合它。

## 二、查完了：代價是一條排序，不是課程系統

**改動前**，`layer === 'universal'` 的全部消費者：

| 位置 | 用途 | |
|---|---|---|
| `ui/toolbox-builder.ts:107` | I/O 積木的排序偏好 | **唯一的生產消費者** |
| `core/concept-registry.ts` `listByLayer()` | 通用 getter | **零呼叫者** |
| `core/block-spec-registry.ts:32` | 抄欄位 | 傳遞，不判斷 |
| 五支測試 | 測上面那條、或用合成假資料 | |

⚠️ **課程系統完全不碰它**——`cpp-beginner.json` 裡 `layer` 與 `universal`
兩個字都不出現，關卡用的是 `levelTree` 明列的元件清單。

我原本擔心「universal 其實是手寫的容差（漸進揭露）」，**查證後不成立**。

## 三、⚠️ 而那唯一的消費者，在用它當一個它不負責的問題的代理

```ts
const 是通用的 = (t) => …conceptMapping?.layer === 'universal'
const sorted = ioPref === 'iostream' ? [...universalIo, ...langIo] : [...langIo, ...universalIo]
```

它真正要問的是「**這顆是不是使用者偏好的那個 I/O 風格**」。
而 `layer` 只是**碰巧**對——`cpp:print` 剛好標 universal、
`cpp:print_formatted` 剛好標 lang-core。

那段程式碼上面還留著它自己的病歷：`startsWith('c_')` 一次、`startsWith('u_')`
一次，兩次都被記成「拿形狀當判斷」。

> **第三版「問宣告」修掉了「拿形狀當判斷」，而沒有修掉「問錯了問題」。**
> **一個代理答對了，不代表它答的是同一個問題。**

## 四、已做：第四版問那條等價邊

```ts
const 風格 = (t) => ioTraitOf(conceptId)?.style
const 合偏好 = ioTypes.filter(t => 風格(t) === ioPref)
const 其餘   = ioTypes.filter(t => 風格(t) !== ioPref)
```

`ioRole` ＝ 等價類、`ioStyle` ＝ 哪個成員——**那是一條被宣告出來的等價邊**，
而它在 F 搬 print 那批時就存在了，只是當時沒有意識到自己在宣告等價。

### ⚠️ 兩個副作用，都是好的

**① 行為刻意改了一處**：`ioPref = 'cstdio'` 時，原本「**全部 lang 的**」排前面
（含 `getline`、`ifstream_declare`、`ofstream_declare`），現在只有
**宣告了 `ioStyle: 'cstdio'` 的那兩顆**排前面。

那三顆**沒有風格對立面**——它們不是「printf 版的什麼」，只是剛好不是 universal 層。
**它們不該因為使用者選了 printf 就往前跳。**

**② 掀出一個宣告缺口**：`cpp:endl` 原本落到「其餘」，因為它沒有 `ioStyle`。
而 endl **就是** iostream 的東西（printf 那邊沒有對應物，換行是格式字串裡的兩個字元）。

於是 `ioTraitOf` 放寬成「角色與風格可以獨立存在」，endl 補上 `ioStyle: 'iostream'`。

> **一顆元件可以屬於一個家族，而在那個家族裡沒有對應物。**

## 五、結果：`layer` 今天**零生產消費者**

改完之後，`src/` 裡讀 `layer` 的只剩兩處**傳遞**（`block-spec-registry` 與
`concept-registry` 把欄位抄進登錄表）與一個**零呼叫者的 getter**。

**所有還在讀它的地方，都是測試在測它自己。**

## 六、⚠️ 而我不建議現在刪

理由不是代價，是**它是唯一還記著「這顆概念當初被認為多通用」的地方**。

> **外延等價是可以收回的觀察；內涵身分是收不回的承諾。**（剪枝力①）

`layer` 是一份**外延主張被存成了內涵欄位**。正確的處置不是刪除，是**降級**：

```
今天    layer: 'universal'          一個宣告（不可驗、不可修訂）
該去    177 筆等價宣告的種子         一組邊（可驗、可修訂、可退步）
```

而**驗它需要第二個語言**。今天所有跨語言的等價類都是空的，
所以刪掉之後「這顆是不是通用」不會變成 `false`，會變成 **unknown**。

⚠️ 而 unknown 是誠實的——**問題是今天沒有地方存 unknown**。

## 七、下一步（未定）

1. **等 Python**，用 177 筆 `layer` 當**待驗清單**：每一顆宣稱 universal 的，
   Python 進來時要嘛長出一條跨語言的邊，要嘛被降級。
   → 這樣 `layer` 從「主張」變成「**假設**」，而假設是可以被否證的。
2. **或者現在就把 `layer` 改名**成誠實的東西（`assumedUniversal`？），
   讓它讀起來就是「還沒驗過」。⚠️ 而改名要付 P8 的一次性轉換。
3. **先泛化 `ioRole/ioStyle` 成通用的等價宣告**（`equiv.class` / `equiv.variant`），
   讓「等價類 ＋ 代表元」不再是 I/O 專用的硬編特例。
   ⚠️ 而 §二 說「**存兩邊的素材，判斷用算的**」——今天 `ioStyle` 沒有記
   「這條邊保住什麼」，它預設了「行為完全相同」。泛化時要補上。

## 出口條件

- **Python 進來** → 177 筆假設被驗，這份反流進 `history/`
- **決定改名或泛化** → 走 spec，這裡刪掉

## 相關

- [concepts/等價與觀察集](../concepts/等價與觀察集.md)——剪枝力①②、§二、§六
- [concepts/性狀](../concepts/性狀.md)——`ioRole`／`ioStyle` 就是那條邊
- [history/049](../history/049-F完成-把身分換成性狀.md)——F 讓這個矛盾變得看得見
