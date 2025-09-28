import os
import json
import base64
import asyncio
import time
from typing import Optional

from .base_tool import BaseTool, ToolRequest, ToolResponse
from google.adk.runners import InMemoryRunner
from google.adk.agents import LiveRequestQueue
from google.adk.agents.run_config import RunConfig
from google.genai import types
from google.genai.types import Part, Content, Blob

from agents.speech_commands_agent import speech_commands_agent

class SpeechToInstructionsRequest(ToolRequest):
    audio_data: str  # Base64 encoded audio or file path
    text_command: Optional[str] = None  # Optional text command for testing

class SpeechToInstructionsTool(BaseTool):
    def __init__(self):
        super().__init__(
            name="Speech-to-Instructions Navigation",
            description="Convert speech to navigation instructions using Google ADK"
        )
        self.app_name = "Speech Commands Tool"
    
    async def process(self, request: SpeechToInstructionsRequest) -> ToolResponse:
        max_retries = 5
        retry_delay = 1  # Start with 1 second delay
        
        for attempt in range(max_retries):
            try:
                # Create a Runner with the speech commands agent
                runner = InMemoryRunner(
                    app_name=self.app_name,
                    agent=speech_commands_agent,
                )

                # Create a Session
                session = await runner.session_service.create_session(
                    app_name=self.app_name,
                    user_id="speech_commands_user",
                )

                # Set response modality to text
                run_config = RunConfig(
                    response_modalities=[types.Modality.TEXT],
                    session_resumption=types.SessionResumptionConfig(),
                    output_audio_transcription=types.AudioTranscriptionConfig(),
                    input_audio_transcription=types.AudioTranscriptionConfig(),
                )

                # Create a LiveRequestQueue for this session
                live_request_queue = LiveRequestQueue()

                # Start agent session
                live_events = runner.run_live(
                    session=session,
                    live_request_queue=live_request_queue,
                    run_config=run_config,
                )

                # Process the input
                if request.text_command:
                    # Process text command directly
                    content = Content(role="user", parts=[Part.from_text(text=request.text_command)])
                    live_request_queue.send_content(content=content)
                elif request.audio_data:
                    # Process audio data
                    decoded_data = base64.b64decode(request.audio_data)
                    live_request_queue.send_realtime(Blob(data=decoded_data, mime_type="audio/pcm"))
                else:
                    return ToolResponse(
                        success=False,
                        message="No audio data or text command provided",
                        data={"error": "missing_input"}
                    )

                # Collect the response
                response_text = ""
                async for event in live_events:
                    if event.turn_complete:
                        break
                    
                    if event.content and event.content.parts:
                        part = event.content.parts[0]
                        if part.text:
                            response_text += part.text

                # Clean up
                live_request_queue.close()

                # Try to parse as JSON for structured responses
                try:
                    response_data = json.loads(response_text)
                    return ToolResponse(
                        success=True,
                        message="Speech command processed successfully",
                        data=response_data
                    )
                except json.JSONDecodeError:
                    # Return as plain text if not JSON
                    return ToolResponse(
                        success=True,
                        message="Speech command processed successfully",
                        data={"response": response_text, "raw_text": response_text}
                    )

            except Exception as e:
                print(f"Error processing speech command (attempt {attempt + 1}/{max_retries}): {e}")
                
                if attempt == max_retries - 1:
                    # Last attempt failed
                    return ToolResponse(
                        success=False,
                        message=f"Error processing speech command after {max_retries} attempts: {str(e)}",
                        data={"error": str(e)}
                    )
                else:
                    # Wait before retrying with exponential backoff
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
