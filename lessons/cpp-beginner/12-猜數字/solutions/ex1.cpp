int main() {
    int target = 1;
    int lo = 1, hi = 100, steps = 0;
    while (lo <= hi) {
        int mid = (lo + hi) / 2;
        steps = steps + 1;
        if (mid == target) break;
        if (mid < target) lo = mid + 1;
        else hi = mid - 1;
    }
    cout << "猜了 " << steps << " 次" << endl;
    return 0;
}
