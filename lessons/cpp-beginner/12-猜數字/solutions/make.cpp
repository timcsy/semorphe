int main() {
    int target;
    cin >> target;
    int linear = 0;
    for (int i = 1; i <= 100; i++) {
        linear = linear + 1;
        if (i == target) break;
    }
    int lo = 1, hi = 100, binary = 0;
    while (lo <= hi) {
        int mid = (lo + hi) / 2;
        binary = binary + 1;
        if (mid == target) break;
        if (mid < target) lo = mid + 1;
        else hi = mid - 1;
    }
    cout << linear << endl;
    cout << binary << endl;
    return 0;
}
