int main() {
    vector<int> v;
    v.push_back(5);
    v.push_back(1);
    v.push_back(9);
    v.push_back(3);
    v.push_back(7);
    sort(v.begin(), v.end());
    cout << v[v.size() / 2] << endl;
    cout << v[v.size() - 1] - v[0] << endl;
    return 0;
}
