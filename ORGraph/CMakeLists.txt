cmake_minimum_required(VERSION 3.10)
project(ORGraphCore CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Указываем, где искать заголовочные файлы
include_directories(include)

# --- 1. СБОРКА ОСНОВНОЙ БИБЛИОТЕКИ ---

# Собираем список исходников САМОЙ БИБЛИОТЕКИ (без тестов)
set(LIB_SOURCES
    src/Graph.cpp
    src/algorithms/GraphGenerator.cpp
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
# Теперь тесты могут использовать все классы и функции из библиотеки.
target_link_libraries(run_tests PRIVATE orgraph)
