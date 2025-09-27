# Accessibility Tools Extension + FastAPI Backend

## Setup Instructions

### 1. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the FastAPI server:
   ```bash
   python main.py
   ```

   The API will be available at `http://localhost:8000`

### 2. Chrome Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`

2. Enable "Developer mode" (toggle in the top right)

3. Click "Load unpacked" and select the `extension` folder

4. The extension should now appear in your extensions list

5. Click the extension icon in the toolbar to open the popup

6. Click the "Call API" button to test the connection

## Available Tools

1. **Text-to-Speech Reading**: Convert text to speech for audio reading assistance
2. **Speech-to-Instructions Navigation**: Convert speech to navigation instructions
3. **AI-Generated Alt Text for Images**: Generate descriptive alt text using AI
4. **Adaptive CSS Adjustments for Readability**: Adjust CSS based on user preferences
5. **Semantic Search and Content Discovery**: Find content using semantic search
6. **Simplified Rewording of Complex Text**: Simplify complex text for better readability

# Adding a New Tool/Tab

To add a new accessibility tool to the extension, follow these steps:

### Step 1: Create the HTML File
Create a new file: `extension/html/tools/your_tool_name.html`

```html
<!-- Your Tool HTML -->
<div id="your_tool_name-content" class="tab-content">
  <div class="tool-description">
    Description of what your tool does.
  </div>
  <div class="input-group">
    <label for="your_tool_name_field">Field Label:</label>
    <input type="text" id="your_tool_name_field" name="field_name" placeholder="Enter value...">
  </div>
  <button id="your_tool_name-button" class="button">Process</button>
  <div id="your_tool_name-result" class="result"></div>
</div>
```

### Step 2: Create the JavaScript File
Create a new file: `extension/js/tools/your_tool_name.js`

```javascript
// Your Tool JavaScript
class YourToolNameTool {
  constructor(toolManager) {
    this.toolManager = toolManager;
    this.toolId = 'your_tool_name';
    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    const button = document.getElementById(`${this.toolId}-button`);
    if (button) {
      button.addEventListener('click', () => this.process());
    }
  }

  async process() {
    const button = document.getElementById(`${this.toolId}-button`);
    const result = document.getElementById(`${this.toolId}-result`);
    
    if (!button || !result) {
      console.error(`Elements not found for tool: ${this.toolId}`);
      return;
    }

    button.disabled = true;
    result.textContent = 'Processing...';
    result.className = 'result loading';

    try {
      const formData = this.getFormData();
      
      const response = await fetch(`http://localhost:8000/tools/${this.toolId}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        result.textContent = data.message;
        result.className = 'result success';
      } else {
        result.textContent = `Error: ${data.message}`;
        result.className = 'result error';
      }

    } catch (error) {
      console.error(`Error processing ${this.toolId}:`, error);
      result.textContent = `Error: ${error.message}`;
      result.className = 'result error';
    } finally {
      button.disabled = false;
    }
  }

  getFormData() {
    const formData = {};
    const inputs = document.querySelectorAll(`#${this.toolId}-content input, #${this.toolId}-content textarea, #${this.toolId}-content select`);
    
    inputs.forEach(input => {
      if (input.type === 'checkbox') {
        formData[input.name] = input.checked;
      } else if (input.type === 'radio') {
        if (input.checked) {
          formData[input.name] = input.value;
        }
      } else {
        formData[input.name] = input.value;
      }
    });

    return formData;
  }
}
```

### Step 3: Create the Backend Python File
Create a new file: `backend/tools/your_tool_name.py`

```python
from .base_tool import BaseTool, ToolRequest, ToolResponse

class YourToolNameRequest(ToolRequest):
    field_name: str
    # Add other fields as needed

class YourToolNameTool(BaseTool):
    def __init__(self):
        super().__init__(
            name="Your Tool Name",
            description="Description of what your tool does"
        )
    
    async def process(self, request: YourToolNameRequest) -> ToolResponse:
        # Implement your tool logic here
        return ToolResponse(
            success=True,
            message="Your tool processed successfully",
            data={"field_name": request.field_name, "status": "ready_for_implementation"}
        )
```

### Step 4: Update Configuration Files

**Update `extension/build-html.js`:**
Add your tool ID to the `toolIds` array:
```javascript
const toolIds = [
  'text_to_speech',
  'speech_to_instructions', 
  'ai_alt_text',
  'adaptive_css',
  'semantic_search',
  'text_simplification',
  'your_tool_name'  // Add your tool here
];
```

**Update `backend/main.py`:**
1. Add import: `from tools.your_tool_name import YourToolNameTool, YourToolNameRequest`
2. Add to tools dictionary: `"your_tool_name": YourToolNameTool()`
3. Add to request handling: `elif tool_id == "your_tool_name": request = YourToolNameRequest(**request_data)`

**Update `extension/popup.html`:**
1. Add tab button: `<button class="tab" data-tool-id="your_tool_name">Your Tool</button>`
2. Add script: `<script src="js/tools/your_tool_name.js"></script>`

**Update `extension/js/shared.js`:**
Add to `toolClasses` in `initializeTools()`:
```javascript
const toolClasses = {
  // ... existing tools
  'your_tool_name': YourToolNameTool
};
```

### Step 5: Build and Test

```bash
# Navigate to extension directory
cd extension

# Build the extension (combines HTML files)
npm run build

# Reload the extension in Chrome
# Go to chrome://extensions/ and click the reload button
```

## Development Workflow

### Frontend Development
- Edit HTML files in `extension/html/tools/`
- Edit JavaScript files in `extension/js/tools/`
- Run `npm run build` to update the extension
- Reload extension in Chrome to test changes

### Backend Development
- Edit Python files in `backend/tools/`
- Restart the FastAPI server to test changes
- Use the `/tools` endpoint to see available tools