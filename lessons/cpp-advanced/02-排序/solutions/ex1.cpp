int main() {
    vector<int> v = {5, 2, 8, 1};
    sort(v.begin(), v.end());
    int best = v[1] - v[0];
    for (int i = 2; i < 4; i++) {
        int d = v[i] - v[i - 1];
        if (d < best) best = d;
    }
    cout << best << endl;
    return 0;
}
