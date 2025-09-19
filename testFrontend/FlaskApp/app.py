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
from aiFeatures.python.image_processing import process_image, analyze_image_for_education

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

@app.route("/process-image", methods=["POST"])
def process_image_endpoint():
    """Handles image processing and returns AI analysis of the image."""
    try:
        if 'image' not in request.files:
            return jsonify({"success": False, "message": "No image file provided"}), 400
            
        file = request.files['image']
        if file.filename == '' or file.filename is None:
            return jsonify({"success": False, "message": "No image selected"}), 400
            
        # Check if the file is an image
        allowed_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff'}
        if not any(file.filename.lower().endswith(ext) for ext in allowed_extensions):
            return jsonify({"success": False, "message": "Invalid file type. Please upload an image file."}), 400
        
        # Save image to temporary location
        file_extension = os.path.splitext(file.filename)[1] if file.filename else '.jpg'
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as tmp_file:
            file.save(tmp_file.name)
            temp_image_path = tmp_file.name
        
        try:
            # Process the image
            image_data = process_image(temp_image_path)
            
            # Get user query if provided
            user_query = request.form.get('query', '')
            
            # Analyze image for educational content
            analysis = analyze_image_for_education(image_data, user_query)
            
            # Clean up temporary file
            os.unlink(temp_image_path)
            
            # Check if there was an OCR error and provide a helpful message
            extracted_text = image_data.get("extracted_text", "")
            if "OCR not available" in extracted_text or "tesseract is not installed" in extracted_text.lower():
                analysis += "\n\nNote: OCR (text extraction from images) is not available because Tesseract OCR is not installed. To enable this feature, please install Tesseract OCR and ensure it's in your system PATH."
            
            return jsonify({
                "success": True,
                "message": "Image processed successfully",
                "image_data": {
                    "extracted_text": image_data.get("extracted_text", ""),
                    "image_description": image_data.get("image_description", ""),
                    "image_size": image_data.get("image_size", "Unknown"),
                    "image_mode": image_data.get("image_mode", "Unknown")
                },
                "analysis": analysis
            })
            
        except Exception as e:
            # Clean up temporary file in case of error
            if os.path.exists(temp_image_path):
                os.unlink(temp_image_path)
            raise e
            
    except Exception as e:
        print(f"Image processing error: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/ask-about-image", methods=["POST"])
def ask_about_image():
    """Handles questions about previously processed images."""
    global session_manager, default_session_id
    data = request.json if request.json else {}
    user_query = data.get("query")
    image_data = data.get("image_data", {})
    image_analysis = data.get("image_analysis", "")

    if not user_query:
        return jsonify({"error": "No input provided"}), 400

    try:
        # Create a prompt that includes the image context
        from langchain.prompts import ChatPromptTemplate
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain.schema.output_parser import StrOutputParser
        
        # Initialize Gemini model
        llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")
        
        # Create prompt for image-based questions
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an AI Tutor named Mentorae. You specialize in explaining educational content. "
                      "A user has uploaded an image and you have already analyzed it. "
                      "The user is now asking specific questions about the image content. "
                      "Use the provided image analysis and extracted text to answer the user's question accurately and comprehensively. "
                      "If the question is unrelated to the image, politely redirect the user to ask image-related questions."),
            ("human", f"Based on the image analysis:\n"
                     f"Extracted Text: {image_data.get('extracted_text', '')}\n"
                     f"Image Description: {image_analysis}\n"
                     f"Image Size: {image_data.get('image_size', 'Unknown')}\n"
                     f"Image Mode: {image_data.get('image_mode', 'Unknown')}\n\n"
                     f"User's Question: {user_query}")
        ])
        
        # Generate response
        chain = prompt | llm | StrOutputParser()
        response = chain.invoke({})
        
        # Convert response to speech
        try:
            say(response)
        except Exception as e:
            print(f"Text-to-speech error: {e}")
        
        return jsonify({
            "response": response
        })
        
    except Exception as e:
        print(f"Error processing image query: {e}")
        return jsonify({"error": f"Failed to process query: {str(e)}"}), 500

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