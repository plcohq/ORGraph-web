#include "deijkstra_algorithm.h"
#include "Graph.h"
#include "nlohmann/json.hpp"
#include <set>
#include <vector>
#include <limits>
#include <algorithm>

using json = nlohmann::json;

std::string Deijkstra(const Graph& graph, int start_vertex, int end_vertex) {
    int n = graph.getVertexCount();

    // Проверка корректности вершин
    if (start_vertex < 0 || start_vertex >= n)
        return json{{"error", "Неверная начальная вершина"}}.dump();
    
    if (end_vertex < 0 || end_vertex >= n)
        return json{{"error", "Неверная конечная вершина"}}.dump();

    // Инициализация массивов
    std::vector<double> distances(n, std::numeric_limits<double>::max());
    std::vector<int> previous(n, -1);
    std::vector<bool> visited(n, false);

    distances[start_vertex] = 0.0;
    
    // Используем set как приоритетную очередь (расстояние, вершина)
    std::set<std::pair<double, int>> priority_set;
    priority_set.insert({0.0, start_vertex});

    while (!priority_set.empty()) {
        // Извлекаем вершину с минимальным расстоянием
        auto current_pair = *priority_set.begin();
        double current_distance = current_pair.first;
        int current_vertex = current_pair.second;
        priority_set.erase(priority_set.begin());

        // Если уже посетили эту вершину, пропускаем
        if (visited[current_vertex]) continue;
        visited[current_vertex] = true;

        // Если нашли путь до конечной вершины, можно остановиться
        if (current_vertex == end_vertex) {
            break;
        }

        // Получаем всех соседей текущей вершины
        std::vector<int> neighbors = graph.getNeighbors(current_vertex);
        
        for (int neighbor : neighbors) {
            if (visited[neighbor]) continue;

            // Получаем вес ребра
            double edge_weight = graph.getEdgeWeight(current_vertex, neighbor);
            if (edge_weight < 0) continue; // Ребро не существует

            // Рассчитываем новое расстояние
            double new_distance = current_distance + edge_weight;

            // Если нашли более короткий путь
            if (new_distance < distances[neighbor]) {
                // Удаляем старую пару из set
                auto it = priority_set.find({distances[neighbor], neighbor});
                if (it != priority_set.end()) {
                    priority_set.erase(it);
                }

                // Обновляем расстояния и добавляем новую пару
                distances[neighbor] = new_distance;
                previous[neighbor] = current_vertex;
                priority_set.insert({new_distance, neighbor});
            }
        }
    }

    // Формируем результат в JSON
    json result;

    // Проверяем, найден ли путь
    if (distances[end_vertex] == std::numeric_limits<double>::max()) {
        result["success"] = false;
        result["message"] = "Путь не найден";
        result["distance"] = -1;
    } else {
        result["success"] = true;
        result["distance"] = distances[end_vertex];

        // Восстанавливаем путь
        std::vector<int> path;
        for (int v = end_vertex; v != -1; v = previous[v]) {
            path.push_back(v);
        }
        std::reverse(path.begin(), path.end());

        result["path"] = path;

        // Добавляем подробную информацию о пути
        json path_details = json::array();
        for (size_t i = 0; i < path.size(); i++) {
            path_details.push_back({
                {"vertex", path[i]},
                {"distance_from_start", distances[path[i]]}
            });
        }
        result["path_details"] = path_details;
    }

    // Добавляем основную информацию
    result["start_vertex"] = start_vertex;
    result["end_vertex"] = end_vertex;

    // Возвращаем форматированный JSON
    return result.dump(2);
}
