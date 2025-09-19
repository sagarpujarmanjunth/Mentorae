# Pinecone Configuration Guide for AI-Tutor

This guide explains how to set up Pinecone integration for the AI-Tutor project's hybrid vector storage system.

## 🚀 Quick Start

### 1. Install Dependencies

First, install the updated requirements:

```bash
pip install -r requirements.txt
```

### 2. Pinecone Account Setup

1. Go to [Pinecone Console](https://app.pinecone.io/)
2. Sign up or log in to your account
3. Create a new project (if you don't have one)
4. Generate an API key from the "API Keys" section

### 3. Environment Configuration

Create or update your `.env` file in the project root:

```env
# Existing variables
GOOGLE_API_KEY=your_google_api_key_here

# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_HOST=https://ai-tutor-x-cgn8neb.svc.aped-4627-b74a.pinecone.io
PINECONE_ENVIRONMENT=us-east-1
PINECONE_INDEX_NAME=ai-tutor-documents
```

## 📊 Pinecone Index Configuration

### Automatic Index Creation

The system automatically creates a Pinecone index with these specifications:

- **Index Name**: `ai-tutor-documents` (configurable)
- **Dimensions**: `1024` (for mxbai-embed-large model)
- **Metric**: `cosine` (for similarity search)
- **Cloud**: `aws`
- **Region**: `us-east-1` (Serverless)

### Manual Index Creation (Optional)

If you prefer to create the index manually:

1. Go to Pinecone Console
2. Click "Create Index"
3. Use these settings:
   - **Name**: `ai-tutor-documents`
   - **Dimensions**: `1024`
   - **Metric**: `cosine`
   - **Pod Type**: Choose Serverless (recommended for cost efficiency)
   - **Cloud Provider**: AWS
   - **Region**: us-east-1

## 🔧 Hybrid Storage Logic

The system automatically decides between local FAISS and Pinecone based on:

### Storage Decision Criteria

| Criterion | Local FAISS | Pinecone |
|-----------|-------------|----------|
| **File Size** | ≤ 1 MB | > 1 MB |
| **Page Count** | ≤ 4 pages | > 4 pages |
| **Memory Usage** | Low | Any |

### Decision Flow

```
Document Analysis
       ↓
Size > 1MB OR Pages > 4?
       ↓                ↓
     Yes              No
       ↓                ↓
   Pinecone      Local FAISS
   (Cloud)        (Memory)
```

## 🛠️ Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PINECONE_API_KEY` | None | **Required** - Your Pinecone API key |
| `PINECONE_ENVIRONMENT` | `us-east-1` | Pinecone environment/region |
| `PINECONE_INDEX_NAME` | `ai-tutor-documents` | Name of your Pinecone index |

### Customizing Thresholds

To modify the storage decision thresholds, edit `hybrid_vector_store.py`:

```python
class HybridVectorStore:
    def __init__(self, embeddings, embedding_dim: int = 1024):
        # Modify these values
        self.size_threshold_mb = 1.0  # Change size threshold
        self.page_threshold = 4       # Change page threshold
```

## 📈 Cost Considerations

### Pinecone Pricing (Approximate)

- **Serverless**: Pay per query and storage
- **Starter**: ~$70/month for small-scale usage
- **Standard**: ~$140/month for medium-scale usage

### Cost Optimization Tips

1. **Use Serverless** for intermittent usage
2. **Local FAISS** for small documents (< 1MB, < 4 pages)
3. **Delete unused indexes** when not needed
4. **Monitor usage** through Pinecone dashboard

## 🔍 Testing the Integration

### 1. Test Small Document (Local FAISS)

```python
# This should use local FAISS
vector_store = index_pdfs("small_document.pdf")  # < 1MB, < 4 pages
print(f"Using: {getattr(vector_store, 'store_type', 'unknown')}")
```

### 2. Test Large Document (Pinecone)

```python
# This should use Pinecone
vector_store = index_pdfs("large_document.pdf")  # > 1MB or > 4 pages
print(f"Using: {getattr(vector_store, 'store_type', 'unknown')}")
```

### 3. Check Status via API

```bash
curl http://localhost:5500/status
```

Expected response:
```json
{
  "vector_store": "initialized",
  "store_type": "pinecone",  // or "local"
  "is_hybrid": true,
  "message": "Vector store active: pinecone"
}
```

## 🚨 Troubleshooting

### Common Issues

1. **Import Error**: `pinecone-client not installed`
   ```bash
   pip install pinecone-client
   ```

2. **API Key Error**: Check your `.env` file
   ```env
   PINECONE_API_KEY=your_actual_api_key_here
   ```

3. **Index Creation Failed**: Verify API key and permissions

4. **Fallback to Local**: System automatically falls back to FAISS if Pinecone fails

### Debug Mode

Enable detailed logging:

```python
import logging
logging.basicConfig(level=logging.INFO)
```

## 🔒 Security Best Practices

1. **Never commit** API keys to version control
2. **Use environment variables** for all secrets
3. **Rotate API keys** regularly
4. **Limit API key permissions** in Pinecone dashboard
5. **Monitor usage** for unexpected spikes

## 📚 Additional Resources

- [Pinecone Documentation](https://docs.pinecone.io/)
- [Pinecone Python Client](https://github.com/pinecone-io/pinecone-python-client)
- [LangChain Pinecone Integration](https://python.langchain.com/docs/integrations/vectorstores/pinecone)

## 🆘 Support

If you encounter issues:

1. Check the Pinecone Console for index status
2. Verify API key permissions
3. Review application logs for error messages
4. Test with a small PDF first
5. Check the `/status` endpoint for current configuration

---

**Note**: The system is designed to work seamlessly with or without Pinecone. If configuration fails, it automatically falls back to local FAISS storage.