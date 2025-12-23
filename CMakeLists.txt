cmake_minimum_required(VERSION 3.12)
project(ORGraph)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find pybind11
find_package(pybind11 REQUIRED)
find_package(nlohmann_json REQUIRED)

# Добавьте все необходимые пути
include_directories(
    ${PROJECT_SOURCE_DIR}/ORGraph/include
    ${PROJECT_SOURCE_DIR}/include
    ${PROJECT_SOURCE_DIR}
    ${pybind11_INCLUDE_DIRS}
)

# Source files
set(SOURCES
    ${PROJECT_SOURCE_DIR}/ORGraph/src/Graph.cpp
    ${PROJECT_SOURCE_DIR}/ORGraph/orgraph_bindings.cpp
    
    # Добавляем исходники алгоритмов
    ${PROJECT_SOURCE_DIR}/ORGraph/src/algorithms/deijkstra_algorithm.cpp
    ${PROJECT_SOURCE_DIR}/ORGraph/src/algorithms/prim_algorithm.cpp
    ${PROJECT_SOURCE_DIR}/ORGraph/src/algorithms/ford_bellman_algorithm.cpp
    # ${PROJECT_SOURCE_DIR}/ORGraph/src/algorithms/floyd_algorithm.cpp  # Если нужен позже
    ${PROJECT_SOURCE_DIR}/ORGraph/src/algorithms/euler_path_algorithm.cpp
    ${PROJECT_SOURCE_DIR}/ORGraph/src/algorithms/hamiltonian_path_algorithm.cpp
    ${PROJECT_SOURCE_DIR}/ORGraph/src/algorithms/topology_sort.cpp
    ${PROJECT_SOURCE_DIR}/ORGraph/src/GraphGenerator.cpp
)

# Create a shared library - ВАЖНО: ЭТО ДОЛЖНО БЫТЬ ДО target_link_libraries
pybind11_add_module(orgraph_core ${SOURCES})

# Link libraries - ЭТО ПОСЛЕ pybind11_add_module
target_link_libraries(orgraph_core PRIVATE
    nlohmann_json::nlohmann_json
    ${pybind11_LIBRARIES}
)

# Optional: Set properties
set_target_properties(orgraph_core PROPERTIES
    CXX_VISIBILITY_PRESET hidden
    VISIBILITY_INLINES_HIDDEN ON
)

# Install the module
install(TARGETS orgraph_core DESTINATION .)

# Установка заголовочных файлов, если нужно
file(GLOB ALGORITHM_HEADERS "ORGraph/include/algorithms/*.h")
if(ALGORITHM_HEADERS)
    install(FILES ${ALGORITHM_HEADERS} DESTINATION include/algorithms)
endif()
