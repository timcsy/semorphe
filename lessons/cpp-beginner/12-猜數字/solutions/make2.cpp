int main() {
    srand(time(0));
    int target = rand() % 100 + 1;
    int steps = 0;
    while (true) {
        int guess;
        cin >> guess;
        steps = steps + 1;
        if (guess == target) {
            cout << "中了，你猜了 " << steps << " 次" << endl;
            break;
        }
        if (guess > target) cout << "太大了" << endl;
        else cout << "太小了" << endl;
    }
    return 0;
}
