#include "floyd_algorithm.h"
#include "Graph.h"
#include "nlohmann/json.hpp"
#include <vector>
#include <limits>
#include <algorithm>

using json = nlohmann::json;

std::string FloydWarshall(const Graph& graph, int start_vertex, int end_vertex) {
    int n = graph.getVertexCount();

    // Проверка корректности вершин
    if (start_vertex < 0 || start_vertex >= n) {
        return json{{"error", "Неверная начальная вершина"}}.dump();
    }
    
    if (end_vertex < 0 || end_vertex >= n) {
        return json{{"error", "Неверная конечная вершина"}}.dump();
    }

    // Инициализация матрицы расстояний
    std::vector<std::vector<double>> dist(n, 
        std::vector<double>(n, std::numeric_limits<double>::max()));
    
    // Инициализация матрицы next для восстановления пути
    std::vector<std::vector<int>> next(n, std::vector<int>(n, -1));

    // Заполняем начальные значения
    for (int i = 0; i < n; ++i) {
        dist[i][i] = 0;
        next[i][i] = i;
        
        // Получаем соседей
        std::vector<int> neighbors = graph.getNeighbors(i);
        for (int j : neighbors) {
            double weight = graph.getEdgeWeight(i, j);
            if (weight >= 0) {
                dist[i][j] = weight;
                next[i][j] = j;
            }
        }
    }

    // Алгоритм Флойда-Уоршелла
    for (int k = 0; k < n; ++k) {
        for (int i = 0; i < n; ++i) {
            if (dist[i][k] == std::numeric_limits<double>::max()) continue;
            
            for (int j = 0; j < n; ++j) {
                if (dist[k][j] == std::numeric_limits<double>::max()) continue;
                
                double new_dist = dist[i][k] + dist[k][j];
                if (new_dist < dist[i][j]) {
                    dist[i][j] = new_dist;
                    next[i][j] = next[i][k];
                }
            }
        }
    }

    // Формируем результат в JSON
    json result;

    // Проверяем, найден ли путь
    if (dist[start_vertex][end_vertex] == std::numeric_limits<double>::max()) {
        result["success"] = false;
        result["message"] = "Путь не найден";
        result["distance"] = -1;
        result["path"] = json::array();
    } else {
        result["success"] = true;
        result["distance"] = dist[start_vertex][end_vertex];

        // Восстанавливаем путь
        std::vector<int> path;
        
        if (next[start_vertex][end_vertex] == -1) {
            path.push_back(start_vertex);
        } else {
            int current = start_vertex;
            while (current != end_vertex) {
                path.push_back(current);
                current = next[current][end_vertex];
            }
            path.push_back(end_vertex);
        }
        
        result["path"] = path;
    }

    result["start_vertex"] = start_vertex;
    result["end_vertex"] = end_vertex;

    return result.dump(2);
}
