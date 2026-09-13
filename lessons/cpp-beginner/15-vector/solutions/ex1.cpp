int main() {
    vector<int> v;
    while (true) {
        int x;
        cin >> x;
        if (x == 0) break;
        v.push_back(x);
    }
    cout << v.size() << endl;
    return 0;
}
