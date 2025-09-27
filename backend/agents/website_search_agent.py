import os
from google.adk.agents import Agent


def extract_website_content(html_content: str) -> str:
    """Extracts and processes website content for search.
    
    Args:
        html_content: The HTML content of the website
        
    Returns:
        str: Confirmation that content has been processed
    """
    # This function confirms that website content has been received and processed
    return f"Website content received and processed. Ready to answer questions about the webpage content."


def answer_question_from_website(question: str, website_content: str) -> str:
    """Answers a question based on the website content.
    
    Args:
        question: The user's question
        website_content: The extracted website content
        
    Returns:
        str: Answer based on the website content
    """
    # This will be processed by the LLM agent
    return f"Based on the website content provided earlier, here's the answer to your question: {question}"




# Set the API key for Google services
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise ValueError("GOOGLE_API_KEY environment variable is required. Please set it in your .env file.")

# Set the environment variable for Google GenAI
os.environ["GOOGLE_API_KEY"] = api_key

website_search_agent = Agent(
    # A unique name for the agent.
    name="website_search_agent",
    # The Large Language Model (LLM) that agent will use.
    model="gemini-2.0-flash-exp",
    # A short description of the agent's purpose.
    description="Agent to answer questions based on website content.",
    # Instructions to set the agent's behavior.
    instruction="""You are a helpful assistant that answers questions about webpage content.

    CONTEXT: You will receive website content at the start of our conversation. This content includes:
    - Page title and URL
    - Text content from the page (all visible text)

    INSTRUCTIONS:
    1. When you receive website content (starting with "Website content extracted:"), acknowledge it and confirm you're ready to help
    2. Use ONLY the provided text content to answer questions
    3. If asked about something not in the content, say "I cannot find that information in the webpage content"
    4. Be specific and helpful in your responses
    5. Analyze the text content to understand what the page is about

    IMPORTANT: Do not ask for content - use what was already provided to you.
    """,
    # Add tools for website content processing and question answering.
    tools=[extract_website_content, answer_question_from_website],
)
