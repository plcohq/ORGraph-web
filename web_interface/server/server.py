from flask import Flask, request, jsonify, session, send_from_directory
from flask_session import Session
import os
import uuid
import json
import orgraph_core  # Our C++ library bindings
from werkzeug.utils import secure_filename
import tempfile
import shutil

app = Flask(__name__, static_folder='../static', static_url_path='')

# Configure session
app.config['SECRET_KEY'] = os.urandom(24)
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_FILE_DIR'] = tempfile.mkdtemp()
Session(app)

# Directory for temporary file storage
TEMP_DIR = tempfile.mkdtemp()
app.config['UPLOAD_FOLDER'] = TEMP_DIR

# Helper function to get or create a user session
def get_user_session():
    if 'user_id' not in session:
        session['user_id'] = str(uuid.uuid4())
        session['graph'] = orgraph_core.Graph()
        session['history'] = []  # For undo/redo functionality
        session['history_index'] = -1
    return session

# Helper function to save graph state for undo/redo
def save_graph_state():
    current_graph = session['graph']
    # Create a deep copy of the current graph state
    # Note: This is a simplified version. In a real implementation,
    # you'd need to properly serialize the graph state
    graph_state = {
        'vertices': current_graph.get_vertices(),
        'edges': current_graph.get_edges()
    }
    
    # Remove any states after the current index (for redo)
    session['history'] = session['history'][:session['history_index']+1]
    
    # Add the new state
    session['history'].append(graph_state)
    session['history_index'] += 1

# API Routes
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/graph', methods=['GET'])
def get_graph():
    user_session = get_user_session()
    graph = user_session['graph']
    
    vertices = graph.get_vertices()
    edges = graph.get_edges()
    
    return jsonify({
        'vertices': vertices,
        'edges': edges
    })

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
    
    if 'id' not in data:
        return jsonify({'error': 'Vertex ID is required'}), 400
    
    save_graph_state()
    graph = user_session['graph']
    
    try:
        graph.add_vertex(data['id'])
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/vertex/<vertex_id>', methods=['DELETE'])
def remove_vertex(vertex_id):
    user_session = get_user_session()
    save_graph_state()
    graph = user_session['graph']
    
    try:
        graph.remove_vertex(vertex_id)
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/edge', methods=['POST'])
def add_edge():
    user_session = get_user_session()
    data = request.json
    
    if 'source' not in data or 'target' not in data:
        return jsonify({'error': 'Source and target vertices are required'}), 400
    
    save_graph_state()
    graph = user_session['graph']
    
    source = data['source']
    target = data['target']
    weight = data.get('weight', 1.0)
    directed = data.get('directed', False)
    
    try:
        graph.add_edge(source, target, weight, directed)
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/edge/<source>/<target>', methods=['DELETE'])
def remove_edge(source, target):
    user_session = get_user_session()
    save_graph_state()
    graph = user_session['graph']
    
    try:
        graph.remove_edge(source, target)
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/graph/adjacency_matrix', methods=['GET'])
def get_adjacency_matrix():
    user_session = get_user_session()
    graph = user_session['graph']
    
    try:
        matrix = graph.get_adjacency_matrix()
        return jsonify({'matrix': matrix})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/graph/adjacency_list', methods=['GET'])
def get_adjacency_list():
    user_session = get_user_session()
    graph = user_session['graph']
    
    try:
        adj_list = graph.get_adjacency_list()
        return jsonify({'adjacency_list': adj_list})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/algorithm/dfs', methods=['POST'])
def run_dfs():
    user_session = get_user_session()
    data = request.json
    graph = user_session['graph']
    
    start_vertex = data.get('start_vertex')
    
    try:
        result = orgraph_core.dfs(graph, start_vertex)
        return jsonify({'result': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/algorithm/bfs', methods=['POST'])
def run_bfs():
    user_session = get_user_session()
    data = request.json
    graph = user_session['graph']
    
    start_vertex = data.get('start_vertex')
    
    try:
        result = orgraph_core.bfs(graph, start_vertex)
        return jsonify({'result': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/algorithm/dijkstra', methods=['POST'])
def run_dijkstra():
    user_session = get_user_session()
    data = request.json
    graph = user_session['graph']
    
    start_vertex = data.get('start_vertex')
    end_vertex = data.get('end_vertex')
    
    try:
        result = orgraph_core.dijkstra(graph, start_vertex, end_vertex)
        return jsonify({'result': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/algorithm/topological_sort', methods=['POST'])
def run_topological_sort():
    user_session = get_user_session()
    graph = user_session['graph']
    
    try:
        result = orgraph_core.topological_sort(graph)
        return jsonify({'result': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/algorithm/is_connected', methods=['POST'])
def check_connectivity():
    user_session = get_user_session()
    graph = user_session['graph']
    
    try:
        result = orgraph_core.is_connected(graph)
        return jsonify({'result': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/algorithm/find_components', methods=['POST'])
def find_components():
    user_session = get_user_session()
    graph = user_session['graph']
    
    try:
        result = orgraph_core.find_components(graph)
        return jsonify({'result': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/algorithm/is_bipartite', methods=['POST'])
def check_bipartite():
    user_session = get_user_session()
    graph = user_session['graph']
    
    try:
        result = orgraph_core.is_bipartite(graph)
        return jsonify({'result': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/algorithm/minimum_spanning_tree', methods=['POST'])
def find_mst():
    user_session = get_user_session()
    graph = user_session['graph']
    
    try:
        result = orgraph_core.minimum_spanning_tree(graph)
        return jsonify({'result': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/algorithm/find_eulerian_path', methods=['POST'])
def find_eulerian_path():
    user_session = get_user_session()
    graph = user_session['graph']
    
    try:
        result = orgraph_core.find_eulerian_path(graph)
        return jsonify({'result': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/algorithm/find_hamiltonian_path', methods=['POST'])
def find_hamiltonian_path():
    user_session = get_user_session()
    graph = user_session['graph']
    
    try:
        result = orgraph_core.find_hamiltonian_path(graph)
        return jsonify({'result': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/undo', methods=['POST'])
def undo_action():
    user_session = get_user_session()
    
    if user_session['history_index'] > 0:
        user_session['history_index'] -= 1
        state = user_session['history'][user_session['history_index']]
        
        # Restore graph from state
        graph = user_session['graph']
        graph.clear()
        
        for vertex in state['vertices']:
            graph.add_vertex(vertex)
        
        for edge in state['edges']:
            graph.add_edge(edge['source'], edge['target'], edge.get('weight', 1.0), edge.get('directed', False))
        
        return jsonify({'status': 'success'})
    else:
        return jsonify({'error': 'No more actions to undo'}), 400

@app.route('/api/redo', methods=['POST'])
def redo_action():
    user_session = get_user_session()
    
    if user_session['history_index'] < len(user_session['history']) - 1:
        user_session['history_index'] += 1
        state = user_session['history'][user_session['history_index']]
        
        # Restore graph from state
        graph = user_session['graph']
        graph.clear()
        
        for vertex in state['vertices']:
            graph.add_vertex(vertex)
        
        for edge in state['edges']:
            graph.add_edge(edge['source'], edge['target'], edge.get('weight', 1.0), edge.get('directed', False))
        
        return jsonify({'status': 'success'})
    else:
        return jsonify({'error': 'No more actions to redo'}), 400

@app.route('/api/graph/random', methods=['POST'])
def generate_random_graph():
    user_session = get_user_session()
    data = request.json
    
    num_vertices = data.get('num_vertices', 10)
    num_edges = data.get('num_edges', 15)
    directed = data.get('directed', False)
    weighted = data.get('weighted', False)
    
    save_graph_state()
    graph = user_session['graph']
    graph.clear()
    
    # Add vertices
    for i in range(num_vertices):
        graph.add_vertex(f"v{i}")
    
    # Add random edges
    import random
    for _ in range(num_edges):
        source = f"v{random.randint(0, num_vertices-1)}"
        target = f"v{random.randint(0, num_vertices-1)}"
        
        if source != target:  # Avoid self-loops
            weight = random.uniform(1.0, 10.0) if weighted else 1.0
            graph.add_edge(source, target, weight, directed)
    
    return jsonify({'status': 'success'})

@app.route('/api/graph/classic', methods=['POST'])
def generate_classic_graph():
    user_session = get_user_session()
    data = request.json
    
    graph_type = data.get('type', 'complete')
    
    save_graph_state()
    graph = user_session['graph']
    graph.clear()
    
    if graph_type == 'complete':
        # Complete graph K5
        for i in range(5):
            graph.add_vertex(f"v{i}")
        
        for i in range(5):
            for j in range(i+1, 5):
                graph.add_edge(f"v{i}", f"v{j}")
    
    elif graph_type == 'cycle':
        # Cycle graph C5
        for i in range(5):
            graph.add_vertex(f"v{i}")
        
        for i in range(5):
            graph.add_edge(f"v{i}", f"v{(i+1)%5}")
    
    elif graph_type == 'bipartite':
        # Complete bipartite graph K3,3
        for i in range(3):
            graph.add_vertex(f"a{i}")
            graph.add_vertex(f"b{i}")
        
        for i in range(3):
            for j in range(3):
                graph.add_edge(f"a{i}", f"b{j}")
    
    elif graph_type == 'tree':
        # Binary tree
        for i in range(7):
            graph.add_vertex(f"v{i}")
        
        graph.add_edge("v0", "v1")
        graph.add_edge("v0", "v2")
        graph.add_edge("v1", "v3")
        graph.add_edge("v1", "v4")
        graph.add_edge("v2", "v5")
        graph.add_edge("v2", "v6")
    
    return jsonify({'status': 'success'})

@app.route('/api/graph/save', methods=['POST'])
def save_graph():
    user_session = get_user_session()
    data = request.json
    
    filename = data.get('filename', 'graph.json')
    if not filename.endswith('.json'):
        filename += '.json'
    
    filename = secure_filename(filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    
    graph = user_session['graph']
    graph_data = {
        'vertices': graph.get_vertices(),
        'edges': graph.get_edges()
    }
    
    with open(filepath, 'w') as f:
        json.dump(graph_data, f)
    
    return jsonify({'status': 'success', 'filename': filename})

@app.route('/api/graph/load', methods=['POST'])
def load_graph():
    user_session = get_user_session()
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if file:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        save_graph_state()
        graph = user_session['graph']
        graph.clear()
        
        with open(filepath, 'r') as f:
            graph_data = json.load(f)
        
        for vertex in graph_data.get('vertices', []):
            graph.add_vertex(vertex)
        
        for edge in graph_data.get('edges', []):
            graph.add_edge(
                edge['source'], 
                edge['target'], 
                edge.get('weight', 1.0), 
                edge.get('directed', False)
            )
        
        return jsonify({'status': 'success', 'vertices': graph.get_vertices(), 'edges': graph.get_edges()})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
