#!/usr/bin/env python3
"""
Test script for enhanced web search functionality.
Tests both Tavily and fallback search engines.
"""

import os
import sys
import json
from dotenv import load_dotenv

# Add the aiFeatures/python directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'aiFeatures', 'python'))

from enhanced_web_search import enhanced_web_search, get_search_content_for_ai

# Load environment variables
load_dotenv()

def test_enhanced_search():
    """Test the enhanced search functionality"""
    print("=== Enhanced Web Search Test ===")
    
    # Check API keys
    tavily_key = os.getenv("TAVILY_API_KEY")
    serp_key = os.getenv("SERP_API_KEY")
    
    print(f"Tavily API Key: {'✓ Set' if tavily_key else '✗ Missing'}")
    print(f"SerpAPI Key: {'✓ Set' if serp_key else '✗ Missing'}")
    
    if not tavily_key and not serp_key:
        print("\\n❌ No API keys configured. Please set TAVILY_API_KEY or SERP_API_KEY in .env file")
        return False
    
    # Test queries
    test_queries = [
        "machine learning basics",
        "Python programming tutorial",
        "how does blockchain work"
    ]
    
    for query in test_queries:
        print(f"\\n🔍 Testing: {query}")
        print("-" * 50)
        
        try:
            # Test enhanced search
            response = enhanced_web_search(query, search_type="educational")
            
            print(f"Search Engine: {response.search_engine}")
            print(f"Results Found: {response.total_results}")
            print(f"Search Time: {response.search_time_ms:.0f}ms")
            
            if response.answer:
                print(f"AI Answer: {response.answer[:100]}...")
            
            if response.results:
                print("\\nTop Sources:")
                for i, result in enumerate(response.results[:2], 1):
                    print(f"  [{i}] {result.title}")
                    print(f"      {result.domain} (Score: {result.score:.2f})")
                    print(f"      {result.snippet[:80]}...")
            
            # Test LLM-formatted content
            print("\\n📝 LLM Content Preview:")
            llm_content = get_search_content_for_ai(query, "educational")
            print(llm_content[:200] + "..." if len(llm_content) > 200 else llm_content)
            
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            
    return True

def test_api_responses():
    """Test API response format for Flask integration"""
    print("\\n=== API Response Format Test ===")
    
    test_query = "JavaScript tutorial"
    
    try:
        response = enhanced_web_search(test_query)
        response_dict = response.to_dict()
        
        print("\\n📋 API Response Structure:")
        print(json.dumps(response_dict, indent=2)[:500] + "...")
        
        print("\\n✓ API response format is valid")
        return True
        
    except Exception as e:
        print(f"❌ API test failed: {str(e)}")
        return False

def interactive_test():
    """Interactive test mode"""
    print("\\n=== Interactive Test Mode ===")
    print("Enter your search queries (type 'quit' to exit)")
    
    while True:
        query = input("\\n🔍 Search query: ").strip()
        
        if query.lower() in ['quit', 'exit', 'q']:
            break
            
        if not query:
            continue
            
        try:
            print("\\n⏱️ Searching...")
            response = enhanced_web_search(query, search_type="comprehensive")
            
            print(f"\\n✅ Found {response.total_results} results in {response.search_time_ms:.0f}ms")
            
            if response.answer:
                print(f"\\n🤖 AI Summary:\\n{response.answer}")
            
            if response.results:
                print(f"\\n🔗 Top Sources:")
                for i, result in enumerate(response.results[:3], 1):
                    print(f"\\n[{i}] {result.title}")
                    print(f"    🌐 {result.url}")
                    print(f"    📊 Score: {result.score:.2f}")
                    print(f"    📝 {result.snippet}")
                    
        except Exception as e:
            print(f"❌ Search failed: {str(e)}")

if __name__ == "__main__":
    print("Enhanced Web Search Test Suite")
    print("=" * 50)
    
    # Run basic tests
    test_enhanced_search()
    test_api_responses()
    
    # Ask for interactive mode
    run_interactive = input("\\n🎮 Run interactive test? (y/n): ").strip().lower()
    if run_interactive in ['y', 'yes']:
        interactive_test()
    
    print("\\n🎉 Test completed!")
    print("\\n💡 Next Steps:")
    print("1. Set TAVILY_API_KEY in your .env file for best results")
    print("2. Run the Flask app to test the UI integration")
    print("3. Try different search types: 'quick', 'comprehensive', 'educational'")