cmake_minimum_required(VERSION 3.10)
project(ORGraphCore CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Добавляем путь к vendor для nlohmann/json
include_directories(include vendor)

# Найти Python3 и pybind11
find_package(Python3 COMPONENTS Development REQUIRED)
find_package(pybind11 REQUIRED)

# Опция для включения отладочного вывода
option(DEBUG_DIJKSTRA "Enable debug output for Dijkstra algorithm" OFF)
if(DEBUG_DIJKSTRA)
    add_definitions(-DDEBUG_DIJKSTRA)
    message(STATUS "Debug output for Dijkstra is enabled")
endif()

# --- 1. СБОРКА ОСНОВНОЙ БИБЛИОТЕКИ ---
set(LIB_SOURCES
    src/Graph.cpp
    src/algorithms/GraphGenerator.cpp
    src/algorithms/deijkstra_algorithm.cpp
    src/algorithms/prim_algorithm.cpp
    src/algorithms/ford_bellman_algorithm.cpp
    src/algorithms/floyd_algorithm.cpp
    src/algorithms/euler_path_algorithm.cpp
    src/algorithms/hamiltonian_path_algorithm.cpp
    src/algorithms/topology_sort.cpp
    src/representations/AdjacencyList.cpp
    src/representations/AdjacencyMatrix.cpp
)

# Создаем статическую библиотеку
add_library(orgraph STATIC ${LIB_SOURCES})
target_include_directories(orgraph PUBLIC include vendor)

# --- 2. СБОРКА PYTHON МОДУЛЯ ---
set(PYTHON_BINDINGS_SOURCES
    orgraph_bindings.cpp
    ${LIB_SOURCES}
)

pybind11_add_module(orgraph_core ${PYTHON_BINDINGS_SOURCES})

# Подключаем зависимости
target_link_libraries(orgraph_core PRIVATE orgraph)
target_include_directories(orgraph_core PRIVATE 
    ${Python3_INCLUDE_DIRS}
    include
    vendor
)

# --- 3. СБОРКА ТЕСТОВОГО ПРИЛОЖЕНИЯ ---
enable_testing()
add_executable(run_tests tests/test_graph.cpp)
target_link_libraries(run_tests PRIVATE orgraph)

# --- 4. СБОРКА ПРИМЕРА С ДЕЙКСТРОЙ ---
add_executable(test_dijkstra tests/test_dijkstra.cpp)
target_link_libraries(test_dijkstra PRIVATE orgraph)