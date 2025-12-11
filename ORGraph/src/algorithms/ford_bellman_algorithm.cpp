#include "ford_bellman_algorithm.h"
#include "Graph.h"
#include "nlohmann/json.hpp"
#include <vector>
#include <limits>
#include <algorithm>

using json = nlohmann::json;

std::string FordBellman(const Graph& graph, int start_vertex) {
    int n = graph.getVertexCount();

    // Проверка корректности вершины
    if (start_vertex < 0 || start_vertex >= n) {
        return json{{"error", "Неверная начальная вершина"}}.dump();
    }

    // Получаем все ребра графа
    std::vector<std::tuple<int, int, double>> edges;
    for (int i = 0; i < n; ++i) {
        std::vector<int> neighbors = graph.getNeighbors(i);
        for (int j : neighbors) {
            double weight = graph.getEdgeWeight(i, j);
            if (weight >= 0) { // Ребро существует
                edges.push_back({i, j, weight});
            }
        }
    }
    
    int m = edges.size();

    // Инициализация массивов
    std::vector<double> distances(n, std::numeric_limits<double>::max());
    std::vector<int> previous(n, -1);
    
    distances[start_vertex] = 0.0;
    previous[start_vertex] = start_vertex;

    // Основная часть алгоритма Форда-Беллмана
    bool changed = false;
    
    for (int i = 0; i < n - 1; ++i) {
        changed = false;
        
        for (const auto& edge : edges) {
            int from = std::get<0>(edge);
            int to = std::get<1>(edge);
            double weight = std::get<2>(edge);
            
            // Релаксация ребра
            if (distances[from] < std::numeric_limits<double>::max()) {
                double new_distance = distances[from] + weight;
                if (new_distance < distances[to]) {
                    distances[to] = new_distance;
                    previous[to] = from;
                    changed = true;
                }
            }
        }
        
        // Если на текущей итерации ничего не изменилось, можно остановиться
        if (!changed) {
            break;
        }
    }

    // Проверка на отрицательные циклы
    bool has_negative_cycle = false;
    std::vector<int> negative_cycle_vertices;
    
    for (const auto& edge : edges) {
        int from = std::get<0>(edge);
        int to = std::get<1>(edge);
        double weight = std::get<2>(edge);
        
        if (distances[from] < std::numeric_limits<double>::max()) {
            if (distances[from] + weight < distances[to]) {
                has_negative_cycle = true;
                // Начинаем восстанавливать цикл
                negative_cycle_vertices.push_back(from);
                negative_cycle_vertices.push_back(to);
                break;
            }
        }
    }

    // Формируем результат в JSON
    json result;
    
    if (has_negative_cycle) {
        result["success"] = false;
        result["message"] = "Обнаружен отрицательный цикл, достижимый из начальной вершины";
        result["has_negative_cycle"] = true;
        
        if (!negative_cycle_vertices.empty()) {
            result["negative_cycle_vertices"] = negative_cycle_vertices;
        }
        
    } else {
        result["success"] = true;
        result["message"] = "Алгоритм Форда-Беллмана успешно завершен";
        result["has_negative_cycle"] = false;
        
        // Добавляем расстояния до всех вершин
        json distances_json = json::array();
        for (int i = 0; i < n; ++i) {
            if (distances[i] == std::numeric_limits<double>::max()) {
                distances_json.push_back({
                    {"vertex", i},
                    {"distance", "INF"},
                    {"reachable", false}
                });
            } else {
                distances_json.push_back({
                    {"vertex", i},
                    {"distance", distances[i]},
                    {"reachable", true}
                });
            }
        }
        result["distances"] = distances_json;
        
        // Добавляем информацию о путях
        json paths_json = json::array();
        for (int i = 0; i < n; ++i) {
            if (i == start_vertex || distances[i] == std::numeric_limits<double>::max()) {
                continue;
            }
            
            // Восстанавливаем путь до вершины i
            std::vector<int> path;
            int current = i;
            
            while (current != start_vertex) {
                path.push_back(current);
                current = previous[current];
                if (current == -1) break;
            }
            
            if (current == start_vertex) {
                path.push_back(start_vertex);
                std::reverse(path.begin(), path.end());
                
                paths_json.push_back({
                    {"target_vertex", i},
                    {"distance", distances[i]},
                    {"path", path},
                    {"path_length", path.size()}
                });
            }
        }
        result["paths"] = paths_json;
        
        // Статистика
        int reachable_count = 0;
        double min_distance = std::numeric_limits<double>::max();
        double max_distance = 0;
        
        for (int i = 0; i < n; ++i) {
            if (distances[i] < std::numeric_limits<double>::max()) {
                reachable_count++;
                if (i != start_vertex) {
                    min_distance = std::min(min_distance, distances[i]);
                    max_distance = std::max(max_distance, distances[i]);
                }
            }
        }
        
        result["reachable_vertices"] = reachable_count;
        result["unreachable_vertices"] = n - reachable_count;
        
        if (reachable_count > 1) { // кроме стартовой
            result["min_distance"] = min_distance;
            result["max_distance"] = max_distance;
        }
    }

    // Общая информация
    result["start_vertex"] = start_vertex;
    result["total_vertices"] = n;
    result["total_edges"] = m;
    result["iterations_performed"] = n - 1;
    result["algorithm"] = "Ford-Bellman";
    result["complexity"] = "O(V*E)";

    return result.dump(2);
}
