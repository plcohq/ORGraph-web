from flask import Flask, request, jsonify, session, send_from_directory
from flask_session import Session
import orgraph_core  # Наш C++ модуль
import os
import uuid
import json
import tempfile
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, '..', 'static')
app = Flask(__name__, static_folder=STATIC_DIR, static_url_path='')

# Конфигурация сессии
app.config['SECRET_KEY'] = os.urandom(24)
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_FILE_DIR'] = tempfile.mkdtemp()
Session(app)

def get_user_graph():
    """Получить или создать граф пользователя из сессии"""
    if 'user_id' not in session:
        session['user_id'] = str(uuid.uuid4())
        session['graph_data'] = {
            'vertices': [],  # Список вершин с их данными
            'edges': [],     # Список рёбер: (from, to, weight)
        }
        session['history'] = []
        session['history_index'] = -1
    
    # Инициализируем graph_data, если его нет
    if 'graph_data' not in session:
        session['graph_data'] = {
            'vertices': [],
            'edges': [],
        }
    
    # Инициализируем историю, если её нет
    if 'history' not in session:
        session['history'] = []
        session['history_index'] = -1
    
    # Создаём объект графа из данных сессии
    graph = orgraph_core.Graph()
    
    # Восстанавливаем вершины
    for vertex_data in session['graph_data']['vertices']:
        graph.add_vertex(vertex_data['label'])
    
    # Восстанавливаем рёбра
    for edge in session['graph_data']['edges']:
        graph.add_edge(edge[0], edge[1], edge[2])
    
    return graph

def save_graph_state(graph):
    """Сохранить состояние графа для undo/redo и обновить данные сессии"""
    # Получаем текущее состояние
    vertices = graph.get_vertices()
    edges = graph.get_edges()
    
    # Собираем данные о вершинах с их метками
    vertices_data = []
    for i, vertex_id in enumerate(vertices):
        # Предполагаем, что у вершины есть метод get_label() или используем ID как метку
        try:
            label = graph.get_vertex_label(vertex_id)
        except:
            label = f"v{vertex_id}"
        vertices_data.append({'id': vertex_id, 'label': label})
    
    edges_data = [list(edge) for edge in edges]  # Преобразуем tuple в list
    
    graph_state = {
        'vertices': vertices_data,
        'edges': edges_data
    }
    
    # Удаляем состояния после текущего индекса
    session['history'] = session['history'][:session['history_index'] + 1]
    
    # Добавляем новое состояние
    session['history'].append(graph_state)
    session['history_index'] += 1
    
    # Обновляем текущие данные графа в сессии
    session['graph_data'] = graph_state

def update_session_from_graph(graph):
    """Обновить данные сессии из текущего состояния графа"""
    vertices = graph.get_vertices()
    edges = graph.get_edges()
    
    vertices_data = []
    for i, vertex_id in enumerate(vertices):
        try:
            label = graph.get_vertex_label(vertex_id)
        except:
            label = f"v{vertex_id}"
        vertices_data.append({'id': vertex_id, 'label': label})
    
    edges_data = [list(edge) for edge in edges]
    
    session['graph_data'] = {
        'vertices': vertices_data,
        'edges': edges_data
    }

# Маршруты API
@app.route('/')
def index():
    # Путь к index.html внутри папки assets
    return send_from_directory(os.path.join(app.static_folder, 'assets'), 'index.html')

@app.route('/index.html')
def index_html():
    return send_from_directory(os.path.join(app.static_folder, 'assets'), 'index.html')
@app.route('/<path:filename>')
def static_files(filename):
    # Пробуем найти файл в разных папках
    possible_paths = [
        os.path.join(app.static_folder, 'assets', filename),
        os.path.join(app.static_folder, 'css', filename),
        os.path.join(app.static_folder, 'js', filename),
        os.path.join(app.static_folder, filename),
    ]
    
    for file_path in possible_paths:
        if os.path.exists(file_path):
            return send_from_directory(os.path.dirname(file_path), os.path.basename(file_path))
    
    return "File not found", 404
@app.route('/api/graph', methods=['GET'])
def get_graph():
    if 'user_id' not in session:
        return jsonify({'vertices': [], 'edges': []})
    
    graph = get_user_graph()
    
    try:
        # Получаем граф в формате JSON
        graph_json = graph.to_json()
        graph_data = json.loads(graph_json)
        
        print(f"DEBUG: Graph data from C++ module: {graph_data}")  # Логирование
        
        # Фильтруем дубликаты рёбер
        edges = graph_data.get('edges', [])
        unique_edges = []
        seen_edges = set()
        
        for edge in edges:
            # Создаем ключ для проверки уникальности
            if isinstance(edge, dict):
                edge_key = (edge.get('source'), edge.get('target'))
            elif isinstance(edge, list) and len(edge) >= 2:
                edge_key = (edge[0], edge[1])
            else:
                edge_key = tuple(edge[:2])
                
            if edge_key not in seen_edges:
                seen_edges.add(edge_key)
                unique_edges.append(edge)
        
        return jsonify({
            'vertices': [str(v) for v in graph.get_vertices()],
            'edges': unique_edges  # Возвращаем уникальные ребра
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/graph/clear', methods=['POST'])
def clear_graph():
    # Создаем или получаем сессию
    if 'user_id' not in session:
        session['user_id'] = str(uuid.uuid4())
    
    # Инициализируем данные графа, если их нет
    if 'graph_data' not in session:
        session['graph_data'] = {'vertices': [], 'edges': []}
    
    # Получаем текущий граф (содержащий текущие данные)
    graph = get_user_graph()
    
    # Сохраняем текущее состояние для undo
    save_graph_state(graph)
    
    # Очищаем граф
    graph.clear()
    
    # Обновляем сессию с пустым графом
    update_session_from_graph(graph)
    
    return jsonify({'status': 'success'})

@app.route('/api/vertex', methods=['POST'])
def add_vertex():
    if 'user_id' not in session:
        session['user_id'] = str(uuid.uuid4())
    
    data = request.json
    
    if not data or 'id' not in data:
        return jsonify({'error': 'Vertex ID is required'}), 400
    
    graph = get_user_graph()
    save_graph_state(graph)
    
    try:
        # В нашей реализации вершины добавляются с автоинкрементом ID
        # Метка используется для отображения
        vertex_id = graph.add_vertex(str(data['id']))
        update_session_from_graph(graph)
        return jsonify({'status': 'success', 'id': vertex_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/vertex/<vertex_id>', methods=['DELETE'])
def remove_vertex(vertex_id):
    if 'user_id' not in session:
        return jsonify({'error': 'No session found'}), 400
    
    graph = get_user_graph()
    save_graph_state(graph)
    
    try:
        success = graph.remove_vertex(int(vertex_id))
        update_session_from_graph(graph)
        return jsonify({'status': 'success' if success else 'failed'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/edge', methods=['POST'])
def add_edge():
    if 'user_id' not in session:
        session['user_id'] = str(uuid.uuid4())
    
    data = request.json
    
    if not data or 'source' not in data or 'target' not in data:
        return jsonify({'error': 'Source and target vertices are required'}), 400
    
    graph = get_user_graph()
    save_graph_state(graph)
    
    source = int(data['source'])
    target = int(data['target'])
    weight = float(data.get('weight', 1.0))
    directed = bool(data.get('directed', True))  # ИЗМЕНЕНИЕ: по умолчанию True!
    
    print(f"DEBUG: Adding edge {source}->{target}, weight={weight}, directed={directed}")
    
    try:
        success = graph.add_edge(source, target, weight)
        
        # Если граф ненаправленный и нужно двустороннее ребро
        # ТОЛЬКО если явно указано directed=False
        if not directed and source != target:  # Добавляем проверку source != target
            # Добавляем обратное ребро для ненаправленного графа
            print(f"DEBUG: Adding reverse edge {target}->{source}")
            reverse_success = graph.add_edge(target, source, weight)
        
        update_session_from_graph(graph)
        return jsonify({'status': 'success' if success else 'failed'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/edge/<source>/<target>', methods=['DELETE'])
def remove_edge(source, target):
    if 'user_id' not in session:
        return jsonify({'error': 'No session found'}), 400
    
    graph = get_user_graph()
    save_graph_state(graph)
    
    try:
        success = graph.remove_edge(int(source), int(target))
        update_session_from_graph(graph)
        return jsonify({'status': 'success' if success else 'failed'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# Алгоритмы
@app.route('/api/algorithm/<algorithm_name>', methods=['POST'])
def run_algorithm(algorithm_name):
    if 'user_id' not in session:
        return jsonify({'error': 'No session found'}), 400
    
    data = request.json
    graph = get_user_graph()
    
    try:
        if algorithm_name == 'dijkstra':
            start = int(data.get('start_vertex', 0))
            end = int(data.get('end_vertex', 0))
            result = graph.dijkstra(start, end)
            
        elif algorithm_name == 'prim':
            result = graph.prim()
            
        elif algorithm_name == 'ford_bellman':
            start = int(data.get('start_vertex', 0))
            result = graph.ford_bellman(start)
            
        elif algorithm_name == 'floyd_algorithm':
            start = int(data.get('start_vertex', 0))
            end = int(data.get('end_vertex', 0))
            result = graph.floyd_algorithm(start, end)
            
        elif algorithm_name == 'find_eulerian_path':
            result = graph.find_eulerian_path()
            
        elif algorithm_name == 'find_hamiltonian_path':
            result = graph.find_hamiltonian_path()
            
        elif algorithm_name == 'topological_sort':
            result = graph.topological_sort()
            
        elif algorithm_name == 'is_connected':
            result = graph.is_connected()
            return jsonify({'result': {'connected': result}})
            
        elif algorithm_name == 'find_components':
            result = graph.find_components()
            return jsonify({'result': {'components': result}})
            
        elif algorithm_name == 'is_bipartite':
            result = graph.is_bipartite()
            return jsonify({'result': {'bipartite': result}})
            
        elif algorithm_name == 'minimum_spanning_tree':
            result = graph.minimum_spanning_tree()
            
        elif algorithm_name == 'dfs':
            start = int(data.get('start_vertex', 0))
            result = graph.dfs(start)
            
        elif algorithm_name == 'bfs':
            start = int(data.get('start_vertex', 0))
            result = graph.bfs(start)
            
        else:
            return jsonify({'error': f'Algorithm {algorithm_name} not found'}), 404
        
        return jsonify({'result': result})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/undo', methods=['POST'])
def undo_action():
    if 'user_id' not in session or session['history_index'] <= 0:
        return jsonify({'error': 'No more actions to undo'}), 400
    
    session['history_index'] -= 1
    state = session['history'][session['history_index']]
    
    # Обновляем данные графа в сессии
    session['graph_data'] = state
    
    return jsonify({'status': 'success'})

@app.route('/api/redo', methods=['POST'])
def redo_action():
    if 'user_id' not in session or session['history_index'] >= len(session['history']) - 1:
        return jsonify({'error': 'No more actions to redo'}), 400
    
    session['history_index'] += 1
    state = session['history'][session['history_index']]
    
    # Обновляем данные графа в сессии
    session['graph_data'] = state
    
    return jsonify({'status': 'success'})

# Генерация графов
@app.route('/api/graph/random', methods=['POST'])
def generate_random_graph():
    if 'user_id' not in session:
        session['user_id'] = str(uuid.uuid4())
    
    data = request.json
    
    num_vertices = int(data.get('num_vertices', 10))
    num_edges = int(data.get('num_edges', 15))
    directed = bool(data.get('directed', False))
    weighted = bool(data.get('weighted', False))
    
    graph = get_user_graph()
    save_graph_state(graph)
    
    # Очищаем текущий граф
    graph.clear()
    
    # Добавляем вершины
    for i in range(num_vertices):
        graph.add_vertex(f"v{i}")
    
    # Добавляем случайные ребра
    import random
    max_possible_edges = num_vertices * (num_vertices - 1)
    if not directed:
        max_possible_edges //= 2
    
    num_edges = min(num_edges, max_possible_edges)
    
    edges_added = 0
    attempts = 0
    max_attempts = num_edges * 10
    
    while edges_added < num_edges and attempts < max_attempts:
        from_vertex = random.randint(0, num_vertices - 1)
        to_vertex = random.randint(0, num_vertices - 1)
        
        if from_vertex != to_vertex:
            weight = random.uniform(1, 10) if weighted else 1.0
            if graph.add_edge(from_vertex, to_vertex, weight):
                edges_added += 1
        
        attempts += 1
    
    update_session_from_graph(graph)
    
    return jsonify({'status': 'success', 'edges_added': edges_added})

@app.route('/api/graph/classic', methods=['POST'])
def generate_classic_graph():
    if 'user_id' not in session:
        session['user_id'] = str(uuid.uuid4())
    
    data = request.json
    
    graph_type = data.get('type', 'complete')
    num_vertices = int(data.get('num_vertices', 5))
    directed = bool(data.get('directed', False))
    
    graph = get_user_graph()
    save_graph_state(graph)
    
    # Очищаем текущий граф
    graph.clear()
    
    # Добавляем вершины
    for i in range(num_vertices):
        graph.add_vertex(f"v{i}")
    
    # Создаем классический граф
    if graph_type == 'complete':
        # Полный граф K_n
        for i in range(num_vertices):
            for j in range(i + 1, num_vertices):
                graph.add_edge(i, j, 1.0)
                if directed:
                    graph.add_edge(j, i, 1.0)
    
    elif graph_type == 'cycle':
        # Цикл C_n
        for i in range(num_vertices):
            graph.add_edge(i, (i + 1) % num_vertices, 1.0)
            if directed:
                graph.add_edge((i + 1) % num_vertices, i, 1.0)
    
    elif graph_type == 'path':
        # Путь P_n
        for i in range(num_vertices - 1):
            graph.add_edge(i, i + 1, 1.0)
            if directed:
                graph.add_edge(i + 1, i, 1.0)
    
    update_session_from_graph(graph)
    
    return jsonify({'status': 'success'})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
