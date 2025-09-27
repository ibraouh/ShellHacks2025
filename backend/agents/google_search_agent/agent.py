# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from google.adk.agents import Agent
from google.adk.tools import google_search  # Import the tool


def press_test_button() -> str:
    """Presses the test button on the web interface.
    
    Returns:
        str: JSON object with button click instructions
    """
    import json
    
    # Return a JSON object that the frontend can parse and act on
    button_action = {
        "elementId": "testButton",
        "event": "click",
        "message": "Test button has been pressed!"
    }
    
    return json.dumps(button_action)

root_agent = Agent(
   # A unique name for the agent.
   name="google_search_agent",
   # The Large Language Model (LLM) that agent will use.
   model="gemini-2.0-flash-exp", # if this model does not work, try below
   #model="gemini-2.0-flash-live-001",
   # A short description of the agent's purpose.
   description="Agent to answer questions using Google Search and interact with the web interface.",
   # Instructions to set the agent's behavior.
   instruction="""Answer questions using the Google Search tool when you need current information, and use the press_test_button tool when the user asks you to press the test button or interact with the web interface.
   If you use the press_test_button tool, DO NOT alter the tool response by adding your own message - return the exact tool response JSON.
   """,
   # Add google_search tool to perform grounding with Google search and press_test_button for web interface interaction.
   tools=[google_search, press_test_button],
)
