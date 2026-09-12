int main() {
    int count[6] = {0, 0, 0, 0, 0, 0};
    int n;
    cin >> n;
    for (int i = 0; i < n; i++) {
        int v;
        cin >> v;
        count[v] = count[v] + 1;
    }
    int best = 1;
    for (int i = 2; i <= 5; i++) {
        if (count[i] > count[best]) best = i;
    }
    for (int i = 1; i <= 5; i++) {
        cout << i << " " << count[i] << endl;
    }
    cout << "當選 " << best << endl;
    return 0;
}
