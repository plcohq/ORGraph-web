#include "representations/AdjacencyList.h"
#include <sstream>
#include <algorithm>
#include "nlohmann/json.hpp"

// Конструктор: инициализируем поля нашего класса
AdjacencyList::AdjacencyList(bool is_directed) : is_directed_(is_directed) {}

// Реализация изменения размера: просто меняем размер нашего списка смежности
void AdjacencyList::resize(int new_size) {
    adj_list_.resize(new_size);
}

// Реализация добавления ребра
bool AdjacencyList::addEdge(int from, int to, double weight) {
    if (from >= adj_list_.size() || to >= adj_list_.size() || from < 0 || to < 0) {
        return false;
    }
    adj_list_[from].push_back({to, weight});
    if (!is_directed_) {
        adj_list_[to].push_back({from, weight});
    }
    return true;
}

// Реализация удаления ребра
bool AdjacencyList::removeEdge(int from, int to) {
    if (from >= adj_list_.size() || to >= adj_list_.size() || from < 0 || to < 0) {
        return false;
    }

    auto& from_edges = adj_list_[from];
    auto it_from = std::remove_if(from_edges.begin(), from_edges.end(),
        [to](const Edge& edge) { return edge.target_id == to; });

    bool found = (it_from != from_edges.end());
    if (found) {
        from_edges.erase(it_from, from_edges.end());
    }

    if (!is_directed_) {
        auto& to_edges = adj_list_[to];
        auto it_to = std::remove_if(to_edges.begin(), to_edges.end(),
            [from](const Edge& edge) { return edge.target_id == from; });
        if (it_to != to_edges.end()) {
            to_edges.erase(it_to, to_edges.end());
            found = true;
        }
    }
    return found;
}

// Реализация получения количества рёбер
int AdjacencyList::getEdgeCount() const {
    int count = 0;
    for (const auto& edge_list : adj_list_) {
        count += edge_list.size();
    }
    return is_directed_ ? count : count / 2;
}

// Реализация получения степени вершины
int AdjacencyList::getVertexDegree(int id) const {
    if (id >= adj_list_.size() || id < 0) {
        return -1;
    }
    return adj_list_[id].size();
}

// Реализация получения смежных вершин с данной
std::vector<int> AdjacencyList::getNeighbors(int vertex_id) const {
    std::vector<int> neighbors;
    if (vertex_id >= adj_list_.size() || vertex_id < 0) {
        return neighbors; // Пустой вектор
    }
    const auto& edges = adj_list_[vertex_id];
    neighbors.reserve(edges.size());
    for (const auto& edge : edges) {
        neighbors.push_back(edge.target_id);
    }
    return neighbors;
}

// Реализация получения веса ребра между 2-мя вершинами
double AdjacencyList::getEdgeWeight(int from_vertex, int to_vertex) const {
    if (from_vertex >= adj_list_.size() 
	|| to_vertex >= adj_list_.size() 
	|| from_vertex < 0 
	|| to_vertex < 0)
        return -1.0; // Неверные вершины

    // Ищем ребро от from к to
    const auto& edges = adj_list_[from_vertex];
    for (const auto& edge : edges)
        if (edge.target_id == to_vertex)
            return edge.weight;

    return -1.0; // Ребро не найдено
}

// Реализация получения строкового представления
std::string AdjacencyList::getAsString() const {
    std::stringstream ss;
    ss << "--- Список смежности ---\n";
    for (int i = 0; i < adj_list_.size(); ++i) {
        ss << "Вершина " << i << " -> ";
        for (const auto& edge : adj_list_[i]) {
            ss << "[-> " << edge.target_id << " W:" << edge.weight << "] ";
        }
        ss << "\n";
    }
    return ss.str();
}

// Реализация очистки связей вершины
void AdjacencyList::clearVertexConnections(int vertex_id) {
    if (vertex_id >= adj_list_.size() || vertex_id < 0) return;
    adj_list_[vertex_id].clear();
    for (auto& edge_list : adj_list_) {
        auto it = std::remove_if(edge_list.begin(), edge_list.end(),
            [vertex_id](const Edge& edge) { return edge.target_id == vertex_id; });
        edge_list.erase(it, edge_list.end());
    }
}

// Реализация получения рёбер в виде JSON
nlohmann::json AdjacencyList::getEdgesAsJson() const {
    nlohmann::json edges_array = nlohmann::json::array();
    for (int i = 0; i < adj_list_.size(); ++i) {
        for (const auto& edge : adj_list_[i]) {
            if (!is_directed_ && i > edge.target_id) {
                continue;
            }
            edges_array.push_back({
                {"source", i}, {"target", edge.target_id}, {"weight", edge.weight}
            });
        }
    }
    return edges_array;
}
