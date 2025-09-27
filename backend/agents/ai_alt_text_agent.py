import os
from google.adk.agents import Agent, LlmAgent
from google.adk.tools import google_search

api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise ValueError("GOOGLE_API_KEY environment variable is required. Please set it in your .env file.")

# Set the environment variable for Google GenAI
os.environ["GOOGLE_API_KEY"] = api_key

image_to_text_agent = LlmAgent(
    # A unique name for the agent.
    name="speech_commands_agent",
    # The Large Language Model (LLM) that agent will use.
    model="gemini-2.0-flash-exp", # if this model does not work, try below
    #model="gemini-2.0-flash-live-001",
    # A short description of the agent's purpose.
    description="Agent to describe images.",
    # Instructions to set the agent's behavior.
    instruction="""Provide a brief description of the image.""",
    # # Add tools for speech command processing and web interface interaction.
    # tools=[google_search, scan_webpage_elements, press_test_button, click_button_by_description, process_speech_command],
)