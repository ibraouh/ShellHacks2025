// Background script for handling floating UI
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleFloatingUI') {
    // Send message to content script to toggle floating UI
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleFloatingUI' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error toggling floating UI:', chrome.runtime.lastError);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            console.log('Floating UI toggled successfully');
            sendResponse({ success: true });
          }
        });
      }
    });
    return true; // Keep the message channel open for async response
  }
});

// Handle extension icon click to toggle floating UI
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { action: 'toggleFloatingUI' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error toggling floating UI:', chrome.runtime.lastError);
    } else {
      console.log('Floating UI toggled via icon click');
    }
  });
});
