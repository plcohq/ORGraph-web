#include "Graph.h"
#include "representations/AdjacencyList.h"   // Подключаем реализацию списка смежности
#include "representations/AdjacencyMatrix.h" // Подключаем реализацию матрицы смежности
#include "nlohmann/json.hpp"                 // Подключаем JSON-библиотеку

// Реализация конструктора.
Graph::Graph(RepresentationType type, bool is_directed) {
    // В зависимости от выбранного типа, создаем соответствующий
    // объект представления и сохраняем его в "умный" указатель.
    if (type == RepresentationType::ADJACENCY_LIST) {
        representation_ = std::make_unique<AdjacencyList>(is_directed);
    } else {
        representation_ = std::make_unique<AdjacencyMatrix>(is_directed);
    }
}

// Реализация добавления вершины.
int Graph::addVertex(const std::string& label) {
    // Генерируем новый уникальный ID.
    int id = next_vertex_id_++;
    // Создаем объект Vertex и добавляем его в наш вектор.
    vertices_.emplace_back(id, label);
    // Сообщаем текущему представлению, что нужно выделить место для новой вершины.
    representation_->resize(next_vertex_id_);
    // Возвращаем ID для дальнейшего использования.
    return id;
}

// Реализация добавления ребра.
bool Graph::addEdge(int from, int to, double weight) {
    // Эта операция полностью передается (делегируется) объекту представления.
    // Класс Graph не знает, как именно хранятся рёбра.
    return representation_->addEdge(from, to, weight);
}

// Реализация удаления ребра.
bool Graph::removeEdge(int from, int to) {
    // Делегируем операцию текущему представлению.
    return representation_->removeEdge(from, to);
}

// Реализация удаления вершины.
bool Graph::removeVertex(int id) {
    if (id >= next_vertex_id_ || id < 0 || vertices_[id].label == "[deleted]") {
        return false; // Вершины нет или уже удалена
    }
    
    // 1. Помечаем вершину как удаленную.
    vertices_[id].label = "[deleted]";
    
    // 2. Делегируем представлению задачу по очистке всех связанных рёбер.
    representation_->clearVertexConnections(id);
    
    return true;
}

// Реализация получения количества вершин.
int Graph::getVertexCount() const {
    return vertices_.size();
}

// Реализация получения количества рёбер.
int Graph::getEdgeCount() const {
    // Делегируем операцию текущему представлению.
    return representation_->getEdgeCount();
}

// Реализация получения степени вершины.
int Graph::getVertexDegree(int id) const {
    if (id >= getVertexCount() || id < 0 || vertices_[id].label == "[deleted]") {
        return -1;
    }
    // Делегируем операцию текущему представлению.
    return representation_->getVertexDegree(id);
}

// Реализация получения смежных вершин с данной
std::vector<int> Graph::getNeighborsVertex(int vertex_id) const {
    return representation_->getNeighbors(vertex_id); // ИЗМЕНИТЬ: getNeighborsVertex -> getNeighbors
}

// Реализация получения веса ребра между двумя вершинами
double Graph::getEdgeWeight(int from_vertex, int to_vertex) const { // ДОБАВЬТЕ const
    return representation_->getEdgeWeight(from_vertex, to_vertex);
}


// Реализация получения строкового представления.
std::string Graph::getRepresentationString() const {
    // Делегируем операцию текущему представлению.
    return representation_->getAsString();
}

// Реализация получения графа в виде JSON.
std::string Graph::getGraphAsJsonString() const {
    nlohmann::json j;

    // Собираем информацию о вершинах.
    j["vertices"] = nlohmann::json::array();
    for (const auto& vertex : vertices_) {
        if (vertex.label == "[deleted]") continue;
        j["vertices"].push_back({{"id", vertex.id}, {"label", vertex.label}});
    }
    
    // Делегируем представлению задачу по сбору информации о рёбрах.
    j["edges"] = representation_->getEdgesAsJson();

    return j.dump(2);
}
