from .base_tool import BaseTool, ToolRequest, ToolResponse
from google import genai
import os

class TextSimplificationRequest(ToolRequest):
    text: str
    simplification_type: str = "general"
    reading_level: str = "middle_school"

class TextSimplificationTool(BaseTool):
    def __init__(self):
        super().__init__(
            name="AI-Powered Text Simplification",
            description="Simplify complex text for better readability and accessibility"
        )
    
    async def process(self, request: TextSimplificationRequest) -> ToolResponse:
        try:
            # Initialize the Gemini client
            client = genai.Client()

            # Generate the LLM prompt based on the request parameters
            prompt = self._generate_llm_prompt(request.text, request.simplification_type, request.reading_level)

            # Call Gemini API to simplify the text
            try:
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=[prompt],
                )

                simplified_text = response.text

                return ToolResponse(
                    success=True,
                    message="Text simplification completed successfully",
                    data={
                        "original_text": request.text,
                        "simplified_text": simplified_text,
                        "simplification_type": request.simplification_type,
                        "reading_level": request.reading_level,
                        "status": "completed"
                    }
                )
            except Exception as e:
                print(f"Error generating content with Gemini: {e}")
                return ToolResponse(
                    success=False,
                    message=f"Failed to simplify text with Gemini: {str(e)}",
                    data={
                        "original_text": request.text,
                        "simplification_type": request.simplification_type,
                        "reading_level": request.reading_level,
                        "status": "error"
                    }
                )
                
        except Exception as e:
            return ToolResponse(
                success=False,
                message=f"Text simplification failed: {str(e)}",
                data={
                    "original_text": request.text,
                    "simplification_type": request.simplification_type,
                    "reading_level": request.reading_level,
                    "status": "error"
                }
            )
    
    def _generate_llm_prompt(self, text: str, simplification_type: str, reading_level: str) -> str:
        """
        Generate a comprehensive LLM prompt for text simplification based on the parameters.
        This prompt will be used when integrating with an actual LLM service.
        """
        
        # Define reading level instructions
        reading_level_instructions = {
            "elementary": "Use simple words (1-2 syllables when possible), short sentences (10-15 words max), and basic vocabulary suitable for grades 1-5.",
            "middle_school": "Use clear, straightforward language with some complex words explained, medium-length sentences (15-20 words), suitable for grades 6-8.",
            "high_school": "Use appropriate vocabulary with explanations for technical terms, varied sentence lengths, suitable for grades 9-12.",
            "adult_basic": "Use clear, everyday language with explanations for technical terms, suitable for adult learners with basic literacy skills."
        }
        
        # Define simplification type instructions
        simplification_instructions = {
            "general": "Make the text easier to read and understand while preserving the original meaning and tone.",
            "accessibility": "Focus on making the text accessible for people with cognitive disabilities, learning difficulties, or attention issues. Use clear structure, simple language, and logical flow.",
            "dyslexia": "Use dyslexia-friendly formatting: short paragraphs, clear spacing, simple sentence structure, and avoid complex fonts or layouts. Break up long words and use bullet points when appropriate.",
            "screen_reader": "Optimize for screen readers: use clear headings, descriptive language, and logical structure. Avoid complex formatting that might confuse screen reading software."
        }
        
        # Build the comprehensive prompt
        prompt = f"""
You are an expert text simplification assistant. Your task is to simplify the following text to make it more accessible and easier to understand.

TEXT TO SIMPLIFY:
{text}

SIMPLIFICATION REQUIREMENTS:

1. READING LEVEL: {reading_level_instructions.get(reading_level, reading_level_instructions['middle_school'])}

2. SIMPLIFICATION TYPE: {simplification_instructions.get(simplification_type, simplification_instructions['general'])}

3. SPECIFIC INSTRUCTIONS:
   - Break down complex sentences into shorter, clearer ones
   - Replace difficult words with simpler alternatives (but explain technical terms when necessary)
   - If the text is very long, consider breaking it into shorter paragraphs
   - If the text contains technical information, provide clear explanations
   - Maintain the original meaning and intent
   - Preserve important facts and data
   - Use active voice when possible
   - Add transitional words to improve flow
   - If appropriate, use bullet points or numbered lists for better organization

4. OUTPUT FORMAT:
   - Return only the simplified text
   - Do not include explanations or meta-commentary
   - Maintain the same general structure as the original
   - If the original had multiple paragraphs, maintain that structure

5. QUALITY CHECKS:
   - Ensure the simplified version is significantly easier to read
   - Verify that all important information is preserved
   - Check that the tone remains appropriate for the content
   - Make sure the text flows naturally

Please provide the simplified version of the text:
"""
        
        return prompt
