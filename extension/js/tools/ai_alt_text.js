// AI Alt Text tool specific functionality
class AIAltTextTool {
  constructor(toolManager) {
    this.toolManager = toolManager;
    this.toolId = 'ai_alt_text';
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

    // Disable button and show loading
    button.disabled = true;
    result.textContent = 'Generating AI alt text...';
    result.className = 'result loading';

    try {
      const formData = this.getFormData();
      
      // Validate image URL
      if (!formData.image_url) {
        throw new Error('Please provide an image URL');
      }
      
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
        
        // Additional AI alt text handling could go here
        this.handleAltTextResponse(data);
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

  handleAltTextResponse(data) {
    // Placeholder for AI alt text specific handling
    // This could include displaying the generated alt text, copying to clipboard, etc.
    console.log('AI Alt Text Response received:', data);
  }
}
