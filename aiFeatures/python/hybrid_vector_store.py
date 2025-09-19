import os
import uuid
import logging
from typing import List, Dict, Tuple, Union, Optional, Any
from abc import ABC, abstractmethod
import faiss
from langchain_community.vectorstores import FAISS
from langchain_community.docstore.in_memory import InMemoryDocstore
from langchain_ollama import OllamaEmbeddings

# Try to import Pinecone (will be available after installing requirements)
try:
    from pinecone_config import get_pinecone_config
    PINECONE_AVAILABLE = True
except ImportError:
    PINECONE_AVAILABLE = False
    logging.warning("Pinecone not available. Only local FAISS storage will be used.")

# Set up logging
logger = logging.getLogger(__name__)

class VectorStore(ABC):
    """Abstract base class for vector stores."""
    
    @abstractmethod
    def add_texts(self, texts: List[str], metadatas: Optional[List[Dict]] = None) -> List[str]:
        """Add texts to the vector store."""
        pass
    
    @abstractmethod
    def similarity_search_with_score(self, query: str, k: int = 3) -> List[Tuple[Any, float]]:
        """Search for similar texts with scores."""
        pass
    
    @abstractmethod
    def delete(self, ids: Optional[List[str]] = None) -> bool:
        """Delete vectors from the store."""
        pass

class LocalFAISSStore(VectorStore):
    """Local FAISS vector store wrapper."""
    
    def __init__(self, embeddings, embedding_dim: int):
        self.embeddings = embeddings
        index = faiss.IndexFlatL2(embedding_dim)
        self.vector_store = FAISS(
            embedding_function=embeddings,
            index=index,
            docstore=InMemoryDocstore(),
            index_to_docstore_id={},
        )
        self.store_type = "local"
    
    def add_texts(self, texts: List[str], metadatas: Optional[List[Dict]] = None) -> List[str]:
        """Add texts to FAISS store."""
        return self.vector_store.add_texts(texts, metadatas)
    
    def similarity_search_with_score(self, query: str, k: int = 3) -> List[Tuple[Any, float]]:
        """Search in FAISS store."""
        return self.vector_store.similarity_search_with_score(query, k)
    
    def delete(self, ids: Optional[List[str]] = None) -> bool:
        """Delete is not directly supported in FAISS, return False."""
        logger.warning("Delete operation not supported for local FAISS storage")
        return False
    
    def save_local(self, path: str):
        """Save FAISS index locally."""
        self.vector_store.save_local(path)
    
    @classmethod
    def load_local(cls, path: str, embeddings):
        """Load FAISS index from local path."""
        vector_store = FAISS.load_local(path, embeddings)
        # Create wrapper instance
        instance = cls.__new__(cls)
        instance.embeddings = embeddings
        instance.vector_store = vector_store
        instance.store_type = "local"
        return instance

class PineconeStore(VectorStore):
    """Pinecone vector store wrapper."""
    
    def __init__(self, embeddings):
        if not PINECONE_AVAILABLE:
            raise ImportError("Pinecone is not available. Please install pinecone-client.")
        
        self.embeddings = embeddings
        self.pinecone_config = get_pinecone_config()
        self.index = self.pinecone_config.get_index()
        self.store_type = "pinecone"
        self.namespace = "default"  # You can customize this per session/user
    
    def add_texts(self, texts: List[str], metadatas: Optional[List[Dict]] = None) -> List[str]:
        """Add texts to Pinecone index with batch processing."""
        try:
            # Generate embeddings for all texts
            embeddings = self.embeddings.embed_documents(texts)
            
            # Prepare vectors for upsert
            vectors = []
            ids = []
            
            for i, (text, embedding) in enumerate(zip(texts, embeddings)):
                vector_id = str(uuid.uuid4())
                ids.append(vector_id)
                
                metadata = metadatas[i] if metadatas and i < len(metadatas) else {}
                
                # Limit text size in metadata to avoid Pinecone size limits
                # Pinecone has a 4MB limit per request, so limit text to reasonable size
                max_text_length = 1000  # Limit to 1KB per text in metadata
                text_for_metadata = text[:max_text_length] if len(text) > max_text_length else text
                metadata['text'] = text_for_metadata
                
                vectors.append({
                    'id': vector_id,
                    'values': embedding,
                    'metadata': metadata
                })
            
            # Process in batches to avoid size limits
            batch_size = 100  # Process 100 vectors at a time
            total_batches = (len(vectors) + batch_size - 1) // batch_size
            
            for i in range(0, len(vectors), batch_size):
                batch = vectors[i:i + batch_size]
                batch_num = (i // batch_size) + 1
                
                logger.info(f"Uploading batch {batch_num}/{total_batches} ({len(batch)} vectors)")
                
                # Upsert batch to Pinecone
                self.index.upsert(vectors=batch, namespace=self.namespace)
            
            logger.info(f"Successfully added {len(vectors)} vectors to Pinecone in {total_batches} batches")
            
            return ids
            
        except Exception as e:
            logger.error(f"Error adding texts to Pinecone: {str(e)}")
            raise
    
    def similarity_search_with_score(self, query: str, k: int = 3) -> List[Tuple[Any, float]]:
        """Search in Pinecone index."""
        try:
            # Generate query embedding
            query_embedding = self.embeddings.embed_query(query)
            
            # Search in Pinecone
            results = self.index.query(
                vector=query_embedding,
                top_k=k,
                include_metadata=True,
                namespace=self.namespace
            )
            
            # Convert results to the expected format
            formatted_results = []
            for match in results['matches']:
                # Create a document-like object
                doc = type('Document', (), {
                    'page_content': match['metadata'].get('text', ''),
                    'metadata': {k: v for k, v in match['metadata'].items() if k != 'text'}
                })()
                
                # Pinecone returns similarity scores (higher = more similar)
                # Convert to distance-like score (lower = more similar) for consistency
                distance_score = 1.0 - match['score']
                formatted_results.append((doc, distance_score))
            
            return formatted_results
            
        except Exception as e:
            logger.error(f"Error searching in Pinecone: {str(e)}")
            raise
    
    def delete(self, ids: Optional[List[str]] = None) -> bool:
        """Delete vectors from Pinecone."""
        try:
            if ids:
                self.index.delete(ids=ids, namespace=self.namespace)
            else:
                # Delete all vectors in namespace
                self.index.delete(delete_all=True, namespace=self.namespace)
            
            logger.info(f"Deleted vectors from Pinecone")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting from Pinecone: {str(e)}")
            return False

class HybridVectorStore:
    """
    Hybrid vector store that decides between local FAISS and Pinecone 
    based on document size and complexity.
    """
    
    def __init__(self, embeddings, embedding_dim: int = 1024):
        self.embeddings = embeddings
        self.embedding_dim = embedding_dim
        self.store = None
        self.store_type = None
        
        # Thresholds for deciding storage type
        self.size_threshold_mb = 1.0  # 1MB
        self.page_threshold = 4  # 4 pages
    
    def should_use_pinecone(self, total_text_size: int, total_pages: int) -> bool:
        """
        Decide whether to use Pinecone based on document size and page count.
        
        Args:
            total_text_size: Total size of text in bytes
            total_pages: Total number of pages
            
        Returns:
            True if should use Pinecone, False for local storage
        """
        size_mb = total_text_size / (1024 * 1024)  # Convert to MB
        
        # Use Pinecone if either condition is met
        use_pinecone = (size_mb > self.size_threshold_mb or 
                       total_pages > self.page_threshold)
        
        logger.info(f"Document analysis: {size_mb:.2f}MB, {total_pages} pages")
        logger.info(f"Storage decision: {'Pinecone' if use_pinecone else 'Local FAISS'}")
        
        return use_pinecone and PINECONE_AVAILABLE
    
    def create_store(self, texts_with_metadata: List[Tuple[str, Dict]]) -> VectorStore:
        """
        Create appropriate vector store based on document characteristics.
        
        Args:
            texts_with_metadata: List of (text, metadata) tuples
            
        Returns:
            VectorStore instance
        """
        # Calculate total size and pages
        total_text_size = sum(len(text.encode('utf-8')) for text, _ in texts_with_metadata)
        total_pages = len(set(metadata.get('page_index', 0) for _, metadata in texts_with_metadata))
        
        # Decide storage type
        if self.should_use_pinecone(total_text_size, total_pages):
            try:
                self.store = PineconeStore(self.embeddings)
                self.store_type = "pinecone"
                logger.info("Using Pinecone vector store")
            except Exception as e:
                logger.warning(f"Failed to initialize Pinecone, falling back to local: {str(e)}")
                self.store = LocalFAISSStore(self.embeddings, self.embedding_dim)
                self.store_type = "local"
        else:
            self.store = LocalFAISSStore(self.embeddings, self.embedding_dim)
            self.store_type = "local"
            logger.info("Using local FAISS vector store")
        
        return self.store
    
    def get_store(self) -> Optional[VectorStore]:
        """Get the current vector store."""
        return self.store
    
    def get_store_type(self) -> Optional[str]:
        """Get the type of current vector store."""
        return self.store_type
    
    def clear_store(self) -> bool:
        """Clear the current vector store."""
        if self.store:
            return self.store.delete()
        return False