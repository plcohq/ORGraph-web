#pragma once
#include "Graph.h"

// Объявление функции, которая будет генерировать случайный граф.
// Принимает количество вершин и рёбер.
Graph generateRandomGraph(int numVertices, int numEdges,
                          RepresentationType type = RepresentationType::ADJACENCY_LIST,
                          bool is_directed = false);
