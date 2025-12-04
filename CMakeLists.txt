cmake_minimum_required(VERSION 3.12)
project(ORGraph)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find pybind11
find_package(pybind11 REQUIRED)

# Include directories
include_directories(include)

# Source files
set(SOURCES
    src/Graph.cpp
    src/algorithms/algorithms.cpp
    src/utils/utils.cpp
)

# Create a shared library
pybind11_add_module(orgraph_core ${SOURCES})

# Install the module
install(TARGETS orgraph_core DESTINATION .)
