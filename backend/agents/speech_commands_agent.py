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
    # A unique name for the agent.
    name="speech_commands_agent",
    # The Large Language Model (LLM) that agent will use.
    model="gemini-2.0-flash-exp", # if this model does not work, try below
    #model="gemini-2.0-flash-live-001",
    # A short description of the agent's purpose.
    description="Agent to process speech commands and interact with webpage elements.",
    # Instructions to set the agent's behavior.
    instruction="""Process speech commands and provide appropriate responses or actions.
    
    WEBPAGE AWARENESS:
    - ALWAYS start by using scan_webpage_elements to understand what's available on the page
    - Use the scan results to make intelligent decisions about which elements to interact with
    - The scan will provide you with detailed information about all clickable elements
    - When scan results are provided, respond briefly like "3 buttons found" or "5 elements available"
    
    BUTTON INTERACTION:
    - When users ask to click buttons, use the appropriate tool:
      - Use press_test_button for generic button clicks or when no specific button is mentioned
      - Use click_button_by_description when users specify a button type (e.g., "click submit", "press cancel", "click login button")
    
    - The frontend will intelligently find buttons based on text content, IDs, and other attributes
    - Always return the exact JSON response from the tool without any modifications
    
    OTHER COMMANDS:
    - Use google_search when users ask questions that require current information
    - Use process_speech_command for general speech command processing
    
    RESPONSE FORMAT:
    - Keep responses concise and natural
    - For conversational responses, be brief and helpful
    - For tool actions, return ONLY the JSON string without any markdown formatting, explanations, or additional text
    - The frontend expects pure JSON for actions, but natural text for conversations
    """,
    # Add tools for speech command processing and web interface interaction.
    tools=[google_search, scan_webpage_elements, press_test_button, click_button_by_description, process_speech_command],
)
