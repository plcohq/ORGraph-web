#!/bin/bash

find . -type d -empty -exec touch {}/.gitkeep \;

echo "# Project Structure" > README.md
echo "build/\n*.o\n*.so\n*.a" > .gitignore

echo "✅ Project structure created!"
