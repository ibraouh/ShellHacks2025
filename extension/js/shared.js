// Shared JavaScript utilities for all tool tabs

class ToolManager {
  constructor() {
    this.currentTool = null;
    this.tools = {};
    this.toolInstances = {};
    this.loadedToolContent = {};
    this.init();
  }

  async init() {
    await this.loadTools();
    this.loadToolContent();
    this.setupTabs();
    this.initializeTools();
  }

  async loadTools() {
    try {
      const response = await fetch('http://localhost:8000/tools');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      this.tools = await response.json();
    } catch (error) {
      console.error('Error loading tools:', error);
      this.showError('Failed to load tools from server');
    }
  }

  loadToolContent() {
    // Use the generated HTML templates
    if (typeof window.HtmlTemplates !== 'undefined') {
      this.loadedToolContent = window.HtmlTemplates;
    } else {
      // Fallback if templates aren't loaded
      console.warn('HTML templates not loaded, using fallback');
      this.loadedToolContent = {
        'text_to_speech': '<div id="text_to_speech-content" class="tab-content"><div class="result error">HTML template not loaded</div></div>',
        'speech_to_instructions': '<div id="speech_to_instructions-content" class="tab-content"><div class="result error">HTML template not loaded</div></div>',
        'ai_alt_text': '<div id="ai_alt_text-content" class="tab-content"><div class="result error">HTML template not loaded</div></div>',
        'adaptive_css': '<div id="adaptive_css-content" class="tab-content"><div class="result error">HTML template not loaded</div></div>',
        'semantic_search': '<div id="semantic_search-content" class="tab-content"><div class="result error">HTML template not loaded</div></div>',
        'text_simplification': '<div id="text_simplification-content" class="tab-content"><div class="result error">HTML template not loaded</div></div>'
      };
    }
  }

  setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const container = document.getElementById('tool-content-container');

    // Clear the loading message
    container.innerHTML = '';

    // Load all tool content into the container
    Object.keys(this.loadedToolContent).forEach(toolId => {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = this.loadedToolContent[toolId];
      const toolContent = tempDiv.firstElementChild;
      if (toolContent) {
        container.appendChild(toolContent);
      }
    });

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const toolId = tab.dataset.toolId;
        this.switchToTool(toolId);
      });
    });

    // Set first tab as active by default
    if (tabs.length > 0) {
      this.switchToTool(tabs[0].dataset.toolId);
    }
  }

  switchToTool(toolId) {
    // Update tab appearance
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-tool-id="${toolId}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${toolId}-content`).classList.add('active');

    this.currentTool = toolId;
  }

  initializeTools() {
    // Initialize each tool instance
    const toolClasses = {
      'text_to_speech': TextToSpeechTool,
      'speech_to_instructions': SpeechToInstructionsTool,
      'ai_alt_text': AIAltTextTool,
      'adaptive_css': AdaptiveCSSTool,
      'semantic_search': SemanticSearchTool,
      'text_simplification': TextSimplificationTool
    };

    Object.keys(toolClasses).forEach(toolId => {
      if (typeof toolClasses[toolId] !== 'undefined') {
        this.toolInstances[toolId] = new toolClasses[toolId](this);
      } else {
        console.warn(`Tool class not found: ${toolId}`);
      }
    });
  }

  showError(message) {
    // Show error in a more prominent way
    const errorDiv = document.createElement('div');
    errorDiv.className = 'result error';
    errorDiv.textContent = message;
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '10px';
    errorDiv.style.left = '10px';
    errorDiv.style.right = '10px';
    errorDiv.style.zIndex = '1000';
    errorDiv.style.padding = '10px';
    errorDiv.style.borderRadius = '4px';
    errorDiv.style.backgroundColor = '#f8d7da';
    errorDiv.style.border = '1px solid #f5c6cb';
    errorDiv.style.color = '#721c24';
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 5000);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ToolManager();
});
