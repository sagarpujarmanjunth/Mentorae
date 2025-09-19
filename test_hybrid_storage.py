#!/usr/bin/env python3
"""
Test script for the hybrid vector store implementation.
This script tests both local FAISS and Pinecone storage based on document size.
"""

import os
import sys
import tempfile
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

# Add the aiFeatures/python directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'aiFeatures', 'python'))

def create_test_pdf(content: str, num_pages: int = 1, filename: str = "test.pdf") -> str:
    """Create a test PDF with specified content and number of pages."""
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    
    for page in range(num_pages):
        c.drawString(100, 750, f"Page {page + 1}")
        c.drawString(100, 700, content)
        
        # Add more content to increase size if needed
        for i in range(50):  # Add multiple lines to increase size
            c.drawString(100, 650 - i * 10, f"Line {i}: {content}")
        
        c.showPage()
    
    c.save()
    
    # Save to temporary file
    temp_dir = tempfile.gettempdir()
    filepath = os.path.join(temp_dir, filename)
    
    with open(filepath, 'wb') as f:
        f.write(buffer.getvalue())
    
    buffer.close()
    return filepath

def test_hybrid_storage():
    """Test the hybrid storage system."""
    print("🚀 Testing Hybrid Vector Store Implementation")
    print("=" * 60)
    
    try:
        # Import the modules
        from rag_pipeline import index_pdfs, retrieve_answer
        
        # Test 1: Small PDF (should use local FAISS)
        print("\\n📄 Test 1: Small PDF (Local FAISS Expected)")
        print("-" * 40)
        
        small_pdf_path = create_test_pdf(
            "This is a small test document for local storage.", 
            num_pages=2, 
            filename="small_test.pdf"
        )
        
        file_size = os.path.getsize(small_pdf_path) / (1024 * 1024)  # MB
        print(f"File size: {file_size:.2f} MB")
        print(f"File path: {small_pdf_path}")
        
        small_vector_store = index_pdfs(small_pdf_path)
        
        if small_vector_store:
            store_type = getattr(small_vector_store, 'store_type', 'legacy_faiss')
            print(f"✅ Storage type: {store_type}")
            
            # Test retrieval
            result = retrieve_answer("small test document", small_vector_store)
            print(f"🔍 Retrieval test: {'✅ Success' if result and 'No relevant information' not in result else '❌ Failed'}")
        else:
            print("❌ Failed to create vector store")
        
        # Test 2: Large PDF (should use Pinecone if configured)
        print("\\n📚 Test 2: Large PDF (Pinecone Expected)")
        print("-" * 40)
        
        # Create a larger PDF
        large_content = "This is a large test document. " * 100  # Make content larger
        large_pdf_path = create_test_pdf(
            large_content, 
            num_pages=6, 
            filename="large_test.pdf"
        )
        
        file_size = os.path.getsize(large_pdf_path) / (1024 * 1024)  # MB
        print(f"File size: {file_size:.2f} MB")
        print(f"File path: {large_pdf_path}")
        
        large_vector_store = index_pdfs(large_pdf_path)
        
        if large_vector_store:
            store_type = getattr(large_vector_store, 'store_type', 'legacy_faiss')
            print(f"✅ Storage type: {store_type}")
            
            # Test retrieval
            result = retrieve_answer("large test document", large_vector_store)
            print(f"🔍 Retrieval test: {'✅ Success' if result and 'No relevant information' not in result else '❌ Failed'}")
        else:
            print("❌ Failed to create vector store")
        
        # Cleanup
        try:
            os.remove(small_pdf_path)
            os.remove(large_pdf_path)
            print("\\n🧹 Cleanup completed")
        except:
            pass
            
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("Make sure all dependencies are installed:")
        print("pip install reportlab")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

def test_pinecone_connection():
    """Test Pinecone connection if configured."""
    print("\\n🔗 Testing Pinecone Connection")
    print("-" * 40)
    
    try:
        from pinecone_config import get_pinecone_config
        
        config = get_pinecone_config()
        
        if not config.api_key:
            print("⚠️  Pinecone API key not found in environment")
            print("Set PINECONE_API_KEY in your .env file to test Pinecone integration")
            return False
        
        success = config.initialize_pinecone()
        
        if success:
            print("✅ Pinecone connection successful")
            index = config.get_index()
            stats = index.describe_index_stats()
            print(f"📊 Index stats: {stats}")
            return True
        else:
            print("❌ Pinecone connection failed")
            return False
            
    except ImportError:
        print("❌ Pinecone modules not available")
        return False
    except Exception as e:
        print(f"❌ Pinecone test failed: {e}")
        return False

def main():
    """Main test function."""
    print("AI-Tutor Hybrid Vector Store Test Suite")
    print("=" * 60)
    
    # Test Pinecone connection first
    pinecone_available = test_pinecone_connection()
    
    # Test hybrid storage
    test_hybrid_storage()
    
    print("\\n" + "=" * 60)
    print("📋 Test Summary:")
    print(f"🔗 Pinecone Connection: {'✅ Available' if pinecone_available else '❌ Not Available'}")
    print("📄 Hybrid Storage: See results above")
    print("\\n💡 Next Steps:")
    
    if not pinecone_available:
        print("1. Set up Pinecone API key in .env file")
        print("2. Check PINECONE_SETUP.md for detailed configuration")
    else:
        print("1. Your hybrid storage system is ready!")
        print("2. Large PDFs will use Pinecone, small ones will use local FAISS")
    
    print("3. Test with your actual PDF documents")
    print("4. Monitor usage through Pinecone dashboard")

if __name__ == "__main__":
    main()