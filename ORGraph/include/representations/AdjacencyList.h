#pragma once
#include "representations/IGraphRepresentation.h"

class AdjacencyList : public IGraphRepresentation {
private:
    std::vector<std::vector<Edge>> adj_list_;
    bool is_directed_;

public:
    AdjacencyList(bool is_directed);
    bool addEdge(int from, int to, double weight) override;
    bool removeEdge(int from, int to) override;
    int getEdgeCount() const override;
    int getVertexDegree(int id) const override;
    std::vector<int> getNeighbors(int vertex_id) const override;
    // УДАЛИТЕ ЭТУ СТРОКУ:
    // std::vector<int> getNeighborsVertex(int vertex_id) const override;
    double getEdgeWeight(int from_vertex, int to_vertex) const override;
    std::string getAsString() const override;
    void resize(int new_size) override;
    void clearVertexConnections(int vertex_id) override;
    nlohmann::json getEdgesAsJson() const override;
};
