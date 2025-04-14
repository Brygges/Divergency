from flask import Flask, send_file, abort, request
import os, sys
import webbrowser, threading

if getattr(sys, 'frozen', False):
    # When the application is run as a bundled executable,
    # sys.executable points to the executable file.
    base_path = os.path.dirname(sys.executable)
else:
    # When running in a normal Python environment, __file__ is the script's filename.
    base_path = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)

@app.route('/')
def index():
    # Serve the generated index.html file.
    return send_file(os.path.join(base_path, "index.html"))

@app.route('/shutdown', methods=['POST'])
def shutdown():
    shutdown_func = request.environ.get('werkzeug.server.shutdown')
    if shutdown_func is None:
        abort(500, 'Not running with the Werkzeug Server')
    shutdown_func()
    return 'Server shutting down...'

@app.route('/data.json')
def data_json():
    return send_file(os.path.join(base_path, "data.json"))

@app.route('/get_pdb/<node>')
def get_pdb(node):
    pdb_path = os.path.join(base_path, "AllSpecies", f"{node}.pdb")
    if os.path.exists(pdb_path):
        return send_file(pdb_path, mimetype='text/plain')
    else:
        abort(404, description="PDB file not found")

@app.route('/superposed/<path:filename>')
def serve_superposed(filename):
    super_path = os.path.join(base_path, "Superposed", f"{filename}")
    if os.path.exists(super_path):
        return send_file(super_path, mimetype='text/plain')
    else:
        abort(404, description="Superposed PDB file not found")

def open_browser():
    import time; time.sleep(1)
    webbrowser.open("http://127.0.0.1:5000")

if __name__ == '__main__':
    threading.Thread(target=open_browser).start()
    app.run(debug=False)