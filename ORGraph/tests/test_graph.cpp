// --- Файл: src/main.cpp (ПОЛНЫЙ КОД) ---

#include <iostream>
#include <string>
#include "Graph.h" // Подключаем наш основной класс
#include "GraphGenerator.h" // Подключаем генератор случайных графов

// Вспомогательная функция для печати красивого заголовка
void print_header(const std::string& title) {
    std::cout << "\n\n======================================================\n";
    std::cout << "    " << title << "\n";
    std::cout << "======================================================\n";
}

// Комплексный тест, который будет запускаться для разных типов графов
void run_comprehensive_test(Graph& g, const std::string& graph_type) {
    std::cout << "\n--- СОЗДАНИЕ И НАПОЛНЕНИЕ ГРАФА (" << graph_type << ") ---\n";
    int idA = g.addVertex("A");
    int idB = g.addVertex("B");
    int idC = g.addVertex("C");
    int idD = g.addVertex("D");
    
    g.addEdge(idA, idB, 7.0);
    g.addEdge(idB, idC, 2.0);
    g.addEdge(idA, idC, 4.0);
    g.addEdge(idC, idD, 1.0);

    std::cout << "\n--- 1. ПРОВЕРКА ИСХОДНОГО СОСТОЯНИЯ ---\n";
    std::cout << "Количество вершин: " << g.getVertexCount() << std::endl;
    std::cout << "Количество рёбер: " << g.getEdgeCount() << std::endl;
    std::cout << "Степень вершины C (ID " << idC << "): " << g.getVertexDegree(idC) << std::endl;
    
    std::cout << "\n--- Представление в виде строки: ---\n";
    std::cout << g.getRepresentationString();
    
    std::cout << "\n--- Представление в виде JSON: ---\n";
    std::cout << g.getGraphAsJsonString() << std::endl;

    std::cout << "\n--- 2. ПРОВЕРКА УДАЛЕНИЯ РЕБРА ---\n";
    std::cout << "Удаляем ребро между A(" << idA << ") и C(" << idC << ")... ";
    if (g.removeEdge(idA, idC)) {
        std::cout << "Успешно!\n";
    } else {
        std::cout << "Не удалось!\n";
    }
    std::cout << "Новое количество рёбер: " << g.getEdgeCount() << std::endl;

    std::cout << "\n--- 3. ПРОВЕРКА УДАЛЕНИЯ ВЕРШИНЫ ---\n";
    std::cout << "Удаляем вершину B(" << idB << ")... ";
    if (g.removeVertex(idB)) {
        std::cout << "Успешно!\n";
    } else {
        std::cout << "Не удалось!\n";
    }
    std::cout << "Новое количество рёбер: " << g.getEdgeCount() << std::endl;

    std::cout << "\n--- 4. ПРОВЕРКА КОНЕЧНОГО СОСТОЯНИЯ ---\n";
    std::cout << "Степень вершины C (ID " << idC << "): " << g.getVertexDegree(idC) << std::endl;
    std::cout << "\n--- Финальное представление в виде JSON: ---\n";
    std::cout << g.getGraphAsJsonString() << std::endl;
    
    std::cout << "\n--- 5. ПРОВЕРКА ОБРАБОТКИ ОШИБОК ---\n";
    int degree_of_B = g.getVertexDegree(idB);
    if (degree_of_B == -1) {
        std::cout << "Тест: Попытка получить степень удаленной вершины B вернула ошибку (-1), как и ожидалось." << std::endl;
    }
}


int main() {
    // ТЕСТ 1: Неориентированный граф на списке смежности
    print_header("Тест 1: Неориентированный, Список смежности");
    Graph graph_list_undirected(RepresentationType::ADJACENCY_LIST, false);
    run_comprehensive_test(graph_list_undirected, "Неориентированный, Список");

    // ТЕСТ 2: Ориентированный граф на списке смежности
    print_header("Тест 2: Ориентированный, Список смежности");
    Graph graph_list_directed(RepresentationType::ADJACENCY_LIST, true);
    run_comprehensive_test(graph_list_directed, "Ориентированный, Список");

    // ТЕСТ 3: Неориентированный граф на матрице смежности
    print_header("Тест 3: Неориентированный, Матрица смежности");
    Graph graph_matrix_undirected(RepresentationType::ADJACENCY_MATRIX, false);
    run_comprehensive_test(graph_matrix_undirected, "Неориентированный, Матрица");
    
    // ТЕСТ 4: Генератор случайных графов
    print_header("Тест 4: Генератор случайных графов");
    int numVertices = 50;
    int numEdges = 100;
    std::cout << "Генерируем случайный неориентированный граф (список смежности)...\n";
    // Теперь мы можем вызывать его так, и он будет использовать значения по умолчанию
    Graph randomGraph = generateRandomGraph(numVertices, numEdges); 
    std::cout << "Результат:\n";
    std::cout << "  Фактическое количество вершин: " << randomGraph.getVertexCount() << std::endl;
    std::cout << "  Фактическое количество рёбер: " << randomGraph.getEdgeCount() << std::endl;

    return 0;
}
