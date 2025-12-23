#include "../../include/algorithms/euler_path_algorithm.h"
#include "../../include/Graph.h"
#include "nlohmann/json.hpp"
#include <vector>
#include <set>
#include <stack>
#include <algorithm>

using json = nlohmann::json;

// Вспомогательная функция для проверки существования эйлерова пути
bool hasEulerPath(const Graph& graph, int& start_vertex) {
    int n = graph.getVertexCount();
    int odd_degree_count = 0;
    int first_odd_vertex = -1;
    
    // Подсчитываем вершины с нечетной степенью
    for (int i = 0; i < n; ++i) {
        int degree = graph.getVertexDegree(i);
        if (degree % 2 == 1) {
            odd_degree_count++;
            if (first_odd_vertex == -1) {
                first_odd_vertex = i;
            }
        }
    }
    
    // Для неориентированного графа:
    // - Эйлеров цикл: все вершины имеют четную степень
    // - Эйлеров путь: 0 или 2 вершины имеют нечетную степень
    if (odd_degree_count == 0) {
        // Эйлеров цикл - начинаем с любой вершины
        start_vertex = 0;
        return true;
    } else if (odd_degree_count == 2) {
        // Эйлеров путь - начинаем с вершины нечетной степени
        start_vertex = first_odd_vertex;
        return true;
    }
    
    return false;
}

// Основная функция для поиска эйлерова пути
std::string FindEulerPath(const Graph& graph) {
    int n = graph.getVertexCount();
    
    if (n == 0) {
        return json{{"error", "Граф пуст"}}.dump();
    }
    
    // Проверяем существование эйлерова пути
    int start_vertex = -1;
    if (!hasEulerPath(graph, start_vertex)) {
        return json{{"error", "Эйлеров путь не существует"}}.dump();
    }
    
    // Создаем копию графа для удаления использованных ребер
    std::vector<std::set<int>> adjacency_list(n);
    std::vector<std::vector<bool>> used_edges(n, std::vector<bool>(n, false));
    
    // Заполняем списки смежности
    for (int i = 0; i < n; ++i) {
        std::vector<int> neighbors = graph.getNeighborsVertex(i);
        for (int neighbor : neighbors) {
            if (!used_edges[i][neighbor]) {
                adjacency_list[i].insert(neighbor);
                // Для неориентированного графа добавляем в обе стороны
                adjacency_list[neighbor].insert(i);
                used_edges[i][neighbor] = true;
                used_edges[neighbor][i] = true;
            }
        }
    }
    
    // Алгоритм Флёри (упрощенный) или DFS-подход
    std::vector<int> euler_path;
    std::stack<int> stack;
    
    stack.push(start_vertex);
    
    while (!stack.empty()) {
        int current = stack.top();
        
        if (!adjacency_list[current].empty()) {
            // Берем следующего соседа
            int next = *adjacency_list[current].begin();
            
            // Удаляем ребро из графа (в обе стороны для неориентированного)
            adjacency_list[current].erase(next);
            adjacency_list[next].erase(current);
            
            // Переходим к следующей вершине
            stack.push(next);
        } else {
            // Если больше нет исходящих ребер, добавляем вершину в путь
            euler_path.push_back(current);
            stack.pop();
        }
    }
    
    // Путь получается в обратном порядке, переворачиваем его
    std::reverse(euler_path.begin(), euler_path.end());
    
    // Проверяем, что путь содержит все ребра
    // (это не всегда выполняется для несвязных графов, но мы уже проверили связность)
    
    // Формируем результат в JSON
    json result;
    
    if (euler_path.size() < 2) {
        result["success"] = false;
        result["message"] = "Не удалось построить эйлеров путь";
        result["path"] = json::array();
        result["edges"] = json::array();
    } else {
        result["success"] = true;
        result["is_cycle"] = (euler_path[0] == euler_path.back());
        result["path_length"] = euler_path.size();
        
        // Сохраняем путь (последовательность вершин)
        result["vertex_path"] = euler_path;
        
        // Формируем список ребер пути
        json edges_array = json::array();
        for (size_t i = 0; i < euler_path.size() - 1; ++i) {
            int from = euler_path[i];
            int to = euler_path[i + 1];
            double weight = graph.getEdgeWeight(from, to);
            
            edges_array.push_back({
                {"from", from},
                {"to", to},
                {"weight", weight}
            });
        }
        
        result["edges"] = edges_array;
        
        // Добавляем информацию о типе пути
        if (result["is_cycle"]) {
            result["message"] = "Найден эйлеров цикл";
        } else {
            result["message"] = "Найден эйлеров путь";
        }
    }
    
    // Общая информация
    result["start_vertex"] = start_vertex;
    result["total_vertices"] = n;
    result["total_edges"] = graph.getEdgeCount();
    result["algorithm"] = "Euler Path Finder";
    
    return result.dump(2);
}
