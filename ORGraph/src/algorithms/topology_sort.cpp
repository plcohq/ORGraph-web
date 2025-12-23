#include "../../include/algorithms/topology_sort.h"
#include "../../include/Graph.h"
#include "nlohmann/json.hpp"
#include <vector>
#include <stack>
#include <algorithm>

using json = nlohmann::json;

// Рекурсивный DFS для топологической сортировки
bool dfs(int v, const Graph& graph, 
         std::vector<int>& color, 
         std::vector<int>& order,
         std::vector<int>& cycle_vertices) {
    
    color[v] = 1; // Серый - вершина в обработке
    
    // Получаем всех соседей текущей вершины
    std::vector<int> neighbors = graph.getNeighborsVertex(v);
    
    for (int neighbor : neighbors) {
        if (color[neighbor] == 0) {
            // Белая вершина - рекурсивно обрабатываем
            if (!dfs(neighbor, graph, color, order, cycle_vertices)) {
                return false; // Найден цикл
            }
        } else if (color[neighbor] == 1) {
            // Нашли серую вершину - значит есть цикл
            cycle_vertices.push_back(neighbor);
            cycle_vertices.push_back(v);
            return false; // Цикл обнаружен
        }
        // Если вершина черная (color == 2), просто продолжаем
    }
    
    color[v] = 2; // Черный - вершина полностью обработана
    order.push_back(v); // Добавляем вершину в порядок (в обратном порядке)
    return true;
}

// Основная функция топологической сортировки
std::string TopologicalSort(const Graph& graph) {
    int n = graph.getVertexCount();
    
    if (n == 0) {
        return json{{"error", "Граф пуст"}}.dump();
    }
    
    // Проверяем, ориентированный ли граф
    // Топологическая сортировка имеет смысл только для ориентированных графов
    
    // Массив цветов вершин:
    // 0 - белый (не посещена)
    // 1 - серый (в обработке)
    // 2 - черный (обработана)
    std::vector<int> color(n, 0);
    
    // Порядок вершин (в обратном порядке выхода)
    std::vector<int> order;
    order.reserve(n);
    
    // Вершины, участвующие в цикле (для сообщения об ошибке)
    std::vector<int> cycle_vertices;
    
    // Выполняем DFS для всех вершин
    for (int i = 0; i < n; ++i) {
        if (color[i] == 0) {
            if (!dfs(i, graph, color, order, cycle_vertices)) {
                // Найден цикл - топологическая сортировка невозможна
                json result;
                result["success"] = false;
                result["message"] = "Граф содержит цикл, топологическая сортировка невозможна";
                result["is_dag"] = false;
                
                if (!cycle_vertices.empty()) {
                    result["cycle_vertices"] = cycle_vertices;
                    result["cycle_length"] = cycle_vertices.size();
                }
                
                result["total_vertices"] = n;
                result["algorithm"] = "Topological Sort (DFS)";
                return result.dump(2);
            }
        }
    }
    
    // Порядок получился в обратном порядке (от последней обработанной к первой)
    std::reverse(order.begin(), order.end());
    
    // Формируем результат в JSON
    json result;
    
    result["success"] = true;
    result["message"] = "Топологическая сортировка успешно выполнена";
    result["is_dag"] = true;
    
    // Порядок вершин
    result["order"] = order;
    result["order_length"] = order.size();
    
    // Инвертированный порядок (для удобства)
    std::vector<int> inverted_order(n, -1);
    for (size_t i = 0; i < order.size(); ++i) {
        inverted_order[order[i]] = i;
    }
    result["inverted_order"] = inverted_order;
    
    // Группировка вершин по уровням (для визуализации)
    json levels_array = json::array();
    
    // Простая эвристика для группировки по уровням:
    // Уровень вершины = максимальный уровень среди предшественников + 1
    std::vector<int> level(n, 0);
    for (int v : order) {
        std::vector<int> neighbors = graph.getNeighborsVertex(v);
        for (int neighbor : neighbors) {
            // Если есть ребро v -> neighbor, то neighbor должен быть позже
            int neighbor_idx = inverted_order[neighbor];
            if (neighbor_idx > inverted_order[v]) {
                // Уровень потомка должен быть хотя бы на 1 больше
                level[neighbor] = std::max(level[neighbor], level[v] + 1);
            }
        }
    }
    
    // Находим максимальный уровень
    int max_level = 0;
    for (int l : level) {
        max_level = std::max(max_level, l);
    }
    
    // Группируем вершины по уровням
    for (int l = 0; l <= max_level; ++l) {
        json level_vertices = json::array();
        for (int i = 0; i < n; ++i) {
            if (level[i] == l) {
                level_vertices.push_back(i);
            }
        }
        if (!level_vertices.empty()) {
            levels_array.push_back({
                {"level", l},
                {"vertices", level_vertices}
            });
        }
    }
    
    result["levels"] = levels_array;
    result["max_level"] = max_level;
    
    // Проверяем, что порядок корректный
    bool is_valid = true;
    for (int i = 0; i < n; ++i) {
        std::vector<int> neighbors = graph.getNeighborsVertex(i);
        for (int neighbor : neighbors) {
            // Для каждого ребра i -> neighbor, i должен быть раньше neighbor
            if (inverted_order[i] > inverted_order[neighbor]) {
                is_valid = false;
                break;
            }
        }
        if (!is_valid) break;
    }
    
    result["is_valid_order"] = is_valid;
    
    // Общая информация
    result["total_vertices"] = n;
    result["algorithm"] = "Topological Sort (DFS)";
    
    return result.dump(2);
}
