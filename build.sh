#!/usr/bin/env bash
set -e

BUILD_DIR=build
OUTPUT_DIR=web_interface/server
MODULE_NAME=orgraph_core

echo "▶ Cleaning old build..."
rm -rf ${BUILD_DIR}

mkdir -p ${BUILD_DIR}
cd ${BUILD_DIR}

echo "▶ Configuring..."
cmake .. -DCMAKE_BUILD_TYPE=Release

echo "▶ Building..."
cmake --build . -j$(nproc)

echo "▶ Copying module..."
mkdir -p ../${OUTPUT_DIR}

# Ищем файл .so, созданный сборкой
# Сначала пробуем точное имя, затем шаблон
if [ -f "${MODULE_NAME}.so" ]; then
    cp "${MODULE_NAME}.so" "../${OUTPUT_DIR}/"
elif [ -f "lib${MODULE_NAME}.so" ]; then
    cp "lib${MODULE_NAME}.so" "../${OUTPUT_DIR}/${MODULE_NAME}.so"
else
    # Если файл имеет другое имя, переименовываем его
    for so_file in *.so; do
        if [ -f "$so_file" ]; then
            cp "$so_file" "../${OUTPUT_DIR}/${MODULE_NAME}.so"
            echo "⚠  Файл $so_file переименован в ${MODULE_NAME}.so"
            break
        fi
    done
fi

echo "✅ Done! Library is in ${OUTPUT_DIR}/${MODULE_NAME}.so"
