#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <pybind11/functional.h>
#include "include/Graph.h"
#include "include/algorithms/deijkstra_algorithm.h"
#include "include/algorithms/prim_algorithm.h"
#include "include/algorithms/ford_bellman_algorithm.h"
#include "include/algorithms/floyd_algorithm.h" // Убрано
#include "include/algorithms/euler_path_algorithm.h"
#include "include/algorithms/hamiltonian_path_algorithm.h"
#include "include/algorithms/topology_sort.h"
#include "include/GraphGenerator.h"
#include <nlohmann/json.hpp>

namespace py = pybind11;
using json = nlohmann::json;

// Вспомогательная функция для преобразования JSON в Python dict
py::object json_to_py(const json& j) {
    if (j.is_null()) {
        return py::none();
    } else if (j.is_boolean()) {
        return py::bool_(j.get<bool>());
    } else if (j.is_number_integer()) {
        return py::int_(j.get<int64_t>());
    } else if (j.is_number_float()) {
        return py::float_(j.get<double>());
    } else if (j.is_string()) {
        return py::str(j.get<std::string>());
    } else if (j.is_array()) {
        py::list list;
        for (const auto& item : j) {
            list.append(json_to_py(item));
        }
        return list;
    } else if (j.is_object()) {
        py::dict dict;
        for (auto it = j.begin(); it != j.end(); ++it) {
            dict[py::str(it.key())] = json_to_py(it.value());
        }
        return dict;
    }
    return py::none();
}

// Обертка для Graph с Python-совместимым интерфейсом
class PyGraph {
private:
    Graph graph;
    bool is_directed;

public:
    PyGraph(const std::string& representation = "list", bool directed = false) 
        : graph((representation == "list") ? RepresentationType::ADJACENCY_LIST 
                                          : RepresentationType::ADJACENCY_MATRIX, 
                directed),
          is_directed(directed) {}

    int add_vertex(const std::string& label = "") {
        return graph.addVertex(label);
    }

    bool add_edge(int from, int to, double weight = 1.0) {
        return graph.addEdge(from, to, weight);
    }

    bool remove_edge(int from, int to) {
        return graph.removeEdge(from, to);
    }

    bool remove_vertex(int id) {
        return graph.removeVertex(id);
    }

    void clear() {
        // Создаем новый пустой граф с теми же параметрами
        *this = PyGraph();
    }

    int get_vertex_count() const {
        return graph.getVertexCount();
    }

    int get_edge_count() const {
        return graph.getEdgeCount();
    }

    std::vector<int> get_vertices() const {
        std::vector<int> vertices;
        for (int i = 0; i < graph.getVertexCount(); ++i) {
            vertices.push_back(i);
        }
        return vertices;
    }

    std::vector<std::tuple<int, int, double, bool>> get_edges() const {
        std::vector<std::tuple<int, int, double, bool>> edges;
        
        // Получаем JSON представление
        std::string json_str = graph.getGraphAsJsonString();
        json j = json::parse(json_str);
        
        if (j.contains("edges") && j["edges"].is_array()) {
            for (const auto& edge : j["edges"]) {
                int from = edge["source"];
                int to = edge["target"];
                double weight = edge["weight"];
                edges.emplace_back(from, to, weight, is_directed);
            }
        }
        
        return edges;
    }

    std::string get_adjacency_list() const {
        return graph.getRepresentationString();
    }

    std::vector<std::vector<double>> get_adjacency_matrix() const {
        int n = graph.getVertexCount();
        std::vector<std::vector<double>> matrix(n, std::vector<double>(n, 0.0));
        
        for (int i = 0; i < n; ++i) {
            for (int j = 0; j < n; ++j) {
                double weight = graph.getEdgeWeight(i, j);
                if (weight >= 0) {
                    matrix[i][j] = weight;
                }
            }
        }
        
        return matrix;
    }

    std::string to_json() const {
        return graph.getGraphAsJsonString();
    }

    // Алгоритмы
    py::object dijkstra(int start_vertex, int end_vertex) {
        std::string result = Deijkstra(graph, start_vertex, end_vertex);
        json j = json::parse(result);
        return json_to_py(j);
    }

    py::object prim() {
        std::string result = Prim(graph);
        json j = json::parse(result);
        return json_to_py(j);
    }

    py::object ford_bellman(int start_vertex) {
        std::string result = FordBellman(graph, start_vertex);
        json j = json::parse(result);
        return json_to_py(j);
    }

    py::object floyd_algorithm(int start_vertex, int end_vertex) {
        std::string result = FloydWarshall(graph, start_vertex, end_vertex);
        json j = json::parse(result);
        return json_to_py(j);
    }

    py::object find_eulerian_path() {
        std::string result = FindEulerPath(graph);
        json j = json::parse(result);
        return json_to_py(j);
    }

    py::object find_hamiltonian_path() {
        std::string result = FindHamiltonianPath(graph);
        json j = json::parse(result);
        return json_to_py(j);
    }

    py::object topological_sort() {
        std::string result = TopologicalSort(graph);
        json j = json::parse(result);
        return json_to_py(j);
    }

    bool is_connected() {
        // Простая реализация через DFS
        int n = graph.getVertexCount();
        if (n == 0) return true;
        
        std::vector<bool> visited(n, false);
        std::vector<int> stack = {0};
        
        while (!stack.empty()) {
            int current = stack.back();
            stack.pop_back();
            
            if (!visited[current]) {
                visited[current] = true;
                std::vector<int> neighbors = graph.getNeighborsVertex(current);
                for (int neighbor : neighbors) {
                    if (!visited[neighbor]) {
                        stack.push_back(neighbor);
                    }
                }
            }
        }
        
        for (bool v : visited) {
            if (!v) return false;
        }
        return true;
    }

    std::vector<std::vector<int>> find_components() {
        int n = graph.getVertexCount();
        std::vector<bool> visited(n, false);
        std::vector<std::vector<int>> components;
        
        for (int i = 0; i < n; ++i) {
            if (!visited[i]) {
                std::vector<int> component;
                std::vector<int> stack = {i};
                
                while (!stack.empty()) {
                    int current = stack.back();
                    stack.pop_back();
                    
                    if (!visited[current]) {
                        visited[current] = true;
                        component.push_back(current);
                        
                        std::vector<int> neighbors = graph.getNeighborsVertex(current);
                        for (int neighbor : neighbors) {
                            if (!visited[neighbor]) {
                                stack.push_back(neighbor);
                            }
                        }
                    }
                }
                
                if (!component.empty()) {
                    components.push_back(component);
                }
            }
        }
        
        return components;
    }

    bool is_bipartite() {
        int n = graph.getVertexCount();
        if (n == 0) return true;
        
        std::vector<int> color(n, -1); // -1: не посещена, 0/1: цвета
        std::vector<int> stack;
        
        for (int start = 0; start < n; ++start) {
            if (color[start] == -1) {
                color[start] = 0;
                stack.push_back(start);
                
                while (!stack.empty()) {
                    int current = stack.back();
                    stack.pop_back();
                    
                    std::vector<int> neighbors = graph.getNeighborsVertex(current);
                    for (int neighbor : neighbors) {
                        if (color[neighbor] == -1) {
                            color[neighbor] = 1 - color[current];
                            stack.push_back(neighbor);
                        } else if (color[neighbor] == color[current]) {
                            return false;
                        }
                    }
                }
            }
        }
        
        return true;
    }

    py::object minimum_spanning_tree() {
        return prim(); // Используем алгоритм Прима для MST
    }

    py::object dfs(int start_vertex) {
        int n = graph.getVertexCount();
        std::vector<bool> visited(n, false);
        std::vector<int> traversal_order;
        std::vector<int> stack = {start_vertex};
        
        while (!stack.empty()) {
            int current = stack.back();
            stack.pop_back();
            
            if (!visited[current]) {
                visited[current] = true;
                traversal_order.push_back(current);
                
                std::vector<int> neighbors = graph.getNeighborsVertex(current);
                // Для упорядоченного обхода добавляем в обратном порядке
                for (auto it = neighbors.rbegin(); it != neighbors.rend(); ++it) {
                    if (!visited[*it]) {
                        stack.push_back(*it);
                    }
                }
            }
        }
        
        json result = {
            {"traversal_order", traversal_order},
            {"visited_count", traversal_order.size()}
        };
        
        return json_to_py(result);
    }

    py::object bfs(int start_vertex) {
        int n = graph.getVertexCount();
        std::vector<bool> visited(n, false);
        std::vector<int> traversal_order;
        std::vector<int> queue = {start_vertex};
        
        while (!queue.empty()) {
            int current = queue.front();
            queue.erase(queue.begin());
            
            if (!visited[current]) {
                visited[current] = true;
                traversal_order.push_back(current);
                
                std::vector<int> neighbors = graph.getNeighborsVertex(current);
                for (int neighbor : neighbors) {
                    if (!visited[neighbor]) {
                        queue.push_back(neighbor);
                    }
                }
            }
        }
        
        json result = {
            {"traversal_order", traversal_order},
            {"visited_count", traversal_order.size()}
        };
        
        return json_to_py(result);
    }
};

PYBIND11_MODULE(orgraph_core, m) {
    m.doc() = "ORGraph C++ library Python bindings";

    py::class_<PyGraph>(m, "Graph")
        .def(py::init<const std::string&, bool>(),
             py::arg("representation") = "list",
             py::arg("is_directed") = false,
             "Create a new graph\n\n"
             "Args:\n"
             "    representation (str): 'list' for adjacency list or 'matrix' for adjacency matrix\n"
             "    is_directed (bool): whether the graph is directed")
        
        .def("add_vertex", &PyGraph::add_vertex,
             py::arg("label") = "",
             "Add a vertex to the graph\n\n"
             "Args:\n"
             "    label (str): vertex label\n"
             "Returns:\n"
             "    int: vertex ID")
        
        .def("add_edge", &PyGraph::add_edge,
             py::arg("from"), py::arg("to"), py::arg("weight") = 1.0,
             "Add an edge to the graph\n\n"
             "Args:\n"
             "    from (int): source vertex ID\n"
             "    to (int): target vertex ID\n"
             "    weight (float): edge weight\n"
             "Returns:\n"
             "    bool: True if edge was added successfully")
        
        .def("remove_edge", &PyGraph::remove_edge,
             py::arg("from"), py::arg("to"),
             "Remove an edge from the graph")
        
        .def("remove_vertex", &PyGraph::remove_vertex,
             py::arg("id"),
             "Remove a vertex from the graph")
        
        .def("clear", &PyGraph::clear,
             "Clear the graph (remove all vertices and edges)")
        
        .def("get_vertex_count", &PyGraph::get_vertex_count,
             "Get number of vertices")
        
        .def("get_edge_count", &PyGraph::get_edge_count,
             "Get number of edges")
        
        .def("get_vertices", &PyGraph::get_vertices,
             "Get list of all vertex IDs")
        
        .def("get_edges", &PyGraph::get_edges,
             "Get list of all edges as tuples (from, to, weight, directed)")
        
        .def("get_adjacency_list", &PyGraph::get_adjacency_list,
             "Get adjacency list as string")
        
        .def("get_adjacency_matrix", &PyGraph::get_adjacency_matrix,
             "Get adjacency matrix as 2D list")
        
        .def("to_json", &PyGraph::to_json,
             "Get graph as JSON string")
        
        // Алгоритмы
        .def("dijkstra", &PyGraph::dijkstra,
             py::arg("start_vertex"), py::arg("end_vertex"),
             "Run Dijkstra's algorithm")
        
        .def("prim", &PyGraph::prim,
             "Run Prim's algorithm for MST")
        
        .def("ford_bellman", &PyGraph::ford_bellman,
             py::arg("start_vertex"),
             "Run Ford-Bellman algorithm")
        
        .def("floyd_algorithm", &PyGraph::floyd_algorithm,
             py::arg("start_vertex"), py::arg("end_vertex"),
             "Run Floyd-Warshall algorithm")
        
        .def("find_eulerian_path", &PyGraph::find_eulerian_path,
             "Find Eulerian path")
        
        .def("find_hamiltonian_path", &PyGraph::find_hamiltonian_path,
             "Find Hamiltonian path")
        
        .def("topological_sort", &PyGraph::topological_sort,
             "Topological sort")
        
        .def("is_connected", &PyGraph::is_connected,
             "Check if graph is connected")
        
        .def("find_components", &PyGraph::find_components,
             "Find connected components")
        
        .def("is_bipartite", &PyGraph::is_bipartite,
             "Check if graph is bipartite")
        
        .def("minimum_spanning_tree", &PyGraph::minimum_spanning_tree,
             "Find minimum spanning tree")
        
        .def("dfs", &PyGraph::dfs,
             py::arg("start_vertex"),
             "Depth-first search")
        
        .def("bfs", &PyGraph::bfs,
             py::arg("start_vertex"),
             "Breadth-first search");

    // Функции-генераторы
    m.def("generate_random_graph", [](int num_vertices, int num_edges, 
                                      const std::string& representation, 
                                      bool is_directed) {
        
        RepresentationType type = (representation == "list") 
            ? RepresentationType::ADJACENCY_LIST 
            : RepresentationType::ADJACENCY_MATRIX;
        
        Graph g = generateRandomGraph(num_vertices, num_edges, type, is_directed);
        
        // Создаем PyGraph и копируем данные
        PyGraph py_graph(representation, is_directed);
        
        // Добавляем вершины
        for (int i = 0; i < num_vertices; ++i) {
            py_graph.add_vertex("v" + std::to_string(i));
        }
        
        // Копируем ребра из сгенерированного графа
        std::string json_str = g.getGraphAsJsonString();
        json j = json::parse(json_str);
        
        if (j.contains("edges") && j["edges"].is_array()) {
            for (const auto& edge : j["edges"]) {
                int from = edge["source"];
                int to = edge["target"];
                double weight = edge["weight"];
                py_graph.add_edge(from, to, weight);
            }
        }
        
        return py_graph;
        
    }, py::arg("num_vertices"), py::arg("num_edges"),
       py::arg("representation") = "list",
       py::arg("is_directed") = false,
       "Generate a random graph");
}
