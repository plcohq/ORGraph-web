#include "../../include/algorithms/topology_sort.h"
#include "../../include/Graph.h"
#include "nlohmann/json.hpp"
#include <vector>
#include <stack>
#include <algorithm>
#include <iostream>
#include <unordered_set>

using json = nlohmann::json;

// Итеративный DFS для топологической сортировки (улучшенная версия)
bool iterative_dfs(int start_v, const Graph& graph, 
                   std::vector<int>& color, 
                   std::vector<int>& order,
                   std::vector<int>& parent,
                   std::vector<int>& cycle_vertices) {
    
    std::stack<std::pair<int, int>> stack; // пара: (вершина, индекс следующего соседа)
    stack.push({start_v, 0});
    
    while (!stack.empty()) {
        int v = stack.top().first;
        int& next_idx = stack.top().second;
        
        // Если это первое посещение вершины
        if (color[v] == 0) {
            color[v] = 1; // Серый - в обработке
        }
        
        // Получаем всех соседей текущей вершины
        std::vector<int> neighbors = graph.getNeighborsVertex(v);
        
        // Отладочный вывод
        // std::cout << "Обрабатываю вершину " << v << ", соседей: " << neighbors.size() << std::endl;
        // for (int nb : neighbors) {
        //     std::cout << "  -> " << nb << std::endl;
        // }
        
        if (next_idx < static_cast<int>(neighbors.size())) {
            int neighbor = neighbors[next_idx];
            next_idx++;
            
            // Отладочный вывод
            // std::cout << "  Проверяю соседа " << neighbor << " (цвет: " << color[neighbor] << ")" << std::endl;
            
            if (color[neighbor] == 0) {
                // Белая вершина - начинаем обработку
                parent[neighbor] = v;
                stack.push({neighbor, 0});
            } else if (color[neighbor] == 1) {
                // Нашли серую вершину - значит есть цикл
                // Восстанавливаем цикл
                cycle_vertices.clear();
                int current = v;
                
                // Добавляем вершины цикла
                cycle_vertices.push_back(neighbor);
                while (current != neighbor && current != -1) {
                    cycle_vertices.push_back(current);
                    current = parent[current];
                }
                
                if (current == neighbor) {
                    cycle_vertices.push_back(neighbor); // Замыкаем цикл
                }
                
                std::reverse(cycle_vertices.begin(), cycle_vertices.end());
                
                // Отладочный вывод
                // std::cout << "Найден цикл: ";
                // for (int cv : cycle_vertices) {
                //     std::cout << cv << " ";
                // }
                // std::cout << std::endl;
                
                return false; // Цикл обнаружен
            }
            // Если вершина черная (color == 2), просто продолжаем
        } else {
            // Все соседи обработаны
            stack.pop();
            if (color[v] == 1) { // Если еще не помечена как черная
                color[v] = 2; // Черный - обработана
                order.push_back(v); // Добавляем вершину в порядок (в обратном порядке)
            }
        }
    }
    
    return true;
}

// Основная функция топологической сортировки
std::string TopologicalSort(const Graph& graph) {
    int n = graph.getVertexCount();
    
    if (n == 0) {
        return json{{"error", "Граф пуст"}}.dump();
    }
    
    // Отладочный вывод
    std::cout << "=== Запуск топологической сортировки ===" << std::endl;
    std::cout << "Вершин: " << n << std::endl;
    
    // Получаем информацию о графе для отладки
    int edge_count = graph.getEdgeCount();
    std::cout << "Рёбер: " << edge_count << std::endl;
    
    // Выводим информацию о соседях для отладки
    std::cout << "Соседи вершин:" << std::endl;
    for (int i = 0; i < n; ++i) {
        std::vector<int> neighbors = graph.getNeighborsVertex(i);
        std::cout << "  Вершина " << i << ": ";
        for (int nb : neighbors) {
            std::cout << nb << " ";
        }
        std::cout << std::endl;
    }
    
    // Массив цветов вершин:
    // 0 - белый (не посещена)
    // 1 - серый (в обработке)
    // 2 - черный (обработана)
    std::vector<int> color(n, 0);
    
    // Массив родителей для восстановления циклов
    std::vector<int> parent(n, -1);
    
    // Порядок вершин (в обратном порядке выхода)
    std::vector<int> order;
    order.reserve(n);
    
    // Вершины, участвующие в цикле
    std::vector<int> cycle_vertices;
    
    // Выполняем DFS для всех вершин
    bool has_cycle = false;
    for (int i = 0; i < n; ++i) {
        if (color[i] == 0) {
            std::cout << "Начинаем DFS от вершины " << i << std::endl;
            if (!iterative_dfs(i, graph, color, order, parent, cycle_vertices)) {
                has_cycle = true;
                std::cout << "Найден цикл!" << std::endl;
                break; // Найден цикл
            }
        }
    }
    
    if (has_cycle) {
        // Найден цикл - топологическая сортировка невозможна
        json result;
        result["success"] = false;
        result["message"] = "Граф содержит цикл, топологическая сортировка невозможна";
        result["is_dag"] = false;
        
        // Проверяем, является ли это петлей (ребро из вершины в саму себя)
        bool is_self_loop = false;
        if (cycle_vertices.size() == 2 && cycle_vertices[0] == cycle_vertices[1]) {
            is_self_loop = true;
            result["cycle_type"] = "self_loop";
            result["message"] = "Граф содержит петлю (ребро из вершины " + 
                               std::to_string(cycle_vertices[0]) + " в саму себя)";
        } else if (cycle_vertices.size() == 3 && 
                  cycle_vertices[0] == cycle_vertices[2]) {
            result["cycle_type"] = "two_vertex_cycle";
        } else {
            result["cycle_type"] = "general_cycle";
        }
        
        if (!cycle_vertices.empty()) {
            result["cycle_vertices"] = cycle_vertices;
            result["cycle_length"] = cycle_vertices.size();
            
            // Формируем описание цикла
            std::string cycle_str = "Цикл: ";
            for (size_t i = 0; i < cycle_vertices.size(); ++i) {
                if (i > 0) cycle_str += " → ";
                cycle_str += std::to_string(cycle_vertices[i]);
            }
            result["cycle_description"] = cycle_str;
        }
        
        result["total_vertices"] = n;
        result["total_edges"] = edge_count;
        result["algorithm"] = "Topological Sort (DFS)";
        
        std::cout << "=== Результат: ЦИКЛ ОБНАРУЖЕН ===" << std::endl;
        std::cout << result.dump(2) << std::endl;
        
        return result.dump(2);
    }
    
    // Порядок получился в обратном порядке (от последней обработанной к первой)
    std::reverse(order.begin(), order.end());
    
    std::cout << "Порядок вершин (после reverse): ";
    for (int v : order) {
        std::cout << v << " ";
    }
    std::cout << std::endl;
    
    // Проверяем, что порядок корректный
    bool is_valid = true;
    std::vector<int> position(n, -1);
    for (size_t i = 0; i < order.size(); ++i) {
        position[order[i]] = i;
    }
    
    // Проверяем все рёбра
    int invalid_edge_count = 0;
    for (int v = 0; v < n; ++v) {
        std::vector<int> neighbors = graph.getNeighborsVertex(v);
        for (int neighbor : neighbors) {
            // Если есть ребро v -> neighbor, то v должен быть раньше neighbor
            if (position[v] > position[neighbor]) {
                is_valid = false;
                invalid_edge_count++;
                std::cout << "Некорректное ребро: " << v << " -> " << neighbor 
                         << " (позиции: " << position[v] << " > " << position[neighbor] << ")" << std::endl;
            }
        }
    }
    
    // Формируем результат в JSON
    json result;
    
    if (is_valid) {
        result["success"] = true;
        result["message"] = "Топологическая сортировка успешно выполнена";
        result["is_dag"] = true;
    } else {
        result["success"] = false;
        result["message"] = "Нарушен топологический порядок: " + 
                           std::to_string(invalid_edge_count) + " некорректных рёбер";
        result["is_dag"] = false;
    }
    
    result["is_valid_order"] = is_valid;
    result["invalid_edge_count"] = invalid_edge_count;
    
    // Порядок вершин
    result["order"] = order;
    result["order_length"] = order.size();
    
    // Группировка вершин по уровням (для визуализации)
    json levels_array = json::array();
    
    if (is_valid) {
        // Вычисляем уровни (длину самого длинного пути до вершины)
        std::vector<int> level(n, 0);
        
        // Идем в порядке топологической сортировки
        for (int v : order) {
            std::vector<int> neighbors = graph.getNeighborsVertex(v);
            for (int neighbor : neighbors) {
                // Для ребра v -> neighbor обновляем уровень neighbor
                level[neighbor] = std::max(level[neighbor], level[v] + 1);
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
                    {"vertices", level_vertices},
                    {"count", level_vertices.size()}
                });
            }
        }
        
        result["max_level"] = max_level;
    }
    
    result["levels"] = levels_array;
    
    // Общая информация
    result["total_vertices"] = n;
    result["total_edges"] = edge_count;
    result["algorithm"] = "Topological Sort (DFS)";
    
    std::cout << "=== Результат: УСПЕХ ===" << std::endl;
    std::cout << result.dump(2) << std::endl;
    
    return result.dump(2);
}
