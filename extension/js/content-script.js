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
    
    // Pass shadow root reference to the tool instance
    toolInstance.shadowRoot = this.shadowRoot;
    
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
          this.selectedImage = null;
          this.isSelectingMode = false;
          this.originalCursor = null;
        }
        
        getContent() {
          return `
            <div class="tool-content">
              <div style="padding: 20px;">
                <div style="margin-bottom: 5px;">
                  <button class="button" id="select-photo-btn" style="width: 100%; margin-bottom: 10px; margin-top: 0px;">
                    ${this.isSelectingMode ? 'Click to Stop Selecting' : 'Select Photo on Page'}
                  </button>
                  <div style="font-size: 12px; color: #666; text-align: center;">
                    ${this.isSelectingMode ? 'Click on any photo to select it' : 'Click the button above to start selecting photos'}
                  </div>
                </div>
                
                <div id="selected-photo-info" style="display: none; margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
                  <div style="font-weight: bold; margin-bottom: 10px;">Selected Photo:</div>
                  <div id="photo-preview" style="margin-bottom: 10px;"></div>
                  <div id="photo-url" style="font-size: 12px; color: #666; word-break: break-all;"></div>
                </div>
                
                <div style="margin-bottom: 20px;">
                  <button class="button" id="generate-alt-text-btn" disabled style="width: 100%; margin-bottom: 10px;">
                    Generate Alt Text
                  </button>
                  <div style="font-size: 12px; color: #666; text-align: center;">
                    Generate AI alt text for the selected photo
                  </div>
                </div>
                
                <div id="api-result" class="result" style="margin-top: 20px;"></div>
              </div>
            </div>
          `;
        }
        
        setupEventListeners(container) {
          const selectBtn = container.querySelector('#select-photo-btn');
          const generateBtn = container.querySelector('#generate-alt-text-btn');
          const resultDiv = container.querySelector('#api-result');
          
          selectBtn.addEventListener('click', () => {
            this.toggleSelectionMode(container);
          });
          
          generateBtn.addEventListener('click', async () => {
            await this.generateAltText(resultDiv, generateBtn);
          });
          
          // Add global event listeners for photo selection
          this.addPhotoSelectionListeners();
        }
        
        toggleSelectionMode(container) {
          this.isSelectingMode = !this.isSelectingMode;
          const selectBtn = container.querySelector('#select-photo-btn');
          const instructionText = container.querySelector('#select-photo-btn').nextElementSibling;
          
          if (this.isSelectingMode) {
            selectBtn.textContent = 'Click to Stop Selecting';
            instructionText.textContent = 'Click on any photo to select it';
            this.enablePhotoSelection();
          } else {
            selectBtn.textContent = 'Select Photo on Page';
            instructionText.textContent = 'Click the button above to start selecting photos';
            this.disablePhotoSelection();
          }
        }
        
        enablePhotoSelection() {
          // Store original cursor
          this.originalCursor = document.body.style.cursor;
          
          // Add hover effects to all images
          const images = document.querySelectorAll('img');
          images.forEach(img => {
            img.style.cursor = 'pointer';
            img.style.outline = 'none';
            img.style.transition = 'outline 0.2s ease';
            
            // Add hover effect
            img.addEventListener('mouseenter', this.handleImageHover);
            img.addEventListener('mouseleave', this.handleImageLeave);
            img.addEventListener('click', this.handleImageClick);
          });
          
          // Change cursor for the entire page
          document.body.style.cursor = 'crosshair';
        }
        
        disablePhotoSelection() {
          // Restore original cursor
          document.body.style.cursor = this.originalCursor;
          
          // Remove hover effects from all images
          const images = document.querySelectorAll('img');
          images.forEach(img => {
            img.style.cursor = '';
            img.style.outline = '';
            img.style.transition = '';
            
            // Remove event listeners
            img.removeEventListener('mouseenter', this.handleImageHover);
            img.removeEventListener('mouseleave', this.handleImageLeave);
            img.removeEventListener('click', this.handleImageClick);
          });
        }
        
        handleImageHover = (event) => {
          if (this.isSelectingMode) {
            event.target.style.outline = '3px solid #007bff';
            event.target.style.outlineOffset = '2px';
          }
        }
        
        handleImageLeave = (event) => {
          if (this.isSelectingMode) {
            event.target.style.outline = '';
            event.target.style.outlineOffset = '';
          }
        }
        
        handleImageClick = (event) => {
          if (this.isSelectingMode) {
            event.preventDefault();
            event.stopPropagation();
            
            this.selectImage(event.target);
            this.isSelectingMode = false;
            this.disablePhotoSelection();
            
            // Update UI using the shadow root reference
            if (this.shadowRoot) {
              const container = this.shadowRoot.querySelector('.tool-panel');
              if (container) {
                this.updateSelectionUI(container);
              }
            }
          }
        }
        
        selectImage(imgElement) {
          // Get the image source URL
          let imageUrl = imgElement.src;
          
          // If it's a data URL or relative URL, try to get the full URL
          if (imageUrl.startsWith('data:') || imageUrl.startsWith('/')) {
            imageUrl = imgElement.src;
          } else if (imageUrl.startsWith('//')) {
            imageUrl = window.location.protocol + imageUrl;
          }
          
          this.selectedImage = {
            element: imgElement,
            url: imageUrl,
            alt: imgElement.alt || '',
            title: imgElement.title || ''
          };
          
          console.log('Image selected:', this.selectedImage);
        }
        
        updateSelectionUI(container) {
          console.log('Updating selection UI, container:', container);
          console.log('Selected image:', this.selectedImage);
          
          const selectBtn = container.querySelector('#select-photo-btn');
          const instructionText = selectBtn.nextElementSibling;
          const photoInfo = container.querySelector('#selected-photo-info');
          const photoPreview = container.querySelector('#photo-preview');
          const photoUrl = container.querySelector('#photo-url');
          const generateBtn = container.querySelector('#generate-alt-text-btn');
          
          console.log('Found elements:', { selectBtn, instructionText, photoInfo, photoPreview, photoUrl, generateBtn });
          
          selectBtn.textContent = 'Select Different Photo';
          instructionText.textContent = 'Click to select a different photo';
          
          if (this.selectedImage) {
            console.log('Updating UI with selected image');
            photoInfo.style.display = 'block';
            
            // Create a small preview of the selected image
            const previewImg = document.createElement('img');
            previewImg.src = this.selectedImage.url;
            previewImg.style.maxWidth = '100px';
            previewImg.style.maxHeight = '100px';
            previewImg.style.borderRadius = '4px';
            previewImg.style.objectFit = 'cover';
            
            photoPreview.innerHTML = '';
            photoPreview.appendChild(previewImg);
            
            photoUrl.textContent = this.selectedImage.url;
            generateBtn.disabled = false;
          } else {
            console.log('No selected image to display');
          }
        }
        
        addPhotoSelectionListeners() {
          // This method is called when the tool is initialized
          // The actual listeners are added/removed in enablePhotoSelection/disablePhotoSelection
        }
        
        async generateAltText(resultDiv, button) {
          if (!this.selectedImage) {
            resultDiv.textContent = 'Please select a photo first';
            resultDiv.className = 'result error';
            return;
          }
          
          button.disabled = true;
          resultDiv.textContent = 'Generating alt text...';
          resultDiv.className = 'result loading';
          
          try {
            const response = await fetch('http://localhost:8000/tools/ai_alt_text/process', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                image_url: this.selectedImage.url, 
                context: `Image alt: "${this.selectedImage.alt}", title: "${this.selectedImage.title}"`
              })
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
          this.selectedText = null;
          this.isSelectingMode = false;
          this.originalCursor = null;
          this.simplificationType = 'general';
          this.readingLevel = 'adult_basic';
        }
        
        getContent() {
          return `
            <div class="tool-content">
              <div style="padding: 20px;">
                <div style="margin-bottom: 20px;">
                  <button class="button" id="select-text-btn" style="width: 100%; margin-bottom: 10px;">
                    ${this.isSelectingMode ? 'Click to Stop Selecting' : 'Select Text to Simplify'}
                  </button>
                  <div style="font-size: 12px; color: #666; text-align: center;">
                    ${this.isSelectingMode ? 'Click on any paragraph to select it' : 'Click the button above to start selecting text'}
                  </div>
                </div>
                
                <div style="margin-bottom: 20px;">
                  <label style="display: block; margin-bottom: 8px; font-weight: bold;">Simplification Type:</label>
                  <select id="simplification-type" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 10px;">
                    <option value="general">General Simplification</option>
                    <option value="accessibility">Accessibility Focused</option>
                    <option value="dyslexia">Dyslexia Friendly</option>
                    <option value="screen_reader">Screen Reader Optimized</option>
                  </select>
                </div>
                
                <div style="margin-bottom: 20px;">
                  <label style="display: block; margin-bottom: 8px; font-weight: bold;">Reading Level:</label>
                  <select id="reading-level" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 10px;">
                    <option value="elementary">Elementary (Grades 1-5)</option>
                    <option value="middle_school">Middle School (Grades 6-8)</option>
                    <option value="high_school">High School (Grades 9-12)</option>
                    <option value="adult_basic" selected>Adult Basic</option>
                  </select>
                </div>
                
                <div id="selected-text-info" style="display: none; margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
                  <div style="font-weight: bold; margin-bottom: 10px;">Selected Text:</div>
                  <div id="text-preview" style="font-size: 12px; color: #666; max-height: 100px; overflow-y: auto; border: 1px solid #ddd; padding: 8px; background: white; border-radius: 4px;"></div>
                </div>
                
                <div style="margin-bottom: 20px;">
                  <button class="button" id="simplify-text-btn" disabled style="width: 100%; margin-bottom: 10px;">
                    Simplify Selected Text
                  </button>
                  <div style="font-size: 12px; color: #666; text-align: center;">
                    Simplify the selected text using AI
                  </div>
                </div>
                
                <div id="api-result" class="result" style="margin-top: 20px;"></div>
              </div>
            </div>
          `;
        }
        
        setupEventListeners(container) {
          const selectBtn = container.querySelector('#select-text-btn');
          const simplifyBtn = container.querySelector('#simplify-text-btn');
          const resultDiv = container.querySelector('#api-result');
          const simplificationTypeSelect = container.querySelector('#simplification-type');
          const readingLevelSelect = container.querySelector('#reading-level');
          
          selectBtn.addEventListener('click', () => {
            this.toggleSelectionMode(container);
          });
          
          simplifyBtn.addEventListener('click', async () => {
            await this.simplifyText(resultDiv, simplifyBtn);
          });
          
          simplificationTypeSelect.addEventListener('change', (e) => {
            this.simplificationType = e.target.value;
          });
          
          readingLevelSelect.addEventListener('change', (e) => {
            this.readingLevel = e.target.value;
          });
          
          // Add global event listeners for text selection
          this.addTextSelectionListeners();
        }
        
        toggleSelectionMode(container) {
          this.isSelectingMode = !this.isSelectingMode;
          const selectBtn = container.querySelector('#select-text-btn');
          const instructionText = container.querySelector('#select-text-btn').nextElementSibling;
          
          if (this.isSelectingMode) {
            selectBtn.textContent = 'Click to Stop Selecting';
            instructionText.textContent = 'Click on any paragraph to select it';
            this.enableTextSelection();
          } else {
            selectBtn.textContent = 'Select Text to Simplify';
            instructionText.textContent = 'Click the button above to start selecting text';
            this.disableTextSelection();
            // Clear any existing selection when stopping selection mode
            this.clearAllTextHighlighting();
            this.selectedText = null;
            this.updateSelectionUI(container);
          }
        }
        
        enableTextSelection() {
          // Store original cursor
          this.originalCursor = document.body.style.cursor;
          
          // Remove any existing selection highlighting first
          this.clearAllTextHighlighting();
          
          // Add hover effects to all paragraphs and text elements
          const textElements = document.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6, li, td, th, article, section');
          textElements.forEach(element => {
            // Only select elements that contain substantial text
            if (element.textContent.trim().length > 20) {
              element.style.cursor = 'pointer';
              element.style.outline = 'none';
              element.style.transition = 'outline 0.2s ease';
              element.style.backgroundColor = '';
              
              // Add hover effect
              element.addEventListener('mouseenter', this.handleTextHover);
              element.addEventListener('mouseleave', this.handleTextLeave);
              element.addEventListener('click', this.handleTextClick);
            }
          });
          
          // Change cursor for the entire page
          document.body.style.cursor = 'crosshair';
        }
        
        disableTextSelection() {
          // Restore original cursor
          document.body.style.cursor = this.originalCursor;
          
          // Remove hover effects from all text elements
          const textElements = document.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6, li, td, th, article, section');
          textElements.forEach(element => {
            element.style.cursor = '';
            element.style.outline = '';
            element.style.transition = '';
            
            // Remove event listeners
            element.removeEventListener('mouseenter', this.handleTextHover);
            element.removeEventListener('mouseleave', this.handleTextLeave);
            element.removeEventListener('click', this.handleTextClick);
          });
        }
        
        clearAllTextHighlighting() {
          // Remove all highlighting from text elements
          const textElements = document.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6, li, td, th, article, section');
          textElements.forEach(element => {
            element.style.outline = '';
            element.style.outlineOffset = '';
            element.style.backgroundColor = '';
            element.style.borderLeft = '';
            element.style.paddingLeft = '';
          });
        }
        
        clearAllHoverHighlighting() {
          // Remove only hover highlighting (not selection highlighting)
          const textElements = document.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6, li, td, th, article, section');
          textElements.forEach(element => {
            // Only clear if it's not the selected text
            if (!this.selectedText || element !== this.selectedText.element) {
              element.style.outline = '';
              element.style.outlineOffset = '';
              element.style.backgroundColor = '';
            }
          });
        }
        
        findSelectableElement(element) {
          // Walk up the DOM tree to find the most specific selectable element
          let current = element;
          const selectableTags = ['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th', 'article', 'section'];
          
          while (current && current !== document.body) {
            if (selectableTags.includes(current.tagName.toLowerCase())) {
              // Check if this element has substantial text content
              const textContent = current.textContent.trim();
              if (textContent.length > 20) {
                return current;
              }
            }
            current = current.parentElement;
          }
          
          return null;
        }
        
        handleTextHover = (event) => {
          if (this.isSelectingMode) {
            // Clear all existing hover highlights first
            this.clearAllHoverHighlighting();
            
            // Find the most specific selectable element
            const selectableElement = this.findSelectableElement(event.target);
            if (selectableElement) {
              selectableElement.style.outline = '2px solid #28a745';
              selectableElement.style.outlineOffset = '2px';
              selectableElement.style.backgroundColor = 'rgba(40, 167, 69, 0.1)';
            }
          }
        }
        
        handleTextLeave = (event) => {
          if (this.isSelectingMode) {
            // Clear all hover highlighting when leaving any element
            this.clearAllHoverHighlighting();
          }
        }
        
        handleTextClick = (event) => {
          if (this.isSelectingMode) {
            event.preventDefault();
            event.stopPropagation();
            
            // Find the most specific selectable element
            const selectableElement = this.findSelectableElement(event.target);
            if (selectableElement) {
              this.selectText(selectableElement);
              this.isSelectingMode = false;
              this.disableTextSelection();
              
              // Update UI using the shadow root reference
              if (this.shadowRoot) {
                const container = this.shadowRoot.querySelector('.tool-panel');
                if (container) {
                  this.updateSelectionUI(container);
                }
              }
            }
          }
        }
        
        selectText(textElement) {
          const text = textElement.textContent.trim();
          
          // Clear all existing highlighting first
          this.clearAllTextHighlighting();
          
          this.selectedText = {
            element: textElement,
            text: text,
            originalHTML: textElement.innerHTML,
            tagName: textElement.tagName.toLowerCase()
          };
          
          // Highlight only the selected text
          textElement.style.outline = '2px solid #28a745';
          textElement.style.outlineOffset = '2px';
          textElement.style.backgroundColor = 'rgba(40, 167, 69, 0.1)';
          
          console.log('Text selected:', this.selectedText);
        }
        
        updateSelectionUI(container) {
          console.log('Updating text selection UI, container:', container);
          console.log('Selected text:', this.selectedText);
          
          const selectBtn = container.querySelector('#select-text-btn');
          const instructionText = selectBtn.nextElementSibling;
          const textInfo = container.querySelector('#selected-text-info');
          const textPreview = container.querySelector('#text-preview');
          const simplifyBtn = container.querySelector('#simplify-text-btn');
          
          console.log('Found elements:', { selectBtn, instructionText, textInfo, textPreview, simplifyBtn });
          
          selectBtn.textContent = 'Select Different Text';
          instructionText.textContent = 'Click to select different text';
          
          if (this.selectedText) {
            console.log('Updating UI with selected text');
            textInfo.style.display = 'block';
            
            // Show preview of selected text (truncated if too long)
            const previewText = this.selectedText.text.length > 200 
              ? this.selectedText.text.substring(0, 200) + '...'
              : this.selectedText.text;
            
            textPreview.textContent = previewText;
            simplifyBtn.disabled = false;
          } else {
            console.log('No selected text to display');
          }
        }
        
        addTextSelectionListeners() {
          // This method is called when the tool is initialized
          // The actual listeners are added/removed in enableTextSelection/disableTextSelection
        }
        
        async simplifyText(resultDiv, button) {
          if (!this.selectedText) {
            resultDiv.textContent = 'Please select text first';
            resultDiv.className = 'result error';
            return;
          }
          
          button.disabled = true;
          resultDiv.textContent = 'Simplifying text...';
          resultDiv.className = 'result loading';
          
          try {
            const response = await fetch('http://localhost:8000/tools/text_simplification/process', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                text: this.selectedText.text,
                simplification_type: this.simplificationType,
                reading_level: this.readingLevel
              })
            });
            const data = await response.json();
            
            if (data.success) {
              // Replace the original text with simplified version
              this.replaceTextWithSimplified(data.data.simplified_text);
              resultDiv.textContent = 'Text simplified successfully!';
              resultDiv.className = 'result success';
            } else {
              resultDiv.textContent = `Error: ${data.message}`;
              resultDiv.className = 'result error';
            }
          } catch (error) {
            resultDiv.textContent = `Error: ${error.message}`;
            resultDiv.className = 'result error';
          } finally {
            button.disabled = false;
          }
        }
        
        replaceTextWithSimplified(simplifiedText) {
          if (this.selectedText && this.selectedText.element) {
            // Create a wrapper div to contain the simplified text with visual indicator
            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';
            wrapper.style.borderLeft = '4px solid #28a745';
            wrapper.style.paddingLeft = '8px';
            wrapper.style.marginLeft = '2px';
            
            // Create the text element
            const newElement = document.createElement(this.selectedText.tagName);
            newElement.innerHTML = simplifiedText;
            
            // Copy all attributes from the original element
            Array.from(this.selectedText.element.attributes).forEach(attr => {
              newElement.setAttribute(attr.name, attr.value);
            });
            
            // Reset any existing styles that might interfere
            newElement.style.margin = '0';
            newElement.style.padding = '0';
            newElement.style.border = 'none';
            newElement.style.backgroundColor = 'transparent';
            
            // Assemble the wrapper
            wrapper.appendChild(newElement);
            
            // Replace the original element
            this.selectedText.element.parentNode.replaceChild(wrapper, this.selectedText.element);
            
            // Update the selected text reference to point to the wrapper
            this.selectedText.element = wrapper;
            
            // Clear the selection highlighting since text has been replaced
            this.clearAllTextHighlighting();
            this.selectedText = null;
            
            console.log('Text replaced with simplified version');
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
