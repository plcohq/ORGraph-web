cmake_minimum_required(VERSION 3.10)
project(ORGraphCore CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Указываем, где искать заголовочные файлы
include_directories(include)

# Опция для включения отладочного вывода
option(DEBUG_DIJKSTRA "Enable debug output for Dijkstra algorithm" OFF)
if(DEBUG_DIJKSTRA)
    add_definitions(-DDEBUG_DIJKSTRA)
    message(STATUS "Debug output for Dijkstra is enabled")
endif()

# --- 1. СБОРКА ОСНОВНОЙ БИБЛИОТЕКИ ---

# Собираем список исходников САМОЙ БИБЛИОТЕКИ (без тестов)
set(LIB_SOURCES
    src/Graph.cpp
    src/algorithms/GraphGenerator.cpp
    src/algorithms/deijkstra_algorithm.cpp  # ДОБАВЛЯЕМ АЛГОРИТМ ДЕЙКСТРЫ
    src/representations/AdjacencyList.cpp
    src/representations/AdjacencyMatrix.cpp
)

# Создаем библиотеку (статическую) с именем "orgraph" из этих исходников
add_library(orgraph STATIC ${LIB_SOURCES})

# Делаем так, чтобы другие части проекта могли легко подключать заголовки
target_include_directories(orgraph PUBLIC include)

# --- 2. СБОРКА ТЕСТОВОГО ПРИЛОЖЕНИЯ ---

# Включаем возможность тестирования
enable_testing()

# Создаем исполняемый файл для тестов
add_executable(run_tests tests/test_graph.cpp)

# САМОЕ ВАЖНОЕ: "Прилинковываем" нашу библиотеку к тестам.
target_link_libraries(run_tests PRIVATE orgraph)

# --- 3. СБОРКА ПРИМЕРА С ДЕЙКСТРОЙ (ДОПОЛНИТЕЛЬНО) ---

# Создаем отдельный исполняемый файл для теста Дейкстры
add_executable(test_dijkstra tests/test_dijkstra.cpp)
target_link_libraries(test_dijkstra PRIVATE orgraph)
