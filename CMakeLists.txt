cmake_minimum_required(VERSION 3.12)
project(ORGraph)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Pybind11
find_package(pybind11 REQUIRED)
find_package(nlohmann_json REQUIRED)

# Include directories (include ТОЛЬКО в ORGraph)
include_directories(
    ${PROJECT_SOURCE_DIR}/ORGraph/include
    ${PROJECT_SOURCE_DIR}/ORGraph
)

# Source files
set(SOURCES
    ORGraph/src/Graph.cpp
    ORGraph/orgraph_bindings.cpp

    ORGraph/src/algorithms/deijkstra_algorithm.cpp
    ORGraph/src/algorithms/prim_algorithm.cpp
    ORGraph/src/algorithms/ford_bellman_algorithm.cpp
    ORGraph/src/algorithms/floyd_algorithm.cpp
    ORGraph/src/algorithms/euler_path_algorithm.cpp
    ORGraph/src/algorithms/hamiltonian_path_algorithm.cpp
    ORGraph/src/algorithms/topology_sort.cpp

    ORGraph/src/GraphGenerator.cpp
    ORGraph/src/representations/AdjacencyList.cpp
    ORGraph/src/representations/AdjacencyMatrix.cpp
)

# Build python module
pybind11_add_module(orgraph_core ${SOURCES})

target_link_libraries(orgraph_core PRIVATE
    nlohmann_json::nlohmann_json
)

# Убираем лишние символы из .so
set_target_properties(orgraph_core PROPERTIES
    CXX_VISIBILITY_PRESET hidden
    VISIBILITY_INLINES_HIDDEN ON
)

