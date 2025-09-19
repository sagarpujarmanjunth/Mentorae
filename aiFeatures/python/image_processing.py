import os
import base64
import io
from typing import Dict, Any
from PIL import Image
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Try to import pytesseract, but handle the case when it's not available
try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    logger.warning("pytesseract not available. OCR functionality will be disabled.")
    pytesseract = None  # Define pytesseract as None to avoid linter errors
except Exception as e:
    TESSERACT_AVAILABLE = False
    logger.warning(f"Error importing pytesseract: {str(e)}. OCR functionality will be disabled.")
    pytesseract = None  # Define pytesseract as None to avoid linter errors

def process_image(image_path: str) -> Dict[str, Any]:
    """
    Process an image and extract information from it.
    
    Args:
        image_path: Path to the image file
        
    Returns:
        Dictionary containing extracted text and image description
    """
    try:
        # Open and process the image
        image = Image.open(image_path)
        
        # Extract text using OCR if available
        extracted_text = ""
        if TESSERACT_AVAILABLE and pytesseract is not None:
            try:
                extracted_text = pytesseract.image_to_string(image)
            except Exception as ocr_error:
                logger.error(f"OCR error: {str(ocr_error)}")
                # Don't expose technical error details to frontend
                extracted_text = ""
        else:
            # Don't send error message to frontend when Tesseract is not available
            extracted_text = ""
        
        # Get image description using Google Gemini
        description = describe_image_with_gemini(image_path)
        
        return {
            "extracted_text": extracted_text.strip(),
            "image_description": description,
            "image_size": image.size,
            "image_mode": image.mode
        }
        
    except Exception as e:
        logger.error(f"Error processing image {image_path}: {str(e)}")
        return {
            "extracted_text": "",
            "image_description": f"Error processing image: {str(e)}",
            "error": str(e)
        }

def describe_image_with_gemini(image_path: str) -> str:
    """
    Use Google Gemini to describe the content of an image.
    
    Args:
        image_path: Path to the image file
        
    Returns:
        Description of the image content
    """
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain.prompts import ChatPromptTemplate
        from langchain.schema.output_parser import StrOutputParser
        
        # Initialize Gemini model
        llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")
        
        # Create prompt for image description
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an AI tutor that can analyze images. "
                      "Provide a detailed description of what you see in the image. "
                      "If it's a diagram, chart, or educational content, explain it clearly. "
                      "If it's a photograph, describe the scene and any notable elements. "
                      "Be educational and informative in your response."),
            ("human", [
                {"type": "text", "text": "Please describe this image in detail:"},
                {"type": "image_url", "image_url": f"data:image/jpeg;base64,{encode_image_to_base64(image_path)}"}
            ])
        ])
        
        # Generate description
        chain = prompt | llm | StrOutputParser()
        description = chain.invoke({})
        
        return description
        
    except Exception as e:
        logger.error(f"Error describing image with Gemini: {str(e)}")
        return f"Could not generate image description: {str(e)}"

def encode_image_to_base64(image_path: str) -> str:
    """
    Encode an image file to base64 string.
    
    Args:
        image_path: Path to the image file
        
    Returns:
        Base64 encoded string of the image
    """
    try:
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    except Exception as e:
        logger.error(f"Error encoding image to base64: {str(e)}")
        return ""

def analyze_image_for_education(image_data: Dict[str, Any], query: str = "") -> str:
    """
    Analyze image content for educational purposes.
    
    Args:
        image_data: Dictionary containing image processing results
        query: Optional specific query about the image
        
    Returns:
        Educational analysis of the image
    """
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain.prompts import ChatPromptTemplate
        from langchain.schema.output_parser import StrOutputParser
        
        # Initialize Gemini model
        llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")
        
        # Create prompt for educational analysis
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an AI Tutor named Mentorae. "
                      "You specialize in explaining educational content. "
                      "Analyze the image content and provide a clear, educational explanation. "
                      "If there's text in the image, explain its significance. "
                      "If it's a diagram or chart, break it down step by step. "
                      "Use clear language and provide examples when helpful."),
            ("human", [
                {"type": "text", "text": f"Based on the image analysis:\n"
                                        f"Extracted Text: {image_data.get('extracted_text', '')}\n"
                                        f"Image Description: {image_data.get('image_description', '')}\n"
                                        f"Image Size: {image_data.get('image_size', 'Unknown')}\n"
                                        f"Image Mode: {image_data.get('image_mode', 'Unknown')}\n\n"
                                        f"Please provide an educational explanation of this image content.\n"
                                        f"Specific query: {query if query else 'General explanation'}"},
            ])
        ])
        
        # Generate educational analysis
        chain = prompt | llm | StrOutputParser()
        analysis = chain.invoke({})
        
        return analysis
        
    except Exception as e:
        logger.error(f"Error analyzing image for education: {str(e)}")
        return f"Could not analyze image content: {str(e)}"