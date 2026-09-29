#include <cmath>
#include <iostream>
using namespace std;
int main() {
    int score = 95;
    score = score + 5;
    cout << "分數是 " << score << endl;
    cout << "每人 " << score / 3 << " 分" << endl;
    cout << "剩下 " << score % 3 << " 分" << endl;
    cout << "開根號是 " << sqrt(score) << endl;
    cout << "10 的 2 次方是 " << pow(10, 2) << endl;
    return 0;
}
