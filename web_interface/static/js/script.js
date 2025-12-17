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

    let selectedElement = null; // Выделенный элемент (вершина или ребро)
    let nextNodeId = 1;
    let mode = 'select'; // 'select', 'add-vertex', 'add-edge', 'delete'
    
    // Состояние активных кнопок панели инструментов
    let activeMode = null; // 'add-vertex', 'add-edge', 'delete', null

    const nodesData = new Map(); // Хранит {x, y, element: nodeGroup}
    const edgesData = new Map(); // Хранит {from, to, weight, directed, element: line, group: edgeGroup, text: textElement, arrow: arrowElement}
    let edgeIdCounter = 1;
    
    // Константы
    const NODE_RADIUS = 20;

    // --- Новые переменные для интерактивного создания ребер ---
    let firstSelectedNodeForEdge = null; // ID первой выбранной вершины для создания ребра
    let firstSelectedNodeElement = null; // SVG элемент первой выбранной вершины
    let editingEdgeId = null; // ID ребра, которое сейчас редактируется через модальное окно
    // -----------------------------------------------------------

    // --- Система Undo/Redo ---
    let undoStack = []; // Стек для отмены действий
    let redoStack = []; // Стек для повтора действий
    const MAX_HISTORY = 50; // Максимальное количество сохраняемых действий
    
    // Создаем кнопки Undo/Redo в правом верхнем углу
    const createUndoRedoButtons = () => {
        const undoRedoContainer = document.createElement('div');
        undoRedoContainer.className = 'undo-redo-container';
        undoRedoContainer.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            display: flex;
            gap: 10px;
            z-index: 100;
        `;
        
        const undoBtn = document.createElement('button');
        undoBtn.id = 'undo-btn';
        undoBtn.className = 'undo-redo-btn';
        undoBtn.innerHTML = '↶ Отменить';
        undoBtn.disabled = true;
        undoBtn.style.cssText = `
            padding: 8px 15px;
            background-color: #5c6bc0;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-family: 'Roboto', sans-serif;
            opacity: 0.7;
            transition: all 0.2s;
        `;
        
        const redoBtn = document.createElement('button');
        redoBtn.id = 'redo-btn';
        redoBtn.className = 'undo-redo-btn';
        redoBtn.innerHTML = '↷ Вернуть';
        redoBtn.disabled = true;
        redoBtn.style.cssText = `
            padding: 8px 15px;
            background-color: #66bb6a;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-family: 'Roboto', sans-serif;
            opacity: 0.7;
            transition: all 0.2s;
        `;
        
        undoRedoContainer.appendChild(undoBtn);
        undoRedoContainer.appendChild(redoBtn);
        document.querySelector('.container').appendChild(undoRedoContainer);
        
        // Обработчики событий для кнопок
        undoBtn.addEventListener('click', () => undo());
        redoBtn.addEventListener('click', () => redo());
        
        // Добавляем стили при наведении
        undoBtn.addEventListener('mouseenter', () => {
            if (!undoBtn.disabled) {
                undoBtn.style.opacity = '1';
                undoBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
            }
        });
        
        undoBtn.addEventListener('mouseleave', () => {
            undoBtn.style.opacity = '0.7';
            undoBtn.style.boxShadow = 'none';
        });
        
        redoBtn.addEventListener('mouseenter', () => {
            if (!redoBtn.disabled) {
                redoBtn.style.opacity = '1';
                redoBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
            }
        });
        
        redoBtn.addEventListener('mouseleave', () => {
            redoBtn.style.opacity = '0.7';
            redoBtn.style.boxShadow = 'none';
        });
        
        return { undoBtn, redoBtn };
    };
    
    const { undoBtn, redoBtn } = createUndoRedoButtons();
    
    // Обновление состояния кнопок Undo/Redo
    const updateUndoRedoButtons = () => {
        undoBtn.disabled = undoStack.length === 0;
        redoBtn.disabled = redoStack.length === 0;
        
        undoBtn.style.opacity = undoStack.length === 0 ? '0.5' : '0.7';
        redoBtn.style.opacity = redoStack.length === 0 ? '0.5' : '0.7';
        
        undoBtn.style.cursor = undoStack.length === 0 ? 'not-allowed' : 'pointer';
        redoBtn.style.cursor = redoStack.length === 0 ? 'not-allowed' : 'pointer';
    };
    
    // Функция для сохранения состояния графа
    const saveState = (actionType, data = null) => {
        // Сохраняем текущее состояние графа
        const state = {
            nodes: new Map(nodesData),
            edges: new Map(edgesData),
            nextNodeId,
            edgeIdCounter,
            actionType,
            data, // Дополнительные данные о действии
            timestamp: Date.now()
        };
        
        // Сохраняем глубокие копии объектов
        state.nodes = new Map();
        nodesData.forEach((node, id) => {
            state.nodes.set(id, {
                x: node.x,
                y: node.y,
                element: node.element // Это ссылка, но она будет пересоздана при восстановлении
            });
        });
        
        state.edges = new Map();
        edgesData.forEach((edge, id) => {
            state.edges.set(id, {
                from: edge.from,
                to: edge.to,
                weight: edge.weight,
                directed: edge.directed,
                element: edge.element,
                group: edge.group,
                text: edge.text,
                arrow: edge.arrow
            });
        });
        
        undoStack.push(state);
        
        // Ограничиваем размер стека
        if (undoStack.length > MAX_HISTORY) {
            undoStack.shift();
        }
        
        // При новом действии очищаем стек redo
        redoStack.length = 0;
        
        updateUndoRedoButtons();
    };
    
    // Функция для восстановления состояния графа
    const restoreState = (state) => {
        // Очищаем текущий граф
        graphElements.innerHTML = '';
        nodesData.clear();
        edgesData.clear();
        
        // Восстанавливаем вершины
        state.nodes.forEach((nodeData, id) => {
            const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            nodeGroup.setAttribute('class', 'node');
            nodeGroup.setAttribute('data-node-id', id);
            nodeGroup.setAttribute('transform', `translate(${nodeData.x}, ${nodeData.y})`);
    
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
            text.textContent = id;
    
            nodeGroup.appendChild(circle);
            nodeGroup.appendChild(text);
            graphElements.appendChild(nodeGroup);
    
            nodesData.set(id, { x: nodeData.x, y: nodeData.y, element: nodeGroup });
        });
        
        // Восстанавливаем ребра
        state.edges.forEach((edgeData, id) => {
            const edgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            edgeGroup.setAttribute('data-edge-id', id);
            
            let lineElement;
            if (edgeData.from === edgeData.to) {
                // Петля
                lineElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                lineElement.setAttribute('stroke', '#666');
                lineElement.setAttribute('stroke-width', '2');
                lineElement.setAttribute('fill', 'none');
            } else {
                // Обычное ребро
                lineElement = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                lineElement.setAttribute('stroke', '#666');
                lineElement.setAttribute('stroke-width', '2');
            }
            
            edgeGroup.appendChild(lineElement);
            graphElements.appendChild(edgeGroup);
            
            // Сохраняем данные ребра
            edgesData.set(id, {
                from: edgeData.from,
                to: edgeData.to,
                weight: edgeData.weight,
                directed: edgeData.directed,
                element: lineElement,
                group: edgeGroup,
                text: null,
                arrow: null
            });
            
            // Обновляем визуализацию ребра
            updateEdgeVisuals(id);
        });
        
        // Восстанавливаем счетчики
        nextNodeId = state.nextNodeId;
        edgeIdCounter = state.edgeIdCounter;
        
        // Сбрасываем выделение
        selectedElement = null;
        firstSelectedNodeForEdge = null;
        firstSelectedNodeElement = null;
    };
    
    // Функция отмены действия
    const undo = () => {
        if (undoStack.length === 0) return;
        
        const currentState = {
            nodes: new Map(nodesData),
            edges: new Map(edgesData),
            nextNodeId,
            edgeIdCounter
        };
        
        // Сохраняем текущее состояние в стек redo
        redoStack.push(currentState);
        
        // Восстанавливаем предыдущее состояние
        const prevState = undoStack.pop();
        restoreState(prevState);
        
        updateUndoRedoButtons();
    };
    
    // Функция повторения действия
    const redo = () => {
        if (redoStack.length === 0) return;
        
        const currentState = {
            nodes: new Map(nodesData),
            edges: new Map(edgesData),
            nextNodeId,
            edgeIdCounter
        };
        
        // Сохраняем текущее состояние в стек undo
        undoStack.push(currentState);
        
        // Восстанавливаем состояние из redo
        const nextState = redoStack.pop();
        restoreState(nextState);
        
        updateUndoRedoButtons();
    };
    
    // Обработка горячих клавиш
    document.addEventListener('keydown', (event) => {
        // Ctrl+Z для отмены
        if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
            event.preventDefault();
            if (!event.shiftKey) {
                undo();
            }
        }
        
        // Ctrl+Y или Ctrl+Shift+Z для повтора
        if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
            event.preventDefault();
            redo();
        }
    });

    // --- Создаем модальное окно для РЕДАКТИРОВАНИЯ ребра (динамически) ---
    const editEdgeModal = document.createElement('div');
    editEdgeModal.className = 'modal';
    editEdgeModal.innerHTML = `
        <div class="modal-content">
            <h3>Изменить ребро</h3>
            <div class="form-group">
                <label>Вес:</label>
                <input type="number" id="edit-edge-weight" placeholder="1" value="1" min="0">
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="edit-edge-directed">
                    Направленное ребро
                </label>
            </div>
            <div class="modal-buttons">
                <button id="cancel-edit-edge-btn">Отмена</button>
                <button id="confirm-edit-edge-btn" class="primary">Применить</button>
            </div>
        </div>
    `;
    document.body.appendChild(editEdgeModal);

    // --- Модальное окно для ГЕНЕРАЦИИ случайного графа ---
    const randomGraphModal = document.createElement('div');
    randomGraphModal.className = 'modal';
    randomGraphModal.innerHTML = `
        <div class="modal-content">
            <h3>Создать случайный граф</h3>
            <div class="form-group">
                <label for="random-nodes">Количество вершин:</label>
                <input type="number" id="random-nodes" value="5" min="2">
            </div>
            <div class="form-group">
                <label for="random-edges">Количество рёбер:</label>
                <input type="number" id="random-edges" value="5" min="0">
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="random-directed">
                    Направленный
                </label>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="random-weighted">
                    Взвешенный (случайный вес 1-10)
                </label>
            </div>
            <div class="modal-buttons">
                <button id="cancel-random-btn">Отмена</button>
                <button id="confirm-random-btn" class="primary">Создать</button>
            </div>
        </div>
    `;
    document.body.appendChild(randomGraphModal);

    // --- Модальное окно для ГЕНЕРАЦИИ классического графа (заглушка) ---
    const classicGraphModal = document.createElement('div');
    classicGraphModal.className = 'modal';
    classicGraphModal.innerHTML = `
        <div class="modal-content">
            <h3>Создать классический граф</h3>
            <div class="form-group">
                <label for="classic-nodes">Количество вершин:</label>
                <input type="number" id="classic-nodes" value="5" min="2">
            </div>
            <div class="form-group">
                <label for="classic-type">Тип графа:</label>
                <select id="classic-type">
                    <option value="complete">Полный (K_n)</option>
                    <option value="cycle">Цикл (C_n)</option>
                    <option value="path">Путь (P_n)</option>
                </select>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="classic-directed">
                    Направленный
                </label>
            </div>
            <div class="modal-buttons">
                <button id="cancel-classic-btn">Отмена</button>
                <button id="confirm-classic-btn" class="primary">Создать</button>
            </div>
        </div>
    `;
    document.body.appendChild(classicGraphModal);

    // Функция для обновления состояния кнопок и курсора
    function updateButtonStates() {
        // Сбрасываем все кнопки
        addVertexBtn.classList.remove('active');
        addEdgeBtn.classList.remove('active');
        deleteElementBtn.classList.remove('active');
        
        // Сбрасываем все классы курсоров
        graphArea.classList.remove('add-vertex-mode', 'add-edge-mode', 'delete-mode');

        // Устанавливаем активную кнопку и курсор
        switch(activeMode) {
            case 'add-vertex':
                addVertexBtn.classList.add('active');
                graphArea.classList.add('add-vertex-mode');
                break;
            case 'add-edge':
                addEdgeBtn.classList.add('active');
                graphArea.classList.add('add-edge-mode');
                break;
            case 'delete':
                deleteElementBtn.classList.add('active');
                graphArea.classList.add('delete-mode');
                break;
            default:
                graphArea.style.cursor = 'grab'; // Режим по умолчанию
                break;
        }
    }

    // Функция для переключения режимов
    function toggleMode(newMode) {
        // Очищаем состояние выбора ребра при смене режима
        if (firstSelectedNodeElement) {
            firstSelectedNodeElement.classList.remove('edge-start-node');
            firstSelectedNodeElement = null;
        }
        firstSelectedNodeForEdge = null;

        if (activeMode === newMode) {
            // Если нажали ту же кнопку - выключаем режим
            activeMode = null;
            mode = 'select';
        } else {
            // Включаем новый режим
            activeMode = newMode;
            mode = newMode;
        }
        selectElement(null); // Сбрасываем выделение при смене режима
        updateButtonStates();
    }

    // Инициализация существующих вершин (если они были бы в HTML изначально)
    function initializeExistingNodes() {
        // В данном случае, мы начинаем с пустого SVG, так что это не нужно
        // Но если бы были статические элементы, логика была бы тут
        nextNodeId = 1;
        edgeIdCounter = 1;
    }

    // Функция для получения свободного ID вершины
    function getNextAvailableNodeId() {
        let id = 1;
        while (nodesData.has(id)) {
            id++;
        }
        return id;
    }

    // Функция для обновления счетчика вершин (после удаления)
    function updateNextNodeId() {
        // Это может быть дорогостоящая операция, лучше просто использовать `getNextAvailableNodeId`
        // когда нужно, или поддерживать счетчик свободных ID
    }

    function getSVGPoint(clientX, clientY) {
        const svgPoint = svg.createSVGPoint();
        svgPoint.x = clientX;
        svgPoint.y = clientY;
        return svgPoint.matrixTransform(svg.getScreenCTM().inverse());
    }

    function updateViewBox() {
        svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
        const currentScale = 900 / viewBox.width; // Расчет масштаба для фона сетки
        graphArea.style.backgroundSize = `${20 * currentScale}px ${20 * currentScale}px`;
        graphArea.style.backgroundPosition = `${(-viewBox.x * currentScale) % (20 * currentScale)}px ${(-viewBox.y * currentScale) % (20 * currentScale)}px`;
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
        // Сохраняем состояние перед созданием вершины
        const prevState = {
            nodes: new Map(nodesData),
            edges: new Map(edgesData),
            nextNodeId,
            edgeIdCounter,
            actionType: 'before-create-vertex'
        };
        
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
        
        // Сохраняем действие в историю
        saveState('create-vertex', { id: newId, x, y });
        
        return nodeGroup;
    }

    function deleteVertex(nodeId) {
        const nodeData = nodesData.get(nodeId);
        if (!nodeData) return;
        
        // Сохраняем состояние перед удалением
        const vertexData = {
            id: nodeId,
            x: nodeData.x,
            y: nodeData.y
        };
        
        // Сохраняем данные о связанных ребрах
        const connectedEdges = [];
        edgesData.forEach((edge, edgeId) => {
            if (edge.from === nodeId || edge.to === nodeId) {
                connectedEdges.push({
                    id: edgeId,
                    from: edge.from,
                    to: edge.to,
                    weight: edge.weight,
                    directed: edge.directed
                });
            }
        });
        
        // Удаляем все связанные ребра
        const edgesToDelete = [];
        edgesData.forEach((edge, edgeId) => {
            if (edge.from === nodeId || edge.to === nodeId) {
                edgesToDelete.push(edgeId);
            }
        });

        edgesToDelete.forEach(edgeId => {
            const edge = edgesData.get(edgeId);
            if (edge && edge.group) {
                edge.group.remove();
                edgesData.delete(edgeId);
            }
        });
        
        // Удаляем вершину
        nodeData.element.remove();
        nodesData.delete(nodeId);
        selectElement(null); // Снимаем выделение
        
        // Сохраняем действие в историю
        saveState('delete-vertex', { 
            vertex: vertexData, 
            connectedEdges: connectedEdges 
        });
    }

    // Функция для вычисления точки на границе вершины
    function getEdgePoint(fromX, fromY, toX, toY, fromRadius = NODE_RADIUS) {
        const dx = toX - fromX;
        const dy = toY - fromY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) return { x: fromX, y: fromY }; // Защита от деления на ноль
        
        const unitX = dx / distance;
        const unitY = dy / distance;
        
        return {
            x: fromX + unitX * fromRadius,
            y: fromY + unitY * fromRadius
        };
    }

    // Функция для создания/обновления визуальных элементов ребра (линия, текст, стрелка)
    function updateEdgeVisuals(edgeId) {
        const edge = edgesData.get(edgeId);
        if (!edge) return;

        const fromNode = nodesData.get(edge.from);
        if (!fromNode) return;

        // Для петель - особый случай
        if (edge.from === edge.to) {
            // Координаты для петли (дуга над вершиной)
            const loopRadius = NODE_RADIUS * 1.5;
            const loopStartX = fromNode.x - NODE_RADIUS;
            const loopStartY = fromNode.y - NODE_RADIUS * 0.5;
            const loopEndX = fromNode.x + NODE_RADIUS;
            const loopEndY = fromNode.y - NODE_RADIUS * 0.5;
            
            // Для петель используем path вместо line
            if (edge.element && edge.element.tagName === 'line') {
                // Заменяем line на path для петли
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('stroke', '#666');
                path.setAttribute('stroke-width', '2');
                path.setAttribute('fill', 'none');
                
                // Удаляем старую линию
                edge.element.remove();
                edge.element = path;
                edge.group.appendChild(path);
            }
            
            // Создаем дугу для петли
            const path = edge.element;
            const d = `M ${loopStartX} ${loopStartY} 
                       Q ${fromNode.x} ${fromNode.y - loopRadius * 2}, ${loopEndX} ${loopEndY}`;
            path.setAttribute('d', d);
            
            // Обновляем текст с весом для петли
            if (edge.weight !== 1) {
                if (!edge.text) {
                    edge.text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    edge.text.setAttribute('text-anchor', 'middle');
                    edge.text.setAttribute('fill', '#d32f2f');
                    edge.text.setAttribute('font-weight', 'bold');
                    edge.text.setAttribute('font-size', '14');
                    edge.group.appendChild(edge.text);
                }
                const textX = fromNode.x;
                const textY = fromNode.y - loopRadius * 1.5;
                edge.text.setAttribute('x', textX);
                edge.text.setAttribute('y', textY);
                edge.text.textContent = edge.weight;
            } else if (edge.text) {
                edge.text.remove();
                edge.text = null;
            }
            
            // Стрелка для направленной петли
            if (edge.directed) {
                if (!edge.arrow) {
                    edge.arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    edge.arrow.setAttribute('fill', '#666');
                    edge.group.appendChild(edge.arrow);
                }
                // Стрелка в конце петли
                const arrowX = fromNode.x + NODE_RADIUS;
                const arrowY = fromNode.y - NODE_RADIUS * 0.5;
                const angle = Math.PI * 0.75; // Направление стрелки
                
                const arrowLength = 10;
                edge.arrow.setAttribute('d', 
                    `M ${arrowX} ${arrowY} 
                     L ${arrowX - arrowLength * Math.cos(angle - Math.PI/6)} ${arrowY - arrowLength * Math.sin(angle - Math.PI/6)}
                     L ${arrowX - arrowLength * Math.cos(angle + Math.PI/6)} ${arrowY - arrowLength * Math.sin(angle + Math.PI/6)}
                     Z`
                );
            } else if (edge.arrow) {
                edge.arrow.remove();
                edge.arrow = null;
            }
            
            return; // Выходим раньше для петель
        }

        // Обычные ребра
        const toNode = nodesData.get(edge.to);
        if (!toNode) return;

        // Вычисляем точки начала и конца на границах вершин
        const startPoint = getEdgePoint(fromNode.x, fromNode.y, toNode.x, toNode.y, NODE_RADIUS);
        const endPoint = getEdgePoint(toNode.x, toNode.y, fromNode.x, fromNode.y, NODE_RADIUS);

        // Для обычных ребер убедимся, что это line
        if (edge.element && edge.element.tagName !== 'line') {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('stroke', '#666');
            line.setAttribute('stroke-width', '2');
            
            // Заменяем старый элемент
            if (edge.element) edge.element.remove();
            edge.element = line;
            edge.group.appendChild(line);
        }
        
        // Обновляем линию
        if (edge.element) {
            edge.element.setAttribute('x1', startPoint.x);
            edge.element.setAttribute('y1', startPoint.y);
            edge.element.setAttribute('x2', endPoint.x);
            edge.element.setAttribute('y2', endPoint.y);
        }
        
        // Обновляем текст с весом
        if (edge.weight !== 1) {
            if (!edge.text) {
                edge.text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                edge.text.setAttribute('text-anchor', 'middle');
                edge.text.setAttribute('fill', '#d32f2f');
                edge.text.setAttribute('font-weight', 'bold');
                edge.text.setAttribute('font-size', '14');
                edge.group.appendChild(edge.text);
            }
            const midX = (startPoint.x + endPoint.x) / 2;
            const midY = (startPoint.y + endPoint.y) / 2;
            edge.text.setAttribute('x', midX);
            edge.text.setAttribute('y', midY - 10);
            edge.text.textContent = edge.weight;
        } else if (edge.text) {
            edge.text.remove();
            edge.text = null;
        }
        
        // Обновляем стрелку для направленного ребра
        if (edge.directed) {
            if (!edge.arrow) {
                edge.arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                edge.arrow.setAttribute('fill', '#666');
                edge.group.appendChild(edge.arrow);
            }
            const dx = endPoint.x - startPoint.x;
            const dy = endPoint.y - startPoint.y;
            const angle = Math.atan2(dy, dx);
            const arrowLength = 12;
            const arrowOffset = NODE_RADIUS + 3;
            
            const arrowStartX = toNode.x - arrowOffset * Math.cos(angle);
            const arrowStartY = toNode.y - arrowOffset * Math.sin(angle);
            
            edge.arrow.setAttribute('d', 
                `M ${arrowStartX} ${arrowStartY} 
                 L ${arrowStartX - arrowLength * Math.cos(angle - Math.PI/6)} ${arrowStartY - arrowLength * Math.sin(angle - Math.PI/6)}
                 L ${arrowStartX - arrowLength * Math.cos(angle + Math.PI/6)} ${arrowStartY - arrowLength * Math.sin(angle + Math.PI/6)}
                 Z`
            );
        } else if (edge.arrow) {
            if (edge.arrow.parentNode) {
                edge.arrow.remove();
            }
            edge.arrow = null;
        }
    }

    function addEdge(fromId, toId, weight = 1, directed = false) {
        const fromNode = nodesData.get(parseInt(fromId));
        const toNode = (fromId !== toId) ? nodesData.get(parseInt(toId)) : fromNode;
        
        if (!fromNode) {
            alert('Невозможно создать ребро для несуществующей вершины!');
            return;
        }
        
        // Разрешаем создание петли (fromId === toId)
        if (fromId === toId) {
            // Проверяем, существует ли уже петля в этой вершине
            let loopExists = false;
            edgesData.forEach(edge => {
                if (edge.from === fromId && edge.to === fromId) {
                    loopExists = true;
                }
            });
            
            if (loopExists) {
                alert('Петля в этой вершине уже существует!');
                return;
            }
        } else {
            // Для обычных ребер проверяем существование (для ненаправленных A-B == B-A)
            let exists = false;
            edgesData.forEach(edge => {
                if (directed) {
                    if (edge.from === fromId && edge.to === toId) {
                        exists = true;
                    }
                } else {
                    if ((edge.from === fromId && edge.to === toId) || (edge.from === toId && edge.to === fromId)) {
                        exists = true;
                    }
                }
            });
            if (exists) {
                // alert('Такое ребро уже существует!'); // Можно оставить или убрать
                return;
            }
        }

        const edgeId = edgeIdCounter++;
        const edgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        edgeGroup.setAttribute('data-edge-id', edgeId);
        
        // Создаем элемент в зависимости от типа ребра
        let lineElement;
        if (fromId === toId) {
            // Для петель используем path
            lineElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            lineElement.setAttribute('stroke', '#666');
            lineElement.setAttribute('stroke-width', '2');
            lineElement.setAttribute('fill', 'none');
        } else {
            // Для обычных ребер используем line
            lineElement = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            lineElement.setAttribute('stroke', '#666');
            lineElement.setAttribute('stroke-width', '2');
        }
        
        edgeGroup.appendChild(lineElement); // Добавляем элемент в группу
        graphElements.appendChild(edgeGroup);
        
        // Сохраняем ВСЕ данные о ребре
        edgesData.set(edgeId, {
            from: parseInt(fromId),
            to: parseInt(toId),
            weight: weight,
            directed: directed,
            element: lineElement,       // Основная линия или path
            group: edgeGroup,           // Вся группа элементов
            text: null,                 // Текст с весом (будет создан/обновлен в updateEdgeVisuals)
            arrow: null                 // Стрелка (будет создана/обновлена в updateEdgeVisuals)
        });
        
        // Обновляем визуальные элементы после добавления данных
        updateEdgeVisuals(edgeId);
        selectElement(lineElement);
        
        // Сохраняем действие в историю
        saveState('create-edge', { 
            id: edgeId, 
            from: parseInt(fromId), 
            to: parseInt(toId), 
            weight, 
            directed 
        });
        
        return edgeId;
    }

    // Функция для обновления связанных ребер при перемещении вершины
    function updateConnectedEdges(nodeId) {
        edgesData.forEach((edge, edgeId) => {
            if (edge.from === nodeId || edge.to === nodeId) {
                updateEdgeVisuals(edgeId);
            }
        });
    }

    function showEditEdgeModal(edgeId) {
        editingEdgeId = edgeId;
        const edge = edgesData.get(edgeId);
        if (!edge) return;

        // Заполняем поля модального окна текущими значениями ребра
        document.getElementById('edit-edge-weight').value = edge.weight;
        document.getElementById('edit-edge-directed').checked = edge.directed;
        editEdgeModal.style.display = 'flex';
    }

    // --- Функции для генерации графов ---
    function clearGraph() {
        // Сохраняем текущее состояние перед очисткой
        saveState('before-clear-graph');
        
        graphElements.innerHTML = '';
        nodesData.clear();
        edgesData.clear();
        nextNodeId = 1;
        edgeIdCounter = 1;
        selectedElement = null;
        if (firstSelectedNodeElement) {
            firstSelectedNodeElement.classList.remove('edge-start-node');
            firstSelectedNodeElement = null;
        }
        firstSelectedNodeForEdge = null;
        updateViewBox(); // Возможно, сбросить viewBox в начальное состояние
        
        // Сохраняем действие очистки
        saveState('clear-graph');
    }

    function createRandomGraph(numNodes, numEdges, directed, weighted) {
        // Сохраняем состояние перед созданием
        saveState('before-create-random-graph');
        
        clearGraph();

        const createdNodeIds = [];
        for (let i = 0; i < numNodes; i++) {
            // Размещаем вершины в пределах текущего viewBox
            const x = viewBox.x + NODE_RADIUS + Math.random() * (viewBox.width - 2 * NODE_RADIUS);
            const y = viewBox.y + NODE_RADIUS + Math.random() * (viewBox.height - 2 * NODE_RADIUS);
            const nodeGroup = createVertex(x, y);
            createdNodeIds.push(parseInt(nodeGroup.dataset.nodeId)); // Получаем ID созданной вершины
        }

        let actualEdges = 0;
        const maxPossibleEdges = directed ? numNodes * (numNodes - 1) : numNodes * (numNodes - 1) / 2;
        
        // Если запрошено слишком много ребер, ограничиваем
        const edgesToCreate = Math.min(numEdges, maxPossibleEdges);
        
        // Оптимизация: создаем список всех возможных пар (без петель)
        const allPossiblePairs = [];
        for (let i = 0; i < numNodes; i++) {
            for (let j = directed ? 0 : i + 1; j < numNodes; j++) {
                if (i !== j) { // Без петель
                    allPossiblePairs.push([createdNodeIds[i], createdNodeIds[j]]);
                }
            }
        }
        
        // Перемешиваем пары
        for (let i = allPossiblePairs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allPossiblePairs[i], allPossiblePairs[j]] = [allPossiblePairs[j], allPossiblePairs[i]];
        }
        
        // Создаем ребра из перемешанного списка
        for (let i = 0; i < Math.min(edgesToCreate, allPossiblePairs.length); i++) {
            const [fromId, toId] = allPossiblePairs[i];
            let weight = weighted ? Math.floor(Math.random() * 10) + 1 : 1;
            addEdge(fromId, toId, weight, directed);
            actualEdges++;
        }
        
        selectElement(null);
        
        // Сохраняем финальное состояние
        saveState('create-random-graph', { numNodes, numEdges: actualEdges, directed, weighted });
    }

    function createClassicGraphByType(numNodes, type, directed) {
        // Сохраняем состояние перед созданием
        saveState('before-create-classic-graph');
        
        clearGraph();
        const createdNodeIds = [];
        const centerX = viewBox.x + viewBox.width / 2;
        const centerY = viewBox.y + viewBox.height / 2;
        const radius = Math.min(viewBox.width, viewBox.height) / 3; // Уменьшил радиус для лучшего отображения

        // Создаем вершины
        for (let i = 0; i < numNodes; i++) {
            const angle = (i / numNodes) * 2 * Math.PI;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            const nodeGroup = createVertex(x, y);
            createdNodeIds.push(parseInt(nodeGroup.dataset.nodeId));
        }

        // Создаем ребра в зависимости от типа
        if (type === 'complete') { // K_n - полный граф
            for (let i = 0; i < numNodes; i++) {
                for (let j = directed ? 0 : i + 1; j < numNodes; j++) {
                    if (i !== j) { // Нет петель
                        addEdge(createdNodeIds[i], createdNodeIds[j], 1, directed);
                    }
                }
            }
        } else if (type === 'cycle') { // C_n - цикл
            for (let i = 0; i < numNodes; i++) {
                addEdge(createdNodeIds[i], createdNodeIds[(i + 1) % numNodes], 1, directed);
            }
        } else if (type === 'path') { // P_n - путь
            for (let i = 0; i < numNodes - 1; i++) {
                addEdge(createdNodeIds[i], createdNodeIds[i + 1], 1, directed);
            }
        }
        selectElement(null);
        
        // Сохраняем финальное состояние
        saveState('create-classic-graph', { numNodes, type, directed });
    }
    // ------------------------------------

    // Обработчики событий
    svg.addEventListener('wheel', (event) => {
        event.preventDefault();
        const zoomFactor = 1.1;
        const svgRect = svg.getBoundingClientRect();
        const svgMouseX = (event.clientX - svgRect.left) / svgRect.width * viewBox.width + viewBox.x;
        const svgMouseY = (event.clientY - svgRect.top) / svgRect.height * viewBox.height + viewBox.y;

        if (event.deltaY < 0) { // Приближение
            viewBox.width /= zoomFactor;
            viewBox.height /= zoomFactor;
        } else { // Отдаление
            viewBox.width *= zoomFactor;
            viewBox.height *= zoomFactor;
        }

        viewBox.x = svgMouseX - (svgMouseX - viewBox.x) / zoomFactor;
        viewBox.y = svgMouseY - (svgMouseY - viewBox.y) / zoomFactor;
        updateViewBox();
    });

    graphArea.addEventListener('mousedown', (event) => {
        if (event.button === 0 && !isDraggingNode) { // Только ЛКМ и не перетаскиваем вершину
            const svgPoint = getSVGPoint(event.clientX, event.clientY);
            
            if (activeMode === 'add-vertex') {
                createVertex(svgPoint.x, svgPoint.y);
                event.stopPropagation();
            } else if (activeMode === 'delete') {
                // В режиме удаления клики по области вне элементов ничего не делают
                selectElement(null);
                event.stopPropagation();
            } else if (activeMode === 'add-edge') {
                // В режиме создания/изменения ребра клики по области вне элементов
                // сбрасывают выбор первой вершины.
                if (firstSelectedNodeElement) {
                    firstSelectedNodeElement.classList.remove('edge-start-node');
                    firstSelectedNodeElement = null;
                }
                firstSelectedNodeForEdge = null;
                selectElement(null);
                event.stopPropagation(); // Важно, чтобы не срабатывало панорамирование
            } else {
                // Режим панорамирования или выбора (по умолчанию)
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
                updateConnectedEdges(nodeId);
            }
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDraggingNode && draggedNode) {
            // Сохраняем состояние после перемещения вершины
            const nodeId = parseInt(draggedNode.dataset.nodeId);
            const node = nodesData.get(nodeId);
            if (node) {
                saveState('move-vertex', { 
                    id: nodeId, 
                    x: node.x, 
                    y: node.y 
                });
            }
        }
        
        isPanning = false;
        graphArea.classList.remove('panning');
        isDraggingNode = false;
        if (draggedNode) {
            draggedNode.classList.remove('dragging');
            draggedNode = null;
        }
    });

    // Обработчик событий для элементов графа (вершин и ребер)
    graphElements.addEventListener('mousedown', (event) => {
        const target = event.target;
        const nodeGroup = target.closest('.node');
        const edgeGroup = target.closest('g[data-edge-id]'); // Группа, содержащая ребро

        if (activeMode === 'delete') {
            if (nodeGroup) {
                const nodeId = parseInt(nodeGroup.dataset.nodeId);
                deleteVertex(nodeId);
                event.stopPropagation();
            } else if (edgeGroup) {
                const edgeId = parseInt(edgeGroup.dataset.edgeId);
                if (edgesData.has(edgeId)) {
                    const edge = edgesData.get(edgeId);
                    // Сохраняем данные ребра перед удалением
                    const edgeData = {
                        id: edgeId,
                        from: edge.from,
                        to: edge.to,
                        weight: edge.weight,
                        directed: edge.directed
                    };
                    
                    edgeGroup.remove(); // Удаляем всю группу ребра
                    edgesData.delete(edgeId);
                    
                    // Сохраняем действие в историю
                    saveState('delete-edge', edgeData);
                }
                selectElement(null);
                event.stopPropagation();
            }
            return; // Выходим, если режим удаления
        }

        if (nodeGroup && event.button === 0) { // Клик по вершине
            if (activeMode === 'add-edge') {
                const nodeId = parseInt(nodeGroup.dataset.nodeId);
                if (!firstSelectedNodeForEdge) {
                    // Первая вершина выбрана
                    firstSelectedNodeForEdge = nodeId;
                    firstSelectedNodeElement = nodeGroup;
                    nodeGroup.classList.add('edge-start-node');
                } else if (firstSelectedNodeForEdge === nodeId) {
                    // Та же вершина кликнута повторно - создаем петлю
                    addEdge(firstSelectedNodeForEdge, nodeId, 1, false); // Создаем петлю
                    firstSelectedNodeElement.classList.remove('edge-start-node');
                    firstSelectedNodeForEdge = null;
                    firstSelectedNodeElement = null;
                } else {
                    // Вторая вершина выбрана, создаем обычное ребро
                    addEdge(firstSelectedNodeForEdge, nodeId, 1, false);
                    firstSelectedNodeElement.classList.remove('edge-start-node');
                    firstSelectedNodeForEdge = null;
                    firstSelectedNodeElement = null;
                }
                event.stopPropagation();
            } else {
                // Обычный режим (выбор или перетаскивание вершины)
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
        } else if (edgeGroup && (target.tagName === 'line' || target.tagName === 'path' || target.tagName === 'text')) {
            // Клик по ребру (или его компоненту: линия, стрелка, текст)
            if (activeMode === 'add-edge') {
                // В режиме 'add-edge' клик по существующему ребру открывает окно редактирования
                const edgeId = parseInt(edgeGroup.dataset.edgeId);
                showEditEdgeModal(edgeId);
                event.stopPropagation();
            } else {
                // Обычный режим (выбор ребра)
                const line = edgeGroup.querySelector('line, path');
                if (line) {
                    selectElement(line);
                }
                event.stopPropagation();
            }
        } else {
            // Клик по пустому месту внутри graphElements (не по вершине и не по ребру)
            selectElement(null);
            // Сбрасываем режим создания ребра, если была выбрана первая вершина
            if (firstSelectedNodeElement) {
                firstSelectedNodeElement.classList.remove('edge-start-node');
                firstSelectedNodeElement = null;
            }
            firstSelectedNodeForEdge = null;
        }
    });

    // --- Обработчики кнопок панели инструментов ---
    addVertexBtn.addEventListener('click', () => toggleMode('add-vertex'));
    addEdgeBtn.addEventListener('click', () => toggleMode('add-edge'));
    deleteElementBtn.addEventListener('click', () => toggleMode('delete'));

    // --- Обработчики модального окна РЕДАКТИРОВАНИЯ ребра ---
    document.getElementById('cancel-edit-edge-btn').addEventListener('click', () => {
        editEdgeModal.style.display = 'none';
        editingEdgeId = null;
        selectElement(null); // Снимаем выделение
    });

    document.getElementById('confirm-edit-edge-btn').addEventListener('click', () => {
        if (!editingEdgeId) return;

        const edge = edgesData.get(editingEdgeId);
        if (edge) {
            // Сохраняем старое состояние ребра
            const oldData = {
                weight: edge.weight,
                directed: edge.directed
            };
            
            const newWeight = parseInt(document.getElementById('edit-edge-weight').value) || 1;
            const newDirected = document.getElementById('edit-edge-directed').checked;
            
            edge.weight = newWeight;
            edge.directed = newDirected;
            updateEdgeVisuals(editingEdgeId); // Обновляем визуальное отображение ребра
            
            // Сохраняем действие в историю
            saveState('edit-edge', {
                id: editingEdgeId,
                old: oldData,
                new: { weight: newWeight, directed: newDirected }
            });
        }
        editEdgeModal.style.display = 'none';
        editingEdgeId = null;
        selectElement(null); // Снимаем выделение
    });

    // --- Обработчики модального окна ГЕНЕРАЦИИ случайного графа ---
    createRandomBtn.addEventListener('click', () => {
        // Деактивируем текущий режим, если есть
        if (activeMode) toggleMode(activeMode); 
        randomGraphModal.style.display = 'flex';
    });

    document.getElementById('cancel-random-btn').addEventListener('click', () => {
        randomGraphModal.style.display = 'none';
    });

    document.getElementById('confirm-random-btn').addEventListener('click', () => {
        const numNodes = parseInt(document.getElementById('random-nodes').value);
        const numEdges = parseInt(document.getElementById('random-edges').value);
        const directed = document.getElementById('random-directed').checked;
        const weighted = document.getElementById('random-weighted').checked;

        if (isNaN(numNodes) || numNodes < 2) {
            alert('Количество вершин должно быть не менее 2.');
            return;
        }
        
        // Максимально возможное количество ребер для простого графа (без петель и кратных ребер)
        const maxEdges = directed ? numNodes * (numNodes - 1) : numNodes * (numNodes - 1) / 2;
        
        if (isNaN(numEdges) || numEdges < 0 || numEdges > maxEdges) {
            alert(`Количество рёбер должно быть от 0 до ${maxEdges} для ${numNodes} вершин.`);
            return;
        }
        
        // Если слишком много вершин или ребер, предупреждаем
        if (numNodes > 50) {
            if (!confirm(`Создание графа с ${numNodes} вершинами может замедлить работу. Продолжить?`)) {
                return;
            }
        }
        
        if (numEdges > 100) {
            if (!confirm(`Создание графа с ${numEdges} рёбрами может замедлить работу. Продолжить?`)) {
                return;
            }
        }
        
        createRandomGraph(numNodes, numEdges, directed, weighted);
        randomGraphModal.style.display = 'none';
    });

    // --- Обработчики модального окна ГЕНЕРАЦИИ классического графа ---
    createClassicBtn.addEventListener('click', () => {
        if (activeMode) toggleMode(activeMode); 
        classicGraphModal.style.display = 'flex';
    });

    document.getElementById('cancel-classic-btn').addEventListener('click', () => {
        classicGraphModal.style.display = 'none';
    });

    document.getElementById('confirm-classic-btn').addEventListener('click', () => {
        const numNodes = parseInt(document.getElementById('classic-nodes').value);
        const graphType = document.getElementById('classic-type').value;
        const directed = document.getElementById('classic-directed').checked;

        if (isNaN(numNodes) || numNodes < 2) {
            alert('Количество вершин должно быть не менее 2.');
            return;
        }
        
        if (numNodes > 30) {
            if (!confirm(`Создание классического графа с ${numNodes} вершинами может замедлить работу. Продолжить?`)) {
                return;
            }
        }
        
        createClassicGraphByType(numNodes, graphType, directed);
        classicGraphModal.style.display = 'none';
    });

    // Заглушка для выбора алгоритма
    selectAlgorithmBtn.addEventListener('click', () => {
        alert('Выбор алгоритма - в разработке');
    });

    // Инициализация
    initializeExistingNodes(); // Сейчас просто сбросит счетчики
    updateViewBox(); // Устанавливает начальный viewBox и фон
    
    // Сохраняем начальное состояние
    saveState('initial-state');
});
