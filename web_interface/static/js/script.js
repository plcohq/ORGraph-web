// script.js - обновленный для работы с алгоритмами C++ библиотеки

document.addEventListener('DOMContentLoaded', () => {
    // Конфигурация API
    const API_BASE_URL = window.location.origin.includes('localhost') 
        ? 'http://localhost:5000/api' 
        : '/api';
    
    console.log('API base URL:', API_BASE_URL);

    // DOM элементы
    const svg = document.getElementById('graph-svg');
    const graphElements = document.getElementById('graph-elements');
    const graphArea = document.querySelector('.graph-area');
    
    // Кнопки инструментов
    const addVertexBtn = document.getElementById('add-vertex-btn');
    const addEdgeBtn = document.getElementById('add-edge-btn');
    const deleteElementBtn = document.getElementById('delete-element-btn');
    const createRandomBtn = document.getElementById('create-random-btn');
    const createClassicBtn = document.getElementById('create-classic-btn');
    const selectAlgorithmBtn = document.getElementById('select-algorithm-btn');

    // Состояние приложения
    let viewBox = { x: 0, y: 0, width: 900, height: 600 };
    let isPanning = false;
    let startPanPoint = { x: 0, y: 0 };
    let currentPanOffset = { x: 0, y: 0 };
    
    let isDraggingNode = false;
    let draggedNode = null;
    let dragOffset = { x: 0, y: 0 };
    
    let selectedElement = null;
    let nextNodeId = 1;
    let activeMode = null;
    
    const nodesData = new Map(); // Map<nodeId, {x, y, element}>
    const edgesData = new Map(); // Map<edgeId, {from, to, weight, directed, element, group, text, arrow}>
    let edgeIdCounter = 1;
    
    const NODE_RADIUS = 20;
    
    let firstSelectedNodeForEdge = null;
    let firstSelectedNodeElement = null;
    let editingEdgeId = null;
    
    // Система Undo/Redo
    let undoStack = [];
    let redoStack = [];
    const MAX_HISTORY = 50;

    // Создание кнопок Undo/Redo
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
        undoBtn.innerHTML = '↶ Отменить (Ctrl+Z)';
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
        redoBtn.innerHTML = '↷ Вернуть (Ctrl+Y)';
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
        
        undoBtn.addEventListener('click', () => undo());
        redoBtn.addEventListener('click', () => redo());
        
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
    
    const updateUndoRedoButtons = () => {
        undoBtn.disabled = undoStack.length === 0;
        redoBtn.disabled = redoStack.length === 0;
        
        undoBtn.style.opacity = undoStack.length === 0 ? '0.5' : '0.7';
        redoBtn.style.opacity = redoStack.length === 0 ? '0.5' : '0.7';
        
        undoBtn.style.cursor = undoStack.length === 0 ? 'not-allowed' : 'pointer';
        redoBtn.style.cursor = redoStack.length === 0 ? 'not-allowed' : 'pointer';
    };
    
    const saveState = (actionType, data = null) => {
        const state = {
            nodes: new Map(),
            edges: new Map(),
            nextNodeId,
            edgeIdCounter,
            actionType,
            data,
            timestamp: Date.now()
        };
        
        // Сохраняем узлы
        nodesData.forEach((node, id) => {
            state.nodes.set(id, {
                x: node.x,
                y: node.y,
                element: node.element
            });
        });
        
        // Сохраняем ребра
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
        
        if (undoStack.length > MAX_HISTORY) {
            undoStack.shift();
        }
        
        redoStack.length = 0;
        
        updateUndoRedoButtons();
    };
    
    const restoreState = (state) => {
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
                lineElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                lineElement.setAttribute('stroke', '#666');
                lineElement.setAttribute('stroke-width', '2');
                lineElement.setAttribute('fill', 'none');
            } else {
                lineElement = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                lineElement.setAttribute('stroke', '#666');
                lineElement.setAttribute('stroke-width', '2');
            }
            
            edgeGroup.appendChild(lineElement);
            graphElements.appendChild(edgeGroup);
            
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
            
            updateEdgeVisuals(id);
        });
        
        nextNodeId = state.nextNodeId;
        edgeIdCounter = state.edgeIdCounter;
        
        selectedElement = null;
        firstSelectedNodeForEdge = null;
        firstSelectedNodeElement = null;
    };
    
    const undo = async () => {
        if (undoStack.length === 0) return;
        
        const currentState = {
            nodes: new Map(nodesData),
            edges: new Map(edgesData),
            nextNodeId,
            edgeIdCounter
        };
        
        redoStack.push(currentState);
        
        const prevState = undoStack.pop();
        restoreState(prevState);
        
        updateUndoRedoButtons();
        
        // Синхронизируем с сервером
        try {
            await fetch(`${API_BASE_URL}/undo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.warn('Failed to sync undo to server:', error);
        }
    };
    
    const redo = async () => {
        if (redoStack.length === 0) return;
        
        const currentState = {
            nodes: new Map(nodesData),
            edges: new Map(edgesData),
            nextNodeId,
            edgeIdCounter
        };
        
        undoStack.push(currentState);
        
        const nextState = redoStack.pop();
        restoreState(nextState);
        
        updateUndoRedoButtons();
        
        // Синхронизируем с сервером
        try {
            await fetch(`${API_BASE_URL}/redo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.warn('Failed to sync redo to server:', error);
        }
    };
    
    document.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
            event.preventDefault();
            if (!event.shiftKey) {
                undo();
            }
        }
        
        if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
            event.preventDefault();
            redo();
        }
    });

    // API функции
    async function loadGraphFromServer() {
        try {
            const response = await fetch(`${API_BASE_URL}/graph`);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            
            const data = await response.json();
            console.log('Server graph data:', data);
            
            // Очищаем локальный граф
            await clearGraph(true);
            
            // Создаем вершины с сервера
            if (data.vertices && Array.isArray(data.vertices)) {
                for (const vertexIdStr of data.vertices) {
                    const vertexId = parseInt(vertexIdStr);
                    if (!isNaN(vertexId)) {
                        const x = viewBox.x + viewBox.width / 2 + (Math.random() - 0.5) * 100;
                        const y = viewBox.y + viewBox.height / 2 + (Math.random() - 0.5) * 100;
                        createVertexLocal(x, y, vertexId);
                    }
                }
            }
            
            // Создаем ребра с сервера
            if (data.edges && Array.isArray(data.edges)) {
                for (const edge of data.edges) {
                    let from, to, weight, directed;
                    
                    if (typeof edge === 'object') {
                        from = parseInt(edge.source || edge.from);
                        to = parseInt(edge.target || edge.to);
                        weight = parseFloat(edge.weight) || 1;
                        directed = edge.directed || false;
                    } else if (Array.isArray(edge) && edge.length >= 2) {
                        from = parseInt(edge[0]);
                        to = parseInt(edge[1]);
                        weight = parseFloat(edge[2]) || 1;
                        directed = edge[3] || false;
                    }
                    
                    if (!isNaN(from) && !isNaN(to)) {
                        addEdgeLocal(from, to, weight, directed);
                    }
                }
            }
            
            console.log('Graph loaded from server:', data);
            return data;
        } catch (error) {
            console.error('Error loading graph from server:', error);
            return null;
        }
    }
    
    async function syncGraphToServer() {
        try {
            const vertices = Array.from(nodesData.keys()).map(id => id.toString());
            const edges = Array.from(edgesData.values()).map(edge => ({
                source: edge.from.toString(),
                target: edge.to.toString(),
                weight: edge.weight,
                directed: edge.directed
            }));
            
            // Отправляем данные на сервер
            const graphData = { vertices, edges };
            
            // Очищаем граф на сервере
            await fetch(`${API_BASE_URL}/graph/clear`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            // Добавляем вершины
            for (const vertexId of vertices) {
                await fetch(`${API_BASE_URL}/vertex`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: vertexId })
                });
            }
            
            // Добавляем ребра
            for (const edge of edges) {
                await fetch(`${API_BASE_URL}/edge`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(edge)
                });
            }
            
            console.log('Graph synced to server');
            return true;
        } catch (error) {
            console.error('Error syncing graph to server:', error);
            return false;
        }
    }
    
    async function addVertexToServer(vertexId) {
        try {
            const response = await fetch(`${API_BASE_URL}/vertex`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: vertexId })
            });
            
            if (!response.ok) {
                const error = await response.json();
                console.error('Server error:', error);
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Error adding vertex to server:', error);
            return false;
        }
    }
    
    async function removeVertexFromServer(vertexId) {
        try {
            const response = await fetch(`${API_BASE_URL}/vertex/${vertexId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const error = await response.json();
                console.error('Server error:', error);
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Error removing vertex from server:', error);
            return false;
        }
    }
    
    async function addEdgeToServer(fromId, toId, weight = 1, directed = false) {
        try {
            const response = await fetch(`${API_BASE_URL}/edge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: fromId.toString(),
                    target: toId.toString(),
                    weight: weight,
                    directed: directed
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                console.error('Server error:', error);
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Error adding edge to server:', error);
            return false;
        }
    }
    
    async function removeEdgeFromServer(fromId, toId) {
        try {
            const response = await fetch(`${API_BASE_URL}/edge/${fromId}/${toId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const error = await response.json();
                console.error('Server error:', error);
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Error removing edge from server:', error);
            return false;
        }
    }
    
    async function clearGraphOnServer() {
        try {
            const response = await fetch(`${API_BASE_URL}/graph/clear`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                const error = await response.json();
                console.error('Server error:', error);
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Error clearing graph on server:', error);
            return false;
        }
    }
    
    async function createRandomGraphOnServer(numNodes, numEdges, directed, weighted) {
        try {
            const response = await fetch(`${API_BASE_URL}/graph/random`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    num_vertices: numNodes,
                    num_edges: numEdges,
                    directed: directed,
                    weighted: weighted
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                console.error('Server error:', error);
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Error creating random graph on server:', error);
            return false;
        }
    }
    
    async function createClassicGraphOnServer(graphType, numNodes, directed) {
        try {
            const response = await fetch(`${API_BASE_URL}/graph/classic`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: graphType,
                    num_vertices: numNodes,
                    directed: directed
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                console.error('Server error:', error);
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Error creating classic graph on server:', error);
            return false;
        }
    }
    
    async function runAlgorithmOnServer(algorithm, params = {}) {
        try {
            console.log(`Running algorithm ${algorithm} with params:`, params);
            
            const response = await fetch(`${API_BASE_URL}/algorithm/${algorithm}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            });
            
            if (!response.ok) {
                const error = await response.json();
                console.error(`Server error for ${algorithm}:`, error);
                return { error: error.error || `HTTP ${response.status}` };
            }
            
            const data = await response.json();
            console.log(`Algorithm ${algorithm} result:`, data);
            return data.result || data;
        } catch (error) {
            console.error(`Error running ${algorithm} on server:`, error);
            return { error: error.message };
        }
    }
    
    // Функции для работы с графом
    function getNextAvailableNodeId() {
        let id = 1;
        while (nodesData.has(id)) {
            id++;
        }
        return id;
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
    
    function updateButtonStates() {
        addVertexBtn.classList.remove('active');
        addEdgeBtn.classList.remove('active');
        deleteElementBtn.classList.remove('active');
        
        graphArea.classList.remove('add-vertex-mode', 'add-edge-mode', 'delete-mode');
        
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
                graphArea.style.cursor = 'grab';
                break;
        }
    }
    
    function toggleMode(newMode) {
        if (firstSelectedNodeElement) {
            firstSelectedNodeElement.classList.remove('edge-start-node');
            firstSelectedNodeElement = null;
        }
        firstSelectedNodeForEdge = null;
        
        if (activeMode === newMode) {
            activeMode = null;
        } else {
            activeMode = newMode;
        }
        selectElement(null);
        updateButtonStates();
    }
    
    // Локальное создание вершины
    function createVertexLocal(x, y, customId = null) {
        const newId = customId || getNextAvailableNodeId();
        
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
    
    // Создание вершины с синхронизацией
    async function createVertex(x, y) {
        const newId = getNextAvailableNodeId();
        
        // Сохраняем состояние перед созданием
        const prevState = {
            nodes: new Map(nodesData),
            edges: new Map(edgesData),
            nextNodeId,
            edgeIdCounter,
            actionType: 'before-create-vertex'
        };
        
        const nodeGroup = createVertexLocal(x, y, newId);
        
        // Сохраняем действие в историю
        saveState('create-vertex', { id: newId, x, y });
        
        // Синхронизируем с сервером
        try {
            await addVertexToServer(newId.toString());
        } catch (error) {
            console.warn('Failed to sync vertex to server, continuing locally:', error);
        }
        
        return nodeGroup;
    }
    
    async function deleteVertex(nodeId) {
        const nodeData = nodesData.get(nodeId);
        if (!nodeData) return;
        
        const vertexData = {
            id: nodeId,
            x: nodeData.x,
            y: nodeData.y
        };
        
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
        
        nodeData.element.remove();
        nodesData.delete(nodeId);
        selectElement(null);
        
        saveState('delete-vertex', { 
            vertex: vertexData, 
            connectedEdges: connectedEdges 
        });
        
        // Синхронизируем с сервером
        try {
            await removeVertexFromServer(nodeId.toString());
        } catch (error) {
            console.warn('Failed to sync vertex deletion to server, continuing locally:', error);
        }
    }
    
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
    
    function updateEdgeVisuals(edgeId) {
        const edge = edgesData.get(edgeId);
        if (!edge) return;
        
        const fromNode = nodesData.get(edge.from);
        if (!fromNode) return;
        
        if (edge.from === edge.to) {
            // Петля
            const loopRadius = NODE_RADIUS * 1.5;
            const loopStartX = fromNode.x - NODE_RADIUS;
            const loopStartY = fromNode.y - NODE_RADIUS * 0.5;
            const loopEndX = fromNode.x + NODE_RADIUS;
            const loopEndY = fromNode.y - NODE_RADIUS * 0.5;
            
            if (edge.element && edge.element.tagName === 'line') {
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('stroke', '#666');
                path.setAttribute('stroke-width', '2');
                path.setAttribute('fill', 'none');
                
                edge.element.remove();
                edge.element = path;
                edge.group.appendChild(path);
            }
            
            const path = edge.element;
            const d = `M ${loopStartX} ${loopStartY} 
                       Q ${fromNode.x} ${fromNode.y - loopRadius * 2}, ${loopEndX} ${loopEndY}`;
            path.setAttribute('d', d);
            
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
            
            if (edge.directed) {
                if (!edge.arrow) {
                    edge.arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    edge.arrow.setAttribute('fill', '#666');
                    edge.group.appendChild(edge.arrow);
                }
                const arrowX = fromNode.x + NODE_RADIUS;
                const arrowY = fromNode.y - NODE_RADIUS * 0.5;
                const angle = Math.PI * 0.75;
                
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
            
            return;
        }
        
        const toNode = nodesData.get(edge.to);
        if (!toNode) return;
        
        const startPoint = getEdgePoint(fromNode.x, fromNode.y, toNode.x, toNode.y, NODE_RADIUS);
        const endPoint = getEdgePoint(toNode.x, toNode.y, fromNode.x, fromNode.y, NODE_RADIUS);
        
        if (edge.element && edge.element.tagName !== 'line') {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('stroke', '#666');
            line.setAttribute('stroke-width', '2');
            
            if (edge.element) edge.element.remove();
            edge.element = line;
            edge.group.appendChild(line);
        }
        
        if (edge.element) {
            edge.element.setAttribute('x1', startPoint.x);
            edge.element.setAttribute('y1', startPoint.y);
            edge.element.setAttribute('x2', endPoint.x);
            edge.element.setAttribute('y2', endPoint.y);
        }
        
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
    
    // Локальное добавление ребра
    function addEdgeLocal(fromId, toId, weight = 1, directed = false) {
        const fromNode = nodesData.get(parseInt(fromId));
        const toNode = (fromId !== toId) ? nodesData.get(parseInt(toId)) : fromNode;
        
        if (!fromNode) {
            console.error(`Вершина ${fromId} не существует!`);
            return null;
        }
        
        if (fromId === toId) {
            // Проверяем петлю
            let loopExists = false;
            edgesData.forEach(edge => {
                if (edge.from === fromId && edge.to === fromId) {
                    loopExists = true;
                }
            });
            
            if (loopExists) {
                console.warn(`Петля в вершине ${fromId} уже существует!`);
                return null;
            }
        } else {
            // Проверяем существующее ребро
            let exists = false;
            edgesData.forEach(edge => {
                if (directed) {
                    if (edge.from === fromId && edge.to === toId) {
                        exists = true;
                    }
                } else {
                    if ((edge.from === fromId && edge.to === toId) || 
                        (edge.from === toId && edge.to === fromId)) {
                        exists = true;
                    }
                }
            });
            if (exists) {
                console.warn(`Ребро ${fromId}-${toId} уже существует!`);
                return null;
            }
        }
        
        const edgeId = edgeIdCounter++;
        const edgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        edgeGroup.setAttribute('data-edge-id', edgeId);
        
        let lineElement;
        if (fromId === toId) {
            lineElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            lineElement.setAttribute('stroke', '#666');
            lineElement.setAttribute('stroke-width', '2');
            lineElement.setAttribute('fill', 'none');
        } else {
            lineElement = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            lineElement.setAttribute('stroke', '#666');
            lineElement.setAttribute('stroke-width', '2');
        }
        
        edgeGroup.appendChild(lineElement);
        graphElements.appendChild(edgeGroup);
        
        edgesData.set(edgeId, {
            from: parseInt(fromId),
            to: parseInt(toId),
            weight: weight,
            directed: directed,
            element: lineElement,
            group: edgeGroup,
            text: null,
            arrow: null
        });
        
        updateEdgeVisuals(edgeId);
        selectElement(lineElement);
        
        console.log(`Создано ребро: ${fromId} -> ${toId}, вес: ${weight}, направленное: ${directed}`);
        return edgeId;
    }
    
    // Добавление ребра с синхронизацией
    async function addEdge(fromId, toId, weight = 1, directed = false) {
        const edgeId = addEdgeLocal(fromId, toId, weight, directed);
        
        if (edgeId) {
            saveState('create-edge', { 
                id: edgeId, 
                from: parseInt(fromId), 
                to: parseInt(toId), 
                weight, 
                directed 
            });
            
            // Синхронизируем с сервером
            try {
                await addEdgeToServer(fromId, toId, weight, directed);
            } catch (error) {
                console.warn('Failed to sync edge to server, continuing locally:', error);
            }
        }
        
        return edgeId;
    }
    
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
        
        document.getElementById('edit-edge-weight').value = edge.weight;
        document.getElementById('edit-edge-directed').checked = edge.directed;
        editEdgeModal.style.display = 'flex';
    }
    
    async function clearGraph(skipSaveState = false) {
        if (!skipSaveState) {
            saveState('before-clear-graph');
        }
        
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
        updateViewBox();
        
        if (!skipSaveState) {
            saveState('clear-graph');
        }
        
        // Синхронизируем с сервером
        try {
            await clearGraphOnServer();
        } catch (error) {
            console.warn('Failed to sync graph clearance to server, continuing locally:', error);
        }
    }
    
    async function createRandomGraph(numNodes, numEdges, directed, weighted) {
        // Сохраняем состояние ДО очистки
        saveState('before-create-random-graph');
        
        // Очищаем текущий граф
        await clearGraph(true); // true = не сохранять еще одно состояние
        
        try {
            // Создаем граф на сервере
            const serverSuccess = await createRandomGraphOnServer(numNodes, numEdges, directed, weighted);
            
            if (serverSuccess) {
                // Загружаем созданный граф с сервера
                const serverGraph = await loadGraphFromServer();
                
                if (!serverGraph) {
                    // Fallback: создаем локально
                    await createRandomGraphLocal(numNodes, numEdges, directed, weighted);
                }
            } else {
                // Fallback: создаем локально
                await createRandomGraphLocal(numNodes, numEdges, directed, weighted);
            }
        } catch (error) {
            console.error('Error creating random graph:', error);
            // Создаем локально при ошибке
            await createRandomGraphLocal(numNodes, numEdges, directed, weighted);
        }
        
        selectElement(null);
        saveState('create-random-graph', { numNodes, numEdges, directed, weighted });
    }
    
    // Вспомогательная функция для локального создания случайного графа
    async function createRandomGraphLocal(numNodes, numEdges, directed, weighted) {
        const createdNodeIds = [];
        
        // Создаем вершины
        for (let i = 0; i < numNodes; i++) {
            const x = viewBox.x + NODE_RADIUS + Math.random() * (viewBox.width - 2 * NODE_RADIUS);
            const y = viewBox.y + NODE_RADIUS + Math.random() * (viewBox.height - 2 * NODE_RADIUS);
            const nodeGroup = createVertexLocal(x, y, i + 1);
            createdNodeIds.push(i + 1);
            
            // Синхронизируем вершину с сервером
            try {
                await addVertexToServer((i + 1).toString());
            } catch (error) {
                console.warn('Failed to sync vertex to server:', error);
            }
        }
        
        const maxPossibleEdges = directed ? numNodes * (numNodes - 1) : numNodes * (numNodes - 1) / 2;
        const edgesToCreate = Math.min(numEdges, maxPossibleEdges);
        
        const allPossiblePairs = [];
        for (let i = 0; i < numNodes; i++) {
            for (let j = directed ? 0 : i + 1; j < numNodes; j++) {
                if (i !== j) {
                    allPossiblePairs.push([i + 1, j + 1]);
                }
            }
        }
        
        // Перемешиваем пары
        for (let i = allPossiblePairs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allPossiblePairs[i], allPossiblePairs[j]] = [allPossiblePairs[j], allPossiblePairs[i]];
        }
        
        // Создаем ребра
        let edgesCreated = 0;
        for (let i = 0; i < Math.min(edgesToCreate, allPossiblePairs.length); i++) {
            const [fromId, toId] = allPossiblePairs[i];
            let weight = weighted ? Math.floor(Math.random() * 10) + 1 : 1;
            
            // Проверяем, существует ли уже такое ребро
            let exists = false;
            edgesData.forEach(edge => {
                if (directed) {
                    if (edge.from === fromId && edge.to === toId) {
                        exists = true;
                    }
                } else {
                    if ((edge.from === fromId && edge.to === toId) || 
                        (edge.from === toId && edge.to === fromId)) {
                        exists = true;
                    }
                }
            });
            
            if (!exists) {
                const edgeId = addEdgeLocal(fromId, toId, weight, directed);
                if (edgeId) {
                    edgesCreated++;
                    
                    // Синхронизируем ребро с сервером
                    try {
                        await addEdgeToServer(fromId, toId, weight, directed);
                    } catch (error) {
                        console.warn('Failed to sync edge to server:', error);
                    }
                }
            }
        }
        
        console.log(`Created random graph: ${numNodes} vertices, ${edgesCreated} edges`);
    }
    
    async function createClassicGraphByType(numNodes, type, directed) {
        saveState('before-create-classic-graph');
        
        // Очищаем текущий граф
        await clearGraph(true);
        
        try {
            // Создаем граф на сервере
            const serverSuccess = await createClassicGraphOnServer(type, numNodes, directed);
            
            if (serverSuccess) {
                // Загружаем созданный граф с сервера
                const serverGraph = await loadGraphFromServer();
                
                if (!serverGraph) {
                    // Fallback: создаем локально
                    await createClassicGraphLocal(numNodes, type, directed);
                }
            } else {
                // Fallback: создаем локально
                await createClassicGraphLocal(numNodes, type, directed);
            }
        } catch (error) {
            console.error('Error creating classic graph:', error);
            // Создаем локально при ошибке
            await createClassicGraphLocal(numNodes, type, directed);
        }
        
        selectElement(null);
        saveState('create-classic-graph', { numNodes, type, directed });
    }
    
    // Вспомогательная функция для локального создания классического графа
    async function createClassicGraphLocal(numNodes, type, directed) {
        const createdNodeIds = [];
        const centerX = viewBox.x + viewBox.width / 2;
        const centerY = viewBox.y + viewBox.height / 2;
        const radius = Math.min(viewBox.width, viewBox.height) / 3;
        
        // Создаем вершины
        for (let i = 0; i < numNodes; i++) {
            let x, y;
            
            if (type === 'complete' || type === 'cycle' || type === 'path') {
                const angle = (i / numNodes) * 2 * Math.PI;
                x = centerX + radius * Math.cos(angle);
                y = centerY + radius * Math.sin(angle);
            } else {
                x = viewBox.x + NODE_RADIUS + Math.random() * (viewBox.width - 2 * NODE_RADIUS);
                y = viewBox.y + NODE_RADIUS + Math.random() * (viewBox.height - 2 * NODE_RADIUS);
            }
            
            const nodeGroup = createVertexLocal(x, y, i + 1);
            createdNodeIds.push(i + 1);
            
            // Синхронизируем вершину с сервером
            try {
                await addVertexToServer((i + 1).toString());
            } catch (error) {
                console.warn('Failed to sync vertex to server:', error);
            }
        }
        
        // Создаем ребра в зависимости от типа графа
        if (type === 'complete') {
            // Полный граф
            for (let i = 0; i < numNodes; i++) {
                for (let j = directed ? 0 : i + 1; j < numNodes; j++) {
                    if (i !== j) {
                        const edgeId = addEdgeLocal(i + 1, j + 1, 1, directed);
                        if (edgeId) {
                            // Синхронизируем ребро с сервером
                            try {
                                await addEdgeToServer(i + 1, j + 1, 1, directed);
                            } catch (error) {
                                console.warn('Failed to sync edge to server:', error);
                            }
                        }
                    }
                }
            }
        } else if (type === 'cycle') {
            // Цикл
            for (let i = 0; i < numNodes; i++) {
                const from = i + 1;
                const to = ((i + 1) % numNodes) + 1;
                const edgeId = addEdgeLocal(from, to, 1, directed);
                if (edgeId) {
                    // Синхронизируем ребро с сервером
                    try {
                        await addEdgeToServer(from, to, 1, directed);
                    } catch (error) {
                        console.warn('Failed to sync edge to server:', error);
                    }
                }
            }
        } else if (type === 'path') {
            // Путь
            for (let i = 0; i < numNodes - 1; i++) {
                const from = i + 1;
                const to = i + 2;
                const edgeId = addEdgeLocal(from, to, 1, directed);
                if (edgeId) {
                    // Синхронизируем ребро с сервером
                    try {
                        await addEdgeToServer(from, to, 1, directed);
                    } catch (error) {
                        console.warn('Failed to sync edge to server:', error);
                    }
                }
            }
        }
        
        console.log(`Created ${type} graph with ${numNodes} vertices`);
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
                createVertex(svgPoint.x, svgPoint.y);
                event.stopPropagation();
            } else if (activeMode === 'delete') {
                selectElement(null);
                event.stopPropagation();
            } else if (activeMode === 'add-edge') {
                if (firstSelectedNodeElement) {
                    firstSelectedNodeElement.classList.remove('edge-start-node');
                    firstSelectedNodeElement = null;
                }
                firstSelectedNodeForEdge = null;
                selectElement(null);
                event.stopPropagation();
            } else {
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
                
                updateConnectedEdges(nodeId);
            }
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isDraggingNode && draggedNode) {
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
    
    graphElements.addEventListener('mousedown', (event) => {
        const target = event.target;
        const nodeGroup = target.closest('.node');
        const edgeGroup = target.closest('g[data-edge-id]');
        
        if (activeMode === 'delete') {
            if (nodeGroup) {
                const nodeId = parseInt(nodeGroup.dataset.nodeId);
                deleteVertex(nodeId);
                event.stopPropagation();
            } else if (edgeGroup) {
                const edgeId = parseInt(edgeGroup.dataset.edgeId);
                if (edgesData.has(edgeId)) {
                    const edge = edgesData.get(edgeId);
                    const edgeData = {
                        id: edgeId,
                        from: edge.from,
                        to: edge.to,
                        weight: edge.weight,
                        directed: edge.directed
                    };
                    
                    edgeGroup.remove();
                    edgesData.delete(edgeId);
                    
                    saveState('delete-edge', edgeData);
                    
                    // Синхронизируем с сервером
                    (async () => {
                        try {
                            await removeEdgeFromServer(edge.from.toString(), edge.to.toString());
                        } catch (error) {
                            console.warn('Failed to sync edge deletion to server, continuing locally:', error);
                        }
                    })();
                }
                selectElement(null);
                event.stopPropagation();
            }
            return;
        }
        
        if (nodeGroup && event.button === 0) {
            if (activeMode === 'add-edge') {
                const nodeId = parseInt(nodeGroup.dataset.nodeId);
                if (!firstSelectedNodeForEdge) {
                    firstSelectedNodeForEdge = nodeId;
                    firstSelectedNodeElement = nodeGroup;
                    nodeGroup.classList.add('edge-start-node');
                } else if (firstSelectedNodeForEdge === nodeId) {
                    addEdge(firstSelectedNodeForEdge, nodeId, 1, false);
                    firstSelectedNodeElement.classList.remove('edge-start-node');
                    firstSelectedNodeForEdge = null;
                    firstSelectedNodeElement = null;
                } else {
                    addEdge(firstSelectedNodeForEdge, nodeId, 1, false);
                    firstSelectedNodeElement.classList.remove('edge-start-node');
                    firstSelectedNodeForEdge = null;
                    firstSelectedNodeElement = null;
                }
                event.stopPropagation();
            } else {
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
            if (activeMode === 'add-edge') {
                const edgeId = parseInt(edgeGroup.dataset.edgeId);
                showEditEdgeModal(edgeId);
                event.stopPropagation();
            } else {
                const line = edgeGroup.querySelector('line, path');
                if (line) {
                    selectElement(line);
                }
                event.stopPropagation();
            }
        } else {
            selectElement(null);
            if (firstSelectedNodeElement) {
                firstSelectedNodeElement.classList.remove('edge-start-node');
                firstSelectedNodeElement = null;
            }
            firstSelectedNodeForEdge = null;
        }
    });
    
    // Модальные окна
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
    
    // Модальное окно для алгоритмов
    const algorithmModal = document.createElement('div');
    algorithmModal.className = 'modal';
    algorithmModal.innerHTML = `
        <div class="modal-content" style="max-width: 600px; max-height: 80vh; overflow-y: auto;">
            <h3>Выберите алгоритм</h3>
            <div class="algorithm-buttons" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 20px 0;">
                <button class="algorithm-btn" data-algorithm="dfs" title="Обход в глубину">DFS</button>
                <button class="algorithm-btn" data-algorithm="bfs" title="Обход в ширину">BFS</button>
                <button class="algorithm-btn" data-algorithm="dijkstra" title="Кратчайший путь (Дейкстра)">Дейкстра</button>
                <button class="algorithm-btn" data-algorithm="ford_bellman" title="Алгоритм Форда-Беллмана">Форд-Беллман</button>
                <button class="algorithm-btn" data-algorithm="floyd_algorithm" title="Алгоритм Флойда-Уоршелла">Флойд-Уоршелл</button>
                <button class="algorithm-btn" data-algorithm="prim" title="Алгоритм Прима (MST)">Прима (MST)</button>
                <button class="algorithm-btn" data-algorithm="minimum_spanning_tree" title="Минимальное остовное дерево">Остовное дерево</button>
                <button class="algorithm-btn" data-algorithm="topological_sort" title="Топологическая сортировка">Топологическая</button>
                <button class="algorithm-btn" data-algorithm="find_eulerian_path" title="Эйлеров путь">Эйлеров путь</button>
                <button class="algorithm-btn" data-algorithm="find_hamiltonian_path" title="Гамильтонов путь">Гамильтонов путь</button>
                <button class="algorithm-btn" data-algorithm="is_connected" title="Проверка связности">Связность</button>
                <button class="algorithm-btn" data-algorithm="find_components" title="Компоненты связности">Компоненты</button>
                <button class="algorithm-btn" data-algorithm="is_bipartite" title="Проверка на двудольность">Двудольность</button>
            </div>
            
            <div id="algorithm-params" style="display: none; margin: 15px 0; padding: 15px; background: #f5f5f5; border-radius: 4px;">
                <h4 style="margin-top: 0;">Параметры алгоритма:</h4>
                <div class="form-group" id="start-vertex-param" style="display: none;">
                    <label for="algorithm-start-vertex">Начальная вершина:</label>
                    <select id="algorithm-start-vertex"></select>
                </div>
                <div class="form-group" id="end-vertex-param" style="display: none;">
                    <label for="algorithm-end-vertex">Конечная вершина:</label>
                    <select id="algorithm-end-vertex"></select>
                </div>
                <div class="form-group" id="weighted-param" style="display: none;">
                    <label>
                        <input type="checkbox" id="algorithm-weighted">
                        Учитывать веса рёбер
                    </label>
                </div>
                <div id="algorithm-description" style="margin-top: 10px; font-size: 13px; color: #666;"></div>
            </div>
            
            <div id="algorithm-result" style="display: none; margin: 15px 0; padding: 15px; background: #f5f5f5; border-radius: 4px; max-height: 300px; overflow-y: auto;">
                <h4 style="margin-top: 0;">Результат:</h4>
                <div id="result-content"></div>
                <button id="visualize-result-btn" style="display: none; margin-top: 10px;" class="primary">Визуализировать</button>
            </div>
            
            <div class="modal-buttons">
                <button id="cancel-algorithm-btn">Закрыть</button>
                <button id="run-algorithm-btn" class="primary" style="display: none;">Запустить алгоритм</button>
            </div>
        </div>
    `;
    document.body.appendChild(algorithmModal);
    
    // Обработчики модальных окон
    document.getElementById('cancel-edit-edge-btn').addEventListener('click', () => {
        editEdgeModal.style.display = 'none';
        editingEdgeId = null;
        selectElement(null);
    });
    
    document.getElementById('confirm-edit-edge-btn').addEventListener('click', async () => {
        if (!editingEdgeId) return;
        
        const edge = edgesData.get(editingEdgeId);
        if (edge) {
            const oldData = {
                weight: edge.weight,
                directed: edge.directed
            };
            
            const newWeight = parseFloat(document.getElementById('edit-edge-weight').value) || 1;
            const newDirected = document.getElementById('edit-edge-directed').checked;
            
            edge.weight = newWeight;
            edge.directed = newDirected;
            updateEdgeVisuals(editingEdgeId);
            
            saveState('edit-edge', {
                id: editingEdgeId,
                old: oldData,
                new: { weight: newWeight, directed: newDirected }
            });
            
            // Синхронизируем с сервером
            try {
                await removeEdgeFromServer(edge.from.toString(), edge.to.toString());
                await addEdgeToServer(edge.from.toString(), edge.to.toString(), newWeight, newDirected);
            } catch (error) {
                console.warn('Failed to sync edge edit to server, continuing locally:', error);
            }
        }
        editEdgeModal.style.display = 'none';
        editingEdgeId = null;
        selectElement(null);
    });
    
    createRandomBtn.addEventListener('click', () => {
        if (activeMode) toggleMode(activeMode); 
        randomGraphModal.style.display = 'flex';
    });
    
    document.getElementById('cancel-random-btn').addEventListener('click', () => {
        randomGraphModal.style.display = 'none';
    });
    
    document.getElementById('confirm-random-btn').addEventListener('click', async () => {
        const confirmBtn = document.getElementById('confirm-random-btn');
        const originalText = confirmBtn.textContent;
        
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Создание...';
        
        const numNodes = parseInt(document.getElementById('random-nodes').value);
        const numEdges = parseInt(document.getElementById('random-edges').value);
        const directed = document.getElementById('random-directed').checked;
        const weighted = document.getElementById('random-weighted').checked;
        
        if (isNaN(numNodes) || numNodes < 2) {
            alert('Количество вершин должно быть не менее 2.');
            confirmBtn.disabled = false;
            confirmBtn.textContent = originalText;
            return;
        }
        
        const maxEdges = directed ? numNodes * (numNodes - 1) : numNodes * (numNodes - 1) / 2;
        
        if (isNaN(numEdges) || numEdges < 0 || numEdges > maxEdges) {
            alert(`Количество рёбер должно быть от 0 до ${maxEdges} для ${numNodes} вершин.`);
            confirmBtn.disabled = false;
            confirmBtn.textContent = originalText;
            return;
        }
        
        if (numNodes > 50) {
            if (!confirm(`Создание графа с ${numNodes} вершинами может замедлить работу. Продолжить?`)) {
                confirmBtn.disabled = false;
                confirmBtn.textContent = originalText;
                return;
            }
        }
        
        if (numEdges > 100) {
            if (!confirm(`Создание графа с ${numEdges} рёбрами может замедлить работу. Продолжить?`)) {
                confirmBtn.disabled = false;
                confirmBtn.textContent = originalText;
                return;
            }
        }
        
        try {
            await createRandomGraph(numNodes, numEdges, directed, weighted);
            randomGraphModal.style.display = 'none';
        } catch (error) {
            alert('Ошибка при создании графа: ' + error.message);
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = originalText;
        }
    });
    
    createClassicBtn.addEventListener('click', () => {
        if (activeMode) toggleMode(activeMode); 
        classicGraphModal.style.display = 'flex';
    });
    
    document.getElementById('cancel-classic-btn').addEventListener('click', () => {
        classicGraphModal.style.display = 'none';
    });
    
    document.getElementById('confirm-classic-btn').addEventListener('click', async () => {
        const confirmBtn = document.getElementById('confirm-classic-btn');
        const originalText = confirmBtn.textContent;
        
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Создание...';
        
        const numNodes = parseInt(document.getElementById('classic-nodes').value);
        const graphType = document.getElementById('classic-type').value;
        const directed = document.getElementById('classic-directed').checked;
        
        if (isNaN(numNodes) || numNodes < 2) {
            alert('Количество вершин должно быть не менее 2.');
            confirmBtn.disabled = false;
            confirmBtn.textContent = originalText;
            return;
        }
        
        if (numNodes > 30) {
            if (!confirm(`Создание классического графа с ${numNodes} вершинами может замедлить работу. Продолжить?`)) {
                confirmBtn.disabled = false;
                confirmBtn.textContent = originalText;
                return;
            }
        }
        
        try {
            await createClassicGraphByType(numNodes, graphType, directed);
            classicGraphModal.style.display = 'none';
        } catch (error) {
            alert('Ошибка при создании графа: ' + error.message);
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = originalText;
        }
    });
    
    // Обработчики для алгоритмов
    selectAlgorithmBtn.addEventListener('click', () => {
        if (activeMode) toggleMode(activeMode); 
        
        // Заполняем список вершин
        const startVertexSelect = document.getElementById('algorithm-start-vertex');
        const endVertexSelect = document.getElementById('algorithm-end-vertex');
        startVertexSelect.innerHTML = '';
        endVertexSelect.innerHTML = '';
        
        const vertices = Array.from(nodesData.keys());
        if (vertices.length === 0) {
            alert('Для запуска алгоритмов добавьте вершины в граф.');
            return;
        }
        
        vertices.forEach(vertexId => {
            const option1 = document.createElement('option');
            option1.value = vertexId;
            option1.textContent = vertexId;
            startVertexSelect.appendChild(option1);
            
            const option2 = document.createElement('option');
            option2.value = vertexId;
            option2.textContent = vertexId;
            endVertexSelect.appendChild(option2);
        });
        
        // Скрываем предыдущие результаты
        document.getElementById('algorithm-result').style.display = 'none';
        document.getElementById('run-algorithm-btn').style.display = 'none';
        document.getElementById('algorithm-params').style.display = 'none';
        document.getElementById('visualize-result-btn').style.display = 'none';
        
        algorithmModal.style.display = 'flex';
    });
    
    document.getElementById('cancel-algorithm-btn').addEventListener('click', () => {
        algorithmModal.style.display = 'none';
    });
    
    // Описания алгоритмов
    const algorithmDescriptions = {
        'dfs': 'Обход графа в глубину (Depth-First Search) - рекурсивный обход графа, идущий "вглубь" насколько возможно перед возвратом.',
        'bfs': 'Обход графа в ширину (Breadth-First Search) - обход графа уровень за уровнем.',
        'dijkstra': 'Алгоритм Дейкстры - поиск кратчайшего пути между вершинами во взвешенном графе с неотрицательными весами.',
        'ford_bellman': 'Алгоритм Форда-Беллмана - поиск кратчайших путей из одной вершины во взвешенном графе (может содержать отрицательные веса, но не отрицательные циклы).',
        'floyd_algorithm': 'Алгоритм Флойда-Уоршелла - поиск кратчайших путей между всеми парами вершин во взвешенном графе.',
        'prim': 'Алгоритм Прима - построение минимального остовного дерева для взвешенного неориентированного графа.',
        'minimum_spanning_tree': 'Минимальное остовное дерево - подграф, связывающий все вершины с минимальным суммарным весом рёбер.',
        'topological_sort': 'Топологическая сортировка - линейное упорядочивание вершин ориентированного графа, при котором для любого ребра (u→v) вершина u идёт раньше v.',
        'find_eulerian_path': 'Эйлеров путь - путь в графе, проходящий через каждое ребро ровно один раз.',
        'find_hamiltonian_path': 'Гамильтонов путь - путь в графе, проходящий через каждую вершину ровно один раз.',
        'is_connected': 'Проверка связности - проверка, существует ли путь между любой парой вершин графа.',
        'find_components': 'Компоненты связности - поиск всех максимально связных подграфов.',
        'is_bipartite': 'Проверка двудольности - проверка, можно ли раскрасить вершины графа в два цвета так, чтобы смежные вершины имели разные цвета.'
    };
    
    // Обработчики для кнопок алгоритмов
    algorithmModal.addEventListener('click', (event) => {
        if (event.target.classList.contains('algorithm-btn')) {
            const algorithm = event.target.dataset.algorithm;
            const paramsContainer = document.getElementById('algorithm-params');
            const runBtn = document.getElementById('run-algorithm-btn');
            const resultContainer = document.getElementById('algorithm-result');
            const descriptionEl = document.getElementById('algorithm-description');
            
            // Скрываем все параметры
            document.getElementById('start-vertex-param').style.display = 'none';
            document.getElementById('end-vertex-param').style.display = 'none';
            document.getElementById('weighted-param').style.display = 'none';
            
            // Показываем нужные параметры
            if (algorithm === 'dfs' || algorithm === 'bfs' || algorithm === 'dijkstra' || 
                algorithm === 'ford_bellman' || algorithm === 'floyd_algorithm' || 
                algorithm === 'topological_sort') {
                document.getElementById('start-vertex-param').style.display = 'block';
            }
            
            if (algorithm === 'dijkstra' || algorithm === 'floyd_algorithm') {
                document.getElementById('end-vertex-param').style.display = 'block';
            }
            
            if (algorithm === 'dijkstra' || algorithm === 'ford_bellman' || 
                algorithm === 'floyd_algorithm' || algorithm === 'prim' || 
                algorithm === 'minimum_spanning_tree') {
                document.getElementById('weighted-param').style.display = 'block';
            }
            
            // Устанавливаем описание
            if (algorithmDescriptions[algorithm]) {
                descriptionEl.textContent = algorithmDescriptions[algorithm];
            }
            
            paramsContainer.style.display = 'block';
            runBtn.style.display = 'block';
            runBtn.dataset.algorithm = algorithm;
            resultContainer.style.display = 'none';
            document.getElementById('visualize-result-btn').style.display = 'none';
        }
    });
    
    document.getElementById('run-algorithm-btn').addEventListener('click', async () => {
        const algorithm = document.getElementById('run-algorithm-btn').dataset.algorithm;
        const params = {};
        
        if (algorithm === 'dfs' || algorithm === 'bfs' || algorithm === 'dijkstra' || 
            algorithm === 'ford_bellman' || algorithm === 'floyd_algorithm' || 
            algorithm === 'topological_sort') {
            const startVertex = document.getElementById('algorithm-start-vertex').value;
            if (startVertex) params.start_vertex = parseInt(startVertex);
        }
        
        if (algorithm === 'dijkstra' || algorithm === 'floyd_algorithm') {
            const endVertex = document.getElementById('algorithm-end-vertex').value;
            if (endVertex) params.end_vertex = parseInt(endVertex);
        }
        
        if (algorithm === 'dijkstra' || algorithm === 'ford_bellman' || 
            algorithm === 'floyd_algorithm' || algorithm === 'prim' || 
            algorithm === 'minimum_spanning_tree') {
            const weighted = document.getElementById('algorithm-weighted').checked;
            params.weighted = weighted;
        }
        
        try {
            const resultContainer = document.getElementById('algorithm-result');
            const resultContent = document.getElementById('result-content');
            const visualizeBtn = document.getElementById('visualize-result-btn');
            
            // Показываем загрузку
            resultContent.innerHTML = '<p>Выполнение алгоритма...</p>';
            resultContainer.style.display = 'block';
            visualizeBtn.style.display = 'none';
            
            // Запускаем алгоритм
            const result = await runAlgorithmOnServer(algorithm, params);
            
            // Отображаем результат
            if (result.error) {
                resultContent.innerHTML = `
                    <div style="color: #d32f2f; padding: 10px; background: #ffebee; border-radius: 4px;">
                        <strong>Ошибка:</strong> ${result.error}
                    </div>
                `;
            } else {
                // Форматируем результат
                resultContent.innerHTML = formatAlgorithmResult(algorithm, result);
                
                // Показываем кнопку визуализации для некоторых алгоритмов
                if (algorithm === 'dijkstra' || algorithm === 'ford_bellman' || 
                    algorithm === 'floyd_algorithm' || algorithm === 'prim' || 
                    algorithm === 'minimum_spanning_tree' || algorithm === 'find_eulerian_path' ||
                    algorithm === 'find_hamiltonian_path' || algorithm === 'topological_sort') {
                    visualizeBtn.style.display = 'block';
                    visualizeBtn.dataset.algorithm = algorithm;
                    visualizeBtn.dataset.result = JSON.stringify(result);
                }
            }
            
            // Прокручиваем к результату
            resultContainer.scrollIntoView({ behavior: 'smooth' });
            
        } catch (error) {
            console.error('Error running algorithm:', error);
            const resultContent = document.getElementById('result-content');
            resultContent.innerHTML = `
                <div style="color: #d32f2f; padding: 10px; background: #ffebee; border-radius: 4px;">
                    <strong>Ошибка:</strong> ${error.message}
                </div>
            `;
        }
    });
    
    // Функция форматирования результатов алгоритмов
    function formatAlgorithmResult(algorithm, result) {
        let html = '';
        
        switch(algorithm) {
            case 'dfs':
            case 'bfs':
                html = `
                    <div style="margin-bottom: 10px;">
                        <strong>Порядок обхода:</strong> ${result.traversal_order?.join(' → ') || 'Нет данных'}
                    </div>
                    <div>
                        <strong>Посещено вершин:</strong> ${result.visited_count || 0}
                    </div>
                `;
                break;
                
            case 'dijkstra':
                if (result.success) {
                    html = `
                        <div style="margin-bottom: 10px;">
                            <strong>Кратчайший путь:</strong> ${result.path?.join(' → ') || 'Нет пути'}
                        </div>
                        <div style="margin-bottom: 10px;">
                            <strong>Длина пути:</strong> ${result.distance || 0}
                        </div>
                        ${result.path_details ? `
                            <div>
                                <strong>Детали пути:</strong>
                                <ul style="margin: 5px 0; padding-left: 20px;">
                                    ${result.path_details.map(d => `<li>Вершина ${d.vertex}: расстояние ${d.distance_from_start}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    `;
                } else {
                    html = `<div style="color: #f57c00;">${result.message || 'Путь не найден'}</div>`;
                }
                break;
                
            case 'ford_bellman':
                if (result.success) {
                    html = `
                        <div style="margin-bottom: 10px;">
                            <strong>Алгоритм успешно завершен</strong>
                        </div>
                        ${result.distances ? `
                            <div>
                                <strong>Расстояния от начальной вершины:</strong>
                                <table style="width: 100%; margin-top: 5px; border-collapse: collapse;">
                                    <tr style="background: #e0e0e0;">
                                        <th style="padding: 5px; border: 1px solid #ccc;">Вершина</th>
                                        <th style="padding: 5px; border: 1px solid #ccc;">Расстояние</th>
                                        <th style="padding: 5px; border: 1px solid #ccc;">Доступна</th>
                                    </tr>
                                    ${result.distances.map(d => `
                                        <tr>
                                            <td style="padding: 5px; border: 1px solid #ccc;">${d.vertex}</td>
                                            <td style="padding: 5px; border: 1px solid #ccc;">${d.distance}</td>
                                            <td style="padding: 5px; border: 1px solid #ccc;">${d.reachable ? '✓' : '✗'}</td>
                                        </tr>
                                    `).join('')}
                                </table>
                            </div>
                        ` : ''}
                    `;
                } else {
                    html = `
                        <div style="color: #d32f2f; margin-bottom: 10px;">
                            <strong>Обнаружен отрицательный цикл!</strong>
                        </div>
                        <div>${result.message || 'Алгоритм не может быть выполнен'}</div>
                    `;
                }
                break;
                
            case 'floyd_algorithm':
                if (result.success) {
                    html = `
                        <div style="margin-bottom: 10px;">
                            <strong>Кратчайший путь:</strong> ${result.path?.join(' → ') || 'Нет пути'}
                        </div>
                        <div>
                            <strong>Длина пути:</strong> ${result.distance || 0}
                        </div>
                    `;
                } else {
                    html = `<div style="color: #f57c00;">${result.message || 'Путь не найден'}</div>`;
                }
                break;
                
            case 'prim':
            case 'minimum_spanning_tree':
                if (result.success) {
                    html = `
                        <div style="margin-bottom: 10px;">
                            <strong>Минимальное остовное дерево построено</strong>
                        </div>
                        <div style="margin-bottom: 10px;">
                            <strong>Общий вес:</strong> ${result.total_weight || 0}
                        </div>
                        ${result.edges ? `
                            <div>
                                <strong>Рёбра MST (${result.edges.length}):</strong>
                                <ul style="margin: 5px 0; padding-left: 20px;">
                                    ${result.edges.map(e => `<li>${e.from} → ${e.to} (вес: ${e.weight})</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    `;
                } else {
                    html = `<div style="color: #f57c00;">${result.message || 'Ошибка'}</div>`;
                }
                break;
                
            case 'topological_sort':
                if (result.success) {
                    html = `
                        <div style="margin-bottom: 10px;">
                            <strong>Топологический порядок:</strong> ${result.order?.join(' → ') || 'Нет порядка'}
                        </div>
                        ${result.levels ? `
                            <div>
                                <strong>Уровни:</strong>
                                ${result.levels.map(l => `
                                    <div style="margin: 5px 0;">
                                        <strong>Уровень ${l.level}:</strong> ${l.vertices?.join(', ')}
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    `;
                } else {
                    html = `<div style="color: #d32f2f;">${result.message || 'Граф содержит циклы'}</div>`;
                }
                break;
                
            case 'find_eulerian_path':
                if (result.success) {
                    html = `
                        <div style="margin-bottom: 10px;">
                            <strong>${result.is_cycle ? 'Эйлеров цикл' : 'Эйлеров путь'}:</strong> ${result.vertex_path?.join(' → ') || 'Нет пути'}
                        </div>
                        <div style="margin-bottom: 10px;">
                            <strong>Длина пути:</strong> ${result.path_length || 0} вершин
                        </div>
                        <div>
                            <strong>Рёбра:</strong> ${result.edges?.length || 0}
                        </div>
                    `;
                } else {
                    html = `<div style="color: #f57c00;">${result.message || 'Эйлеров путь не существует'}</div>`;
                }
                break;
                
            case 'find_hamiltonian_path':
                if (result.success) {
                    html = `
                        <div style="margin-bottom: 10px;">
                            <strong>${result.is_cycle ? 'Гамильтонов цикл' : 'Гамильтонов путь'}:</strong> ${result.path?.join(' → ') || 'Нет пути'}
                        </div>
                        <div style="margin-bottom: 10px;">
                            <strong>Длина пути:</strong> ${result.path_length || 0} вершин
                        </div>
                        <div>
                            <strong>Рёбра:</strong> ${result.edges?.length || 0}
                        </div>
                    `;
                } else {
                    html = `<div style="color: #f57c00;">${result.message || 'Гамильтонов путь не найден'}</div>`;
                }
                break;
                
            case 'is_connected':
                html = `
                    <div style="margin-bottom: 10px;">
                        <strong>Граф ${result.connected ? 'связный' : 'несвязный'}</strong>
                    </div>
                `;
                break;
                
            case 'find_components':
                html = `
                    <div style="margin-bottom: 10px;">
                        <strong>Найдено компонент связности:</strong> ${result.components?.length || 0}
                    </div>
                    ${result.components ? `
                        <div>
                            <strong>Компоненты:</strong>
                            <ul style="margin: 5px 0; padding-left: 20px;">
                                ${result.components.map((comp, i) => `
                                    <li>Компонента ${i + 1}: [${comp.join(', ')}]</li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                `;
                break;
                
            case 'is_bipartite':
                html = `
                    <div style="margin-bottom: 10px;">
                        <strong>Граф ${result.bipartite ? 'двудольный' : 'не двудольный'}</strong>
                    </div>
                `;
                break;
                
            default:
                // Для неизвестных алгоритмов показываем JSON
                html = `<pre style="margin: 0; font-size: 12px;">${JSON.stringify(result, null, 2)}</pre>`;
        }
        
        return html;
    }
    
    // Визуализация результатов алгоритмов
    document.getElementById('visualize-result-btn').addEventListener('click', function() {
        const algorithm = this.dataset.algorithm;
        const result = JSON.parse(this.dataset.result);
        
        // Сбрасываем предыдущее выделение
        clearAlgorithmVisualization();
        
        // Применяем визуализацию в зависимости от алгоритма
        switch(algorithm) {
            case 'dijkstra':
                visualizePath(result.path || []);
                break;
                
            case 'prim':
            case 'minimum_spanning_tree':
                visualizeMST(result.edges || []);
                break;
                
            case 'find_eulerian_path':
                visualizeEulerianPath(result.vertex_path || [], result.edges || []);
                break;
                
            case 'find_hamiltonian_path':
                visualizeHamiltonianPath(result.path || [], result.edges || []);
                break;
                
            case 'topological_sort':
                visualizeTopologicalSort(result.order || [], result.levels || []);
                break;
        }
        
        algorithmModal.style.display = 'none';
    });
    
    function clearAlgorithmVisualization() {
        // Сбрасываем цвета вершин и рёбер
        graphElements.querySelectorAll('.node circle').forEach(circle => {
            circle.setAttribute('fill', 'white');
            circle.setAttribute('stroke', 'black');
        });
        
        graphElements.querySelectorAll('line, path').forEach(edge => {
            edge.setAttribute('stroke', '#666');
            edge.setAttribute('stroke-width', '2');
        });
        
        // Удаляем временные элементы визуализации
        document.querySelectorAll('.algorithm-visualization').forEach(el => el.remove());
    }
    
    function visualizePath(path) {
        if (!path || path.length < 2) return;
        
        // Выделяем вершины пути
        path.forEach((vertexId, index) => {
            const node = nodesData.get(vertexId);
            if (node && node.element) {
                const circle = node.element.querySelector('circle');
                if (circle) {
                    circle.setAttribute('fill', index === 0 ? '#4CAF50' : 
                                        index === path.length - 1 ? '#f44336' : '#2196F3');
                }
            }
        });
        
        // Выделяем рёбра пути
        for (let i = 0; i < path.length - 1; i++) {
            const from = path[i];
            const to = path[i + 1];
            
            // Ищем ребро
            let foundEdge = null;
            edgesData.forEach((edge, edgeId) => {
                if ((edge.from === from && edge.to === to) || 
                    (!edge.directed && edge.from === to && edge.to === from)) {
                    foundEdge = edge;
                }
            });
            
            if (foundEdge && foundEdge.element) {
                foundEdge.element.setAttribute('stroke', '#FF9800');
                foundEdge.element.setAttribute('stroke-width', '3');
            }
        }
    }
    
    function visualizeMST(edges) {
        edges.forEach(edge => {
            const from = edge.from;
            const to = edge.to;
            
            // Ищем ребро
            let foundEdge = null;
            edgesData.forEach((e, edgeId) => {
                if ((e.from === from && e.to === to) || 
                    (!e.directed && e.from === to && e.to === from)) {
                    foundEdge = e;
                }
            });
            
            if (foundEdge && foundEdge.element) {
                foundEdge.element.setAttribute('stroke', '#4CAF50');
                foundEdge.element.setAttribute('stroke-width', '3');
            }
            
            // Выделяем вершины
            [from, to].forEach(vertexId => {
                const node = nodesData.get(vertexId);
                if (node && node.element) {
                    const circle = node.element.querySelector('circle');
                    if (circle) {
                        circle.setAttribute('fill', '#E8F5E9');
                    }
                }
            });
        });
    }
    
    function visualizeEulerianPath(vertexPath, edges) {
        visualizePath(vertexPath);
    }
    
    function visualizeHamiltonianPath(path, edges) {
        visualizePath(path);
    }
    
    function visualizeTopologicalSort(order, levels) {
        // Выделяем вершины в порядке топологической сортировки
        order.forEach((vertexId, index) => {
            const node = nodesData.get(vertexId);
            if (node && node.element) {
                const circle = node.element.querySelector('circle');
                if (circle) {
                    const hue = (index * 30) % 360;
                    circle.setAttribute('fill', `hsl(${hue}, 70%, 80%)`);
                    
                    // Добавляем номер порядка
                    const text = node.element.querySelector('text');
                    if (text) {
                        const orderText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                        orderText.setAttribute('x', '0');
                        orderText.setAttribute('y', '25');
                        orderText.setAttribute('text-anchor', 'middle');
                        orderText.setAttribute('fill', '#333');
                        orderText.setAttribute('font-size', '12');
                        orderText.textContent = `#${index + 1}`;
                        node.element.appendChild(orderText);
                    }
                }
            }
        });
    }
    
    // Обработчики кнопок инструментов
    addVertexBtn.addEventListener('click', () => toggleMode('add-vertex'));
    addEdgeBtn.addEventListener('click', () => toggleMode('add-edge'));
    deleteElementBtn.addEventListener('click', () => toggleMode('delete'));
    
    // Инициализация
    updateViewBox();
    updateUndoRedoButtons();
    
    // Загружаем граф с сервера при загрузке страницы
    window.addEventListener('load', async () => {
        try {
            console.log('Loading graph from server...');
            await loadGraphFromServer();
            console.log('Graph loaded successfully');
        } catch (error) {
            console.warn('Could not load graph from server, starting with empty graph:', error);
        }
    });
    
    // Периодическая синхронизация с сервером
    setInterval(async () => {
        try {
            await syncGraphToServer();
        } catch (error) {
            console.warn('Background sync failed:', error);
        }
    }, 30000);
});
