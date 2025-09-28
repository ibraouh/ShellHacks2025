from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from typing import Dict, Any
import json
import base64
import asyncio
import signal
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import ADK components for SSE
from google.adk.runners import InMemoryRunner
from google.adk.agents import LiveRequestQueue
from google.adk.agents.run_config import RunConfig
from google.genai import types
from google.genai.types import Part, Content, Blob
from google import genai

# Import all tools
from tools.speech_to_instructions import SpeechToInstructionsTool, SpeechToInstructionsRequest
from tools.ai_alt_text import AIAltTextTool, AIAltTextRequest
from tools.adaptive_css import DyslexiaFontTool, DyslexiaFontRequest
from tools.semantic_search import SemanticSearchTool, SemanticSearchRequest
from tools.text_simplification import TextSimplificationTool, TextSimplificationRequest

# Import agents
from agents.speech_commands_agent import speech_commands_agent, form_interpreter_agent
from agents.website_search_agent import website_search_agent

app = FastAPI(title="Accessibility Tools API", version="1.0.0")

# Add CORS middleware to allow requests from the Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Initialize all tools
tools = {
    "speech_to_instructions": SpeechToInstructionsTool(),
    "ai_alt_text": AIAltTextTool(),
    "adaptive_css": DyslexiaFontTool(),
    "semantic_search": SemanticSearchTool(),
    "text_simplification": TextSimplificationTool(),
}

# Store active sessions for SSE
active_sessions = {}

# Graceful shutdown handler
def cleanup_sessions():
    """Clean up all active sessions on shutdown"""
    print("Cleaning up active sessions...")
    for user_id, live_request_queue in active_sessions.items():
        try:
            live_request_queue.close()
            print(f"Closed session for user {user_id}")
        except Exception as e:
            print(f"Error closing session for user {user_id}: {e}")
    active_sessions.clear()

# Register shutdown handler
def signal_handler(signum, frame):
    print(f"\nReceived signal {signum}, shutting down gracefully...")
    cleanup_sessions()
    exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

# FastAPI shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Handle FastAPI shutdown"""
    cleanup_sessions()

# =============================================================================
# SSE ENDPOINTS FOR REAL-TIME SPEECH COMMANDS
# =============================================================================

async def start_agent_session(user_id):
    """Starts an agent session"""
    # Create a Runner
    runner = InMemoryRunner(
        app_name="Speech Commands Tool",
        agent=speech_commands_agent,
    )

    # Create a Session
    session = await runner.session_service.create_session(
        app_name="Speech Commands Tool",
        user_id=user_id,
    )

    # Text responses with input audio transcription enabled (audio modality disabled for stability)
    run_config = RunConfig(
        response_modalities=[types.Modality.TEXT],
        session_resumption=types.SessionResumptionConfig(),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
    )

    # Create a LiveRequestQueue for this session
    live_request_queue = LiveRequestQueue()

    # Start agent session
    live_events = runner.run_live(
        session=session,
        live_request_queue=live_request_queue,
        run_config=run_config,
    )
    return live_events, live_request_queue

async def start_search_agent_session(user_id):
    """Starts a website search agent session"""
    # Create a Runner
    runner = InMemoryRunner(
        app_name="Website Search Tool",
        agent=website_search_agent,
    )

    # Create a Session
    session = await runner.session_service.create_session(
        app_name="Website Search Tool",
        user_id=user_id,
    )

    # Set response modality to text only for search
    run_config = RunConfig(
        response_modalities=[types.Modality.TEXT],
        session_resumption=types.SessionResumptionConfig(),
    )

    # Create a LiveRequestQueue for this session
    live_request_queue = LiveRequestQueue()

    # Start agent session
    live_events = runner.run_live(
        session=session,
        live_request_queue=live_request_queue,
        run_config=run_config,
    )
    return live_events, live_request_queue

async def agent_to_client_sse(live_events):
    """Agent to client communication via SSE"""
    async for event in live_events:
        # If the turn complete or interrupted, send it
        if event.turn_complete or event.interrupted:
            message = {
                "turn_complete": event.turn_complete,
                "interrupted": event.interrupted,
            }
            yield f"data: {json.dumps(message)}\n\n"
            print(f"[AGENT TO CLIENT]: {message}")
            continue

        # Read the Content and its first Part
        part: Part = (
            event.content and event.content.parts and event.content.parts[0]
        )
        if not part:
            continue

        # If it's text, send it only when complete (not partial)
        if part.text and not event.partial:
            message = {
                "mime_type": "text/plain",
                "data": part.text
            }
            yield f"data: {json.dumps(message)}\n\n"
            print(f"[AGENT TO CLIENT]: text/plain: {message}")

@app.get("/events/{user_id}")
async def sse_endpoint(user_id: int):
    """SSE endpoint for agent to client communication"""
    # Start agent session
    user_id_str = str(user_id)
    live_events, live_request_queue = await start_agent_session(user_id_str)

    # Store the request queue for this user
    active_sessions[user_id_str] = live_request_queue

    print(f"Client #{user_id} connected via SSE")

    def cleanup():
        live_request_queue.close()
        if user_id_str in active_sessions:
            del active_sessions[user_id_str]
        print(f"Client #{user_id} disconnected from SSE")

    async def event_generator():
        try:
            async for data in agent_to_client_sse(live_events):
                yield data
        except Exception as e:
            error_msg = str(e)
            print(f"Error in SSE stream: {e}")
            
            # Check if it's a quota exceeded error
            if "quota" in error_msg.lower() or "exceeded" in error_msg.lower():
                quota_error = {
                    "error": "quota_exceeded",
                    "message": "Google API quota exceeded. Please check your API key limits or try again later.",
                    "mime_type": "text/plain",
                    "data": "Sorry, I've reached my API quota limit. Please check your Google API key settings or try again later."
                }
                yield f"data: {json.dumps(quota_error)}\n\n"
            else:
                # Generic error message
                error_response = {
                    "error": "connection_error", 
                    "message": error_msg,
                    "mime_type": "text/plain",
                    "data": "An error occurred while processing your request. Please try again."
                }
                yield f"data: {json.dumps(error_response)}\n\n"
        finally:
            cleanup()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control"
        }
    )

@app.post("/send/{user_id}")
async def send_message_endpoint(user_id: int, request: Request):
    """HTTP endpoint for client to agent communication"""
    user_id_str = str(user_id)

    # Get the live request queue for this user
    live_request_queue = active_sessions.get(user_id_str)
    if not live_request_queue:
        return {"error": "Session not found"}

    # Parse the message
    message = await request.json()
    mime_type = message["mime_type"]
    data = message["data"]

    # Send the message to the agent
    if mime_type == "text/plain":
        content = Content(role="user", parts=[Part.from_text(text=data)])
        live_request_queue.send_content(content=content)
        print(f"[CLIENT TO AGENT]: {data}")
    elif mime_type == "audio/pcm":
        decoded_data = base64.b64decode(data)
        live_request_queue.send_realtime(Blob(data=decoded_data, mime_type=mime_type))
        print(f"[CLIENT TO AGENT]: audio/pcm: {len(decoded_data)} bytes")
    else:
        return {"error": f"Mime type not supported: {mime_type}"}

    return {"status": "sent"}

# =============================================================================
# SSE ENDPOINTS FOR WEBSITE SEARCH
# =============================================================================

@app.get("/search/events/{user_id}")
async def search_sse_endpoint(user_id: str):
    """SSE endpoint for website search agent to client communication"""
    # Start search agent session
    user_id_str = str(user_id)
    live_events, live_request_queue = await start_search_agent_session(user_id_str)

    # Store the request queue for this user
    active_sessions[f"search_{user_id_str}"] = live_request_queue

    print(f"Search client #{user_id} connected via SSE")

    def cleanup():
        live_request_queue.close()
        if f"search_{user_id_str}" in active_sessions:
            del active_sessions[f"search_{user_id_str}"]
        print(f"Search client #{user_id} disconnected from SSE")

    async def event_generator():
        try:
            async for data in agent_to_client_sse(live_events):
                yield data
        except Exception as e:
            error_msg = str(e)
            print(f"Error in search SSE stream: {e}")
            
            # Check if it's a quota exceeded error
            if "quota" in error_msg.lower() or "exceeded" in error_msg.lower():
                quota_error = {
                    "error": "quota_exceeded",
                    "message": "Google API quota exceeded. Please check your API key limits or try again later.",
                    "mime_type": "text/plain",
                    "data": "Sorry, I've reached my API quota limit. Please check your Google API key settings or try again later."
                }
                yield f"data: {json.dumps(quota_error)}\n\n"
            else:
                # Generic error message
                error_response = {
                    "error": "connection_error", 
                    "message": error_msg,
                    "mime_type": "text/plain",
                    "data": "An error occurred while processing your request. Please try again."
                }
                yield f"data: {json.dumps(error_response)}\n\n"
        finally:
            cleanup()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control"
        }
    )

@app.post("/search/send/{user_id}")
async def search_send_message_endpoint(user_id: str, request: Request):
    """HTTP endpoint for client to search agent communication"""
    user_id_str = str(user_id)

    # Get the live request queue for this user
    live_request_queue = active_sessions.get(f"search_{user_id_str}")
    if not live_request_queue:
        return {"error": "Search session not found"}

    # Parse the message
    message = await request.json()
    mime_type = message["mime_type"]
    data = message["data"]

    # Send the message to the agent
    if mime_type == "text/plain":
        content = Content(role="user", parts=[Part.from_text(text=data)])
        live_request_queue.send_content(content=content)
        print(f"[SEARCH CLIENT TO AGENT]: {data}")
    else:
        return {"error": f"Mime type not supported: {mime_type}"}

    return {"status": "sent"}

# =============================================================================
# FORM ANSWER INTERPRETATION ENDPOINT
# =============================================================================

@app.post("/form/interpret")
async def interpret_form_answer(request: Request):
    """Use ADK agent to interpret a natural-language answer into structured action JSON."""
    try:
        payload = await request.json()
        question = payload.get("question")
        qtype = payload.get("type")
        options = payload.get("options", [])
        user_text = payload.get("user_text")
        context = payload.get("context", {})

        if not question or not qtype or user_text is None:
            raise HTTPException(status_code=400, detail="Missing required fields: question, type, user_text")

        system_preamble = (
            "You are a form interpreter. Convert user_text into strict JSON. "
            + "Question type: " + str(qtype) + ". "
            + "Options: " + ", ".join(options) + ". "
            + "Question: " + str(question)
        )

        # Use direct Gemini client for a simple one-shot generation
        client = genai.Client()
        prompt = (
            system_preamble
            + "\nReturn ONLY a single-line JSON. Do not add prose.\n"
            + f"User payload: {json.dumps({'question': question, 'type': qtype, 'options': options, 'user_text': user_text, 'context': context})}"
            + "\nIf type is text/long_text, output {\"action\":\"set_text\",\"normalized_text\":\"...\",\"confidence\":0.0-1.0}.\n"
            + "If type is radio/dropdown, output {\"action\":\"select\",\"choices\":[exact_option],\"confidence\":0.0-1.0} where choices[0] EXACTLY matches one of the provided options.\n"
            + "If type is checkbox, output {\"action\":\"multi_select\",\"choices\":[exact_options...],\"confidence\":0.0-1.0} where each choice EXACTLY matches an option.\n"
            + "For name prompts, normalized_text must be the name only, capitalized. For emails, return the email; for phone, return a tidy phone string."
        )
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[prompt],
            )
            response_text = response.text or ""
        except Exception as e:
            response_text = ""

        try:
            data = json.loads(response_text)
            return {"success": True, "data": data}
        except json.JSONDecodeError:
            # Attempt to salvage JSON substring
            start = response_text.find("{")
            end = response_text.rfind("}")
            if start != -1 and end != -1 and end > start:
                try:
                    data = json.loads(response_text[start:end+1])
                    return {"success": True, "data": data}
                except Exception:
                    pass

            # Backend fallback normalization for common text questions
            def backend_fallback_normalize(q: str, qtype: str, user_txt: str):
                ql = (q or "").lower()
                txt = (user_txt or "").strip()
                if qtype in ["text", "long_text"]:
                    # Name extraction
                    if any(k in ql for k in ["name", "your name", "full name"]):
                        import re
                        m = re.search(r"(?:^|\b)(?:i am|i'm|my name is|my name's|it is|it's)\s+([a-z][a-z\-\' ]{1,60})", txt, flags=re.IGNORECASE)
                        if m and m.group(1):
                            candidate = m.group(1).strip()
                            candidate = re.split(r"[,.!?]", candidate)[0].strip()
                            candidate = " ".join(w[:1].upper() + w[1:].lower() for w in candidate.split())
                            return {"action": "set_text", "normalized_text": candidate, "confidence": 0.9}
                        # If no pattern match, try to capitalize a single word
                        words = [w for w in re.split(r"\s+", txt) if w]
                        if 1 <= len(words) <= 3:
                            candidate = " ".join(w[:1].upper() + w[1:].lower() for w in words)
                            return {"action": "set_text", "normalized_text": candidate, "confidence": 0.7}
                        return {"action": "set_text", "normalized_text": txt, "confidence": 0.6}

                    # Email extraction
                    if "email" in ql:
                        import re
                        m = re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", txt, flags=re.IGNORECASE)
                        if m:
                            return {"action": "set_text", "normalized_text": m.group(0), "confidence": 0.9}
                        return {"action": "set_text", "normalized_text": txt, "confidence": 0.6}

                    # Phone extraction
                    if any(k in ql for k in ["phone", "mobile", "telephone"]):
                        import re
                        m = re.search(r"(\+?\d[\d\s().-]{7,}\d)", txt)
                        if m:
                            return {"action": "set_text", "normalized_text": m.group(1).strip(), "confidence": 0.85}
                        return {"action": "set_text", "normalized_text": txt, "confidence": 0.6}

                    # Generic text fallback
                    return {"action": "set_text", "normalized_text": txt, "confidence": 0.6}

                # No fallback for choice types here
                return None

            fallback = backend_fallback_normalize(question, qtype, user_text)
            if fallback:
                return {"success": True, "data": fallback, "note": "backend_fallback"}
            return {"success": False, "error": "invalid_json", "raw": response_text}

    except HTTPException:
        raise
    except Exception as e:
        # As a last resort, provide backend fallback normalization
        try:
            payload = await request.json()
            question = payload.get("question")
            qtype = payload.get("type")
            user_text = payload.get("user_text")

            def quick_fallback(q: str, qtype: str, user_txt: str):
                ql = (q or "").lower()
                txt = (user_txt or "").strip()
                if qtype in ["text", "long_text"]:
                    import re
                    if any(k in ql for k in ["name", "your name", "full name"]):
                        m = re.search(r"(?:^|\b)(?:i am|i'm|my name is|my name's|it is|it's)\s+([a-z][a-z\-\' ]{1,60})", txt, flags=re.IGNORECASE)
                        if m and m.group(1):
                            candidate = m.group(1).strip()
                            candidate = re.split(r"[,.!?]", candidate)[0].strip()
                            candidate = " ".join(w[:1].upper() + w[1:].lower() for w in candidate.split())
                            return {"action": "set_text", "normalized_text": candidate, "confidence": 0.85}
                    return {"action": "set_text", "normalized_text": txt, "confidence": 0.6}
                return None

            fb = quick_fallback(question, qtype, user_text)
            if fb:
                return {"success": True, "data": fb, "note": "backend_exception_fallback"}
        except Exception:
            pass
        return {"success": False, "error": str(e)}

# =============================================================================
# EXISTING ENDPOINTS
# =============================================================================

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
        if tool_id == "speech_to_instructions":
            request = SpeechToInstructionsRequest(**request_data)
        elif tool_id == "ai_alt_text":
            request = AIAltTextRequest(**request_data)
        elif tool_id == "adaptive_css":
            request = DyslexiaFontRequest(**request_data)
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

@app.get("/api-status")
async def api_status():
    """Check the status of the Google API key"""
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return {
            "status": "error",
            "message": "GOOGLE_API_KEY not found in environment variables"
        }
    
    # Check if the key looks valid (basic validation)
    if len(api_key) < 20 or not api_key.startswith("AIza"):
        return {
            "status": "warning", 
            "message": "API key format appears invalid"
        }
    
    return {
        "status": "ok",
        "message": "API key is configured",
        "key_prefix": api_key[:10] + "..."
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
