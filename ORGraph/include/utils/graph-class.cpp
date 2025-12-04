/*
 * graph-class.cpp -- create graph with adjacency list
 */

#include <vector>

class Graph {
private:
	vector<vector<pair<int, double>>> adjacency_list;

public:
	Graph(int n = 0, int m = 0) {
		adjacency_list.resize(n);
		for (int i = 0; i < m; i++)
			adjacency_list[i].resize(m)
	}
};
