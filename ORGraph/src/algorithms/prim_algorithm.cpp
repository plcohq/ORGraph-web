#include "../../include/algorithms/prim_algorithm.h"
#include "../../include/Graph.h"
#include "nlohmann/json.hpp"
#include <vector>
#include <set>
#include <limits>
#include <algorithm>

using json = nlohmann::json;

std::string Prim(const Graph& graph) {
    int n = graph.getVertexCount();
    
    if (n == 0) {
        return json{{"error", "Граф пуст"}}.dump();
    }
    
    // Проверяем, что граф неориентированный (для алгоритма Прима)
    // Алгоритм Прима работает только с неориентированными графами
    
    // Инициализация
    std::vector<double> min_edge(n, std::numeric_limits<double>::max());
    std::vector<int> parent(n, -1);
    std::vector<bool> in_mst(n, false);
    
    // Начинаем с вершины 0
    min_edge[0] = 0;
    
    // Используем set для хранения пар (вес, вершина)
    std::set<std::pair<double, int>> priority_set;
    priority_set.insert({0.0, 0});
    
    int mst_edges_count = 0;
    double total_weight = 0.0;
    
    while (!priority_set.empty() && mst_edges_count < n - 1) {
        // Извлекаем вершину с минимальным весом
        auto current_pair = *priority_set.begin();
        double current_weight = current_pair.first;
        int current_vertex = current_pair.second;
        priority_set.erase(priority_set.begin());
        
        // Если вершина уже в MST, пропускаем
        if (in_mst[current_vertex]) continue;
        
        in_mst[current_vertex] = true;
        if (current_vertex != 0) {
            total_weight += current_weight;
            mst_edges_count++;
        }
        
        // Обрабатываем всех соседей текущей вершины
        std::vector<int> neighbors = graph.getNeighborsVertex(current_vertex);
        
        for (int neighbor : neighbors) {
            if (in_mst[neighbor]) continue;
            
            double edge_weight = graph.getEdgeWeight(current_vertex, neighbor);
            if (edge_weight < 0) continue; // Ребро не существует
            
            // Если нашли ребро с меньшим весом
            if (edge_weight < min_edge[neighbor]) {
                // Удаляем старую пару из set
                auto it = priority_set.find({min_edge[neighbor], neighbor});
                if (it != priority_set.end()) {
                    priority_set.erase(it);
                }
                
                // Обновляем минимальный вес
                min_edge[neighbor] = edge_weight;
                parent[neighbor] = current_vertex;
                
                // Добавляем новую пару
                priority_set.insert({edge_weight, neighbor});
            }
        }
    }
    
    // Формируем результат в JSON
    json result;
    
    // Проверяем, получилось ли построить MST (граф должен быть связным)
    if (mst_edges_count != n - 1) {
        result["success"] = false;
        result["message"] = "Граф не связный, невозможно построить MST";
        result["total_weight"] = -1;
        result["edges"] = json::array();
    } else {
        result["success"] = true;
        result["total_weight"] = total_weight;
        
        // Формируем список рёбер MST (исключая корень)
        json edges_array = json::array();
        for (int i = 1; i < n; ++i) {
            if (parent[i] != -1) {
                edges_array.push_back({
                    {"from", parent[i]},
                    {"to", i},
                    {"weight", min_edge[i]}
                });
            }
        }
        
        result["edges"] = edges_array;
        
        // Добавляем информацию о вершинах
        json vertices_info = json::array();
        for (int i = 0; i < n; ++i) {
            vertices_info.push_back({
                {"vertex", i},
                {"in_mst", in_mst[i]},
                {"parent", parent[i]},
                {"min_edge_to_mst", min_edge[i]}
            });
        }
        
        result["vertices_info"] = vertices_info;
    }
    
    // Общая информация
    result["total_vertices"] = n;
    result["edges_in_mst"] = mst_edges_count;
    result["algorithm"] = "Prim";
    
    return result.dump(2);
}
