from flask import Flask, request, jsonify, session, send_from_directory
from flask_session import Session
import orgraph_core  # Наш C++ модуль
import os
import uuid
import json
import tempfile

app = Flask(__name__, static_folder='../frontend', static_url_path='')

# Конфигурация сессии
app.config['SECRET_KEY'] = os.urandom(24)
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_FILE_DIR'] = tempfile.mkdtemp()
Session(app)

def get_user_session():
    """Получить или создать сессию пользователя"""
    if 'user_id' not in session:
        session['user_id'] = str(uuid.uuid4())
        session['graph'] = orgraph_core.Graph()
        session['history'] = []
        session['history_index'] = -1
    return session

def save_graph_state():
    """Сохранить состояние графа для undo/redo"""
    current_graph = session['graph']
    
    # Получаем текущее состояние
    vertices = current_graph.get_vertices()
    edges = current_graph.get_edges()
    
    graph_state = {
        'vertices': list(vertices),
        'edges': [list(edge) for edge in edges]  # Преобразуем tuple в list
    }
    
    # Удаляем состояния после текущего индекса
    session['history'] = session['history'][:session['history_index'] + 1]
    
    # Добавляем новое состояние
    session['history'].append(graph_state)
    session['history_index'] += 1

# Маршруты API
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/graph', methods=['GET'])
def get_graph():
    user_session = get_user_session()
    graph = user_session['graph']
    
    try:
        # Получаем граф в формате JSON
        graph_json = graph.to_json()
        graph_data = json.loads(graph_json)
        
        return jsonify({
            'vertices': [str(v) for v in graph.get_vertices()],
            'edges': graph_data.get('edges', [])
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/graph/clear', methods=['POST'])
def clear_graph():
    user_session = get_user_session()
    save_graph_state()
    user_session['graph'].clear()
    
    return jsonify({'status': 'success'})

@app.route('/api/vertex', methods=['POST'])
def add_vertex():
    user_session = get_user_session()
    data = request.json
    
    if not data or 'id' not in data:
        return jsonify({'error': 'Vertex ID is required'}), 400
    
    save_graph_state()
    graph = user_session['graph']
    
    try:
        # В нашей реализации вершины добавляются с автоинкрементом ID
        # Метка используется для отображения
        vertex_id = graph.add_vertex(str(data['id']))
        return jsonify({'status': 'success', 'id': vertex_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/vertex/<vertex_id>', methods=['DELETE'])
def remove_vertex(vertex_id):
    user_session = get_user_session()
    save_graph_state()
    graph = user_session['graph']
    
    try:
        success = graph.remove_vertex(int(vertex_id))
        return jsonify({'status': 'success' if success else 'failed'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/edge', methods=['POST'])
def add_edge():
    user_session = get_user_session()
    data = request.json
    
    if not data or 'source' not in data or 'target' not in data:
        return jsonify({'error': 'Source and target vertices are required'}), 400
    
    save_graph_state()
    graph = user_session['graph']
    
    source = int(data['source'])
    target = int(data['target'])
    weight = float(data.get('weight', 1.0))
    
    try:
        success = graph.add_edge(source, target, weight)
        return jsonify({'status': 'success' if success else 'failed'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/edge/<source>/<target>', methods=['DELETE'])
def remove_edge(source, target):
    user_session = get_user_session()
    save_graph_state()
    graph = user_session['graph']
    
    try:
        success = graph.remove_edge(int(source), int(target))
        return jsonify({'status': 'success' if success else 'failed'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# Алгоритмы
@app.route('/api/algorithm/<algorithm_name>', methods=['POST'])
def run_algorithm(algorithm_name):
    user_session = get_user_session()
    data = request.json
    graph = user_session['graph']
    
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
            
        elif algorithm_name == 'floyd_warshall':
            start = int(data.get('start_vertex', 0))
            end = int(data.get('end_vertex', 0))
            result = graph.floyd_warshall(start, end)
            
        elif algorithm_name == 'euler_path':
            result = graph.find_eulerian_path()
            
        elif algorithm_name == 'hamiltonian_path':
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
    user_session = get_user_session()
    
    if session['history_index'] > 0:
        session['history_index'] -= 1
        state = session['history'][session['history_index']]
        
        # Восстанавливаем граф из состояния
        graph = session['graph']
        graph.clear()
        
        # Восстанавливаем вершины
        for vertex_id in state['vertices']:
            graph.add_vertex(str(vertex_id))
        
        # Восстанавливаем ребра
        for edge in state['edges']:
            # edge = (from, to, weight, directed)
            graph.add_edge(edge[0], edge[1], edge[2])
        
        return jsonify({'status': 'success'})
    else:
        return jsonify({'error': 'No more actions to undo'}), 400

@app.route('/api/redo', methods=['POST'])
def redo_action():
    user_session = get_user_session()
    
    if session['history_index'] < len(session['history']) - 1:
        session['history_index'] += 1
        state = session['history'][session['history_index']]
        
        # Восстанавливаем граф из состояния
        graph = session['graph']
        graph.clear()
        
        # Восстанавливаем вершины
        for vertex_id in state['vertices']:
            graph.add_vertex(str(vertex_id))
        
        # Восстанавливаем ребра
        for edge in state['edges']:
            graph.add_edge(edge[0], edge[1], edge[2])
        
        return jsonify({'status': 'success'})
    else:
        return jsonify({'error': 'No more actions to redo'}), 400

# Генерация графов
@app.route('/api/graph/random', methods=['POST'])
def generate_random_graph():
    user_session = get_user_session()
    data = request.json
    
    num_vertices = int(data.get('num_vertices', 10))
    num_edges = int(data.get('num_edges', 15))
    directed = bool(data.get('directed', False))
    weighted = bool(data.get('weighted', False))
    
    save_graph_state()
    
    # Используем встроенный генератор
    import random
    graph = session['graph']
    graph.clear()
    
    # Добавляем вершины
    for i in range(num_vertices):
        graph.add_vertex(f"v{i}")
    
    # Добавляем случайные ребра
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
    
    return jsonify({'status': 'success', 'edges_added': edges_added})

@app.route('/api/graph/classic', methods=['POST'])
def generate_classic_graph():
    user_session = get_user_session()
    data = request.json
    
    graph_type = data.get('type', 'complete')
    num_vertices = int(data.get('num_vertices', 5))
    directed = bool(data.get('directed', False))
    
    save_graph_state()
    graph = session['graph']
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
    
    return jsonify({'status': 'success'})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)