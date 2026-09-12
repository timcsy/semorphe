int main() {
    vector<int> v;
    v.push_back(1);
    v.push_back(3);
    v.push_back(3);
    v.push_back(3);
    v.push_back(5);
    v.push_back(7);
    vector<int> ask;
    ask.push_back(3);
    ask.push_back(4);
    ask.push_back(7);
    for (int x : ask) {
        cout << upper_bound(v.begin(), v.end(), x) - lower_bound(v.begin(), v.end(), x) << endl;
    }
    return 0;
}
