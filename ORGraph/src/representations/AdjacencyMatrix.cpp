#include "representations/AdjacencyMatrix.h"
#include <sstream>
#include <iomanip>
#include "nlohmann/json.hpp"

AdjacencyMatrix::AdjacencyMatrix(bool is_directed) : is_directed_(is_directed) {}

void AdjacencyMatrix::resize(int new_size) {
    matrix_.resize(new_size);
    for (auto& row : matrix_) {
        row.resize(new_size, 0.0);
    }
}

bool AdjacencyMatrix::addEdge(int from, int to, double weight) {
    // ИСПРАВЛЕНО: явное приведение типов для устранения предупреждений
    if (static_cast<size_t>(from) >= matrix_.size() || 
        static_cast<size_t>(to) >= matrix_.size() || 
        from < 0 || to < 0) {
        return false;
    }
    matrix_[from][to] = weight;
    if (!is_directed_) {
        matrix_[to][from] = weight;
    }
    return true;
}

bool AdjacencyMatrix::removeEdge(int from, int to) {
    // ИСПРАВЛЕНО: явное приведение типов
    if (static_cast<size_t>(from) >= matrix_.size() || 
        static_cast<size_t>(to) >= matrix_.size() || 
        from < 0 || to < 0 || 
        matrix_[from][to] == 0.0) {
        return false;
    }
    matrix_[from][to] = 0.0;
    if (!is_directed_) {
        matrix_[to][from] = 0.0;
    }
    return true;
}

int AdjacencyMatrix::getEdgeCount() const {
    int count = 0;
    for (const auto& row : matrix_) {
        for (double val : row) {
            if (val != 0.0) {
                count++;
            }
        }
    }
    return is_directed_ ? count : count / 2;
}

int AdjacencyMatrix::getVertexDegree(int id) const {
    // ИСПРАВЛЕНО: явное приведение типов
    if (static_cast<size_t>(id) >= matrix_.size() || id < 0) {
        return -1;
    }
    int degree = 0;
    for (double val : matrix_[id]) {
        if (val != 0.0) {
            degree++;
        }
    }
    return degree;
}

std::vector<int> AdjacencyMatrix::getNeighbors(int vertex_id) const {
    std::vector<int> neighbors;
    // ИСПРАВЛЕНО: явное приведение типов
    if (static_cast<size_t>(vertex_id) >= matrix_.size() || vertex_id < 0)
        return neighbors;

    const auto& row = matrix_[vertex_id];
    // ИСПРАВЛЕНО: использование size_t для индекса
    for (size_t i = 0; i < row.size(); ++i) {
        if (row[i] > 0) { // Если есть ребро (положительный вес)
            neighbors.push_back(static_cast<int>(i));
        }
    }
    
    return neighbors;
}

// ИСПРАВЛЕННЫЙ метод getEdgeWeight
double AdjacencyMatrix::getEdgeWeight(int from_vertex, int to_vertex) const {
    // ИСПРАВЛЕНО: явное приведение типов
    if (static_cast<size_t>(from_vertex) >= matrix_.size() ||
        static_cast<size_t>(to_vertex) >= matrix_[0].size() ||
        from_vertex < 0 ||
        to_vertex < 0) {
        return -1.0;
    }
    
    // ИСПРАВЛЕНО: используем правильные имена переменных
    double weight = matrix_[from_vertex][to_vertex];
    if (weight > 0)  // Исправлено с >= 0 на > 0 для согласованности
        return weight;
    
    return -1.0;
}

std::string AdjacencyMatrix::getAsString() const {
    std::stringstream ss;
    ss << "--- Матрица смежности ---\n";
    for (const auto& row : matrix_) {
        for (double val : row) {
            ss << std::fixed << std::setprecision(1) << val << "  ";
        }
        ss << "\n";
    }
    return ss.str();
}

void AdjacencyMatrix::clearVertexConnections(int vertex_id) {
    // ИСПРАВЛЕНО: явное приведение типов
    if (static_cast<size_t>(vertex_id) >= matrix_.size() || vertex_id < 0) return;
    for (size_t j = 0; j < matrix_.size(); ++j) {
        matrix_[vertex_id][j] = 0.0;
    }
    for (size_t i = 0; i < matrix_.size(); ++i) {
        matrix_[i][vertex_id] = 0.0;
    }
}

nlohmann::json AdjacencyMatrix::getEdgesAsJson() const {
    nlohmann::json edges_array = nlohmann::json::array();
    for (size_t i = 0; i < matrix_.size(); ++i) {
        for (size_t j = 0; j < matrix_[i].size(); ++j) {
            if (matrix_[i][j] != 0.0) {
                if (!is_directed_ && i > j) {
                    continue;
                }
                edges_array.push_back({
                    {"source", static_cast<int>(i)}, 
                    {"target", static_cast<int>(j)}, 
                    {"weight", matrix_[i][j]}
                });
            }
        }
    }
    return edges_array;
}
