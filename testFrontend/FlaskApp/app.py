import os
import re
import sys
from flask import Flask, request, jsonify, render_template, session
from flask_cors import CORS
import threading
import tempfile

# Add aiFeatures/python to sys.path for module imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from aiFeatures.python.ai_response import generate_response_without_retrieval, generate_response_with_retrieval, ChatSessionManager
from aiFeatures.python.speech_to_text import speech_to_text
from aiFeatures.python.text_to_speech import say, stop_speech
from aiFeatures.python.enhanced_web_search import enhanced_web_search, get_search_content_for_ai
from aiFeatures.python.rag_pipeline import index_pdfs, retrieve_answer

app = Flask(__name__)
app.secret_key = os.urandom(24)  # Add a secret key for sessions
CORS(app)  # Enable CORS for frontend requests

# Global variables
vector_store = None
session_manager = ChatSessionManager()
default_session_id = "user_session_001"  # Default session ID

import re


def chunk_text(text, max_length=150):
    """Split text into smaller chunks at sentence boundaries for faster TTS processing."""
    # Split by sentences
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current_chunk = ""
    
    for sentence in sentences:
        if len(current_chunk) + len(sentence) <= max_length:
            current_chunk += " " + sentence if current_chunk else sentence
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = sentence
    
    if current_chunk:
        chunks.append(current_chunk.strip())
        
    return chunks

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/status", methods=["GET"])
def get_status():
    """Get the current status of the vector store."""
    global vector_store
    
    try:
        if not vector_store:
            return jsonify({
                "vector_store": None,
                "store_type": None,
                "message": "No vector store initialized"
            })
        
        store_type = getattr(vector_store, 'store_type', 'legacy_faiss')
        is_hybrid = hasattr(vector_store, 'hybrid_manager')
        
        return jsonify({
            "vector_store": "initialized",
            "store_type": store_type,
            "is_hybrid": is_hybrid,
            "message": f"Vector store active: {store_type}"
        })
    
    except Exception as e:
        return jsonify({"error": f"Status check failed: {str(e)}"}), 500

@app.route("/clear-session", methods=["POST"])
def clear_session():
    """Clears the current RAG session and resets the vector store."""
    global vector_store, session_manager
    
    try:
        # Handle both FAISS and hybrid vector stores
        if vector_store:
            # Try to clear hybrid store first
            if hasattr(vector_store, 'hybrid_manager'):
                try:
                    hybrid_manager = getattr(vector_store, 'hybrid_manager', None)
                    if hybrid_manager and hasattr(hybrid_manager, 'clear_store'):
                        hybrid_manager.clear_store()
                    store_type = getattr(vector_store, 'store_type', 'unknown')
                    print(f"Cleared {store_type} vector store")
                except Exception as e:
                    print(f"Error clearing hybrid store: {e}")
            # For legacy FAISS, just reset the reference
            vector_store = None
        
        # Clear the session for this user
        session_manager.delete_session(default_session_id)
        
        return jsonify({"success": True, "message": "Session cleared successfully"})
    
    except Exception as e:
        print(f"Error clearing session: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/initialize-rag", methods=["POST"])
def initialize_rag():
    """Handles indexing PDFs from uploaded files or a folder path."""
    global vector_store
    
    try:
        if 'files' in request.files:
            files = request.files.getlist('files')
            
            with tempfile.TemporaryDirectory() as temp_dir:
                file_paths = []
                for file in files:
                    if file.filename and file.filename.endswith('.pdf'):
                        file_path = os.path.join(temp_dir, file.filename)
                        file.save(file_path)
                        file_paths.append(file_path)

                if len(file_paths) == 1:
                    vector_store = index_pdfs(file_paths[0])  # Using unified index_pdfs function
                else:
                    vector_store = index_pdfs(file_paths)  # Using unified index_pdfs function
        
        elif 'folder' in request.form:
            folder_path = request.form.get('folder')
            if folder_path:
                vector_store = index_pdfs(folder_path)  # Using unified index_pdfs function
            else:
                return jsonify({"success": False, "message": "Invalid folder path"}), 400
        
        else:
            return jsonify({"success": False, "message": "No files or folder provided"}), 400
        
        return jsonify({"success": True, "message": "RAG initialized successfully"})
    
    except Exception as e:
        print(f"RAG initialization error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/enhanced-search", methods=["POST"])
def enhanced_search():
    """Enhanced web search with timeout protection and engine switching"""
    data = request.json if request.json else {}
    query = data.get("query")
    search_type = data.get("search_type", "educational")
    
    if not query:
        return jsonify({"error": "No query provided"}), 400
    
    try:
        # Import enhanced search with timeout protection
        from aiFeatures.python.enhanced_web_search import enhanced_web_search
        
        # Add request timeout handling
        import signal
        import threading
        
        search_result = None
        search_error = None
        
        def search_worker():
            nonlocal search_result, search_error
            try:
                search_result = enhanced_web_search(query, search_type)
            except Exception as e:
                search_error = e
        
        # Use threading for timeout on Windows
        search_thread = threading.Thread(target=search_worker)
        search_thread.start()
        search_thread.join(timeout=30)  # 30 second timeout
        
        if search_thread.is_alive():
            print(f"Search timed out for query: {query}")
            return jsonify({
                "success": False,
                "error": "Search timed out. Please try again.",
                "timeout": True
            }), 408
        
        if search_error:
            print(f"Enhanced search error: {search_error}")
            return jsonify({
                "success": False, 
                "error": f"Search failed: {str(search_error)}"
            }), 500
        
        if not search_result:
            return jsonify({
                "success": False,
                "error": "No search results found"
            }), 404
        
        return jsonify({
            "success": True,
            "search_data": search_result.to_dict(),
            "engine_used": getattr(search_result, 'search_engine', 'unknown')
        })
        
    except Exception as e:
        print(f"Enhanced search error: {e}")
        return jsonify({
            "success": False, 
            "error": f"Search failed: {str(e)}"
        }), 500

@app.route("/ask", methods=["POST"])
def ask():
    """Handles text input and returns AI response with chat history management."""
    global vector_store, session_manager, default_session_id
    data = request.json if request.json else {}
    user_query = data.get("query")

    if not user_query:
        return jsonify({"error": "No input provided"}), 400

    try:
        # Get retrieved information if vector store exists
        retrieved_info = retrieve_answer(user_query, vector_store) if vector_store else ""
        
        # Generate response based on whether retrieval was performed
        if retrieved_info:
            response = generate_response_with_retrieval(
                default_session_id, 
                user_query,
                retrieved_info, 
                session_manager
            )
            
            say(response)  # Convert response to speech

            return jsonify({
                "response": response,
                "retrieved": retrieved_info,
                "hasRetrieval": bool(retrieved_info)
            })
            
        else:
            # Get search content for AI processing
            scraped_text = get_search_content_for_ai(user_query, "educational")
            
            response = generate_response_without_retrieval(
                default_session_id, 
                user_query, 
                scraped_text,
                session_manager
            )
            say(response)  # Convert response to speech

            return jsonify({
                "response": response,
                "scraped": scraped_text,
                "hasScraping": bool(scraped_text),
                "showSourcesSeparately": True  # Flag to indicate sources should be shown separately
            })
    
    except Exception as e:
        print(f"Error processing query: {e}")
        return jsonify({"error": f"Failed to process query: {str(e)}"}), 500
    
@app.route("/speech-to-text", methods=["POST"])
def process_voice():
    """Handles voice input and converts it to text."""
    try:
        user_query = speech_to_text()
        return jsonify({"query": user_query})
    except Exception as e:
        print(f"Speech recognition error: {e}")
        return jsonify({"error": f"Failed to recognize speech: {str(e)}"}), 500

@app.route("/text-to-speech", methods=["POST"])
def process_speech():
    """Converts text to speech."""
    data = request.json if request.json else {}
    text = data.get("text")
    
    if not text:
        return jsonify({"error": "No text provided"}), 400
    
    try:
        say(text)  # Convert text to speech
        return jsonify({"success": True})
    except Exception as e:
        print(f"Text-to-speech error: {e}")
        return jsonify({"error": f"Failed to convert text to speech: {str(e)}"}), 500
    
    
@app.route("/stop-speech", methods=["POST"])
def handle_stop_speech():
    """Stops ongoing speech output."""
    try:
        success = stop_speech()
        return jsonify({"message": "Speech stopped", "success": success})
    except Exception as e:
        print(f"Error stopping speech: {e}")
        return jsonify({"error": f"Failed to stop speech: {str(e)}"}), 500

    
if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5500, debug=True)