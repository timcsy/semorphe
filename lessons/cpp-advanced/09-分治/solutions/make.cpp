vector<int> mergeSort(vector<int>& a, int lo, int hi) {
    vector<int> out;
    if (lo >= hi) {
        out.push_back(a[lo]);
        return out;
    }
    int mid = (lo + hi) / 2;
    vector<int> L = mergeSort(a, lo, mid);
    vector<int> R = mergeSort(a, mid + 1, hi);
    int i = 0, j = 0;
    while (i < L.size() && j < R.size()) {
        if (L[i] <= R[j]) { out.push_back(L[i]); i = i + 1; }
        else { out.push_back(R[j]); j = j + 1; }
    }
    while (i < L.size()) { out.push_back(L[i]); i = i + 1; }
    while (j < R.size()) { out.push_back(R[j]); j = j + 1; }
    return out;
}

int main() {
    vector<int> a;
    a.push_back(5);
    a.push_back(1);
    a.push_back(9);
    a.push_back(3);
    a.push_back(7);
    vector<int> s = mergeSort(a, 0, a.size() - 1);
    for (int x : s) cout << x << " ";
    cout << endl;
    return 0;
}
