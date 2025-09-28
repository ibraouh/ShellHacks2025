import os
from google.adk.agents import Agent
from google.adk.tools import google_search  # Import the tool


def press_test_button() -> str:
    """Presses a button on the webpage.
    
    Returns:
        str: JSON object with button click instructions
    """
    import json
    
    # Return a JSON object that the frontend can parse and act on
    button_action = {
        "elementId": "click-me-button",  # This will be used as a fallback
        "event": "click",
        "message": "Webpage button has been clicked!"
    }
    
    return json.dumps(button_action)


def click_button_by_description(description: str) -> str:
    """Clicks a button on the webpage based on its description.
    
    Args:
        description (str): Description of the button to click (e.g., "submit", "cancel", "login")
        
    Returns:
        str: JSON object with button click instructions
    """
    import json
    
    # Return a JSON object that the frontend can parse and act on
    button_action = {
        "elementId": f"button-{description.lower().replace(' ', '-')}",  # Generate ID based on description
        "event": "click",
        "message": f"Button {description} has been clicked!"  # Remove single quotes to avoid JSON issues
    }
    
    return json.dumps(button_action)


def scan_webpage_elements() -> str:
    """Scans the webpage for all clickable elements and returns their information.
    
    Returns:
        str: JSON string containing information about all clickable elements on the page
    """
    import json
    
    # This will be populated by the frontend with actual webpage data
    # For now, return a placeholder that the frontend will replace
    return json.dumps({
        "message": "Requesting webpage scan...",
        "action": "scan_webpage"
    })


def process_speech_command(command: str) -> str:
    """Process speech commands and return appropriate actions.
    
    Args:
        command: The speech command text to process
        
    Returns:
        str: Natural text response for conversational commands
    """
    # Simple command processing - can be enhanced later
    command_lower = command.lower()
    
    if "click" in command_lower and "button" in command_lower:
        return press_test_button()
    elif "search" in command_lower:
        # For search commands, we'll let the agent handle it with google_search
        return f"I'll search for: {command}"
    else:
        # Return natural conversational response
        return "How can I help you interact with this webpage?"


# Set the API key for Google services
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise ValueError("GOOGLE_API_KEY environment variable is required. Please set it in your .env file.")

# Set the environment variable for Google GenAI
os.environ["GOOGLE_API_KEY"] = api_key

speech_commands_agent = Agent(
    name="speech_commands_agent",
    model="gemini-2.0-flash-exp",
    description="Agent to process speech commands and interact with webpage elements.",
    instruction="""
    CONTRACT:
    - Return ONLY machine-actionable JSON strings for actions. No markdown, no prose.
    - If clarification is needed, return {"action":"speak","text":"..."}.
    - First call scan_webpage_elements. Then use press_test_button or click_button_by_description for interactions.
    - Do not emit any free-form text outside JSON.
    EXAMPLES:
    {"action":"scan_webpage"}
    {"elementId":"click-me-button","event":"click","message":"Webpage button has been clicked!"}
    {"action":"speak","text":"Which button should I press?"}
    """,
    tools=[scan_webpage_elements, press_test_button, click_button_by_description, process_speech_command],
)
