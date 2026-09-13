int main() {
    vector<int> v;
    int x;
    cin >> x;
    while (x != 0) {
        v.push_back(x);
        cin >> x;
    }
    int sum = 0;
    for (int i = 0; i < v.size(); i++) sum = sum + v[i];
    int avg = sum / v.size();
    int above = 0;
    for (int i = 0; i < v.size(); i++) {
        if (v[i] > avg) above = above + 1;
    }
    cout << avg << endl;
    cout << above << endl;
    return 0;
}
