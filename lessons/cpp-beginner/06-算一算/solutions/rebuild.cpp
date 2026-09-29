#include <iostream>
using namespace std;
int main() {
    int score = 95;
    score = score + 5;
    cout << "分數是 " << score << endl;
    cout << "每人 " << score / 3 << " 分" << endl;
    cout << "剩下 " << score % 3 << " 分" << endl;
    return 0;
}
