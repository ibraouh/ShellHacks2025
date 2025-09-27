// =============================================================================
// FLOATING ACCESSIBILITY TOOLS EXTENSION
// =============================================================================

class FloatingAccessibilityTools {
  constructor() {
    // ========================================================================
    // STATE MANAGEMENT
    // ========================================================================
    this.isExpanded = false;        // Whether the main panel is expanded
    this.currentTool = null;        // Currently active tool ID
    
    // ========================================================================
    // TOOL CONFIGURATION
    // ========================================================================
    // Add new tools here - each tool needs: id, name, icon
    // The id must match the tool class name in getInlineTool() method
    this.tools = [
      { id: 'text_to_speech', name: 'Text-to-Speech', icon: '🔊' },
      { id: 'speech_to_instructions', name: 'Speech Commands', icon: '🎤' },
      { id: 'ai_alt_text', name: 'AI Alt Text', icon: '🖼️' },
      { id: 'adaptive_css', name: 'CSS Adjust', icon: '🎨' },
      { id: 'semantic_search', name: 'Search', icon: '🔍' },
      { id: 'text_simplification', name: 'Simplify Text', icon: '📝' }
    ];
    
    this.init();
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================
  init() {
    this.createFloatingUI();      // Create the floating UI elements
    this.setupMessageListener();  // Listen for messages from background script
    this.setupTextSelection();    // Setup text selection highlighting
  }

  // ==========================================================================
  // UI CREATION METHODS
  // ==========================================================================
  
  createFloatingUI() {
    // ========================================================================
    // SHADOW DOM SETUP
    // ========================================================================
    // Create shadow DOM to avoid CSS conflicts with the host page
    this.shadowHost = document.createElement('div');
    this.shadowHost.id = 'accessibility-tools-floating';
    this.shadowHost.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Create shadow root for isolated styling
    this.shadowRoot = this.shadowHost.attachShadow({ mode: 'open' });
    
    // ========================================================================
    // UI COMPONENT CREATION
    // ========================================================================
    this.addStyles();           // Load external CSS
    this.createMainButton();    // Create the main toggle button
    this.createExpandedPanel(); // Create the tools panel
    
    // Add the complete UI to the page
    document.body.appendChild(this.shadowHost);
  }

  addStyles() {
    // ========================================================================
    // CSS LOADING
    // ========================================================================
    // Load external CSS file for consistent styling
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('css/floating-ui.css');
    this.shadowRoot.appendChild(link);
  }

  createMainButton() {
    // ========================================================================
    // MAIN TOGGLE BUTTON
    // ========================================================================
    // Creates the floating accessibility icon button
    this.mainButton = document.createElement('button');
    this.mainButton.className = 'main-button';
    this.mainButton.innerHTML = 'A11y';  // Accessibility abbreviation
    this.mainButton.addEventListener('click', () => this.togglePanel());
    this.shadowRoot.appendChild(this.mainButton);
  }

  createExpandedPanel() {
    // ========================================================================
    // EXPANDED PANEL CREATION
    // ========================================================================
    // Creates the main tools panel that appears when the button is clicked
    this.expandedPanel = document.createElement('div');
    this.expandedPanel.className = 'expanded-panel';

    // ========================================================================
    // PANEL HEADER
    // ========================================================================
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = `
      <div class="panel-title">A11y Tools</div>
      <div class="panel-controls">
        <span class="quit-text" title="Close">quit</span>
      </div>
    `;

    // ========================================================================
    // TOOLS GRID
    // ========================================================================
    // Creates the grid of tool buttons based on this.tools configuration
    const toolsGrid = document.createElement('div');
    toolsGrid.className = 'tools-grid';
    
    this.tools.forEach(tool => {
      const toolItem = document.createElement('button');
      toolItem.className = 'tool-item';
      toolItem.innerHTML = `
        <div class="tool-icon">${tool.icon}</div>
        <div class="tool-name">${tool.name}</div>
      `;
      toolItem.addEventListener('click', () => this.openTool(tool.id));
      toolsGrid.appendChild(toolItem);
    });

    // ========================================================================
    // ASSEMBLE PANEL
    // ========================================================================
    this.expandedPanel.appendChild(header);
    this.expandedPanel.appendChild(toolsGrid);

    // Add control button event listeners
    header.querySelector('.quit-text').addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent header click from triggering
      this.closePanel();
    });
    
    // Add header click listener for minimize functionality
    header.addEventListener('click', () => this.minimizePanel());

    this.shadowRoot.appendChild(this.expandedPanel);
  }

  // ==========================================================================
  // PANEL STATE MANAGEMENT
  // ==========================================================================
  
  togglePanel() {
    // Toggle between expanded and minimized states
    if (this.isExpanded) {
      this.minimizePanel();
    } else {
      this.expandPanel();
    }
  }

  expandPanel() {
    // Show the tools panel
    this.isExpanded = true;
    this.expandedPanel.classList.add('visible');
    this.mainButton.style.transform = 'scale(1.1)';
  }

  minimizePanel() {
    // Hide the tools panel and close any open tool
    this.isExpanded = false;
    this.expandedPanel.classList.remove('visible');
    this.mainButton.style.transform = 'scale(1)';
    
    // Close any open tool panel when minimizing
    if (this.currentTool) {
      this.closeTool();
    }
  }

  closePanel() {
    // Completely remove the floating UI from the page
    this.shadowHost.remove();
  }

  // ==========================================================================
  // TOOL MANAGEMENT
  // ==========================================================================
  
  async openTool(toolId) {
    // ========================================================================
    // TOOL VALIDATION
    // ========================================================================
    const tool = this.tools.find(t => t.id === toolId);
    if (!tool) return;

    this.currentTool = toolId;

    // ========================================================================
    // TOOL PANEL CREATION
    // ========================================================================
    // Create tool panel if it doesn't exist (reuse existing panel)
    let toolPanel = this.shadowRoot.querySelector('.tool-panel');
    if (!toolPanel) {
      toolPanel = document.createElement('div');
      toolPanel.className = 'tool-panel';
      this.expandedPanel.appendChild(toolPanel);
    }

    // ========================================================================
    // TOOL INSTANCE LOADING
    // ========================================================================
    // Load the specific tool using inline tool classes for reliability
    const toolInstance = this.getInlineTool(toolId);
    
    // ========================================================================
    // TOOL UI RENDERING
    // ========================================================================
    toolPanel.innerHTML = `
      <div class="tool-panel-header">
        <button class="back-btn">←</button>
        <div class="tool-panel-title">${tool.name}</div>
      </div>
      ${toolInstance.getContent()}
    `;

    // ========================================================================
    // EVENT LISTENER SETUP
    // ========================================================================
    // Add back button functionality
    toolPanel.querySelector('.back-btn').addEventListener('click', () => this.closeTool());
    
    // Setup tool-specific event listeners (handled by each tool class)
    toolInstance.setupEventListeners(toolPanel);
    
    // Hide the tools grid and show the tool panel
    const toolsGrid = this.shadowRoot.querySelector('.tools-grid');
    if (toolsGrid) {
      toolsGrid.style.visibility = 'hidden';
      toolsGrid.style.opacity = '0';
    }
    toolPanel.classList.add('visible');
  }


  // ==========================================================================
  // INLINE TOOL CLASSES
  // ==========================================================================
  // All tool implementations are defined inline for reliability and immediate availability
  // Each tool class must implement: constructor(), getContent(), setupEventListeners()
  // ==========================================================================
  
  getInlineTool(toolId) {
    const toolClasses = {
      // ========================================================================
      // TEXT-TO-SPEECH TOOL
      // ========================================================================
      'text_to_speech': class TextToSpeechTool {
        constructor() {
          this.toolId = 'text_to_speech';
          this.name = 'Text-to-Speech';
          this.icon = '🔊';
        }
        
        getContent() {
          return `
            <div class="tool-content">
              <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">${this.icon}</div>
                <div style="font-size: 16px; margin-bottom: 20px;">${this.name}</div>
                <button class="button" id="test-api-btn">Test API Connection</button>
                <div id="api-result" class="result" style="margin-top: 20px;"></div>
              </div>
            </div>
          `;
        }
        
        setupEventListeners(container) {
          const testBtn = container.querySelector('#test-api-btn');
          const resultDiv = container.querySelector('#api-result');
          testBtn.addEventListener('click', async () => {
            await this.testAPI(resultDiv, testBtn);
          });
        }
        
        async testAPI(resultDiv, button) {
          button.disabled = true;
          resultDiv.textContent = 'Testing API connection...';
          resultDiv.className = 'result loading';
          try {
            const response = await fetch('http://localhost:8000/tools/text_to_speech/process', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: 'Hello, this is a test message.' })
            });
            const data = await response.json();
            resultDiv.textContent = `API Response: ${JSON.stringify(data, null, 2)}`;
            resultDiv.className = 'result success';
          } catch (error) {
            resultDiv.textContent = `Error: ${error.message}`;
            resultDiv.className = 'result error';
          } finally {
            button.disabled = false;
          }
        }
      },
      // ========================================================================
      // SPEECH-TO-INSTRUCTIONS TOOL
      // ========================================================================
      'speech_to_instructions': class SpeechToInstructionsTool {
        constructor() {
          this.toolId = 'speech_to_instructions';
          this.name = 'Speech Commands';
          this.icon = '🎤';
        }
        
        getContent() {
          return `
            <div class="tool-content">
              <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">${this.icon}</div>
                <div style="font-size: 16px; margin-bottom: 20px;">${this.name}</div>
                <button class="button" id="test-api-btn">Test API Connection</button>
                <div id="api-result" class="result" style="margin-top: 20px;"></div>
              </div>
            </div>
          `;
        }
        
        setupEventListeners(container) {
          const testBtn = container.querySelector('#test-api-btn');
          const resultDiv = container.querySelector('#api-result');
          testBtn.addEventListener('click', async () => {
            await this.testAPI(resultDiv, testBtn);
          });
        }
        
        async testAPI(resultDiv, button) {
          button.disabled = true;
          resultDiv.textContent = 'Testing API connection...';
          resultDiv.className = 'result loading';
          try {
            const response = await fetch('http://localhost:8000/tools/speech_to_instructions/process', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio_data: 'test_audio_data' })
            });
            const data = await response.json();
            resultDiv.textContent = `API Response: ${JSON.stringify(data, null, 2)}`;
            resultDiv.className = 'result success';
          } catch (error) {
            resultDiv.textContent = `Error: ${error.message}`;
            resultDiv.className = 'result error';
          } finally {
            button.disabled = false;
          }
        }
      },
      // ========================================================================
      // AI ALT TEXT TOOL
      // ========================================================================
      'ai_alt_text': class AIAltTextTool {
        constructor() {
          this.toolId = 'ai_alt_text';
          this.name = 'AI Alt Text';
          this.icon = '🖼️';
        }
        
        getContent() {
          return `
            <div class="tool-content">
              <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">${this.icon}</div>
                <div style="font-size: 16px; margin-bottom: 20px;">${this.name}</div>
                <button class="button" id="test-api-btn">Test API Connection</button>
                <div id="api-result" class="result" style="margin-top: 20px;"></div>
              </div>
            </div>
          `;
        }
        
        setupEventListeners(container) {
          const testBtn = container.querySelector('#test-api-btn');
          const resultDiv = container.querySelector('#api-result');
          testBtn.addEventListener('click', async () => {
            await this.testAPI(resultDiv, testBtn);
          });
        }
        
        async testAPI(resultDiv, button) {
          button.disabled = true;
          resultDiv.textContent = 'Testing API connection...';
          resultDiv.className = 'result loading';
          try {
            const response = await fetch('http://localhost:8000/tools/ai_alt_text/process', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image_url: 'https://example.com/test.jpg', context: 'test image' })
            });
            const data = await response.json();
            resultDiv.textContent = `API Response: ${JSON.stringify(data, null, 2)}`;
            resultDiv.className = 'result success';
          } catch (error) {
            resultDiv.textContent = `Error: ${error.message}`;
            resultDiv.className = 'result error';
          } finally {
            button.disabled = false;
          }
        }
      },
      // ========================================================================
      // ADAPTIVE CSS TOOL
      // ========================================================================
      'adaptive_css': class AdaptiveCSSTool {
        constructor() {
          this.toolId = 'adaptive_css';
          this.name = 'CSS Adjust';
          this.icon = '🎨';
        }
        
        getContent() {
          return `
            <div class="tool-content">
              <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">${this.icon}</div>
                <div style="font-size: 16px; margin-bottom: 20px;">${this.name}</div>
                <button class="button" id="test-api-btn">Test API Connection</button>
                <div id="api-result" class="result" style="margin-top: 20px;"></div>
              </div>
            </div>
          `;
        }
        
        setupEventListeners(container) {
          const testBtn = container.querySelector('#test-api-btn');
          const resultDiv = container.querySelector('#api-result');
          testBtn.addEventListener('click', async () => {
            await this.testAPI(resultDiv, testBtn);
          });
        }
        
        async testAPI(resultDiv, button) {
          button.disabled = true;
          resultDiv.textContent = 'Testing API connection...';
          resultDiv.className = 'result loading';
          try {
            const response = await fetch('http://localhost:8000/tools/adaptive_css/process', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ css_rules: 'high_contrast', user_preferences: '{"font_size":"large"}' })
            });
            const data = await response.json();
            resultDiv.textContent = `API Response: ${JSON.stringify(data, null, 2)}`;
            resultDiv.className = 'result success';
          } catch (error) {
            resultDiv.textContent = `Error: ${error.message}`;
            resultDiv.className = 'result error';
          } finally {
            button.disabled = false;
          }
        }
      },
      // ========================================================================
      // SEMANTIC SEARCH TOOL
      // ========================================================================
      'semantic_search': class SemanticSearchTool {
        constructor() {
          this.toolId = 'semantic_search';
          this.name = 'Search';
          this.icon = '🔍';
        }
        
        getContent() {
          return `
            <div class="tool-content">
              <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">${this.icon}</div>
                <div style="font-size: 16px; margin-bottom: 20px;">${this.name}</div>
                <button class="button" id="test-api-btn">Test API Connection</button>
                <div id="api-result" class="result" style="margin-top: 20px;"></div>
              </div>
            </div>
          `;
        }
        
        setupEventListeners(container) {
          const testBtn = container.querySelector('#test-api-btn');
          const resultDiv = container.querySelector('#api-result');
          testBtn.addEventListener('click', async () => {
            await this.testAPI(resultDiv, testBtn);
          });
        }
        
        async testAPI(resultDiv, button) {
          button.disabled = true;
          resultDiv.textContent = 'Testing API connection...';
          resultDiv.className = 'result loading';
          try {
            const response = await fetch('http://localhost:8000/tools/semantic_search/process', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: 'test search' })
            });
            const data = await response.json();
            resultDiv.textContent = `API Response: ${JSON.stringify(data, null, 2)}`;
            resultDiv.className = 'result success';
          } catch (error) {
            resultDiv.textContent = `Error: ${error.message}`;
            resultDiv.className = 'result error';
          } finally {
            button.disabled = false;
          }
        }
      },
      // ========================================================================
      // TEXT SIMPLIFICATION TOOL
      // ========================================================================
      'text_simplification': class TextSimplificationTool {
        constructor() {
          this.toolId = 'text_simplification';
          this.name = 'Simplify Text';
          this.icon = '📝';
        }
        
        getContent() {
          return `
            <div class="tool-content">
              <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">${this.icon}</div>
                <div style="font-size: 16px; margin-bottom: 20px;">${this.name}</div>
                <button class="button" id="test-api-btn">Test API Connection</button>
                <div id="api-result" class="result" style="margin-top: 20px;"></div>
              </div>
            </div>
          `;
        }
        
        setupEventListeners(container) {
          const testBtn = container.querySelector('#test-api-btn');
          const resultDiv = container.querySelector('#api-result');
          testBtn.addEventListener('click', async () => {
            await this.testAPI(resultDiv, testBtn);
          });
        }
        
        async testAPI(resultDiv, button) {
          button.disabled = true;
          resultDiv.textContent = 'Testing API connection...';
          resultDiv.className = 'result loading';
          try {
            const response = await fetch('http://localhost:8000/tools/text_simplification/process', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: 'This is a test text to simplify.' })
            });
            const data = await response.json();
            resultDiv.textContent = `API Response: ${JSON.stringify(data, null, 2)}`;
            resultDiv.className = 'result success';
          } catch (error) {
            resultDiv.textContent = `Error: ${error.message}`;
            resultDiv.className = 'result error';
          } finally {
            button.disabled = false;
          }
        }
      }
    };

    return new toolClasses[toolId]();
  }

  // ==========================================================================
  // TOOL PANEL MANAGEMENT
  // ==========================================================================
  
  closeTool() {
    // Hide the current tool panel and reset state
    const toolPanel = this.shadowRoot.querySelector('.tool-panel');
    if (toolPanel) {
      toolPanel.classList.remove('visible');
    }
    
    // Show the tools grid again
    const toolsGrid = this.shadowRoot.querySelector('.tools-grid');
    if (toolsGrid) {
      toolsGrid.style.visibility = 'visible';
      toolsGrid.style.opacity = '1';
    }
    
    this.currentTool = null;
  }

  // ==========================================================================
  // MESSAGE HANDLING
  // ==========================================================================
  
  setupMessageListener() {
    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'toggleFloatingUI') {
        this.togglePanel();
        sendResponse({ success: true });
      }
    });
  }

  // ==========================================================================
  // TEXT SELECTION FEATURES
  // ==========================================================================
  
  setupTextSelection() {
    // Add text selection highlighting functionality for better accessibility
    document.addEventListener('mouseup', (event) => {
      const selection = window.getSelection();
      if (selection.toString().trim().length > 0) {
        this.highlightSelectedText(selection);
      }
    });
  }

  highlightSelectedText(selection) {
    // ========================================================================
    // TEXT HIGHLIGHTING LOGIC
    // ========================================================================
    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    
    if (selectedText.length > 0) {
      // Create a temporary highlight element
      const span = document.createElement('span');
      span.className = 'highlight';
      span.style.cssText = `
        background: rgba(255, 235, 59, 0.3);
        padding: 2px 4px;
        border-radius: 3px;
        transition: all 0.2s;
      `;
      
      try {
        range.surroundContents(span);
        
        // Remove highlight after 3 seconds
        setTimeout(() => {
          if (span.parentNode) {
            span.parentNode.replaceChild(document.createTextNode(span.textContent), span);
          }
        }, 3000);
      } catch (e) {
        // If surroundContents fails, just log it (can happen with complex selections)
        console.log('Could not highlight selected text:', e);
      }
    }
  }
}

// =============================================================================
// EXTENSION INITIALIZATION
// =============================================================================
// Initialize the floating accessibility tools when the content script loads
const floatingTools = new FloatingAccessibilityTools();
