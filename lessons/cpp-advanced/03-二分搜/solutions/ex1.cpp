int main() {
    vector<int> v = {1, 3, 3, 3, 5};
    cout << upper_bound(v.begin(), v.end(), 3) - lower_bound(v.begin(), v.end(), 3) << endl;
    cout << lower_bound(v.begin(), v.end(), 4) - v.begin() << endl;
    return 0;
}
