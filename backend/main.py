from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any
import json

# Import all tools
from tools.text_to_speech import TextToSpeechTool, TextToSpeechRequest
from tools.speech_to_instructions import SpeechToInstructionsTool, SpeechToInstructionsRequest
from tools.ai_alt_text import AIAltTextTool, AIAltTextRequest
from tools.adaptive_css import AdaptiveCSSTool, AdaptiveCSSRequest
from tools.semantic_search import SemanticSearchTool, SemanticSearchRequest
from tools.text_simplification import TextSimplificationTool, TextSimplificationRequest

app = FastAPI(title="Accessibility Tools API", version="1.0.0")

# Add CORS middleware to allow requests from the Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["chrome-extension://*"],  # Allow all Chrome extensions
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize all tools
tools = {
    "text_to_speech": TextToSpeechTool(),
    "speech_to_instructions": SpeechToInstructionsTool(),
    "ai_alt_text": AIAltTextTool(),
    "adaptive_css": AdaptiveCSSTool(),
    "semantic_search": SemanticSearchTool(),
    "text_simplification": TextSimplificationTool(),
}

@app.get("/")
async def root():
    return {"message": "Accessibility Tools API is running!", "tools": list(tools.keys())}

@app.get("/tools")
async def get_tools():
    """Get information about all available tools"""
    return {tool_id: tool.get_info() for tool_id, tool in tools.items()}

@app.post("/tools/{tool_id}/process")
async def process_tool(tool_id: str, request_data: Dict[str, Any]):
    """Process a request with the specified tool"""
    if tool_id not in tools:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_id}' not found")
    
    tool = tools[tool_id]
    
    try:
        # Create appropriate request object based on tool type
        if tool_id == "text_to_speech":
            request = TextToSpeechRequest(**request_data)
        elif tool_id == "speech_to_instructions":
            request = SpeechToInstructionsRequest(**request_data)
        elif tool_id == "ai_alt_text":
            request = AIAltTextRequest(**request_data)
        elif tool_id == "adaptive_css":
            request = AdaptiveCSSRequest(**request_data)
        elif tool_id == "semantic_search":
            request = SemanticSearchRequest(**request_data)
        elif tool_id == "text_simplification":
            request = TextSimplificationRequest(**request_data)
        else:
            raise HTTPException(status_code=400, detail="Invalid tool type")
        
        # Process the request
        response = await tool.process(request)
        return response.dict()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")

@app.get("/test")
async def test_endpoint():
    return {"message": "good"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
