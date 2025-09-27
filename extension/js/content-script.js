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
    this.textSimplificationState = null; // Reference to text simplification tool state
    this.aiAltTextState = null;     // Reference to AI alt text tool state
    
    // ========================================================================
    // TOOL CONFIGURATION
    // ========================================================================
    // Add new tools here - each tool needs: id, name, icon
    // The id must match the tool class name in getInlineTool() method
    this.tools = [
      { id: 'speech_to_instructions', name: 'Speech Commands', icon: '🎤', span: 2, description: 'Control the page with voice commands' },
      { id: 'ai_alt_text', name: 'AI Alt Text', icon: '🖼️', description: 'Generate image descriptions' },
      { id: 'adaptive_css', name: 'CSS Adjust', icon: '🎨', description: 'Customize page appearance' },
      { id: 'semantic_search', name: 'Search', icon: '🔍', description: 'Find content semantically' },
      { id: 'text_simplification', name: 'Simplify Text', icon: '📝', description: 'Make text easier to read' }
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
    // Get extension URLs for images
    const adkImageUrl = chrome.runtime.getURL('css/adk.png');
    const geminiImageUrl = chrome.runtime.getURL('css/gemini.png');
    
    header.innerHTML = `
      <div class="panel-title">A11y Tools</div>
      <div class="powered-by">
        <span class="powered-by-text">Powered by</span>
        <div class="powered-by-logos">
          <img src="${adkImageUrl}" alt="ADK" class="powered-by-logo">
          <img src="${geminiImageUrl}" alt="Gemini" class="powered-by-logo">
        </div>
      </div>
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
      if (tool.span) {
        toolItem.style.gridColumn = `span ${tool.span}`;
      }
      toolItem.innerHTML = `
        <div class="tool-icon">${tool.icon}</div>
        <div class="tool-name">${tool.name}</div>
        <div class="tool-description">${tool.description || ''}</div>
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

  resetCurrentToolState() {
    // Reset state for the currently active tool
    if (this.currentTool === 'text_simplification') {
      this.resetTextSimplificationState();
    } else if (this.currentTool === 'ai_alt_text') {
      this.resetAIAltTextState();
    }
    // Add other tool resets here as needed
  }
  
  resetTextSimplificationState() {
    // Reset text selection state globally
    if (this.textSimplificationState) {
      this.textSimplificationState.isSelectingMode = false;
      this.textSimplificationState.disableTextSelection();
      this.textSimplificationState.clearAllTextHighlighting();
      this.textSimplificationState.selectedText = null;
      
      // Update the UI if the tool panel is still visible
      const container = this.shadowRoot.querySelector('.tool-panel');
      if (container) {
        this.textSimplificationState.updateSelectionUI(container);
      }
    }
  }
  
  resetAIAltTextState() {
    // Reset image selection state globally
    if (this.aiAltTextState) {
      this.aiAltTextState.isSelectingMode = false;
      this.aiAltTextState.disablePhotoSelection();
      this.aiAltTextState.clearAllPhotoHighlighting();
      this.aiAltTextState.selectedImage = null;
      
      // Update the UI if the tool panel is still visible
      const container = this.shadowRoot.querySelector('.tool-panel');
      if (container) {
        this.aiAltTextState.updateSelectionUI(container);
      }
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
    
    // Store tool instance reference for state management
    if (toolId === 'text_simplification') {
      this.textSimplificationState = toolInstance;
    } else if (toolId === 'ai_alt_text') {
      this.aiAltTextState = toolInstance;
    }
    
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
      // SPEECH-TO-INSTRUCTIONS TOOL
      // ========================================================================
      'speech_to_instructions': class SpeechToInstructionsTool {
        constructor() {
          this.toolId = 'speech_to_instructions';
          this.name = 'Speech Commands';
          this.icon = '🎤';
          this.sessionId = Math.random().toString().substring(10);
          this.eventSource = null;
          this.isAudioMode = false;
          this.audioPlayerNode = null;
          this.audioPlayerContext = null;
          this.audioRecorderNode = null;
          this.audioRecorderContext = null;
          this.micStream = null;
          this.audioBuffer = [];
          this.bufferTimer = null;
          this.currentMessageId = null;
          this.messageBuffer = "";
          this.container = null; // Store reference to the container
          this.processingButton = false; // Flag to prevent duplicate button processing
        }
        
        getContent() {
          return `
            <div class="tool-content" style="height: 100%; display: flex; flex-direction: column; margin-bottom: 0px; padding-bottom: 0px;">
                <!-- Chat Messages -->
                <div id="chat-messages" style="flex: 1; overflow-y: auto; padding: 15px; min-height: 0; max-height: calc(100% - 180px);">
                <div class="chat-message agent" style="margin-bottom: 15px;">
                  <div style="display: flex;">
                    <div style="background: white; padding: 8px 12px; border-radius: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 80%;">
                      <div style="color: #333; font-size: 14px; line-height: 1.4;">Hello! I'm ready to help you interact with this webpage. What would you like me to do?</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Input Area -->
              <div style="border-top: 1px solid #e0e0e0; background: white; padding: 8px 8px; flex-shrink: 0;">
                <!-- Text Input -->
                <div id="text-mode">
                  <div style="display: flex; gap: 8px; margin-bottom: 2px;">
                    <input type="text" id="speech-text-input" placeholder="Type your message..." 
                           style="flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 20px; font-size: 14px; height: 40px; outline: none; transition: border-color 0.2s;"
                           onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#ddd'">
                    <button class="button" id="send-text-btn" style="padding: 8px 0px; border-radius: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; color: white; font-size: 16px; cursor: pointer; transition: transform 0.2s; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; margin: 0px;" 
                            onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">↵</button>
                  </div>
                </div>
                
                <!-- Audio Mode -->
                <div id="audio-mode" style="display: none;">
                  <div style="display: flex; gap: 8px; margin-bottom: 2px;">
                    <button class="button" id="start-audio-btn" style="flex: 1; padding: 8px 12px; border-radius: 25px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; color: white; font-size: 14px; cursor: pointer;margin-top: 2px; margin-bottom: 0px;">🎤 Start Recording</button>
                    <button class="button" id="stop-audio-btn" style="flex: 1; padding: 8px 12px; border-radius: 25px; background: #dc3545; border: none; color: white; font-size: 14px; cursor: pointer; display: none;">⏹️ Stop Recording</button>
                  </div>
                </div>
                
                <!-- Mode Toggle -->
                <div style="text-align: center;">
                  <button class="button" id="toggle-mode-btn" style="padding: 6px 14px; border-radius: 20px; background: #f4f6fb; border: 1px solid #ddd; color: #666; font-size: 12px; cursor: pointer; transition: all 0.2s;"
                          onmouseover="this.style.backgroundColor='#e9ecef'" onmouseout="this.style.backgroundColor='#f4f6fb'">Switch to Audio Mode</button>
                </div>
              </div>
            </div>
          `;
        }
        
        setupEventListeners(container) {
          console.log('Setting up event listeners for container:', container);
          this.container = container; // Store container reference
          
          const textInput = container.querySelector('#speech-text-input');
          const sendTextBtn = container.querySelector('#send-text-btn');
          const startAudioBtn = container.querySelector('#start-audio-btn');
          const stopAudioBtn = container.querySelector('#stop-audio-btn');
          const toggleModeBtn = container.querySelector('#toggle-mode-btn');
          const chatMessages = container.querySelector('#chat-messages');
          
          console.log('Found elements:', {
            textInput, sendTextBtn, startAudioBtn, stopAudioBtn, 
            toggleModeBtn, chatMessages
          });
          
          // Text mode
          sendTextBtn.addEventListener('click', () => {
            const text = textInput.value.trim();
            if (text) {
              this.sendTextCommand(text);
              textInput.value = '';
            }
          });
          
          textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              const text = textInput.value.trim();
              if (text) {
                this.sendTextCommand(text);
                textInput.value = '';
              }
            }
          });
          
          // Audio mode
          startAudioBtn.addEventListener('click', () => {
            this.startAudioRecording();
          });
          
          stopAudioBtn.addEventListener('click', () => {
            this.stopAudioRecording();
          });
          
          // Mode toggle
          toggleModeBtn.addEventListener('click', () => {
            this.toggleMode();
          });
          
        // Initialize SSE connection after a short delay to ensure UI is ready
        setTimeout(() => {
          this.connectSSE();
        }, 100);
        }
        
        connectSSE() {
          const sseUrl = `http://localhost:8000/events/${this.sessionId}?is_audio=${this.isAudioMode}`;
          console.log('Connecting to SSE:', sseUrl);
          this.eventSource = new EventSource(sseUrl);
          
        this.eventSource.onopen = () => {
          console.log('SSE connection opened');
          this.addSystemMessage('Connected to speech commands', 'success');
        };
          
          this.eventSource.onmessage = (event) => {
            console.log('Raw SSE message:', event.data);
            try {
              const message = JSON.parse(event.data);
              console.log('Parsed SSE message:', message);
              this.handleSSEMessage(message);
            } catch (e) {
              console.error('Error parsing SSE message:', e, 'Raw data:', event.data);
            }
          };
          
        this.eventSource.onerror = (event) => {
          console.error('SSE connection error:', event);
          this.addSystemMessage('Connection lost, reconnecting...', 'error');
          setTimeout(() => this.connectSSE(), 5000);
        };
        }
        
        handleSSEMessage(message) {
          console.log('Handling SSE message:', message);
          
          if (message.turn_complete) {
            console.log('Turn complete, clearing message buffer');
            this.currentMessageId = null;
            this.messageBuffer = "";
            return;
          }
          
          if (message.interrupted) {
            if (this.audioPlayerNode) {
              this.audioPlayerNode.port.postMessage({ command: "endOfAudio" });
            }
            return;
          }
          
          if (message.mime_type === "audio/pcm" && this.audioPlayerNode) {
            this.audioPlayerNode.port.postMessage(this.base64ToArray(message.data));
          }
          
          if (message.mime_type === "text/plain") {
            console.log('Processing text message:', message.data);
            console.log('Current messageBuffer:', this.messageBuffer);
            this.messageBuffer += message.data;
            console.log('Updated messageBuffer:', this.messageBuffer);
            
            // Try to find and parse JSON button actions
            const actionProcessed = this.tryParseJSONActions();
            console.log('Action processed:', actionProcessed);
            
            // If an action was processed, don't add the raw JSON to chat
            if (actionProcessed) {
              console.log('Action was processed, returning early');
              return;
            }
            
            // Check if this is a direct JSON action (not in buffer)
            const text = message.data.trim();
            if (this.isDirectJSONAction(text)) {
              console.log('Detected direct JSON action:', text);
              return;
            }
            // Check if this is a system action message (not a chat message)
            if (this.isSystemActionMessage(text)) {
              console.log('Detected system action message:', text);
              this.addSystemMessage(text, 'info');
              return;
            }
            
          // Add text to results (this is a chat message)
          if (this.currentMessageId === null) {
            this.currentMessageId = Math.random().toString(36).substring(7);
            console.log('Creating new message element with ID:', this.currentMessageId);
            this.addChatMessage('', 'agent', this.currentMessageId);
          }
            
            // Find the message element within the container
            const messageElement = this.container ? this.container.querySelector(`#${this.currentMessageId}`) : document.getElementById(this.currentMessageId);
            if (messageElement) {
              console.log('Updating message element with:', message.data);
              // Find the text div within the message bubble
              const textDiv = messageElement.querySelector('div[style*="color: #333"]');
              if (textDiv) {
                textDiv.textContent += message.data;
              } else {
                // Fallback: update the entire message content
                messageElement.textContent += message.data;
              }
            } else {
              console.error('Message element not found with ID:', this.currentMessageId);
              // Fallback: add the text directly to results
              this.addChatMessage(message.data, 'agent');
            }
          }
        }
        
        isDirectJSONAction(text) {
          // Check if the text is a direct JSON action (not buffered)
          try {
            const data = JSON.parse(text);
            
            // Check if this is a nested result with button action
            if (data.result && typeof data.result === 'string' && !this.processingButton) {
              console.log('Found direct nested result, processingButton:', this.processingButton);
              console.log('Result string:', data.result);
              try {
                const innerData = JSON.parse(data.result);
                console.log('Parsed inner data:', innerData);
                if (innerData.elementId && innerData.event === "click") {
                  console.log('Processing direct nested button action:', innerData);
                  this.processingButton = true;
                  this.handleButtonAction(innerData);
                  // Reset flag after a short delay
                  setTimeout(() => {
                    this.processingButton = false;
                  }, 1000);
                  return true; // Action was processed
                }
              } catch (innerE) {
                console.log('Inner JSON parse failed:', innerE);
              }
            }
            
            // Check if this is a direct button action
            if (data.elementId && data.event === "click" && !this.processingButton) {
              console.log('Processing direct button action:', data);
              this.processingButton = true;
              this.handleButtonAction(data);
              // Reset flag after a short delay
              setTimeout(() => {
                this.processingButton = false;
              }, 1000);
              return true; // Action was processed
            }
            
            // Check if this is a webpage scan request
            if (data.action === "scan_webpage") {
              console.log('Processing direct webpage scan request');
              const scanResult = this.scanWebpageElements();
              this.addSystemMessage(`${scanResult.elements.length} elements found`, 'info');
              this.sendScanResults(scanResult);
              return true; // Action was processed
            }
            
          } catch (e) {
            console.log('Not a JSON action:', e);
          }
          
          return false; // Not a JSON action
        }
        
        isSystemActionMessage(text) {
          // System action messages are typically short, informational messages
          // that describe what the system is doing, not conversational responses
          const systemPatterns = [
            /^\d+\s+(buttons?|elements?)\s+found/i,
            /^\d+\s+(buttons?|elements?)\s+available/i,
            /scanning/i,
            /connected/i,
            /disconnected/i,
            /error/i,
            /loading/i,
            /processing/i,
            /found\s+\d+/i,
            /elements?\s+found/i,
            /buttons?\s+found/i,
            /scan\s+complete/i,
            /ready/i,
            /starting/i,
            /stopping/i
          ];
          
          // Check if the text matches any system action pattern
          return systemPatterns.some(pattern => pattern.test(text));
        }
        
        tryParseJSONActions() {
          // Look for complete JSON objects in the buffer
          let braceCount = 0;
          let startIndex = -1;
          
          for (let i = 0; i < this.messageBuffer.length; i++) {
            if (this.messageBuffer[i] === '{') {
              if (startIndex === -1) startIndex = i;
              braceCount++;
            } else if (this.messageBuffer[i] === '}') {
              braceCount--;
              if (braceCount === 0 && startIndex !== -1) {
                // Found a complete JSON object
                const jsonStr = this.messageBuffer.substring(startIndex, i + 1);
                console.log('Found complete JSON:', jsonStr);
                
                try {
                  const data = JSON.parse(jsonStr);
                  console.log('Parsed JSON data:', data);
                  console.log('Has result field:', !!data.result);
                  console.log('Result type:', typeof data.result);
                  
                  // Check if this is a webpage scan request
                  if (data.action === "scan_webpage") {
                    console.log('Processing webpage scan request');
                    const scanResult = this.scanWebpageElements();
                    this.addSystemMessage(`${scanResult.elements.length} elements found`, 'info');
                    
                    // Send the scan results back to the agent
                    this.sendScanResults(scanResult);
                    
                    // Remove the processed JSON from buffer
                    this.messageBuffer = this.messageBuffer.substring(i + 1);
                    return true; // Action was processed
                  }
                  
                  // Check if this is a button action directly
                  if (data.elementId && data.event === "click" && !this.processingButton) {
                    console.log('Processing button action:', data);
                    this.processingButton = true;
                    this.handleButtonAction(data);
                    // Remove the processed JSON from buffer and return to prevent duplicate processing
                    this.messageBuffer = this.messageBuffer.substring(i + 1);
                    // Reset flag after a short delay
                    setTimeout(() => {
                      this.processingButton = false;
                    }, 1000);
                    return true; // Action was processed
                  }
                  
                  // Check if this is a nested result with button action
                  if (data.result && typeof data.result === 'string' && !this.processingButton) {
                    console.log('Found nested result, processingButton:', this.processingButton);
                    console.log('Result string:', data.result);
                    try {
                      const innerData = JSON.parse(data.result);
                      console.log('Parsed inner data:', innerData);
                      if (innerData.elementId && innerData.event === "click") {
                        console.log('Processing nested button action:', innerData);
                        this.processingButton = true;
                        this.handleButtonAction(innerData);
                        // Remove the processed JSON from buffer and return to prevent duplicate processing
                        this.messageBuffer = this.messageBuffer.substring(i + 1);
                        // Reset flag after a short delay
                        setTimeout(() => {
                          this.processingButton = false;
                        }, 1000);
                        return true; // Action was processed
                      }
                    } catch (innerE) {
                      console.log('Inner JSON parse failed:', innerE);
                    }
                  }
                } catch (e) {
                  console.log('JSON parse failed:', e, 'String:', jsonStr);
                }
                
                // Reset for next JSON object
                startIndex = -1;
              }
            }
          }
          return false; // No action was processed
        }
        
        scanWebpageElements() {
          console.log('Scanning webpage for clickable elements...');
          
          const elements = [];
          const selectors = [
            'button',
            'a[href]',
            'input[type="button"]',
            'input[type="submit"]',
            'input[type="reset"]',
            'input[type="checkbox"]',
            'input[type="radio"]',
            'select',
            'textarea',
            '[onclick]',
            '[role="button"]',
            '[role="link"]',
            '[role="menuitem"]',
            '[role="tab"]',
            '[role="option"]',
            '[tabindex]:not([tabindex="-1"])'
          ];
          
          // Collect all clickable elements
          selectors.forEach(selector => {
            const foundElements = document.querySelectorAll(selector);
            foundElements.forEach(element => {
              // Skip elements that are not visible or are disabled
              if (this.isElementVisible(element) && !element.disabled) {
                const rect = element.getBoundingClientRect();
                const isVisible = rect.width > 0 && rect.height > 0 && 
                                 rect.top >= 0 && rect.left >= 0 &&
                                 rect.bottom <= window.innerHeight && 
                                 rect.right <= window.innerWidth;
                
                elements.push({
                  tagName: element.tagName.toLowerCase(),
                  text: element.textContent?.trim() || element.value || '',
                  id: element.id || '',
                  className: element.className || '',
                  type: element.type || '',
                  href: element.href || '',
                  onclick: element.onclick ? 'has onclick handler' : '',
                  role: element.getAttribute('role') || '',
                  tabIndex: element.tabIndex || '',
                  visible: isVisible,
                  position: {
                    top: Math.round(rect.top),
                    left: Math.round(rect.left),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height)
                  }
                });
              }
            });
          });
          
          // Remove duplicates and prioritize visible elements
          const uniqueElements = [];
          const seenElements = new Set();
          
          // First pass: add visible elements
          elements.forEach(element => {
            const key = `${element.tagName}-${element.text}-${element.id}`;
            if (element.visible && !seenElements.has(key)) {
              uniqueElements.push(element);
              seenElements.add(key);
            }
          });
          
          // Second pass: add non-visible elements if we have space
          elements.forEach(element => {
            const key = `${element.tagName}-${element.text}-${element.id}`;
            if (!element.visible && !seenElements.has(key) && uniqueElements.length < 30) {
              uniqueElements.push(element);
              seenElements.add(key);
            }
          });
          
          // Limit to 30 elements
          const limitedElements = uniqueElements.slice(0, 30);
          
          console.log(`Found ${limitedElements.length} clickable elements:`, limitedElements);
          
          return {
            action: "webpage_scan_complete",
            elements: limitedElements,
            totalFound: elements.length,
            message: `Found ${limitedElements.length} clickable elements on the page`
          };
        }
        
        isElementVisible(element) {
          const style = window.getComputedStyle(element);
          return style.display !== 'none' && 
                 style.visibility !== 'hidden' && 
                 style.opacity !== '0' &&
                 element.offsetParent !== null;
        }
        
        async sendScanResults(scanResult) {
          try {
            const response = await fetch(`http://localhost:8000/send/${this.sessionId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                mime_type: "text/plain",
                data: `Webpage scan complete. Found ${scanResult.elements.length} clickable elements:\n\n${JSON.stringify(scanResult.elements, null, 2)}`
              })
            });
            
            if (response.ok) {
              console.log('Scan results sent to agent');
            }
          } catch (error) {
            console.error('Error sending scan results:', error);
            this.addSystemMessage(`Error sending scan results: ${error.message}`, 'error');
          }
        }
        
        handleButtonAction(data) {
          console.log('Handling button action:', data);
          
          // Look for buttons on the webpage (not in the extension)
          let element = null;
          let buttonDescription = '';
          
          // Try different selectors to find the button
          if (data.elementId) {
            element = document.querySelector(`#${data.elementId}`);
            if (element) {
              buttonDescription = `ID: ${data.elementId}`;
            }
          }
          
          // If not found by ID, try to find by text content or other attributes
          if (!element) {
            const buttons = document.querySelectorAll('button');
            console.log(`Found ${buttons.length} buttons on page:`, Array.from(buttons).map(b => ({
              id: b.id,
              text: b.textContent.trim(),
              classes: b.className
            })));
            // Extract description from elementId if it follows the pattern "button-description"
            let targetDescription = '';
            if (data.elementId && data.elementId.startsWith('button-')) {
              targetDescription = data.elementId.replace('button-', '').replace('-', ' ').toLowerCase();
            }
            console.log('Target description from elementId:', targetDescription);
            
            // Look for buttons with specific text patterns
            for (const button of buttons) {
              const text = button.textContent.toLowerCase().trim();
              const id = button.id.toLowerCase();
              
              // If we have a target description, try to match it FIRST (highest priority)
              if (targetDescription && (text.includes(targetDescription) || id.includes(targetDescription))) {
                element = button;
                buttonDescription = `Matched "${targetDescription}": "${button.textContent.trim()}"`;
                break;
              }
            }
            
            // If no specific match found, look for generic patterns
            if (!element) {
              for (const button of buttons) {
                const text = button.textContent.toLowerCase().trim();
                const id = button.id.toLowerCase();
                
                // Check for common button patterns (lower priority)
                if (text.includes('click me') || 
                    text.includes('click') ||
                    text.includes('test') ||
                    text.includes('button') ||
                    text.includes('submit') ||
                    text.includes('cancel') ||
                    text.includes('login') ||
                    text.includes('save') ||
                    text.includes('delete') ||
                    text.includes('welcome') ||
                    text.includes('success') ||
                    id.includes('click') ||
                    id.includes('test') ||
                    id.includes('button') ||
                    id.includes('submit') ||
                    id.includes('cancel') ||
                    id.includes('login') ||
                    id.includes('save') ||
                    id.includes('delete') ||
                    id.includes('welcome') ||
                    id.includes('success') ||
                    button.onclick) {
                  element = button;
                  buttonDescription = `Text: "${button.textContent.trim()}"`;
                  break;
                }
              }
            }
          }
          
          // If still not found, try to find any button
          if (!element) {
            element = document.querySelector('button');
            if (element) {
              buttonDescription = `First button found: "${element.textContent.trim()}"`;
            }
          }
          
          console.log('Looking for button on webpage');
          console.log('Found element:', element);
          console.log('Button description:', buttonDescription);
          
        if (element) {
          console.log('Clicking webpage button');
          element.click();
          
          // Extract a clean button name for the user message
          let buttonName = '';
          if (element.textContent && element.textContent.trim()) {
            buttonName = element.textContent.trim();
          } else if (data.elementId && data.elementId.startsWith('button-')) {
            buttonName = data.elementId.replace('button-', '').replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
          } else {
            buttonName = 'button';
          }
          
          // Add a user-friendly chat message instead of system message
          this.addChatMessage(`I clicked the "${buttonName}" button.`, 'agent');
        } else {
          console.error('No button found on webpage');
          this.addSystemMessage(`No button found on webpage`, 'error');
        }
        }
        
        async sendTextCommand(text) {
          try {
            // First, trigger a webpage scan to give the agent context
            this.addSystemMessage('Scanning...', 'info');
            const scanResult = this.scanWebpageElements();
            await this.sendScanResults(scanResult);
            
            // Wait a moment for the scan results to be processed
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Then send the user's command
            const response = await fetch(`http://localhost:8000/send/${this.sessionId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                mime_type: "text/plain",
                data: text
              })
            });
            
            if (response.ok) {
              this.addChatMessage(text, 'user');
            }
          } catch (error) {
            this.addSystemMessage(`Error: ${error.message}`, 'error');
          }
        }
        
        async startAudioRecording() {
          try {
            // Import audio worklets
            const { startAudioPlayerWorklet } = await import(chrome.runtime.getURL('js/audio/audio-player.js'));
            const { startAudioRecorderWorklet } = await import(chrome.runtime.getURL('js/audio/audio-recorder.js'));
            
            // Start audio player
            const [playerNode, playerCtx] = await startAudioPlayerWorklet();
            this.audioPlayerNode = playerNode;
            this.audioPlayerContext = playerCtx;
            
            // Start audio recorder
            const [recorderNode, recorderCtx, stream] = await startAudioRecorderWorklet((pcmData) => {
              this.audioRecorderHandler(pcmData);
            });
            this.audioRecorderNode = recorderNode;
            this.audioRecorderContext = recorderCtx;
            this.micStream = stream;
            
          // Update UI
          const startBtn = this.container ? this.container.querySelector('#start-audio-btn') : document.querySelector('#start-audio-btn');
          const stopBtn = this.container ? this.container.querySelector('#stop-audio-btn') : document.querySelector('#stop-audio-btn');
          if (startBtn) startBtn.style.display = 'none';
          if (stopBtn) stopBtn.style.display = 'inline-block';
            this.addSystemMessage('Audio recording started', 'success');
            
          } catch (error) {
            this.addSystemMessage(`Audio error: ${error.message}`, 'error');
          }
        }
        
        stopAudioRecording() {
          if (this.bufferTimer) {
            clearInterval(this.bufferTimer);
            this.bufferTimer = null;
          }
          
          if (this.audioBuffer.length > 0) {
            this.sendBufferedAudio();
          }
          
          if (this.micStream) {
            this.micStream.getTracks().forEach(track => track.stop());
          }
          
        // Update UI
        const startBtn = this.container ? this.container.querySelector('#start-audio-btn') : document.querySelector('#start-audio-btn');
        const stopBtn = this.container ? this.container.querySelector('#stop-audio-btn') : document.querySelector('#stop-audio-btn');
        if (startBtn) startBtn.style.display = 'inline-block';
        if (stopBtn) stopBtn.style.display = 'none';
          this.addSystemMessage('Audio recording stopped', 'info');
        }
        
        audioRecorderHandler(pcmData) {
          this.audioBuffer.push(new Uint8Array(pcmData));
          
          if (!this.bufferTimer) {
            this.bufferTimer = setInterval(() => this.sendBufferedAudio(), 200);
          }
        }
        
        async sendBufferedAudio() {
          if (this.audioBuffer.length === 0) return;
          
          let totalLength = 0;
          for (const chunk of this.audioBuffer) {
            totalLength += chunk.length;
          }
          
          const combinedBuffer = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of this.audioBuffer) {
            combinedBuffer.set(chunk, offset);
            offset += chunk.length;
          }
          
          try {
            await fetch(`http://localhost:8000/send/${this.sessionId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                mime_type: "audio/pcm",
                data: this.arrayBufferToBase64(combinedBuffer.buffer)
              })
            });
        } catch (error) {
          this.addSystemMessage(`Audio send error: ${error.message}`, 'error');
        }
          
          this.audioBuffer = [];
        }
        
        toggleMode() {
          this.isAudioMode = !this.isAudioMode;
          const textMode = this.container ? this.container.querySelector('#text-mode') : document.querySelector('#text-mode');
          const audioMode = this.container ? this.container.querySelector('#audio-mode') : document.querySelector('#audio-mode');
          const toggleBtn = this.container ? this.container.querySelector('#toggle-mode-btn') : document.querySelector('#toggle-mode-btn');
          
          if (this.isAudioMode) {
            textMode.style.display = 'none';
            audioMode.style.display = 'block';
            toggleBtn.textContent = 'Switch to Text Mode';
          } else {
            textMode.style.display = 'block';
            audioMode.style.display = 'none';
            toggleBtn.textContent = 'Switch to Audio Mode';
          }
          
          // Reconnect SSE with new mode
          if (this.eventSource) {
            this.eventSource.close();
          }
          this.connectSSE();
        }
        
        addChatMessage(text, sender = 'agent', id = null) {
          if (!this.container) {
            console.error('Container not available for addChatMessage');
            return;
          }
          
          const chatMessages = this.container.querySelector('#chat-messages');
          if (!chatMessages) {
            console.error('Chat messages div not found in container!');
            return;
          }
          
          const messageDiv = document.createElement('div');
          messageDiv.className = `chat-message ${sender}`;
          messageDiv.style.marginBottom = '15px';
          if (id) messageDiv.id = id;
          
          if (sender === 'user') {
            messageDiv.innerHTML = `
              <div style="display: flex; justify-content: flex-end;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 8px 12px; border-radius: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 80%;">
                  <div style="font-size: 14px; line-height: 1.4;">${text}</div>
                </div>
              </div>
            `;
          } else {
            messageDiv.innerHTML = `
              <div style="display: flex;">
                <div style="background: white; padding: 8px 12px; border-radius: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 80%;">
                  <div style="color: #333; font-size: 14px; line-height: 1.4;">${text}</div>
                </div>
              </div>
            `;
          }
          
          chatMessages.appendChild(messageDiv);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        
        addSystemMessage(text, type = 'info') {
          if (!this.container) {
            console.error('Container not available for addSystemMessage');
            return;
          }
          
          const chatMessages = this.container.querySelector('#chat-messages');
          if (!chatMessages) {
            console.error('Chat messages div not found in container!');
            return;
          }
          
          const messageDiv = document.createElement('div');
          messageDiv.style.marginBottom = '10px';
          messageDiv.style.textAlign = 'center';
          
          let bgColor, textColor, icon;
          switch (type) {
            case 'success':
              bgColor = '#d4edda';
              textColor = '#155724';
              icon = '✅';
              break;
            case 'error':
              bgColor = '#f8d7da';
              textColor = '#721c24';
              icon = '❌';
              break;
            case 'info':
            default:
              bgColor = '#d1ecf1';
              textColor = '#0c5460';
              icon = 'ℹ️';
          }
          
          messageDiv.innerHTML = `
            <div style="display: inline-block; background: ${bgColor}; color: ${textColor}; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 500;">
              ${icon} ${text}
            </div>
          `;
          
          chatMessages.appendChild(messageDiv);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        
        base64ToArray(base64) {
          const binaryString = window.atob(base64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return bytes.buffer;
        }
        
        arrayBufferToBase64(buffer) {
          let binary = "";
          const bytes = new Uint8Array(buffer);
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          return window.btoa(binary);
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
          
          if (this.selectedImage) {
            console.log('Updating UI with selected image');
            selectBtn.textContent = 'Select Different Photo';
            instructionText.textContent = 'Click to select a different photo';
            
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
            selectBtn.textContent = 'Select Photo on Page';
            instructionText.textContent = 'Click the button above to start selecting photos';
            photoInfo.style.display = 'none';
            generateBtn.disabled = true;
          }
        }
        
        addPhotoSelectionListeners() {
          // This method is called when the tool is initialized
          // The actual listeners are added/removed in enablePhotoSelection/disablePhotoSelection
        }
        
        clearAllPhotoHighlighting() {
          // Remove all highlighting from image elements
          const images = document.querySelectorAll('img');
          images.forEach(img => {
            img.style.outline = '';
            img.style.outlineOffset = '';
            img.style.backgroundColor = '';
          });
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
            resultDiv.textContent = `${data.data.alt_text}`;
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
                <button class="button" id="test-api-btn">Make dyslexic-friendly font</button>
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
          resultDiv.textContent = 'Applying dyslexic-friendly font...';
          resultDiv.className = 'result loading';
          
          try {
            // Apply dyslexic-friendly font to the entire page
            this.applyDyslexicFont();
            resultDiv.textContent = 'Dyslexic-friendly font applied successfully! The page now uses OpenDyslexic font.';
            resultDiv.className = 'result success';
          } catch (error) {
            resultDiv.textContent = `Error applying font: ${error.message}`;
            resultDiv.className = 'result error';
          } finally {
            button.disabled = false;
          }
        }
        
        applyDyslexicFont() {
          // Check if font styles are already injected
          if (document.getElementById('dyslexic-font-styles')) {
            return; // Font already applied
          }
          
          // Create style element for font-face declarations and font application
          const style = document.createElement('style');
          style.id = 'dyslexic-font-styles';
          style.textContent = `
            @font-face {
              font-family: 'OpenDyslexic';
              src: url('${chrome.runtime.getURL('assets/fonts/opendyslexic/OpenDyslexic-Regular.woff2')}') format('woff2'),
                   url('${chrome.runtime.getURL('assets/fonts/opendyslexic/OpenDyslexic-Regular.woff')}') format('woff'),
                   url('${chrome.runtime.getURL('assets/fonts/opendyslexic/OpenDyslexic-Regular.otf')}') format('opentype');
              font-weight: normal;
              font-style: normal;
            }
            
            @font-face {
              font-family: 'OpenDyslexic';
              src: url('${chrome.runtime.getURL('assets/fonts/opendyslexic/OpenDyslexic-Bold.woff2')}') format('woff2'),
                   url('${chrome.runtime.getURL('assets/fonts/opendyslexic/OpenDyslexic-Bold.woff')}') format('woff'),
                   url('${chrome.runtime.getURL('assets/fonts/opendyslexic/OpenDyslexic-Bold.otf')}') format('opentype');
              font-weight: bold;
              font-style: normal;
            }
            
            @font-face {
              font-family: 'OpenDyslexic';
              src: url('${chrome.runtime.getURL('assets/fonts/opendyslexic/OpenDyslexic-Italic.woff2')}') format('woff2'),
                   url('${chrome.runtime.getURL('assets/fonts/opendyslexic/OpenDyslexic-Italic.woff')}') format('woff'),
                   url('${chrome.runtime.getURL('assets/fonts/opendyslexic/OpenDyslexic-Italic.otf')}') format('opentype');
              font-weight: normal;
              font-style: italic;
            }
            
            @font-face {
              font-family: 'OpenDyslexic';
              src: url('${chrome.runtime.getURL('assets/fonts/opendyslexic/OpenDyslexic-Bold-Italic.woff2')}') format('woff2'),
                   url('${chrome.runtime.getURL('assets/fonts/opendyslexic/OpenDyslexic-Bold-Italic.woff')}') format('woff'),
                   url('${chrome.runtime.getURL('assets/fonts/opendyslexic/OpenDyslexic-Bold-Italic.otf')}') format('opentype');
              font-weight: bold;
              font-style: italic;
            }
            
            /* Apply OpenDyslexic font to all text elements */
            * {
              font-family: 'OpenDyslexic', sans-serif !important;
            }
          `;
          
          // Inject the styles into the document head
          document.head.appendChild(style);
          
          console.log('Dyslexic-friendly font (OpenDyslexic) applied to the page');
        }
      },
      // ========================================================================
      // WEBSITE SEARCH TOOL
      // ========================================================================
      'semantic_search': class WebsiteSearchTool {
        constructor() {
          this.toolId = 'semantic_search';
          this.name = 'Search';
          this.icon = '🔍';
          this.sessionId = Math.random().toString().substring(10);
          this.eventSource = null;
          this.currentMessageId = null;
          this.messageBuffer = "";
          this.container = null;
          this.websiteContent = null;
          this.isContentExtracted = false;
        }
        
        getContent() {
          return `
            <div class="tool-content" style="height: 100%; display: flex; flex-direction: column; margin-bottom: 0px; padding-bottom: 0px;">
                <!-- Chat Messages -->
                <div id="search-chat-messages" style="flex: 1; overflow-y: auto; padding: 15px; min-height: 0; max-height: calc(100% - 180px);">
                </div>
              
              <!-- Input Area -->
              <div style="border-top: 1px solid #e0e0e0; background: white; padding: 8px 8px; flex-shrink: 0;">
                <!-- Text Input -->
                <div id="search-text-mode">
                  <div style="display: flex; gap: 8px; margin-bottom: 2px;">
                    <input type="text" id="search-text-input" placeholder="Ask a question about this webpage..." 
                           style="flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 20px; font-size: 14px; height: 40px; outline: none; transition: border-color 0.2s;"
                           onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#ddd'">
                    <button class="button" id="send-search-btn" style="padding: 8px 0px; border-radius: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; color: white; font-size: 16px; cursor: pointer; transition: transform 0.2s; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; margin: 0px;" 
                            onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">↵</button>
                  </div>
                </div>
                
                <!-- Status -->
                <div style="text-align: center;">
                  <div id="search-status" style="margin-top: 5px;padding: 6px 14px; border-radius: 20px; background: #f4f6fb; border: 1px solid #ddd; color: #666; font-size: 12px; display: inline-block;">
                    Ready to search this webpage
                  </div>
                </div>
              </div>
            </div>
          `;
        }
        
        setupEventListeners(container) {
          console.log('Setting up event listeners for search container:', container);
          this.container = container;
          
          const textInput = container.querySelector('#search-text-input');
          const sendBtn = container.querySelector('#send-search-btn');
          const chatMessages = container.querySelector('#search-chat-messages');
          const statusDiv = container.querySelector('#search-status');
          
          console.log('Found search elements:', {
            textInput, sendBtn, chatMessages, statusDiv
          });
          
          // Text input
          sendBtn.addEventListener('click', () => {
            const text = textInput.value.trim();
            if (text) {
              this.sendSearchQuery(text);
              textInput.value = '';
            }
          });
          
          textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              const text = textInput.value.trim();
              if (text) {
                this.sendSearchQuery(text);
                textInput.value = '';
              }
            }
          });
          
          
          // Initialize SSE connection after a short delay
          setTimeout(() => {
            this.connectSSE();
          }, 100);
          
          // Extract website content when tool opens
          setTimeout(() => {
            this.extractWebsiteContent();
          }, 200);
        }
        
        connectSSE() {
          const sseUrl = `http://localhost:8000/search/events/${this.sessionId}`;
          console.log('Connecting to search SSE:', sseUrl);
          this.eventSource = new EventSource(sseUrl);
          
          this.eventSource.onopen = () => {
            console.log('Search SSE connection opened');
            this.updateStatus('Connected to search agent', 'success');
          };
          
          this.eventSource.onmessage = (event) => {
            console.log('Raw search SSE message:', event.data);
            try {
              const message = JSON.parse(event.data);
              console.log('Parsed search SSE message:', message);
              this.handleSSEMessage(message);
            } catch (e) {
              console.error('Error parsing search SSE message:', e, 'Raw data:', event.data);
            }
          };
          
          this.eventSource.onerror = (event) => {
            console.error('Search SSE connection error:', event);
            this.updateStatus('Connection lost, reconnecting...', 'error');
            setTimeout(() => this.connectSSE(), 5000);
          };
        }
        
        handleSSEMessage(message) {
          console.log('Handling search SSE message:', message);
          
          if (message.turn_complete) {
            console.log('Search turn complete, clearing message buffer');
            this.currentMessageId = null;
            this.messageBuffer = "";
            // Update status back to ready
            this.updateStatus('Ready to search this webpage', 'success');
            return;
          }
          
          if (message.mime_type === "text/plain") {
            console.log('Processing search text message:', message.data);
            this.messageBuffer += message.data;
            
            
            // Add text to results
            if (this.currentMessageId === null) {
              this.currentMessageId = 'msg_' + Math.random().toString(36).substring(2, 9);
              console.log('Creating new search message element with ID:', this.currentMessageId);
              this.addChatMessage('', 'agent', this.currentMessageId);
            }
            
            // Find the message element within the container
            let messageElement = null;
            if (this.container) {
              try {
                messageElement = this.container.querySelector(`[id="${this.currentMessageId}"]`);
              } catch (e) {
                console.error('Invalid selector for message ID:', this.currentMessageId, e);
                messageElement = null;
              }
            }
            
            if (messageElement) {
              console.log('Updating search message element with:', message.data);
              // Find the text div within the message bubble
              const textDiv = messageElement.querySelector('div[style*="color: #333"]');
              if (textDiv) {
                textDiv.textContent += message.data;
              } else {
                // Fallback: update the entire message content
                messageElement.textContent += message.data;
              }
            } else {
              console.error('Search message element not found with ID:', this.currentMessageId);
              // Fallback: add the text directly to results
              this.addChatMessage(message.data, 'agent');
            }
          }
        }
        
        
        async extractWebsiteContent() {
          console.log('Extracting website content...');
          this.updateStatus('Extracting webpage content...', 'loading');
          
          try {
            // Extract the main content from the webpage
            const content = this.getWebsiteContent();
            this.websiteContent = content;
            this.isContentExtracted = true;
            
            console.log('Website content extracted:', content.length, 'characters');
            this.updateStatus('Ready to search this webpage', 'success');
            
            // Send the content to the agent
            await this.sendWebsiteContentToAgent(content);
            
          } catch (error) {
            console.error('Error extracting website content:', error);
            this.updateStatus('Error extracting content', 'error');
          }
        }
        
        getWebsiteContent() {
          // Extract meaningful content from the webpage
          const content = {
            url: window.location.href,
            title: document.title,
            text: '',
            headings: [],
            links: [],
            images: [],
            buttons: []
          };
          
          // Extract main text content
          const textElements = document.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6, li, td, th, article, section');
          const textParts = [];
          
          textElements.forEach(element => {
            const text = element.textContent.trim();
            if (text.length > 3) { // Include more text, even shorter ones
              textParts.push(text);
            }
          });
          
          content.text = textParts.join('\n\n');
          
          // Extract headings
          const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
          headings.forEach(heading => {
              content.headings.push({
                level: heading.tagName.toLowerCase(),
              text: heading.textContent.trim()
            });
          });
          
          // Extract links
          const links = document.querySelectorAll('a[href]');
          links.forEach(link => {
            if (link.textContent.trim()) {
              content.links.push({
                text: link.textContent.trim(),
                href: link.href
              });
            }
          });
          
          // Extract images
          const images = document.querySelectorAll('img[src]');
          images.forEach(img => {
              content.images.push({
                src: img.src,
              alt: img.alt || '',
              title: img.title || ''
            });
          });
          
          // Extract buttons and clickable elements
          const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"], input[type="reset"], [role="button"]');
          buttons.forEach(button => {
            const text = button.textContent.trim() || button.value || button.getAttribute('aria-label') || '';
            if (text) {
              content.buttons.push({
                text: text,
                type: button.tagName.toLowerCase(),
                id: button.id || '',
                className: button.className || ''
              });
            }
          });
          
          // Also extract any elements with onclick handlers
          const clickableElements = document.querySelectorAll('[onclick]');
          clickableElements.forEach(element => {
            const text = element.textContent.trim();
            if (text && !content.buttons.some(btn => btn.text === text)) {
              content.buttons.push({
                text: text,
                type: element.tagName.toLowerCase(),
                id: element.id || '',
                className: element.className || '',
                onclick: 'has onclick handler'
              });
            }
          });
          
          return content;
        }
        
        async sendWebsiteContentToAgent(content) {
          try {
            // Only send the essential text content to avoid rate limits
            const contentData = `Website content extracted:\n\nURL: ${content.url}\nTitle: ${content.title}\n\nText Content:\n${content.text}`;
            
            console.log('Sending website content to agent (text only):', contentData.length, 'characters');
            
            const response = await fetch(`http://localhost:8000/search/send/${this.sessionId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                mime_type: "text/plain",
                data: contentData
              })
            });
            
            if (response.ok) {
              console.log('Website content sent to search agent successfully');
            } else {
              console.error('Failed to send website content:', response.status, response.statusText);
            }
          } catch (error) {
            console.error('Error sending website content:', error);
            this.updateStatus('Error sending content to agent', 'error');
          }
        }
        
        async sendSearchQuery(text) {
          try {
            this.addChatMessage(text, 'user');
            this.updateStatus('Searching...', 'loading');
            
            const response = await fetch(`http://localhost:8000/search/send/${this.sessionId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                mime_type: "text/plain",
                data: text
              })
            });
            
            if (response.ok) {
              console.log('Search query sent to agent');
            }
          } catch (error) {
            this.updateStatus(`Error: ${error.message}`, 'error');
          }
        }
        
        
        addChatMessage(text, sender = 'agent', id = null) {
          if (!this.container) {
            console.error('Search container not available for addChatMessage');
            return;
          }
          
          const chatMessages = this.container.querySelector('#search-chat-messages');
          if (!chatMessages) {
            console.error('Search chat messages div not found in container!');
            return;
          }
          
          const messageDiv = document.createElement('div');
          messageDiv.className = `chat-message ${sender}`;
          messageDiv.style.marginBottom = '15px';
          if (id) messageDiv.id = id;
          
          if (sender === 'user') {
            messageDiv.innerHTML = `
              <div style="display: flex; justify-content: flex-end;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 8px 12px; border-radius: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 80%;">
                  <div style="font-size: 14px; line-height: 1.4;">${text}</div>
                </div>
              </div>
            `;
          } else {
            messageDiv.innerHTML = `
              <div style="display: flex;">
                <div style="background: white; padding: 8px 12px; border-radius: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 80%;">
                  <div style="color: #333; font-size: 14px; line-height: 1.4;">${text}</div>
                </div>
              </div>
            `;
          }
          
          chatMessages.appendChild(messageDiv);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        
        updateStatus(message, type = 'info') {
          if (!this.container) {
            console.error('Search container not available for updateStatus');
            return;
          }
          
          const statusElement = this.container.querySelector('#search-status');
          if (!statusElement) {
            console.error('Search status element not found!');
            return;
          }
          
          statusElement.textContent = message;
          
          // Update color based on type
          switch (type) {
            case 'success':
              statusElement.style.backgroundColor = '#d4edda';
              statusElement.style.color = '#155724';
              statusElement.style.borderColor = '#c3e6cb';
              break;
            case 'error':
              statusElement.style.backgroundColor = '#f8d7da';
              statusElement.style.color = '#721c24';
              statusElement.style.borderColor = '#f5c6cb';
              break;
            case 'loading':
              statusElement.style.backgroundColor = '#d1ecf1';
              statusElement.style.color = '#0c5460';
              statusElement.style.borderColor = '#bee5eb';
              break;
            default:
              statusElement.style.backgroundColor = '#f4f6fb';
              statusElement.style.color = '#666';
              statusElement.style.borderColor = '#ddd';
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
              <div style="padding: 20px; padding-bottom: 0px;">
                <div style="margin-bottom: 20px;">
                  <button class="button" id="select-text-btn" style="width: 100%; margin-bottom: 10px; margin-top: 0px;">
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
                  <div id="simplify-status" style="font-size: 12px; color: #666; text-align: center;">
                    Simplify the selected text using AI
                  </div>
                </div>
                
              </div>
            </div>
          `;
        }
        
        setupEventListeners(container) {
          const selectBtn = container.querySelector('#select-text-btn');
          const simplifyBtn = container.querySelector('#simplify-text-btn');
          const simplificationTypeSelect = container.querySelector('#simplification-type');
          const readingLevelSelect = container.querySelector('#reading-level');
          
          selectBtn.addEventListener('click', () => {
            this.toggleSelectionMode(container);
          });
          
          simplifyBtn.addEventListener('click', async () => {
            await this.simplifyText(simplifyBtn);
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
            
            // Reset status message
            this.updateStatusMessage('Simplify the selected text using AI', 'default');
          } else {
            console.log('No selected text to display');
            // Reset status message when no text is selected
            this.updateStatusMessage('Simplify the selected text using AI', 'default');
          }
        }
        
        addTextSelectionListeners() {
          // This method is called when the tool is initialized
          // The actual listeners are added/removed in enableTextSelection/disableTextSelection
        }
        
        updateStatusMessage(message, type) {
          if (this.shadowRoot) {
            const statusElement = this.shadowRoot.querySelector('#simplify-status');
            if (statusElement) {
              statusElement.textContent = message;
              
              // Update color based on type
              switch (type) {
                case 'success':
                  statusElement.style.color = '#28a745';
                  break;
                case 'error':
                  statusElement.style.color = '#dc3545';
                  break;
                case 'loading':
                  statusElement.style.color = '#007bff';
                  break;
                default:
                  statusElement.style.color = '#666';
              }
            }
          }
        }
        
        async simplifyText(button) {
          if (!this.selectedText) {
            this.updateStatusMessage('Please select text first', 'error');
            return;
          }
          
          button.disabled = true;
          this.updateStatusMessage('Simplifying text...', 'loading');
          
          try {
            console.log('Sending request to API:', {
              text: this.selectedText.text,
              simplification_type: this.simplificationType,
              reading_level: this.readingLevel
            });
            
            const response = await fetch('http://localhost:8000/tools/text_simplification/process', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                text: this.selectedText.text,
                simplification_type: this.simplificationType,
                reading_level: this.readingLevel
              })
            });
            
            console.log('API response status:', response.status);
            const data = await response.json();
            console.log('API response data:', data);
            
            if (data.success) {
              // Replace the original text with simplified version
              this.replaceTextWithSimplified(data.data.simplified_text);
              this.updateStatusMessage('Text replaced!', 'success');
            } else {
              this.updateStatusMessage(`Error: ${data.message}`, 'error');
            }
          } catch (error) {
            console.error('API call failed:', error);
            this.updateStatusMessage(`Error: ${error.message}`, 'error');
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
    
    // Reset tool-specific state when closing any tool
    this.resetCurrentToolState();
    
    // Clear tool state references
    this.textSimplificationState = null;
    this.aiAltTextState = null;
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
