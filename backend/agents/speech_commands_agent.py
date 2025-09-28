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
    """Process speech commands and return appropriate actions. This function MUST be called for all user inputs.
    
    Args:
        command: The speech command text to process
        
    Returns:
        str: JSON action response that will be executed by the frontend
    """
    import json
    
    # Simple command processing - can be enhanced later
    command_lower = command.lower()
    
    if "click" in command_lower and "button" in command_lower:
        # Extract button description from the command
        # Look for patterns like "click the welcome button", "click welcome", etc.
        import re
        
        # Try to extract button description from various patterns
        patterns = [
            r"click\s+(?:the\s+)?(.+?)\s+button",
            r"click\s+(?:the\s+)?(.+?)(?:\s+button)?$",
            r"press\s+(?:the\s+)?(.+?)\s+button",
            r"press\s+(?:the\s+)?(.+?)(?:\s+button)?$"
        ]
        
        button_description = None
        for pattern in patterns:
            match = re.search(pattern, command_lower)
            if match:
                button_description = match.group(1).strip()
                break
        
        # If no specific description found, try to extract any word after "click"
        if not button_description:
            words = command_lower.split()
            click_index = -1
            for i, word in enumerate(words):
                if word in ["click", "press"]:
                    click_index = i
                    break
            
            if click_index >= 0 and click_index + 1 < len(words):
                # Get the next word(s) as potential button description
                remaining_words = words[click_index + 1:]
                # Remove common words
                filtered_words = [w for w in remaining_words if w not in ["the", "button", "a", "an"]]
                if filtered_words:
                    button_description = " ".join(filtered_words)
        
        # Use the extracted description or fallback to a generic one
        if button_description:
            return json.dumps({"action": "click_button_by_description", "description": button_description})
        else:
            return json.dumps({"action": "click_button_by_description", "description": "button"})
    elif "search" in command_lower:
        # For search commands, we'll let the agent handle it with google_search
        return json.dumps({"action": "speak", "text": f"I'll search for: {command}"})
    else:
        # Return natural conversational response
        return json.dumps({"action": "speak", "text": "How can I help you interact with this webpage?"})


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
    You are a speech command processor that returns JSON actions. You MUST return ONLY valid JSON objects.
    
    CRITICAL RULES:
    - NEVER return conversational text like "OK. I clicked the button."
    - ALWAYS return pure JSON objects
    - Extract button names from user commands
    
    COMMAND PATTERNS:
    - "click [button_name]" -> {"action":"click_button_by_description","description":"button_name"}
    - "click any button" -> {"action":"speak","text":"Which button should I press?"}
    - Other commands -> {"action":"speak","text":"How can I help you interact with this webpage?"}
    
    EXAMPLES:
    User: "click welcome button" -> {"action":"click_button_by_description","description":"welcome"}
    User: "click the success button" -> {"action":"click_button_by_description","description":"success"}
    User: "press cancel" -> {"action":"click_button_by_description","description":"cancel"}
    User: "hello" -> {"action":"speak","text":"How can I help you interact with this webpage?"}
    
    RETURN ONLY THE JSON OBJECT, NO OTHER TEXT.
    """,
    tools=[scan_webpage_elements, press_test_button, click_button_by_description, process_speech_command],
)

# -----------------------------------------------------------------------------
# ADK agent to interpret natural-language form answers into structured actions
# -----------------------------------------------------------------------------
form_interpreter_agent = Agent(
    name="form_interpreter_agent",
    model="gemini-2.0-flash-exp",
    description="Interpret NL answers for form questions into strict JSON actions",
    instruction="""
    You convert a user's natural-language answer into a STRICT JSON action for form filling.
    Always return ONLY a single-line JSON string, no markdown or extra text.
    Supported actions by question type:
    - text, long_text -> {"action":"set_text","normalized_text":"...","confidence":0.0-1.0}
    - radio, dropdown -> {"action":"select","choices":["..."],"confidence":0.0-1.0}
    - checkbox -> {"action":"multi_select","choices":["...","..."],"confidence":0.0-1.0}
    If not confident (< 0.8) or multiple options match, return:
    {"action":"clarify","prompt":"...","confidence":0.0-1.0}
    Hard rules:
    - For radio, dropdown, checkbox you MUST return select/multi_select. Do NOT return set_text.
    - choices MUST exactly match one of the provided options for radio/checkbox/dropdown.
    - For text, normalize and correct obvious typos but preserve meaning.
    - For name-like answers (e.g., "what's your name?"), extract the person's name only, capitalized (e.g., "Abe").
    - For email prompts, return a valid email format if present.
    - For phone prompts, return digits with standard punctuation (e.g., +1 415-555-1234).
    - Never output anything but JSON.
    Examples:
    User: "probably b" Options: ["Option A","Option B","Option C"]
    -> {"action":"select","choices":["Option B"],"confidence":0.9}
    User: "red and blue" Options: ["Red","Green","Blue"]
    -> {"action":"multi_select","choices":["Red","Blue"],"confidence":0.92}
    User: "the one about refunds" Options: ["Shipping","Billing","Returns"] (ambiguous)
    -> {"action":"clarify","prompt":"Did you mean Returns?" ,"confidence":0.6}
    User: question="What's your name?" user_text="my name's abe"
    -> {"action":"set_text","normalized_text":"Abe","confidence":0.95}
    User: question="Your email" user_text="you can email me at jane.doe+news@example.com"
    -> {"action":"set_text","normalized_text":"jane.doe+news@example.com","confidence":0.93}
    """,
)
