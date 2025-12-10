#pragma once
#include <vector>
#include <string>
#include "Edge.h"
#include "nlohmann/json.hpp"

// "Контракт" (интерфейс) для всех представлений графа.
class IGraphRepresentation {
public:
    virtual ~IGraphRepresentation() = default; // Виртуальный деструктор
    virtual bool addEdge(int from, int to, double weight) = 0;
    virtual bool removeEdge(int from, int to) = 0;
    virtual int getEdgeCount() const = 0;
    virtual int getVertexDegree(int id) const = 0;
    virtual std::vector<int> getNeighbors(int vertex_id) const = 0;
    virtual double getEdgeWeight(int from, int to) const = 0;
    virtual std::string getAsString() const = 0; // Общий метод для получения строкового представления
    virtual void resize(int new_size) = 0; // Для добавления новых вершин
    virtual void clearVertexConnections(int vertex_id) = 0;
    virtual nlohmann::json getEdgesAsJson() const = 0;
};
