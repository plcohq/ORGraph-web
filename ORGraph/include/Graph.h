#pragma once

#include <vector>
#include <string>
#include <memory> // Необходимо для std::unique_ptr, "умного" указателя
#include "Vertex.h"
#include "representations/IGraphRepresentation.h" // Подключаем наш "контракт"

// Перечисление (enum class) для удобного и безопасного выбора
// типа внутреннего представления графа при его создании.
enum class RepresentationType {
    ADJACENCY_LIST,
    ADJACENCY_MATRIX
};

// Класс Graph действует как "менеджер" или "фасад".
// Он предоставляет пользователю удобный интерфейс для работы с графом,
// при этом скрывая сложные детали внутреннего хранения рёбер.
class Graph {
private:
    // Вектор для хранения всех объектов вершин.
    // Это общий компонент для любого представления.
    std::vector<Vertex> vertices_;

    // "Умный" указатель на объект представления (список или матрица).
    // std::unique_ptr автоматически управляет памятью, освобождая ее,
    // когда объект Graph уничтожается. Это предотвращает утечки памяти.
    std::unique_ptr<IGraphRepresentation> representation_;

    // Счетчик для генерации уникальных ID для новых вершин.
    int next_vertex_id_ = 0;

public:
    // Конструктор. Принимает тип представления и флаг направленности.
    // По умолчанию граф создается неориентированным.
    Graph(RepresentationType type, bool is_directed = false);

    // Добавляет новую вершину в граф.
    // Принимает строковую метку, возвращает уникальный ID созданной вершины.
    int addVertex(const std::string& label);

    // Добавляет ребро между двумя вершинами.
    // Делегирует эту операцию текущему объекту представления.
    // Возвращает true в случае успеха.
    bool addEdge(int from, int to, double weight = 1.0);

    // Удаляет ребро между двумя вершинами.
    // Делегирует операцию текущему представлению.
    bool removeEdge(int from, int to);
    
    // Удаляет вершину из графа, помечая ее как неактивную.
    bool removeVertex(int id);
    
    // Возвращает текущее количество вершин в графе.
    int getVertexCount() const;

    // Возвращает количество рёбер. Делегирует вызов представлению.
    int getEdgeCount() const;

    // Возвращает степень вершины. Делегирует вызов представлению.
    int getVertexDegree(int id) const;

    // Возвращает список вершин, смежных с данной
    std::vector<int> getNeighborsVertex(int vertex_id) const;

    // Возвращает вес ребра между двумя указанными вершинами
    double getEdgeWeight(int from_vertex, int to_vertex) const;

    // Возвращает строковое представление графа (список или матрицу).
    // Вызывает соответствующий метод у объекта представления.
    std::string getRepresentationString() const;
    
    // Возвращает граф в виде JSON-строки для использования на веб-сайте.
    std::string getGraphAsJsonString() const;
};
