import type { RuntimeValue } from './types'
import type { Place } from './lvalue'
import { hasAlias, resolveAlias } from './aliases'
import { RuntimeError, RUNTIME_ERRORS } from './errors'
import { findNearMiss } from './near-miss'
import { isBuiltinName } from '../core/language-executors'

/**
 * 一個引用指到的東西——**兩種**。
 *
 * ```
 * { scope, name }   指到另一個作用域裡的【一個名字】      int &r = x;      g(x)
 * { place }         指到一個【算出來的位置】              int &r = a[1];   g(a[1])  g(s.a)
 * ```
 *
 * 🔴 **第二種是 2026-09-20 才有的，而在此之前缺的不是機制，是【接上】**：
 * 兩個呼叫點（`cpp:func_call` 的參照參數、`cpp:var_declare_ref`）都寫著
 * 「引數是一個裸的變數名就綁引用，否則……」——而那個「否則」是
 * **安靜地改用傳值**。於是
 *
 * ```
 * void g(int &r){ r = 7; }
 * int a[3] = {0,0,0};  g(a[1]);  cout << a[1];   g++ 印 7，我們印 0
 * struct S{int a;}; S s;  g(s.a);                g++ 印 7，我們印 0
 * ```
 *
 * ——**不報錯、程式跑完、答案是錯的**。實測五種形狀全中
 *（C 陣列元素／vector 元素／struct 陣列元素／struct 的成員／綁到參照變數）。
 *
 * > **一個「認得出裸名字就做對，否則悄悄改做別的事」的分支，
 * > 它的正確性等於【使用者只會寫裸名字】這個假設。**
 *
 * 🟢 而「算出來的位置」這個抽象**本來就在**（`lvalue.ts` 的 `Place`，
 * `swap(a[j], a[j+1])` 在用）——這裡只是讓引用也拿得到它。
 */
type RefTarget = { scope: Scope, name: string } | { place: Place }

/** 讀一個引用指到的東西。 */
function readRef(t: RefTarget): RuntimeValue {
  return 'place' in t ? t.place.read() : t.scope.get(t.name)
}

/** 寫一個引用指到的東西。 */
function writeRef(t: RefTarget, v: RuntimeValue): void {
  if ('place' in t) t.place.write(v)
  else t.scope.set(t.name, v)
}

export class Scope {
  private variables = new Map<string, RuntimeValue>()
  private refs = new Map<string, RefTarget>()
  readonly parent: Scope | null

  constructor(parent: Scope | null = null) {
    this.parent = parent
  }

  declare(name: string, value: RuntimeValue): void {
    if (this.variables.has(name)) {
      throw new RuntimeError(RUNTIME_ERRORS.DUPLICATE_DECLARATION, { '%1': name })
    }
    this.variables.set(name, value)
  }

  /**
   * **蓋掉一個內建常數**——使用者宣告了同名的東西時走這條。
   *
   * ## 🔴 為什麼需要它（2026-09-06，spec 174）
   *
   * 直譯器啟動時把**全部**內建常數塞進全域作用域
   * （`interpreter.ts` 的 `allBuiltinConstants()`）。於是使用者寫
   * `enum Marker { EOF = -99 };` 會撞上那一份，丟 `DUPLICATE_DECLARATION`
   * ——⚠️ 而那個訊息**說錯了原因**：他只宣告了一次。
   *
   * > **一個「你重複宣告了」的錯誤訊息，
   * > 在另一個宣告是系統自己塞的時候，指控的是無辜的那一方。**
   *
   * ## ⚠️ 它【只】蓋得掉內建的那些
   *
   * 🔴 使用者自己重複宣告**仍然要丟錯**——那是一個真的錯誤，
   * 而把這一支寫成「一律覆蓋」會把它一起吞掉。
   *
   * 判準：那個名字**是不是語言的內建常數**（`isBuiltinName`）。
   */
  declareOverridingBuiltin(name: string, value: RuntimeValue): void {
    if (this.variables.has(name) && !isBuiltinName(name)) {
      throw new RuntimeError(RUNTIME_ERRORS.DUPLICATE_DECLARATION, { '%1': name })
    }
    this.variables.set(name, value)
  }

  /** Declare a reference alias: reads/writes to `name` delegate to `target` in `targetScope` */
  declareRef(name: string, targetScope: Scope, targetName: string): void {
    this.refs.set(name, { scope: targetScope, name: targetName })
  }

  /**
   * **把一個名字綁到一個【算出來的位置】**——`int &r = a[1];`、`g(s.a)`。
   *
   * ⚠️ 位置要在**呼叫端的作用域**解好再傳進來：`a[1]` 的 `a` 與 `1`
   * 是呼叫端的東西，而這個作用域是被呼叫端的。
   */
  declarePlaceRef(name: string, place: Place): void {
    this.refs.set(name, { place })
  }

  get(name: string): RuntimeValue {
    const ref = this.refs.get(name)
    if (ref) return readRef(ref)
    if (this.variables.has(name)) {
      return this.variables.get(name)!
    }
    // 🔴 **不能寫成 `return this.parent.get(name)`**——那樣拋錯的是【最外層】，
    // 而 `getAll()` 只往上攤平，**最外層看不到我們這一層的名字**。
    // 於是 `int score` 在 main 裡、而建議在 global 拋出 → 永遠找不到近似名。
    //
    // > **遞迴到最外層才拋錯，錯誤訊息就只看得到最外層的世界。**
    //
    // ⚠️ 2026-08-17 實測撞到：單元測試（直接對一個 Scope 呼叫）全綠，
    // 而跑真的程式一句建議都沒有。**驗證必須在行為端。**
    for (let s: Scope | null = this.parent; s; s = s.parent) {
      const r = s.refs.get(name)
      if (r) return readRef(r)
      if (s.variables.has(name)) return s.variables.get(name)!
    }
    /**
     * 🔴 **查不到才問別名**（2026-09-16）——`#define SENSOR_PIN A0`。
     *
     * `cpp:define` 只認得**字面值**的替換（`#define MAXN 100000` → 宣告一個變數），
     * 而「值是另一個識別字」那一族一直是 `UNDECLARED_VAR`。
     * 它在競賽與 Arduino 的程式裡是招牌寫法。
     *
     * ⚠️ **只在查不到的那一刻問一次**：有這個名字的時候一個字都不動，
     * 所以它不會蓋掉正常的查找，也不會把使用者的程式碼改寫成別的樣子
     * （見 `aliases.ts` 的檔頭——替換與查詢是兩件事）。
     *
     * > **一個「取小名」的宣告，它要的是【查得到】，不是【被換掉】。**
     */
    if (hasAlias(name)) {
      const real = resolveAlias(name)
      if (real !== name) {
        for (let s: Scope | null = this; s; s = s.parent) {
          const r = s.refs.get(real)
          if (r) return readRef(r)
          if (s.variables.has(real)) return s.variables.get(real)!
        }
      }
    }
    throw this.undeclared(name)
  }

  /**
   * **未宣告的名字——而如果可見範圍裡有一個長得很像的，說出來。**
   *
   * ⚠️ 這裡是最外層才會走到（`get` 一路往上遞迴），所以 `getAll()`
   * 拿到的**就是完整的可見集合**。
   *
   * 🔴 而找不到近似名時**回傳與今天逐字相同的那一則**——
   * 「不亂猜」比「會猜」重要（見 `near-miss.ts` 檔頭）。
   */
  private undeclared(name: string): RuntimeError {
    const near = findNearMiss(name, this.getAll().keys())
    return near === undefined
      ? new RuntimeError(RUNTIME_ERRORS.UNDECLARED_VAR, { '%1': name })
      : new RuntimeError(RUNTIME_ERRORS.UNDECLARED_VAR_SUGGEST, { '%1': name, '%2': near })
  }

  /**
   * 寫入一個名字。**找不到就拋，不建立。**
   *
   * ## 為什麼（2026-08-15，spec `127`）
   *
   * 這裡原本的收尾是 `this.variables.set(name, value)`——**找不到就默默創出來**。
   * 於是 `score = 90;`（忘了寫 `int`）**跑得完並印出 90**，而 C++ 拒絕它。
   *
   * ```
   * 之前   get 找不到 → 拋      set 找不到 → 建立   🔴 同一件事兩種行為
   * 之後   get 找不到 → 拋      set 找不到 → 拋     ✅ 同一則訊息
   * ```
   *
   * 使用者逐字：「**寫錯還能順利執行就是不合理的**」。
   * 而它有一個教學上的受害者——第二課花兩段講「`int` 不能省」，
   * 而系統本身允許省，所以課文**繞了路**，甚至寫了一句系統做不到的提醒。
   *
   * ## 🔴 限定：這是執行期，不是編輯期（2/3）
   *
   * C++ 在**編譯時**拒絕；這裡在**跑到那一行時**才停。
   * **一段有這個錯誤而永遠跑不到那一行的程式，仍然會「成功」。**
   * ⚠️ **不得宣稱兩者等價。**（另兩處：`spec.md` FR-008、第二課課文）
   *
   * ## ⚠️ 為什麼是遞迴，而不是「只把最後一行改成拋」
   *
   * 舊寫法用 `try { this.parent.get(name) } catch {}` 當「看看有沒有」。
   * 改成拒絕之後 `parent.set()` 也會拋，而**那個 catch 會把它吃掉**
   * ——控制流照樣掉到最後一行，**行為完全沒變，而它看起來像修好了**。
   *
   * > **一個為了「看看有沒有」而存在的 try/catch，
   * > 在被查的那件事本身開始拋錯的那天，會靜靜地把新行為吃掉。**
   *
   * 遞迴讓「拋」自然從最外層傳上來，而中間每一層都不必知道找不到會怎樣。
   *
   * ⚠️ **不得改用 `findOwner()`**：它**只看 `variables` 不看 `refs`**，
   * 用它會讓父層宣告的**引用別名**寫入被靜默判成未宣告。
   */
  set(name: string, value: RuntimeValue): void {
    const ref = this.refs.get(name)
    if (ref) { writeRef(ref, value); return }
    if (this.variables.has(name)) {
      this.variables.set(name, value)
      return
    }
    // 同上——拋錯的必須是**發起查找的這一層**，它才看得到完整的可見集合。
    for (let s: Scope | null = this.parent; s; s = s.parent) {
      const r = s.refs.get(name)
      if (r) { writeRef(r, value); return }
      if (s.variables.has(name)) { s.variables.set(name, value); return }
    }
    throw this.undeclared(name)
  }

  /**
   * 這個名字在**這一層**有沒有——不往上找。
   *
   * 🔴 Python 的規則：**函式裡的指派建立的是本地變數**，
   * 即使外面有同名的。而 `has()` 往上找，於是
   *
   * ```python
   * x = 10
   * def f():
   *     x = 20     # ← 用 has() 判斷的話這裡會改到【外面的 x】
   *     return x
   * print(f(), x)  # 真 Python：20 10 ／ 我們曾經：20 20
   * ```
   *
   * ⚠️ 症狀**不報錯、有輸出、而外面那個值被改掉了**——參照直譯器抓到的。
   *
   * > **「這個名字看得見嗎」與「這個名字屬於這一層嗎」是兩個問題，
   * > 而一個往上找的查詢只答得出前者。**
   */
  hasLocal(name: string): boolean {
    return this.variables.has(name) || this.refs.has(name)
  }

  /** Find the scope that owns a variable (for reference binding) */
  findOwner(name: string): Scope | null {
    if (this.variables.has(name)) return this
    if (this.parent) return this.parent.findOwner(name)
    return null
  }

  /**
   * **只有這一層自己**宣告的變數，依宣告順序。
   *
   * 與 `getAll()` 不同——後者會把父層的一起攤平，用它來跑收尾的話，
   * 外層的物件會在每一個內層作用域結束時被重複收尾一次。
   */
  ownVariables(): Map<string, RuntimeValue> {
    return this.variables
  }

  /** 這個名字宣告過嗎？（`get` 找不到會丟錯，所以要先問） */
  has(name: string): boolean {
    if (this.refs.has(name) || this.variables.has(name)) return true
    return this.parent?.has(name) ?? false
  }

  createChild(): Scope {
    return new Scope(this)
  }

  /**
   * 建一個**直接用 `fields` 當變數表**的作用域——給方法呼叫用。
   *
   * C++ 的方法直接寫欄位名（`x = 5`，不是 `this->x = 5`）。天真的做法是把
   * 欄位複製進來、跑完再複製回去，**而那在方法呼叫方法時是錯的**：內層改的
   * 是自己那份副本。
   *
   * 這裡不複製——欄位表就是變數表，讀寫自動穿透。
   *
   * ⚠️ 方法裡宣告的區域變數會落進這張表，也就是落進物件。呼叫端要用一個
   * **子作用域**跑方法本體，讓區域變數落在子層。見 `struct-methods.ts`。
   */
  static overFields(fields: Map<string, RuntimeValue>, parent: Scope | null): Scope {
    const s = new Scope(parent)
    ;(s as unknown as { variables: Map<string, RuntimeValue> }).variables = fields
    return s
  }

  /**
   * **這一層自己的名字**——不含外層。
   *
   * ⚠️ 與 `getAll()` 的差別是「往不往上攤平」，而**用錯的症狀是安靜的**：
   * 類別層級的屬性用 `getAll()` 收集的話，**外層的每一個變數都會被抄進實例裡**
   * ——程式照跑，而每個物件多出一堆看不見的欄位。
   *
   * > **與 `hasLocal` 同一條線：「看得見」與「屬於這一層」是兩個問題。**
   */
  own(): Map<string, RuntimeValue> {
    return new Map(this.variables)
  }

  getAll(): Map<string, RuntimeValue> {
    const result = new Map<string, RuntimeValue>()
    if (this.parent) {
      for (const [k, v] of this.parent.getAll()) {
        result.set(k, v)
      }
    }
    for (const [k, v] of this.variables) {
      result.set(k, v)
    }
    return result
  }
}
