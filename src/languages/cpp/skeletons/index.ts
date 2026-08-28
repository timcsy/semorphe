/**
 * C++ 的骨架宣告——**在模組載入時註冊**。
 *
 * 🔴 **它的家在這裡，不在 `pack.ts`。**
 *
 * 第一版註冊在套件裡，而 `board-library-headers-output` 那支測試
 * **直接 import `CppScaffold`、不經套件** → 鷹架沒註冊 → 七支全紅。
 *
 * > **一份宣告的家，要跟著它的【使用者】走，不是跟著「最上層那個檔」走。**
 *
 * ⚠️ 而那七支紅得**指名了原因**（「骨架宣告 main 不存在」）
 * ——那正是 `skeletonById` 找不到時**出聲**而不是回一份空骨架的價值：
 * 靜靜地當成「沒有鷹架」的話，產出的是一支少了 `int main()` 的程式，
 * **而它看起來像 Arduino**。
 */
import { registerSkeleton, parseSkeleton } from '../../../core/skeleton'
import mainSkeletonDef from './main.json'
import noneSkeletonDef from './none.json'
// 🔴 Arduino 的骨架（2026-08-28）——**在此之前九個板子目標指的是 `none`**，
//    也就是「沒有骨架」。而 Arduino 是有骨架的，只是它有【兩個】進入點。
import arduinoSkeletonDef from './arduino.json'

for (const raw of [mainSkeletonDef, noneSkeletonDef, arduinoSkeletonDef]) registerSkeleton(parseSkeleton(raw))
