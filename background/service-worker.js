importScripts('../storage/store.js');

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_SESSION_STATS') {
    store.getRecentStats(message.platform, 60).then(sendResponse);
    return true;
  }
  if (message.type === 'OPEN_DASHBOARD') {
    chrome.runtime.openOptionsPage();
  }
});
