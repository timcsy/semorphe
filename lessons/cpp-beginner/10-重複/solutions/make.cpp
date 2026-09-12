int main() {
    int n;
    cin >> n;
    int steps = 0;
    while (n != 1) {
        if (n % 2 == 0) {
            n = n / 2;
        } else {
            n = n * 3 + 1;
        }
        steps = steps + 1;
    }
    cout << steps << endl;
    return 0;
}
