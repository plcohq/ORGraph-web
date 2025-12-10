#pragma once
#ifndef DIJKSTRA_H
#define DIJKSTRA_H

#include "Graph.h"
#include <string>

std::string Deijkstra(const Graph& graph, int start_vertex, int end_vertex);

#endif
