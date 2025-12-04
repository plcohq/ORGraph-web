#pragma once
#include "Graph.h"

// Алгоритм для получения степени вершины.
// Он находится ВНЕ класса Graph.
int getVertexDegree(const Graph& g, int vertex_id);
