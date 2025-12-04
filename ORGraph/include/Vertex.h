#pragma once // Защита от двойного включения
#include <string>

class Vertex {
public:
    int id;
    std::string label;

    Vertex(int vertex_id, const std::string& vertex_label)
        : id(vertex_id), label(vertex_label) {}
};
