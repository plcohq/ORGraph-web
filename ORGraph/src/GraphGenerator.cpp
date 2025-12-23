#include "../include/GraphGenerator.h"
#include <random>   // Для качественного генератора случайных чисел
#include <vector>
#include <set>      // Для эффективной проверки на дубликаты рёбер
#include <utility>  // Для std::pair и std::swap

Graph generateRandomGraph(int numVertices, int numEdges, RepresentationType type, bool is_directed) {
    
    // Создаем граф, используя переданные параметры.
    Graph g(type, is_directed);

    if (numVertices <= 0) {
        return g;
    }

    // Добавляем все вершины
    for (int i = 0; i < numVertices; ++i) {
        g.addVertex("v" + std::to_string(i));
    }

    // Проверка на максимальное количество рёбер
    long long maxEdges = (long long)numVertices * (numVertices - 1) / 2;
    if (numEdges > maxEdges) {
        numEdges = maxEdges; // Ограничиваем сверху, если запрошено слишком много
    }

    // Настраиваем генератор случайных чисел
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> distrib(0, numVertices - 1);

    // Используем set, чтобы избежать дубликатов рёбер
    std::set<std::pair<int, int>> existingEdges;
    int edgesCreated = 0;

    while (edgesCreated < numEdges) {
        int u = distrib(gen);
        int v = distrib(gen);

        // Избегаем петель (u == v)
        if (u == v) {
            continue;
        }

        // Приводим пару к каноническому виду (min, max),
        // чтобы ребро (1, 2) и (2, 1) считались одним и тем же.
        if (u > v) {
            std::swap(u, v);
        }

        // Проверяем, не создавали ли мы уже такое ребро
        if (existingEdges.find({u, v}) == existingEdges.end()) {
            g.addEdge(u, v, 1.0); // Добавляем ребро с весом по умолчанию
            existingEdges.insert({u, v});
            edgesCreated++;
        }
    }

    return g;
}
