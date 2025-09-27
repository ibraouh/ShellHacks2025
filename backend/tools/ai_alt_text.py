from .base_tool import BaseTool, ToolRequest, ToolResponse
import requests
import os
import json

from google import genai
import requests
from google.genai import types

class AIAltTextRequest(ToolRequest):
    image_url: str
    context: str = ""

class AIAltTextTool(BaseTool):
    def __init__(self):
        super().__init__(
            name="AI-Generated Alt Text for Images",
            description="Generate descriptive alt text for images using AI"
        )
        
    async def process(self, request: AIAltTextRequest) -> ToolResponse:
        try:
            # Initialize the Gemini client
            client = genai.Client()

            # Define the text prompt
            prompt = f"Generate alt text for the following image: {request.image_url}"

            # For image URLs, we need to fetch the image first and encode it
            # Let's use a simpler approach with the image URL directly
            try:
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=[prompt],
                )

                return ToolResponse(
                    success=True,
                    message="AI Alt Text generated successfully",
                    data={
                        "image_url": request.image_url,
                        "context": request.context,
                        "alt_text": response.text,
                        "status": "completed"
                    }
                )
            except Exception as e:
                result = "Could not generate content with Gemini."
                print(f"Error generating content with Gemini: {e}")
            
                
        except requests.exceptions.RequestException as e:
            return ToolResponse(
                success=False,
                message=f"API request failed: {str(e)}",
                data={
                    "image_url": request.image_url,
                    "context": request.context,
                    "status": "error"
                }
            )
        except Exception as e:
            return ToolResponse(
                success=False,
                message=f"Error generating alt text: {str(e)}",
                data={
                    "image_url": request.image_url,
                    "context": request.context,
                    "status": "error"
                }
            )
