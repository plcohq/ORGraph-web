#ifndef FLOYD_ALGORITHM_H
#define FLOYD_ALGORITHM_H

#include <string>
#include "Graph.h"

std::string FloydWarshall(const Graph& graph, int start_vertex, int end_vertex);

#endif // FLOYD_ALGORITHM_H
