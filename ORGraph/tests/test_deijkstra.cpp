#include <iostream>
#include "Graph.h"
#include "algorithms/deijkstra_algorithm.h"

void testDijkstraBasic() {
    std::cout << "=== Тест Дейкстры: Простой граф ===" << std::endl;
    
    // Создаем неориентированный граф
    Graph graph(RepresentationType::ADJACENCY_LIST, false);
    
    // Добавляем вершины
    int a = graph.addVertex("A");
    int b = graph.addVertex("B");
    int c = graph.addVertex("C");
    int d = graph.addVertex("D");
    
    std::cout << "Вершины: A=" << a << ", B=" << b 
              << ", C=" << c << ", D=" << d << std::endl;
    
    // Добавляем ребра (простой граф)
    graph.addEdge(a, b, 1.0);  // A - B: 1
    graph.addEdge(b, c, 2.0);  // B - C: 2
    graph.addEdge(a, c, 4.0);  // A - C: 4
    graph.addEdge(c, d, 1.0);  // C - D: 1
    
    std::cout << "Граф создан. Ребер: " << graph.getEdgeCount() << std::endl;
    
    // Тестируем соседей
    std::cout << "\nПроверка соседей:" << std::endl;
    auto neighbors = graph.getNeighbors(a);
    std::cout << "Соседи A: ";
    for (int n : neighbors) std::cout << n << " ";
    std::cout << std::endl;
    
    // Тестируем веса
    std::cout << "\nПроверка весов:" << std::endl;
    std::cout << "Вес A-B: " << graph.getEdgeWeight(a, b) << std::endl;
    std::cout << "Вес B-A: " << graph.getEdgeWeight(b, a) << std::endl;  // Должен быть тот же
    std::cout << "Вес A-C: " << graph.getEdgeWeight(a, c) << std::endl;
    
    // Запускаем Дейкстру
    std::cout << "\nЗапуск Дейкстры (A -> D):" << std::endl;
    std::string result = Deijkstra(graph, a, d);
    std::cout << "Результат:\n" << result << std::endl;
    
    // Другой путь
    std::cout << "\nЗапуск Дейкстры (A -> C):" << std::endl;
    result = Deijkstra(graph, a, c);
    std::cout << "Результат:\n" << result << std::endl;
}

void testDijkstraDirected() {
    std::cout << "\n=== Тест Дейкстры: Ориентированный граф ===" << std::endl;
    
    // Создаем ориентированный граф
    Graph graph(RepresentationType::ADJACENCY_LIST, true);
    
    int a = graph.addVertex("A");
    int b = graph.addVertex("B");
    int c = graph.addVertex("C");
    
    graph.addEdge(a, b, 1.0);  // A -> B
    graph.addEdge(b, c, 2.0);  // B -> C
    // Нет ребра A -> C напрямую
    
    std::cout << "Запуск Дейкстры (A -> C):" << std::endl;
    std::string result = Deijkstra(graph, a, c);
    std::cout << "Результат:\n" << result << std::endl;
    
    // Обратный путь не должен существовать
    std::cout << "\nЗапуск Дейкстры (C -> A):" << std::endl;
    result = Deijkstra(graph, c, a);
    std::cout << "Результат:\n" << result << std::endl;
}

void testDijkstraErrors() {
    std::cout << "\n=== Тест Дейкстры: Обработка ошибок ===" << std::endl;
    
    Graph graph(RepresentationType::ADJACENCY_LIST, false);
    int a = graph.addVertex("A");
    int b = graph.addVertex("B");
    
    // Несуществующая вершина
    std::cout << "Тест с несуществующей вершиной (0 -> 5):" << std::endl;
    std::string result = Deijkstra(graph, 0, 5);
    std::cout << "Результат:\n" << result << std::endl;
    
    // Нет пути
    graph.addVertex("C");  // Вершина C не соединена
    std::cout << "\nТест без пути (A -> C):" << std::endl;
    result = Deijkstra(graph, a, 2);
    std::cout << "Результат:\n" << result << std::endl;
}

int main() {
    std::cout << "=== ТЕСТИРОВАНИЕ АЛГОРИТМА ДЕЙКСТРЫ ===\n" << std::endl;
    
    try {
        testDijkstraBasic();
        testDijkstraDirected();
        testDijkstraErrors();
        
        std::cout << "\n=== ВСЕ ТЕСТЫ ЗАВЕРШЕНЫ ===" << std::endl;
    } catch (const std::exception& e) {
        std::cerr << "ОШИБКА: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}
