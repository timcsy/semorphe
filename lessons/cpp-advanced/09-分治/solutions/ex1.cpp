int msum(vector<int>& a, int lo, int hi) {
    if (lo == hi) return a[lo];
    int mid = (lo + hi) / 2;
    int left = msum(a, lo, mid);
    int right = msum(a, mid + 1, hi);
    return max(left, right);
}

int main() {
    vector<int> a = {1, 2, 3, 4};
    cout << msum(a, 0, 3) << endl;
    return 0;
}
