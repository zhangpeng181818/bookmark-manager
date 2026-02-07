// Background Service Worker | 后台服务脚本
// Handles extension lifecycle events and optional periodic tasks

/**
 * Open main page in new tab when extension icon is clicked
 * 点击扩展图标时在新标签页打开主界面
 */
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('popup.html')
  });
});

/**
 * Initialize extension on install
 * 扩展安装时初始化
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('智能书签整理器已安装');
    
    // Set default configuration | 设置默认配置
    chrome.storage.sync.set({
      apiProvider: 'openai',
      endpoint: 'https://api.openai.com',
      model: 'gpt-4',
      organizationStrategy: 'by-topic'
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to set default config:', chrome.runtime.lastError);
      } else {
        console.log('默认配置已保存');
      }
    });
    
    // Open configuration page on first install | 首次安装打开配置页面
    chrome.runtime.openOptionsPage();
  } else if (details.reason === 'update') {
    console.log('智能书签整理器已更新到版本', chrome.runtime.getManifest().version);
  }
});

/**
 * Listen for bookmark changes (optional feature)
 * 监听书签变化（可选功能）
 */
chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  console.log('新书签已创建:', bookmark.title);
});

chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
  console.log('书签已删除, ID:', id);
});

/**
 * Message handler for communication with popup and config pages
 * 消息处理器，用于与弹出窗口和配置页面通信
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle async operations properly | 正确处理异步操作
  const handleMessage = async () => {
    try {
      switch (request.action) {
        case 'getBookmarks':
          return await getAllBookmarks();
        
        case 'saveConfig':
          await chrome.storage.sync.set(request.config);
          return { success: true };
        
        case 'getConfig':
          return await chrome.storage.sync.get(null);
        
        default:
          throw new Error(`Unknown action: ${request.action}`);
      }
    } catch (error) {
      console.error('Background script error:', error);
      throw error;
    }
  };
  
  handleMessage()
    .then(result => sendResponse({ success: true, data: result }))
    .catch(error => sendResponse({ success: false, error: error.message }));
  
  // Return true to indicate async response | 返回 true 表示异步响应
  return true;
});

/**
 * Get all bookmarks from Chrome
 * 从 Chrome 获取所有书签
 * @returns {Promise<Array>} Array of bookmark objects
 */
async function getAllBookmarks() {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getTree((tree) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      const bookmarks = [];
      
      /**
       * Recursively traverse bookmark tree
       * 递归遍历书签树
       * @param {Array} nodes - Bookmark nodes
       * @param {number} depth - Current depth level
       */
      function traverse(nodes, depth = 0) {
        nodes.forEach(node => {
          if (node.url) {
            bookmarks.push({
              id: node.id,
              title: node.title,
              url: node.url,
              dateAdded: node.dateAdded,
              depth: depth
            });
          }
          if (node.children) {
            traverse(node.children, depth + 1);
          }
        });
      }
      
      traverse(tree);
      resolve(bookmarks);
    });
  });
}
