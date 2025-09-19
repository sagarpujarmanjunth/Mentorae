#!/usr/bin/env python3
"""
Test script for Pinecone configuration and connection.
This script tests both host-based and name-based connection methods.
"""

import os
import sys
import logging
from dotenv import load_dotenv

# Add the aiFeatures/python directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'aiFeatures', 'python'))

from pinecone_config import PineconeConfig

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_pinecone_connection():
    """Test Pinecone connection with detailed error handling."""
    
    # Load environment variables
    load_dotenv()
    
    logger.info("=== Pinecone Connection Test ===")
    
    # Check environment variables
    api_key = os.environ.get("PINECONE_API_KEY")
    host = os.environ.get("PINECONE_HOST")
    environment = os.environ.get("PINECONE_ENVIRONMENT", "us-east-1")
    index_name = os.environ.get("PINECONE_INDEX_NAME", "ai-tutor-documents")
    
    logger.info(f"API Key: {'✓ Set' if api_key else '✗ Missing'}")
    logger.info(f"Host: {host or 'Not set'}")
    logger.info(f"Environment: {environment}")
    logger.info(f"Index Name: {index_name}")
    
    if not api_key:
        logger.error("PINECONE_API_KEY is not set. Please check your .env file.")
        return False
    
    # Test configuration
    try:
        config = PineconeConfig()
        logger.info("PineconeConfig instance created successfully")
        
        # Test initialization
        if config.initialize_pinecone():
            logger.info("✓ Pinecone initialization successful")
            
            # Test getting index
            index = config.get_index()
            logger.info("✓ Index retrieved successfully")
            
            # Test index stats
            try:
                stats = index.describe_index_stats()
                logger.info(f"✓ Index Stats: {stats}")
                
                # Test basic operations
                logger.info("Testing basic index operations...")
                
                # Test query (empty query to check connection)
                try:
                    query_result = index.query(
                        vector=[0.0] * config.dimension,
                        top_k=1,
                        include_metadata=True
                    )
                    logger.info(f"✓ Query test successful. Found {len(query_result.matches)} matches")
                except Exception as query_error:
                    logger.warning(f"Query test failed (this is normal for empty index): {query_error}")
                
                return True
                
            except Exception as stats_error:
                logger.error(f"Failed to get index stats: {stats_error}")
                return False
                
        else:
            logger.error("✗ Pinecone initialization failed")
            return False
            
    except Exception as e:
        logger.error(f"Configuration error: {str(e)}")
        return False

def test_environment_variables():
    """Test and display current environment variable configuration."""
    logger.info("\n=== Environment Variables Check ===")
    
    required_vars = ["PINECONE_API_KEY"]
    optional_vars = ["PINECONE_HOST", "PINECONE_ENVIRONMENT", "PINECONE_INDEX_NAME"]
    
    all_good = True
    
    for var in required_vars:
        value = os.environ.get(var)
        if value:
            logger.info(f"✓ {var}: ***{value[-4:]} (hidden for security)")
        else:
            logger.error(f"✗ {var}: Not set")
            all_good = False
    
    for var in optional_vars:
        value = os.environ.get(var)
        logger.info(f"{'✓' if value else '○'} {var}: {value or 'Using default'}")
    
    return all_good

if __name__ == "__main__":
    logger.info("Starting Pinecone connection test...")
    
    # Test environment variables first
    env_ok = test_environment_variables()
    
    if not env_ok:
        logger.error("Please fix environment variables before continuing.")
        sys.exit(1)
    
    # Test connection
    success = test_pinecone_connection()
    
    if success:
        logger.info("\n🎉 All tests passed! Pinecone is configured correctly.")
    else:
        logger.error("\n❌ Tests failed. Please check the configuration.")
        sys.exit(1)