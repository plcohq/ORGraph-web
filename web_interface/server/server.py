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
    
    # Восстанавливаем вершины (frontend ID → C++ ID)
    for vertex_data in session['graph_data']['vertices']:
        frontend_id = int(vertex_data['id'])
        cpp_id = frontend_id - 1  # Преобразуем в C++ ID
        try:
            # Создаём вершину с правильным C++ ID
            graph.add_vertex(vertex_data['label'])
        except Exception as e:
            print(f"WARNING: Failed to restore vertex {frontend_id}: {e}")
    
    # Восстанавливаем рёбра (frontend ID → C++ ID)
    for edge in session['graph_data']['edges']:
        if len(edge) >= 2:
            source_frontend = int(edge[0])
            target_frontend = int(edge[1])
            source_cpp = source_frontend - 1
            target_cpp = target_frontend - 1
            weight = float(edge[2]) if len(edge) > 2 else 1.0
            try:
                graph.add_edge(source_cpp, target_cpp, weight)
            except Exception as e:
                print(f"WARNING: Failed to restore edge {source_frontend}->{target_frontend}: {e}")
    
    return graph

def save_graph_state(graph):
    """Сохранить состояние графа для undo/redo"""
    try:
        # Получаем вершины из C++ модуля (C++ IDs)
        vertices_cpp = []
        try:
            vertices_cpp = graph.get_vertices()  # [0, 1, 2, ...]
        except Exception as e:
            print(f"WARNING: Could not get vertices: {e}")
        
        # Получаем рёбра из C++ модуля
        edges_cpp = []
        try:
            edges_cpp = graph.get_edges()  # [(0, 1, 1.0), ...]
        except Exception as e:
            print(f"WARNING: Could not get edges: {e}")
        
        # Преобразуем в формат для сессии (frontend IDs)
        vertices_data = []
        for cpp_id in vertices_cpp:
            frontend_id = cpp_id + 1
            try:
                label = graph.get_vertex_label(cpp_id)
            except:
                label = f"v{frontend_id}"
            vertices_data.append({'id': frontend_id, 'label': label})
        
        edges_data = []
        for edge in edges_cpp:
            if isinstance(edge, (list, tuple)) and len(edge) >= 2:
                source_cpp = int(edge[0])
                target_cpp = int(edge[1])
                source_frontend = source_cpp + 1
                target_frontend = target_cpp + 1
                weight = float(edge[2]) if len(edge) > 2 else 1.0
                edges_data.append([source_frontend, target_frontend, weight])
        
        graph_state = {
            'vertices': vertices_data,
            'edges': edges_data
        }
        
        print(f"DEBUG: Saving state - {len(vertices_data)} vertices, {len(edges_data)} edges")
        
        # Удаляем состояния после текущего индекса
        session['history'] = session['history'][:session['history_index'] + 1]
        
        # Добавляем новое состояние
        session['history'].append(graph_state)
        session['history_index'] += 1
        
        # Обновляем текущие данные графа в сессии
        session['graph_data'] = graph_state
        
    except Exception as e:
        print(f"ERROR in save_graph_state: {e}")

def update_session_from_graph(graph):
    """Обновить данные сессии из текущего состояния графа"""
    try:
        # Получаем данные из C++ модуля
        vertices_cpp = graph.get_vertices()  # [0, 1, 2, ...]
        edges_cpp = graph.get_edges()  # [(0, 1, 1.0), ...]
        
        # Преобразуем в frontend формат
        vertices_data = []
        for cpp_id in vertices_cpp:
            frontend_id = cpp_id + 1
            try:
                label = graph.get_vertex_label(cpp_id)
            except:
                label = f"v{frontend_id}"
            vertices_data.append({'id': frontend_id, 'label': label})
        
        edges_data = []
        for edge in edges_cpp:
            if isinstance(edge, (list, tuple)) and len(edge) >= 2:
                source_cpp = int(edge[0])
                target_cpp = int(edge[1])
                source_frontend = source_cpp + 1
                target_frontend = target_cpp + 1
                weight = float(edge[2]) if len(edge) > 2 else 1.0
                edges_data.append([source_frontend, target_frontend, weight])
        
        session['graph_data'] = {
            'vertices': vertices_data,
            'edges': edges_data
        }
        
        print(f"DEBUG: Updated session - {len(vertices_data)} vertices, {len(edges_data)} edges")
        
    except Exception as e:
        print(f"ERROR in update_session_from_graph: {e}")
        session['graph_data'] = {'vertices': [], 'edges': []}

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
    """Получить текущий граф в формате для фронтенда"""
    if 'user_id' not in session:
        return jsonify({'vertices': [], 'edges': []})
    
    graph = get_user_graph()
    
    try:
        # Получаем вершины из C++ модуля
        vertices_cpp = graph.get_vertices()  # [0, 1, 2, ...]
        vertices_frontend = [str(v + 1) for v in vertices_cpp]  # Преобразуем в [1, 2, 3, ...]
        
        # Получаем рёбра из C++ модуля
        edges_cpp = graph.get_edges()  # [(0, 1, 1.0), (1, 2, 1.0), ...]
        edges_frontend = []
        
        for edge in edges_cpp:
            if isinstance(edge, (list, tuple)) and len(edge) >= 2:
                # Преобразуем индексы C++ (0-based) в фронтенд (1-based)
                source = str(edge[0] + 1)
                target = str(edge[1] + 1)
                weight = float(edge[2]) if len(edge) > 2 else 1.0
                edges_frontend.append({
                    'source': source,
                    'target': target,
                    'weight': weight
                })
        
        print(f"DEBUG: get_graph - returning {len(vertices_frontend)} vertices, {len(edges_frontend)} edges")
        
        return jsonify({
            'vertices': vertices_frontend,
            'edges': edges_frontend
        })
        
    except Exception as e:
        print(f"ERROR in get_graph: {e}")
        return jsonify({'vertices': [], 'edges': []})

@app.route('/api/graph/clear', methods=['POST'])
def clear_graph():
    """Очистить граф"""
    if 'user_id' not in session:
        session['user_id'] = str(uuid.uuid4())
    
    # Получаем текущий граф
    graph = get_user_graph()
    
    # Сохраняем текущее состояние для undo
    save_graph_state(graph)
    
    # Очищаем граф
    print("DEBUG: Clearing graph...")
    graph.clear()
    
    # Обновляем сессию с пустым графом
    update_session_from_graph(graph)
    
    return jsonify({'status': 'success'})

@app.route('/api/vertex', methods=['POST'])
def add_vertex():
    """Добавить вершину"""
    if 'user_id' not in session:
        session['user_id'] = str(uuid.uuid4())
    
    data = request.json
    
    if not data or 'id' not in data:
        return jsonify({'error': 'Vertex ID is required'}), 400
    
    # Фронтенд присылает ID в виде строки "1", "2", и т.д.
    frontend_id = str(data['id'])
    
    graph = get_user_graph()
    save_graph_state(graph)
    
    try:
        # C++ модуль сам назначает ID (0, 1, 2...)
        # Мы передаём метку, а C++ возвращает внутренний ID
        cpp_vertex_id = graph.add_vertex(f"v{frontend_id}")
        
        print(f"DEBUG: Added vertex. Frontend ID: {frontend_id}, C++ ID: {cpp_vertex_id}")
        
        update_session_from_graph(graph)
        return jsonify({'status': 'success', 'id': frontend_id})
        
    except Exception as e:
        print(f"ERROR in add_vertex: {e}")
        return jsonify({'error': str(e)}), 400

@app.route('/api/vertex/<vertex_id>', methods=['DELETE'])
def remove_vertex(vertex_id):
    """Удалить вершину"""
    if 'user_id' not in session:
        return jsonify({'error': 'No session found'}), 400
    
    graph = get_user_graph()
    save_graph_state(graph)
    
    # Преобразуем фронтенд ID в C++ ID
    frontend_id = int(vertex_id)  # "1" → 1
    cpp_id = frontend_id - 1      # 1 → 0
    
    print(f"DEBUG: Removing vertex. Frontend ID: {frontend_id}, C++ ID: {cpp_id}")
    
    try:
        success = graph.remove_vertex(cpp_id)
        update_session_from_graph(graph)
        return jsonify({'status': 'success' if success else 'failed'})
        
    except Exception as e:
        print(f"ERROR in remove_vertex: {e}")
        return jsonify({'error': str(e)}), 400

@app.route('/api/edge', methods=['POST'])
def add_edge():
    """Добавить ребро"""
    if 'user_id' not in session:
        session['user_id'] = str(uuid.uuid4())
    
    data = request.json
    
    if not data or 'source' not in data or 'target' not in data:
        return jsonify({'error': 'Source and target vertices are required'}), 400
    
    graph = get_user_graph()
    save_graph_state(graph)
    
    # Преобразуем фронтенд ID (1-based) в C++ ID (0-based)
    source_frontend = int(data['source'])  # "1" → 1
    target_frontend = int(data['target'])  # "2" → 2
    source_cpp = source_frontend - 1      # 1 → 0
    target_cpp = target_frontend - 1      # 2 → 1
    
    weight = float(data.get('weight', 1.0))
    directed = bool(data.get('directed', False))
    
    print(f"DEBUG: Adding edge. Frontend: {source_frontend}->{target_frontend}, C++: {source_cpp}->{target_cpp}, weight={weight}, directed={directed}")
    
    try:
        success = graph.add_edge(source_cpp, target_cpp, weight)
        
        # Если граф ненаправленный и нужно двустороннее ребро
        if not directed and source_frontend != target_frontend:
            print(f"DEBUG: Adding reverse edge for undirected graph")
            reverse_success = graph.add_edge(target_cpp, source_cpp, weight)
        
        update_session_from_graph(graph)
        return jsonify({'status': 'success' if success else 'failed'})
        
    except Exception as e:
        print(f"ERROR in add_edge: {e}")
        return jsonify({'error': str(e)}), 400

@app.route('/api/edge/<source>/<target>', methods=['DELETE'])
def remove_edge(source, target):
    """Удалить ребро"""
    if 'user_id' not in session:
        return jsonify({'error': 'No session found'}), 400
    
    graph = get_user_graph()
    save_graph_state(graph)
    
    # Преобразуем ID
    source_frontend = int(source)  # "1" → 1
    target_frontend = int(target)  # "2" → 2
    source_cpp = source_frontend - 1
    target_cpp = target_frontend - 1
    
    print(f"DEBUG: Removing edge. Frontend: {source_frontend}->{target_frontend}, C++: {source_cpp}->{target_cpp}")
    
    try:
        success = graph.remove_edge(source_cpp, target_cpp)
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
        # Преобразуем ID вершин из фронтенда в C++
        if algorithm_name == 'dijkstra':
            start_frontend = int(data.get('start_vertex', 1))
            end_frontend = int(data.get('end_vertex', 1))
            start_cpp = start_frontend - 1
            end_cpp = end_frontend - 1
            result = graph.dijkstra(start_cpp, end_cpp)
            
        elif algorithm_name == 'prim':
            result = graph.prim()
            
        elif algorithm_name == 'ford_bellman':
            start_frontend = int(data.get('start_vertex', 1))
            start_cpp = start_frontend - 1
            result = graph.ford_bellman(start_cpp)
            
        elif algorithm_name == 'floyd_algorithm':
            start_frontend = int(data.get('start_vertex', 1))
            end_frontend = int(data.get('end_vertex', 1))
            start_cpp = start_frontend - 1
            end_cpp = end_frontend - 1
            result = graph.floyd_algorithm(start_cpp, end_cpp)
            
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
            start_frontend = int(data.get('start_vertex', 1))
            start_cpp = start_frontend - 1
            result = graph.dfs(start_cpp)
            
        elif algorithm_name == 'bfs':
            start_frontend = int(data.get('start_vertex', 1))
            start_cpp = start_frontend - 1
            result = graph.bfs(start_cpp)
            
        else:
            return jsonify({'error': f'Algorithm {algorithm_name} not found'}), 404
        
        # Преобразуем результат из C++ ID во фронтенд ID
        if isinstance(result, dict) and 'path' in result and isinstance(result['path'], list):
            result['path'] = [v + 1 for v in result['path']]
        
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
    """Генерация случайного графа"""
    if 'user_id' not in session:
        session['user_id'] = str(uuid.uuid4())
    
    data = request.json
    
    try:
        num_vertices = int(data.get('num_vertices', 5))
        num_edges = int(data.get('num_edges', 7))
        directed = bool(data.get('directed', False))
        weighted = bool(data.get('weighted', False))
        
        print(f"DEBUG: Generating random graph: vertices={num_vertices}, edges={num_edges}, directed={directed}, weighted={weighted}")
        
        graph = get_user_graph()
        save_graph_state(graph)
        
        # Очищаем текущий граф
        graph.clear()
        
        # Создаём вершины (C++ присвоит ID 0, 1, 2...)
        created_cpp_ids = []
        for i in range(num_vertices):
            cpp_id = graph.add_vertex(f"random_v{i}")
            created_cpp_ids.append(cpp_id)
        
        print(f"DEBUG: Created vertices with C++ IDs: {created_cpp_ids}")
        
        # Генерируем случайные рёбра
        import random
        
        # Максимально возможное количество рёбер
        max_possible_edges = num_vertices * (num_vertices - 1)
        if not directed:
            max_possible_edges //= 2
        
        num_edges = min(num_edges, max_possible_edges)
        
        edges_added = 0
        attempts = 0
        max_attempts = num_edges * 10
        added_edges = set()
        
        while edges_added < num_edges and attempts < max_attempts:
            # Выбираем случайные вершины (C++ IDs)
            from_cpp = random.randint(0, num_vertices - 1)
            to_cpp = random.randint(0, num_vertices - 1)
            
            if from_cpp != to_cpp:
                # Создаём уникальный ключ для ребра
                if directed:
                    edge_key = (from_cpp, to_cpp)
                else:
                    edge_key = (min(from_cpp, to_cpp), max(from_cpp, to_cpp))
                
                if edge_key not in added_edges:
                    weight = round(random.uniform(1, 10), 1) if weighted else 1.0
                    
                    if graph.add_edge(from_cpp, to_cpp, weight):
                        added_edges.add(edge_key)
                        edges_added += 1
                        
                        # Если граф ненаправленный, добавляем обратное ребро в set
                        if not directed:
                            reverse_key = (to_cpp, from_cpp)
                            added_edges.add(reverse_key)
            
            attempts += 1
        
        print(f"DEBUG: Added {edges_added} edges (requested {num_edges})")
        
        update_session_from_graph(graph)
        
        return jsonify({
            'status': 'success', 
            'vertices': num_vertices,
            'edges_added': edges_added,
            'directed': directed,
            'weighted': weighted
        })
        
    except Exception as e:
        print(f"ERROR in generate_random_graph: {e}")
        return jsonify({'error': str(e)}), 400

@app.route('/api/graph/classic', methods=['POST'])
def generate_classic_graph():
    """Генерация классического графа"""
    if 'user_id' not in session:
        session['user_id'] = str(uuid.uuid4())
    
    data = request.json
    
    try:
        graph_type = data.get('type', 'complete')
        num_vertices = int(data.get('num_vertices', 4))
        directed = bool(data.get('directed', False))
        
        print(f"DEBUG: Generating classic graph: type={graph_type}, vertices={num_vertices}, directed={directed}")
        
        graph = get_user_graph()
        save_graph_state(graph)
        
        # Очищаем текущий граф
        graph.clear()
        
        # Создаём вершины
        created_cpp_ids = []
        for i in range(num_vertices):
            cpp_id = graph.add_vertex(f"{graph_type}_v{i}")
            created_cpp_ids.append(cpp_id)
        
        print(f"DEBUG: Created vertices with C++ IDs: {created_cpp_ids}")
        
        edges_added = 0
        
        if graph_type == 'complete':
            # Полный граф K_n
            print(f"DEBUG: Creating complete graph K_{num_vertices}")
            for i in range(num_vertices):
                for j in range(i + 1, num_vertices):
                    graph.add_edge(i, j, 1.0)
                    edges_added += 1
                    
                    if directed:
                        graph.add_edge(j, i, 1.0)
                        edges_added += 1
        
        elif graph_type == 'cycle':
            # Цикл C_n
            print(f"DEBUG: Creating cycle graph C_{num_vertices}")
            for i in range(num_vertices):
                j = (i + 1) % num_vertices
                graph.add_edge(i, j, 1.0)
                edges_added += 1
                
                if directed:
                    graph.add_edge(j, i, 1.0)
                    edges_added += 1
        
        elif graph_type == 'path':
            # Путь P_n
            print(f"DEBUG: Creating path graph P_{num_vertices}")
            for i in range(num_vertices - 1):
                graph.add_edge(i, i + 1, 1.0)
                edges_added += 1
                
                if directed:
                    graph.add_edge(i + 1, i, 1.0)
                    edges_added += 1
        
        print(f"DEBUG: Added {edges_added} edges for {graph_type} graph")
        
        update_session_from_graph(graph)
        
        return jsonify({
            'status': 'success',
            'type': graph_type,
            'vertices': num_vertices,
            'edges': edges_added,
            'directed': directed
        })
        
    except Exception as e:
        print(f"ERROR in generate_classic_graph: {e}")
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    print("Starting ORGraph server...")
    print("DEBUG mode: ON")
    app.run(debug=True, host='0.0.0.0', port=5000)