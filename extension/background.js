// OmniTrack MV3 Background Service Worker for Network Operations
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'OMNITRACK_SYNC_TO_BACKEND') {
    // Execute the fetch from the background worker context
    fetch('http://localhost:5001/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message.payload)
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();

        // Proactively notify any active dashboard tabs running on localhost of this background update
        try {
          chrome.tabs.query({ url: ["*://localhost:*/*", "*://127.0.0.1:*/*"] }, (dashboardTabs) => {
            if (dashboardTabs && dashboardTabs.length > 0) {
              chrome.scripting.executeScript({
                target: { tabId: dashboardTabs[0].id },
                func: (syncedItems) => {
                  const event = new CustomEvent('OMNITRACK_SYNC_ITEMS', { detail: syncedItems });
                  window.dispatchEvent(event);
                },
                args: [message.payload]
              }).catch((err) => console.warn('Background dashboard sync notification skipped:', err));
            }
          });
        } catch (tabQueryErr) {
          console.warn('Dashboard tab query failed:', tabQueryErr);
        }

        sendResponse({ success: true, data });
      })
      .catch((err) => {
        console.error('Background fetch failed:', err);
        sendResponse({ success: false, error: err.message });
      });

    // Return true to indicate asynchronous sendResponse
    return true;
  }
});
