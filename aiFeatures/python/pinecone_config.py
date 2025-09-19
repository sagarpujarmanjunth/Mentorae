import os
import logging
from typing import Optional, Dict, Any
from pinecone import Pinecone, ServerlessSpec
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set up logging
logger = logging.getLogger(__name__)

class PineconeConfig:
    """Configuration and management class for Pinecone vector database."""
    
    def __init__(self):
        self.api_key = os.environ.get("PINECONE_API_KEY")
        
        # Handle both PINECONE_HOST and PINECONE_ENVIRONMENT for backward compatibility
        self.host = os.environ.get("PINECONE_HOST")
        environment_var = os.environ.get("PINECONE_ENVIRONMENT", "us-east-1")
        
        # If PINECONE_ENVIRONMENT contains a URL, use it as host
        if environment_var and environment_var.startswith("https://"):
            self.host = environment_var
            self.environment = "us-east-1"  # Default region
        else:
            self.environment = environment_var
            
        # Fallback to default host if none provided
        if not self.host:
            self.host = "https://ai-tutor-x-cgn8neb.svc.aped-4627-b74a.pinecone.io"
            
        self.index_name = os.environ.get("PINECONE_INDEX_NAME", "ai-tutor-documents")
        self.dimension = 1024  # Dimension for mxbai-embed-large model
        self.metric = "cosine"  # Similarity metric
        self.cloud = "aws"  # Cloud provider
        self.region = "us-east-1"  # Region for serverless
        
        self.pc = None
        self.index = None
        
    def initialize_pinecone(self) -> bool:
        """Initialize Pinecone client and create/connect to index."""
        try:
            if not self.api_key:
                logger.error("PINECONE_API_KEY environment variable not set")
                return False
                
            # Initialize Pinecone client
            self.pc = Pinecone(api_key=self.api_key)
            logger.info("Pinecone client initialized successfully")
            
            # Try to connect using host URL first
            if self.host and self.host.startswith("https://"):
                try:
                    logger.info(f"Attempting to connect using host: {self.host}")
                    self.index = self.pc.Index(host=self.host)
                    
                    # Test the connection
                    stats = self.index.describe_index_stats()
                    logger.info(f"Successfully connected to index via host. Stats: {stats}")
                    return True
                except Exception as host_error:
                    logger.warning(f"Failed to connect via host URL: {host_error}")
                    logger.info("Falling back to index name-based connection...")
            
            # Fallback: Check if index exists by name, create if not
            existing_indexes = self.pc.list_indexes().names()
            logger.info(f"Available indexes: {existing_indexes}")
            
            if self.index_name not in existing_indexes:
                logger.info(f"Creating new Pinecone index: {self.index_name}")
                self.pc.create_index(
                    name=self.index_name,
                    dimension=self.dimension,
                    metric=self.metric,
                    spec=ServerlessSpec(
                        cloud=self.cloud,
                        region=self.region
                    )
                )
                logger.info(f"Index {self.index_name} created successfully")
            else:
                logger.info(f"Using existing Pinecone index: {self.index_name}")
            
            # Connect to the index by name
            self.index = self.pc.Index(self.index_name)
            
            # Get index stats
            stats = self.index.describe_index_stats()
            logger.info(f"Index stats: {stats}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize Pinecone: {str(e)}")
            return False
    
    def get_index(self):
        """Get the Pinecone index instance."""
        if not self.index:
            if not self.initialize_pinecone():
                raise Exception("Failed to initialize Pinecone")
        return self.index
    
    def delete_index(self) -> bool:
        """Delete the Pinecone index (use with caution)."""
        try:
            if self.pc and self.index_name in self.pc.list_indexes().names():
                self.pc.delete_index(self.index_name)
                logger.info(f"Index {self.index_name} deleted successfully")
                self.index = None
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to delete index: {str(e)}")
            return False
    
    def clear_index(self) -> bool:
        """Clear all vectors from the index."""
        try:
            if self.index:
                # Delete all vectors (this might take some time for large indexes)
                self.index.delete(delete_all=True)
                logger.info("All vectors deleted from index")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to clear index: {str(e)}")
            return False

# Global instance
pinecone_config = PineconeConfig()

def get_pinecone_config() -> PineconeConfig:
    """Get the global Pinecone configuration instance."""
    return pinecone_config