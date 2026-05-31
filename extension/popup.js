// OmniTrack Chrome Extension Logic with Direct Dashboard Sync Bridge
document.addEventListener('DOMContentLoaded', async () => {
  const storeBadge = document.getElementById('store-badge');
  const introText = document.getElementById('intro-text');
  const itemList = document.getElementById('item-list');
  const btnScan = document.getElementById('btn-scan');
  const btnCopy = document.getElementById('btn-copy');

  let activeTab = null;
  let detectedStore = 'Unknown';
  let scrapedData = null;

  // 1. Detect store domain on active tab
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      activeTab = tabs[0];
      const url = new URL(activeTab.url);
      const host = url.hostname.toLowerCase();

      if (host.includes('zalando')) {
        detectedStore = 'Zalando';
      } else if (host.includes('bstn')) {
        detectedStore = 'BSTN';
      } else if (host.includes('hhv')) {
        detectedStore = 'HHV';
      } else if (host.includes('endclothing')) {
        detectedStore = 'END';
      } else if (host.includes('asphaltgold')) {
        detectedStore = 'Asphaltgold';
      }

      storeBadge.textContent = detectedStore;
      if (detectedStore === 'Unknown') {
        storeBadge.style.background = 'rgba(239, 68, 68, 0.08)';
        storeBadge.style.color = '#ef4444';
        storeBadge.style.borderColor = 'rgba(239, 68, 68, 0.15)';
        introText.textContent = 'To sync items, navigate to an active cart or product page on Zalando, BSTN, HHV, END, or Asphaltgold.';
      } else {
        introText.textContent = `Active retailer detected: ${detectedStore}. Navigate to your cart, wishlist, or a product page, and click Scan & Sync.`;
      }
    }
  } catch (err) {
    console.error('Error querying tab:', err);
    storeBadge.textContent = 'Ready';
  }

  // 2. Scan active page DOM and Sync immediately
  btnScan.addEventListener('click', async () => {
    if (!activeTab) return;
    
    // Prevent double clicking by disabling action button immediately
    btnScan.disabled = true;
    btnScan.style.opacity = '0.7';
    btnScan.querySelector('span').textContent = 'Scanning page...';

    try {
      // Inject content script to extract DOM items
      const results = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['content.js']
      });

      if (results && results[0] && results[0].result) {
        const payload = results[0].result;
        const items = payload.items || [];
        scrapedData = items.map(item => ({
          ...item,
          sourceUrl: activeTab.url
        }));

        if (scrapedData.length > 0) {
          renderItems(scrapedData);
          btnScan.querySelector('span').textContent = 'Syncing to tracker...';
          
          // Offload network sync to service worker to bypass CSP/CORS
          chrome.runtime.sendMessage(
            { action: 'OMNITRACK_SYNC_TO_BACKEND', payload: scrapedData },
            async (response) => {
              if (chrome.runtime.lastError || !response || !response.success) {
                const errorMsg = response ? response.error : 'Network sync failed';
                console.error('Direct sync failed:', errorMsg);
                alert('Sync failed: ' + (errorMsg || 'Connection timeout'));
                
                btnScan.disabled = false;
                btnScan.style.opacity = '';
                btnScan.querySelector('span').textContent = 'Scan & Sync to Dashboard';
                return;
              }

              console.log('Sync to SQLite backend succeeded:', response.data);
              btnCopy.style.display = 'flex';
              btnCopy.removeAttribute('disabled');

              try {
                // Focus dashboard and notify UI
                const dashboardTabs = await chrome.tabs.query({ url: ["*://localhost:*/*", "*://127.0.0.1:*/*"] });
                if (dashboardTabs && dashboardTabs.length > 0) {
                  await chrome.scripting.executeScript({
                    target: { tabId: dashboardTabs[0].id },
                    func: (syncedItems) => {
                      const event = new CustomEvent('OMNITRACK_SYNC_ITEMS', { detail: syncedItems });
                      window.dispatchEvent(event);
                    },
                    args: [scrapedData]
                  });

                  await chrome.tabs.update(dashboardTabs[0].id, { active: true });
                  await chrome.windows.update(dashboardTabs[0].windowId, { drawAttention: true, focused: true });
                }
              } catch (tabErr) {
                console.warn('Dashboard focus skipped:', tabErr);
              }

              // Success animation
              btnScan.querySelector('span').textContent = 'Synced successfully!';
              btnScan.style.background = 'var(--color-emerald)';
              btnScan.style.color = '#ffffff';

              setTimeout(() => {
                btnScan.querySelector('span').textContent = 'Scan & Sync to Dashboard';
                btnScan.disabled = false;
                btnScan.style.opacity = '';
                btnScan.style.background = '';
                btnScan.style.color = '';
              }, 3000);
            }
          );
        } else {
          itemList.innerHTML = `
            <div class="empty-state">
              <svg width="24" height="24" fill="none" stroke="#ef4444" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span style="color: #ef4444">No items discovered</span>
              <p style="font-size: 0.65rem; color: var(--text-secondary); margin-top: 0.25rem;">Navigate to your cart, wishlist, or a product page, and try again.</p>
            </div>
          `;
          btnCopy.style.display = 'none';
          btnCopy.setAttribute('disabled', 'true');
          
          btnScan.querySelector('span').textContent = 'Scan & Sync to Dashboard';
          btnScan.disabled = false;
          btnScan.style.opacity = '';
        }
      } else {
        throw new Error('Empty script response');
      }
    } catch (err) {
      console.error('Scan failed:', err);
      itemList.innerHTML = `
        <div class="empty-state">
          <span style="color: #ef4444">Extension Error</span>
          <p style="font-size: 0.65rem; color: var(--text-secondary); margin-top: 0.25rem;">Please make sure you are not on a protected chrome:// page.</p>
        </div>
      `;
      btnScan.querySelector('span').textContent = 'Scan & Sync to Dashboard';
      btnScan.disabled = false;
      btnScan.style.opacity = '';
    }
  });

  // 3. Backup clipboard copy
  btnCopy.addEventListener('click', () => {
    if (!scrapedData || scrapedData.length === 0) return;

    const formattedText = scrapedData.map(item => {
      return `${item.store} ${item.title} - ${item.price !== null ? `€${item.price.toFixed(2)}` : 'No Price'}`;
    }).join('\n');

    navigator.clipboard.writeText(formattedText).then(() => {
      const copySpan = btnCopy.querySelector('span');
      const originalText = copySpan.textContent;
      copySpan.textContent = 'Copied to clipboard!';
      btnCopy.style.background = '#e9ecef';
      btnCopy.style.color = 'var(--color-emerald)';

      setTimeout(() => {
        copySpan.textContent = originalText;
        btnCopy.style.background = '';
        btnCopy.style.color = '';
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
    });
  });

  // Helper to render preview items
  function renderItems(itemsList) {
    itemList.innerHTML = '';
    itemsList.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'scraped-item';
      
      const img = document.createElement('img');
      img.className = 'item-img';
      img.src = item.image;
      img.alt = item.title;
      img.addEventListener('error', () => {
        img.src = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100&auto=format&fit=crop&q=60';
      });
      
      const details = document.createElement('div');
      details.className = 'item-details';
      
      const title = document.createElement('div');
      title.className = 'item-title';
      title.title = item.title;
      title.textContent = item.title;
      
      const storeName = document.createElement('div');
      storeName.className = 'item-store';
      storeName.textContent = item.store;
      
      details.appendChild(title);
      details.appendChild(storeName);
      
      const price = document.createElement('div');
      price.className = 'item-price';
      price.textContent = item.price !== null ? `€${item.price.toFixed(2)}` : 'No Price';
      
      itemEl.appendChild(img);
      itemEl.appendChild(details);
      itemEl.appendChild(price);
      
      itemList.appendChild(itemEl);
    });
  }
});
