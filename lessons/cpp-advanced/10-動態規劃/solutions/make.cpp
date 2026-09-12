int main() {
    vector<int> a;
    a.push_back(-2);
    a.push_back(1);
    a.push_back(-3);
    a.push_back(4);
    a.push_back(-1);
    a.push_back(2);
    a.push_back(1);
    a.push_back(-5);
    a.push_back(4);
    int best = a[0];
    int cur = a[0];
    for (int i = 1; i < a.size(); i++) {
        if (cur + a[i] > a[i]) cur = cur + a[i];
        else cur = a[i];
        if (cur > best) best = cur;
    }
    cout << best << endl;
    return 0;
}
