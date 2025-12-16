document.addEventListener('DOMContentLoaded', () => {
    const svg = document.getElementById('graph-svg');
    const graphElements = document.getElementById('graph-elements');
    const graphArea = document.querySelector('.graph-area');

    const addVertexBtn = document.getElementById('add-vertex-btn');
    const addEdgeBtn = document.getElementById('add-edge-btn');
    const deleteElementBtn = document.getElementById('delete-element-btn');
    const createRandomBtn = document.getElementById('create-random-btn');
    const createClassicBtn = document.getElementById('create-classic-btn');
    const selectAlgorithmBtn = document.getElementById('select-algorithm-btn');

    let viewBox = { x: 0, y: 0, width: 900, height: 600 };
    let isPanning = false;
    let startPanPoint = { x: 0, y: 0 };
    let currentPanOffset = { x: 0, y: 0 };

    let isDraggingNode = false;
    let draggedNode = null;
    let dragOffset = { x: 0, y: 0 };

    let selectedElement = null;
    let nextNodeId = 1;
    let mode = 'select'; // 'select', 'add-vertex', 'add-edge', 'delete'
    
    // Состояние активных кнопок
    let activeMode = null;

    const nodesData = new Map();
    const edgesData = new Map();
    let edgeIdCounter = 1;
    
    // Константы
    const NODE_RADIUS = 20;

    // Создаем модальное окно для ребра
    const edgeModal = document.createElement('div');
    edgeModal.className = 'modal';
    edgeModal.innerHTML = `
        <div class="modal-content">
            <h3>Добавить ребро</h3>
            <div class="form-group">
                <label>От вершины:</label>
                <select id="edge-from">
                    <option value="">Выберите вершину</option>
                </select>
            </div>
            <div class="form-group">
                <label>К вершине:</label>
                <select id="edge-to">
                    <option value="">Выберите вершину</option>
                </select>
            </div>
            <div class="form-group">
                <label>Вес (опционально):</label>
                <input type="number" id="edge-weight" placeholder="1" value="1" min="0">
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="edge-directed">
                    Направленное ребро
                </label>
            </div>
            <div class="modal-buttons">
                <button id="cancel-edge-btn">Отмена</button>
                <button id="confirm-edge-btn" class="primary">Подтвердить</button>
            </div>
        </div>
    `;
    document.body.appendChild(edgeModal);

    // Функция для обновления состояния кнопок
    function updateButtonStates() {
        // Сбрасываем все кнопки
        addVertexBtn.classList.remove('active');
        addEdgeBtn.classList.remove('active');
        deleteElementBtn.classList.remove('active');
        
        // Устанавливаем активную кнопку
        switch(activeMode) {
            case 'add-vertex':
                addVertexBtn.classList.add('active');
                graphArea.style.cursor = 'crosshair';
                break;
            case 'add-edge':
                addEdgeBtn.classList.add('active');
                graphArea.style.cursor = 'default';
                break;
            case 'delete':
                deleteElementBtn.classList.add('active');
                graphArea.style.cursor = 'not-allowed';
                break;
            default:
                graphArea.style.cursor = 'grab';
                break;
        }
    }

    // Функция для переключения режимов
    function toggleMode(newMode) {
        if (activeMode === newMode) {
            // Если нажали ту же кнопку - выключаем режим
            activeMode = null;
            mode = 'select';
        } else {
            // Включаем новый режим
            activeMode = newMode;
            mode = newMode;
            
            // Если включаем добавление ребра, сразу показываем модальное окно
            if (newMode === 'add-edge') {
                showEdgeModal();
            }
        }
        updateButtonStates();
    }

    // Инициализация существующих вершин
    function initializeExistingNodes() {
        const nodes = document.querySelectorAll('.node');
        let maxId = 0;
        
        nodes.forEach(nodeGroup => {
            const id = parseInt(nodeGroup.dataset.nodeId);
            if (id > maxId) maxId = id;
            const transform = nodeGroup.transform.baseVal.getItem(0);
            if (transform) {
                nodesData.set(id, {
                    x: transform.matrix.e,
                    y: transform.matrix.f,
                    element: nodeGroup
                });
            }
        });
        nextNodeId = maxId + 1;
    }

    // Функция для получения свободного ID вершины
    function getNextAvailableNodeId() {
        let id = 1;
        while (nodesData.has(id)) {
            id++;
        }
        // Обновляем nextNodeId если нашли пропуск
        if (id > nextNodeId) {
            nextNodeId = id + 1;
        }
        return id;
    }

    // Функция для обновления счетчика вершин
    function updateNextNodeId() {
        let maxId = 0;
        nodesData.forEach((node, id) => {
            if (id > maxId) maxId = id;
        });
        nextNodeId = maxId + 1;
    }

    function getSVGPoint(clientX, clientY) {
        const svgPoint = svg.createSVGPoint();
        svgPoint.x = clientX;
        svgPoint.y = clientY;
        return svgPoint.matrixTransform(svg.getScreenCTM().inverse());
    }

    function updateViewBox() {
        svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
        const currentScale = 900 / viewBox.width;
        graphArea.style.backgroundSize = `${20 * currentScale}px ${20 * currentScale}px`;
        graphArea.style.backgroundPosition = `${-viewBox.x * currentScale}px ${-viewBox.y * currentScale}px`;
    }

    function selectElement(element) {
        if (selectedElement) {
            selectedElement.classList.remove('selected');
        }
        selectedElement = element;
        if (selectedElement) {
            selectedElement.classList.add('selected');
        }
    }

    function createVertex(x, y) {
        const newId = getNextAvailableNodeId();
        
        const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        nodeGroup.setAttribute('class', 'node');
        nodeGroup.setAttribute('data-node-id', newId);
        nodeGroup.setAttribute('transform', `translate(${x}, ${y})`);

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '0');
        circle.setAttribute('cy', '0');
        circle.setAttribute('r', NODE_RADIUS);
        circle.setAttribute('fill', 'white');
        circle.setAttribute('stroke', 'black');
        circle.setAttribute('stroke-width', '2');

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '0');
        text.setAttribute('y', '5');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#333');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('font-size', '16');
        text.textContent = newId;

        nodeGroup.appendChild(circle);
        nodeGroup.appendChild(text);
        graphElements.appendChild(nodeGroup);

        nodesData.set(newId, { x, y, element: nodeGroup });
        selectElement(nodeGroup);
        
        return nodeGroup;
    }

    function deleteVertex(nodeId) {
        const nodeData = nodesData.get(nodeId);
        if (!nodeData) return;
        
        // Удаляем все связанные ребра
        edgesData.forEach((edge, edgeId) => {
            if (edge.from === nodeId || edge.to === nodeId) {
                edge.group.remove();  // Удаляем всю группу
                edgesData.delete(edgeId);
            }
        });
        
        // Удаляем вершину
        nodeData.element.remove();
        nodesData.delete(nodeId);
        updateNextNodeId();
        selectedElement = null;
    }

    function showEdgeModal() {
        const fromSelect = document.getElementById('edge-from');
        const toSelect = document.getElementById('edge-to');
        
        // Очищаем и заполняем опции
        fromSelect.innerHTML = '<option value="">Выберите вершину</option>';
        toSelect.innerHTML = '<option value="">Выберите вершину</option>';
        
        nodesData.forEach((node, id) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = id;
            fromSelect.appendChild(option.cloneNode(true));
            toSelect.appendChild(option);
        });
        
        edgeModal.style.display = 'flex';
    }

    // Функция для вычисления точки на границе вершины
    function getEdgePoint(fromX, fromY, toX, toY, fromRadius = NODE_RADIUS) {
        const dx = toX - fromX;
        const dy = toY - fromY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) return { x: fromX, y: fromY };
        
        const unitX = dx / distance;
        const unitY = dy / distance;
        
        return {
            x: fromX + unitX * fromRadius,
            y: fromY + unitY * fromRadius
        };
    }

    function addEdge(fromId, toId, weight = 1, directed = false) {
        const fromNode = nodesData.get(parseInt(fromId));
        const toNode = nodesData.get(parseInt(toId));
        
        if (!fromNode || !toNode || fromId === toId) {
            alert('Выберите разные существующие вершины!');
            return;
        }
        
        const edgeId = edgeIdCounter++;
        const edgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        edgeGroup.setAttribute('data-edge-id', edgeId);
        
        // Вычисляем точки начала и конца на границах вершин
        const startPoint = getEdgePoint(fromNode.x, fromNode.y, toNode.x, toNode.y, NODE_RADIUS);
        const endPoint = getEdgePoint(toNode.x, toNode.y, fromNode.x, fromNode.y, NODE_RADIUS);
        
        // Линия ребра
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', startPoint.x);
        line.setAttribute('y1', startPoint.y);
        line.setAttribute('x2', endPoint.x);
        line.setAttribute('y2', endPoint.y);
        line.setAttribute('stroke', '#666');
        line.setAttribute('stroke-width', '2');
        
        // Текст с весом
        let textElement = null;
        if (weight !== 1) {
            const midX = (startPoint.x + endPoint.x) / 2;
            const midY = (startPoint.y + endPoint.y) / 2;
            
            textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textElement.setAttribute('x', midX);
            textElement.setAttribute('y', midY - 10);
            textElement.setAttribute('text-anchor', 'middle');
            textElement.setAttribute('fill', '#d32f2f');
            textElement.setAttribute('font-weight', 'bold');
            textElement.setAttribute('font-size', '14');
            textElement.textContent = weight;
            edgeGroup.appendChild(textElement);
        }
        
        // Стрелка для направленного ребра
        let arrowElement = null;
        if (directed) {
            // Вычисляем угол направления ребра
            const dx = endPoint.x - startPoint.x;
            const dy = endPoint.y - startPoint.y;
            const angle = Math.atan2(dy, dx);
            const arrowLength = 12;
            
            // Стрелка начинается немного раньше конца линии
            const arrowStartX = endPoint.x - 8 * Math.cos(angle);
            const arrowStartY = endPoint.y - 8 * Math.sin(angle);
            
            arrowElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            arrowElement.setAttribute('d', 
                `M ${arrowStartX} ${arrowStartY} 
                 L ${arrowStartX - arrowLength * Math.cos(angle - Math.PI/6)} ${arrowStartY - arrowLength * Math.sin(angle - Math.PI/6)}
                 L ${arrowStartX - arrowLength * Math.cos(angle + Math.PI/6)} ${arrowStartY - arrowLength * Math.sin(angle + Math.PI/6)}
                 Z`
            );
            arrowElement.setAttribute('fill', '#666');
            edgeGroup.appendChild(arrowElement);
        }
        
        edgeGroup.appendChild(line);
        graphElements.appendChild(edgeGroup);
        
        // Сохраняем ВСЕ данные о ребре
        edgesData.set(edgeId, {
            from: parseInt(fromId),
            to: parseInt(toId),
            weight: weight,
            directed: directed,
            element: line,                 // Основная линия
            group: edgeGroup,              // Вся группа элементов
            text: textElement,             // Текст с весом
            arrow: arrowElement            // Стрелка
        });
        
        selectElement(line);
    }

    // Функция для обновления связанных ребер при перемещении вершины
    function updateConnectedEdges(nodeId, newX, newY) {
        edgesData.forEach((edge, edgeId) => {
            // Проверяем связана ли вершина с этим ребром
            if (edge.from === nodeId || edge.to === nodeId) {
                // Получаем все элементы ребра
                const line = edge.element;
                const text = edge.text;
                const arrow = edge.arrow;
                
                // Получаем данные о вершинах
                const fromNodeId = edge.from;
                const toNodeId = edge.to;
                const fromNode = nodesData.get(fromNodeId);
                const toNode = nodesData.get(toNodeId);
                
                if (!fromNode || !toNode) return;
                
                // Вычисляем новые точки начала и конца
                const startPoint = getEdgePoint(fromNode.x, fromNode.y, toNode.x, toNode.y, NODE_RADIUS);
                const endPoint = getEdgePoint(toNode.x, toNode.y, fromNode.x, fromNode.y, NODE_RADIUS);
                
                // Обновляем линию
                if (line) {
                    line.setAttribute('x1', startPoint.x);
                    line.setAttribute('y1', startPoint.y);
                    line.setAttribute('x2', endPoint.x);
                    line.setAttribute('y2', endPoint.y);
                }
                
                // Обновляем текст с весом
                if (text && edge.weight !== 1) {
                    const midX = (startPoint.x + endPoint.x) / 2;
                    const midY = (startPoint.y + endPoint.y) / 2;
                    text.setAttribute('x', midX);
                    text.setAttribute('y', midY - 10);
                }
                
                // Обновляем стрелку
                if (arrow && edge.directed) {
                    const dx = endPoint.x - startPoint.x;
                    const dy = endPoint.y - startPoint.y;
                    const angle = Math.atan2(dy, dx);
                    const arrowLength = 12;
                    
                    const arrowStartX = endPoint.x - 8 * Math.cos(angle);
                    const arrowStartY = endPoint.y - 8 * Math.sin(angle);
                    
                    arrow.setAttribute('d', 
                        `M ${arrowStartX} ${arrowStartY} 
                         L ${arrowStartX - arrowLength * Math.cos(angle - Math.PI/6)} ${arrowStartY - arrowLength * Math.sin(angle - Math.PI/6)}
                         L ${arrowStartX - arrowLength * Math.cos(angle + Math.PI/6)} ${arrowStartY - arrowLength * Math.sin(angle + Math.PI/6)}
                         Z`
                    );
                }
            }
        });
    }

    // Обработчики событий
    svg.addEventListener('wheel', (event) => {
        event.preventDefault();
        const zoomFactor = 1.1;
        const svgRect = svg.getBoundingClientRect();
        const svgMouseX = (event.clientX - svgRect.left) / svgRect.width * viewBox.width + viewBox.x;
        const svgMouseY = (event.clientY - svgRect.top) / svgRect.height * viewBox.height + viewBox.y;

        if (event.deltaY < 0) {
            viewBox.width /= zoomFactor;
            viewBox.height /= zoomFactor;
        } else {
            viewBox.width *= zoomFactor;
            viewBox.height *= zoomFactor;
        }

        viewBox.x = svgMouseX - (svgMouseX - viewBox.x) / zoomFactor;
        viewBox.y = svgMouseY - (svgMouseY - viewBox.y) / zoomFactor;
        updateViewBox();
    });

    graphArea.addEventListener('mousedown', (event) => {
        if (event.button === 0 && !isDraggingNode) {
            const svgPoint = getSVGPoint(event.clientX, event.clientY);
            
            if (activeMode === 'add-vertex') {
                // Добавляем вершину по клику
                createVertex(svgPoint.x, svgPoint.y);
                event.stopPropagation();
            } else if (activeMode === 'delete') {
                // Режим удаления - ничего не делаем здесь, удаление в graphElements
                event.stopPropagation();
            } else {
                // Режим панорамирования или выбора
                isPanning = true;
                graphArea.classList.add('panning');
                startPanPoint = { x: event.clientX, y: event.clientY };
                currentPanOffset = { x: viewBox.x, y: viewBox.y };
                selectElement(null);
            }
        }
    });

    document.addEventListener('mousemove', (event) => {
        if (isPanning) {
            const deltaX = event.clientX - startPanPoint.x;
            const deltaY = event.clientY - startPanPoint.y;
            const svgDeltaX = deltaX * (viewBox.width / svg.clientWidth);
            const svgDeltaY = deltaY * (viewBox.height / svg.clientHeight);
            viewBox.x = currentPanOffset.x - svgDeltaX;
            viewBox.y = currentPanOffset.y - svgDeltaY;
            updateViewBox();
        } else if (isDraggingNode) {
            event.preventDefault();
            const svgPoint = getSVGPoint(event.clientX, event.clientY);
            const newX = svgPoint.x - dragOffset.x;
            const newY = svgPoint.y - dragOffset.y;

            draggedNode.setAttribute('transform', `translate(${newX}, ${newY})`);

            const nodeId = parseInt(draggedNode.dataset.nodeId);
            if (nodesData.has(nodeId)) {
                const node = nodesData.get(nodeId);
                node.x = newX;
                node.y = newY;
                
                // Обновляем все связанные ребра
                updateConnectedEdges(nodeId, newX, newY);
            }
        }
    });

    document.addEventListener('mouseup', () => {
        isPanning = false;
        graphArea.classList.remove('panning');
        isDraggingNode = false;
        if (draggedNode) {
            draggedNode.classList.remove('dragging');
            draggedNode = null;
        }
    });

    graphElements.addEventListener('mousedown', (event) => {
        const target = event.target;
        const nodeGroup = target.closest('.node');

        if (nodeGroup && event.button === 0) {
            if (activeMode === 'delete') {
                // Режим удаления - удаляем вершину
                const nodeId = parseInt(nodeGroup.dataset.nodeId);
                deleteVertex(nodeId);
                event.stopPropagation();
            } else {
                // Режим перетаскивания или выбора
                isDraggingNode = true;
                draggedNode = nodeGroup;
                nodeGroup.classList.add('dragging');
                selectElement(nodeGroup);

                const transform = nodeGroup.transform.baseVal.getItem(0);
                const nodeX = transform ? transform.matrix.e : 0;
                const nodeY = transform ? transform.matrix.f : 0;

                const svgPoint = getSVGPoint(event.clientX, event.clientY);
                dragOffset = {
                    x: svgPoint.x - nodeX,
                    y: svgPoint.y - nodeY
                };
                event.stopPropagation();
            }
        } else if (target.tagName === 'line' || target.tagName === 'path' || target.tagName === 'text') {
            const edgeGroup = target.closest('g[data-edge-id]');
            if (edgeGroup) {
                if (activeMode === 'delete') {
                    // Режим удаления - удаляем ребро
                    const edgeId = parseInt(edgeGroup.dataset.edgeId);
                    if (edgesData.has(edgeId)) {
                        edgeGroup.remove();
                        edgesData.delete(edgeId);
                    }
                } else {
                    // Режим выбора - выделяем линию
                    const line = edgeGroup.querySelector('line');
                    if (line) {
                        selectElement(line);
                    }
                }
            }
        } else {
            selectElement(null);
        }
    });

    // Кнопки панели инструментов - теперь переключатели
    addVertexBtn.addEventListener('click', () => {
        toggleMode('add-vertex');
    });

    addEdgeBtn.addEventListener('click', () => {
        toggleMode('add-edge');
    });

    deleteElementBtn.addEventListener('click', () => {
        toggleMode('delete');
    });

    // Модальное окно ребра
    document.getElementById('cancel-edge-btn').addEventListener('click', () => {
        edgeModal.style.display = 'none';
        activeMode = null;
        mode = 'select';
        updateButtonStates();
    });

    document.getElementById('confirm-edge-btn').addEventListener('click', () => {
        const fromId = document.getElementById('edge-from').value;
        const toId = document.getElementById('edge-to').value;
        const weight = parseInt(document.getElementById('edge-weight').value) || 1;
        const directed = document.getElementById('edge-directed').checked;
        
        if (fromId && toId) {
            addEdge(fromId, toId, weight, directed);
            edgeModal.style.display = 'none';
            activeMode = null;
            mode = 'select';
            updateButtonStates();
        } else {
            alert('Выберите обе вершины!');
        }
    });

    // Заглушки для остальных кнопок
    createRandomBtn.addEventListener('click', () => {
        alert('Создание случайного графа - в разработке');
    });

    createClassicBtn.addEventListener('click', () => {
        alert('Создание классического графа - в разработке');
    });

    selectAlgorithmBtn.addEventListener('click', () => {
        alert('Выбор алгоритма - в разработке');
    });

    // Инициализация
    initializeExistingNodes();
    updateViewBox();
});
