#include "../../include/algorithms/hamiltonian_path_algorithm.h"
#include "../../include/Graph.h"
#include "nlohmann/json.hpp"
#include <vector>
#include <bitset>
#include <algorithm>

using json = nlohmann::json;

// Динамическое программирование для поиска гамильтонова пути
std::string FindHamiltonianPath(const Graph& graph) {
    int n = graph.getVertexCount();
    
    if (n == 0) {
        return json{{"error", "Граф пуст"}}.dump();
    }
    
    if (n > 20) { // Ограничение из-за экспоненциальной сложности
        return json{{"error", "Слишком много вершин для поиска гамильтонова пути"}}.dump();
    }
    
    // Создаем матрицу смежности для быстрого доступа
    std::vector<std::vector<bool>> adjacency(n, std::vector<bool>(n, false));
    for (int i = 0; i < n; ++i) {
        std::vector<int> neighbors = graph.getNeighborsVertex(i);
        for (int neighbor : neighbors) {
            adjacency[i][neighbor] = true;
        }
    }
    
    int max_mask = 1 << n; // 2^n масок
    
    // DP[mask][last] - существует ли путь, проходящий через вершины mask и заканчивающийся в last
    std::vector<std::vector<bool>> dp(max_mask, std::vector<bool>(n, false));
    
    // Инициализация: пути длины 1 (только одна вершина)
    for (int i = 0; i < n; ++i) {
        dp[1 << i][i] = true;
    }
    
    // Массив для восстановления пути: prev[mask][last] = предыдущая вершина
    std::vector<std::vector<int>> prev(max_mask, std::vector<int>(n, -1));
    
    // Перебор всех масок (подмножеств вершин)
    for (int mask = 1; mask < max_mask; ++mask) {
        for (int last = 0; last < n; ++last) {
            // Если last не входит в mask, пропускаем
            if (!(mask & (1 << last))) continue;
            
            // Если путь для этого mask и last уже существует
            if (dp[mask][last]) {
                // Пробуем добавить новую вершину
                int prev_mask = mask ^ (1 << last); // Убираем last из mask
                
                // Если mask содержит только одну вершину, путь уже инициализирован
                if (prev_mask == 0) continue;
                
                // Ищем, из какой вершины могли прийти в last
                for (int prev_vertex = 0; prev_vertex < n; ++prev_vertex) {
                    if (!(prev_mask & (1 << prev_vertex))) continue;
                    
                    // Проверяем, есть ли ребро между prev_vertex и last
                    if (adjacency[prev_vertex][last] && dp[prev_mask][prev_vertex]) {
                        dp[mask][last] = true;
                        prev[mask][last] = prev_vertex;
                        break;
                    }
                }
            }
        }
    }
    
    // Проверяем полную маску (все вершины)
    int full_mask = (1 << n) - 1;
    int end_vertex = -1;
    
    for (int i = 0; i < n; ++i) {
        if (dp[full_mask][i]) {
            end_vertex = i;
            break;
        }
    }
    
    // Формируем результат в JSON
    json result;
    
    if (end_vertex == -1) {
        result["success"] = false;
        result["message"] = "Гамильтонов путь не найден";
        result["path"] = json::array();
        result["is_cycle"] = false;
    } else {
        result["success"] = true;
        result["message"] = "Гамильтонов путь найден";
        
        // Восстанавливаем путь
        std::vector<int> path;
        int current_mask = full_mask;
        int current_vertex = end_vertex;
        
        while (current_vertex != -1) {
            path.push_back(current_vertex);
            int next_vertex = prev[current_mask][current_vertex];
            current_mask = current_mask ^ (1 << current_vertex);
            current_vertex = next_vertex;
        }
        
        // Путь восстанавливается с конца, переворачиваем
        std::reverse(path.begin(), path.end());
        
        result["path"] = path;
        result["path_length"] = path.size();
        
        // Проверяем, является ли путь циклом
        if (path.size() >= 2 && adjacency[path.back()][path.front()]) {
            result["is_cycle"] = true;
            result["message"] = "Гамильтонов цикл найден";
        } else {
            result["is_cycle"] = false;
        }
        
        // Добавляем информацию о ребрах пути
        json edges_array = json::array();
        for (size_t i = 0; i < path.size() - 1; ++i) {
            int from = path[i];
            int to = path[i + 1];
            double weight = graph.getEdgeWeight(from, to);
            
            edges_array.push_back({
                {"from", from},
                {"to", to},
                {"weight", weight}
            });
        }
        
        // Если это цикл, добавляем последнее ребро
        if (result["is_cycle"] && path.size() >= 2) {
            int from = path.back();
            int to = path.front();
            double weight = graph.getEdgeWeight(from, to);
            
            edges_array.push_back({
                {"from", from},
                {"to", to},
                {"weight", weight}
            });
        }
        
        result["edges"] = edges_array;
    }
    
    // Общая информация
    result["total_vertices"] = n;
    result["algorithm"] = "Hamiltonian Path Finder";
    result["complexity"] = "O(2^n * n^2)";
    
    // Статистика поиска
    int total_paths_found = 0;
    for (int i = 0; i < n; ++i) {
        if (dp[full_mask][i]) {
            total_paths_found++;
        }
    }
    result["total_hamiltonian_paths_found"] = total_paths_found;
    
    return result.dump(2);
}
