/**
 * Bookmark Manager Module | 书签管理模块
 * Handles bookmark operations and organization
 * 处理书签操作和整理
 */

class BookmarkManager {
  constructor() {
    this.originalState = null; // For rollback support | 用于回滚支持
  }

  /**
   * Get all bookmarks from Chrome
   * 从 Chrome 获取所有书签
   * @returns {Promise<Array>} Array of bookmark objects | 书签对象数组
   */
  async getAllBookmarks() {
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
         */
        const traverse = (nodes, depth = 0, path = []) => {
          nodes.forEach(node => {
            if (node.url) {
              bookmarks.push({
                id: node.id,
                title: node.title,
                url: node.url,
                dateAdded: node.dateAdded,
                depth: depth,
                path: [...path]
              });
            }
            if (node.children) {
              traverse(node.children, depth + 1, [...path, node.title]);
            }
          });
        };

        traverse(tree);
        resolve(bookmarks);
      });
    });
  }

  /**
   * Save current bookmark state for rollback
   * 保存当前书签状态用于回滚
   * @returns {Promise<void>}
   */
  async saveCurrentState() {
    const tree = await new Promise((resolve) => {
      chrome.bookmarks.getTree(resolve);
    });
    this.originalState = JSON.stringify(tree);
    console.log('书签状态已备份');
  }

  /**
   * Apply organization plan to bookmarks
   * 应用整理方案到书签
   * @param {Object} plan - Organization plan from AI | AI 生成的整理方案
   * @returns {Promise<Object>} Result statistics | 结果统计
   */
  async applyOrganization(plan) {
    await this.saveCurrentState();

    const stats = {
      foldersCreated: 0,
      foldersRemoved: 0,
      bookmarksMoved: 0,
      titlesUpdated: 0,
      duplicatesRemoved: 0,
      errors: []
    };

    try {
      await this.cleanupPreviousOrganization();

      const folderMap = new Map();

      const processFolder = async (folder, parentId = '1', parentPath = []) => {
        const currentPath = [...parentPath, folder.name];
        const pathKey = currentPath.join('/');

        try {
          const newFolder = await this.createFolder(folder.name, parentId);
          folderMap.set(pathKey, newFolder.id);
          stats.foldersCreated++;

          if (folder.bookmarks && Array.isArray(folder.bookmarks)) {
            for (const bookmark of folder.bookmarks) {
              try {
                await this.moveBookmark(bookmark.id, newFolder.id);
                stats.bookmarksMoved++;

                if (bookmark.newTitle && bookmark.newTitle !== bookmark.title) {
                  await this.updateBookmarkTitle(bookmark.id, bookmark.newTitle);
                  stats.titlesUpdated++;
                }
              } catch (error) {
                stats.errors.push(`处理书签 "${bookmark.title || bookmark.id}" 失败: ${error.message}`);
              }
            }
          }

          if (folder.children && Array.isArray(folder.children)) {
            for (const childFolder of folder.children) {
              await processFolder(childFolder, newFolder.id, currentPath);
            }
          }
        } catch (error) {
          stats.errors.push(`创建文件夹 "${folder.name}" 失败: ${error.message}`);
        }
      };

      for (const folder of plan.folders) {
        await processFolder(folder);
      }

      // 注：三阶段整理不再返回 unclassified，旧代码已移除

      if (plan.duplicates && Array.isArray(plan.duplicates)) {
        for (const duplicateId of plan.duplicates) {
          try {
            await this.removeBookmark(duplicateId);
            stats.duplicatesRemoved++;
          } catch (error) {
            stats.errors.push(`删除重复书签 "${duplicateId}" 失败: ${error.message}`);
          }
        }
      }

      await this.moveRemainingBookmarksToOtherFolder(stats);

      console.log('整理完成:', stats);
      return stats;

    } catch (error) {
      console.error('应用整理方案失败:', error);
      throw error;
    }
  }

  /**
   * Create a new folder
   * 创建新文件夹
   * @param {string} name - Folder name | 文件夹名称
   * @param {string} parentId - Parent folder ID | 父文件夹 ID
   * @returns {Promise<Object>} Created folder | 创建的文件夹
   */
  async createFolder(name, parentId = '1') {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.create({
        parentId: parentId,
        title: name
      }, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Move a bookmark to a new folder
   * 移动书签到新文件夹
   * @param {string} bookmarkId - Bookmark ID | 书签 ID
   * @param {string} parentId - Target folder ID | 目标文件夹 ID
   * @returns {Promise<Object>} Moved bookmark | 移动后的书签
   */
  async moveBookmark(bookmarkId, parentId) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.move(bookmarkId, {
        parentId: parentId
      }, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Update bookmark title
   * 更新书签标题
   * @param {string} bookmarkId - Bookmark ID | 书签 ID
   * @param {string} newTitle - New title | 新标题
   * @returns {Promise<Object>} Updated bookmark | 更新后的书签
   */
  async updateBookmarkTitle(bookmarkId, newTitle) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.update(bookmarkId, {
        title: newTitle
      }, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Remove a bookmark
   * 删除书签
   * @param {string} bookmarkId - Bookmark ID | 书签 ID
   * @returns {Promise<void>}
   */
  async removeBookmark(bookmarkId) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.remove(bookmarkId, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Remove a folder and all its contents
   * 删除文件夹及其所有内容
   * @param {string} folderId - Folder ID | 文件夹 ID
   * @returns {Promise<void>}
   */
  async removeFolder(folderId) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.removeTree(folderId, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Clean up folders created by previous organization
   * Move bookmarks to bookmarks bar first, then remove empty folders
   * 清理之前整理创建的文件夹，先把书签移回书签栏，再删除空文件夹
   * @returns {Promise<number>} Number of folders removed | 删除的文件夹数量
   */
  async cleanupPreviousOrganization() {
    const tree = await new Promise((resolve) => {
      chrome.bookmarks.getTree(resolve);
    });

    let removedCount = 0;
    const foldersToRemove = [];

    const findAICreatedFolders = (nodes, parentIsRoot = false) => {
      nodes.forEach(node => {
        if (!node.url && node.children) {
          const isRootLevel = parentIsRoot && node.parentId === '1';

          if (isRootLevel && !this.shouldPreserveFolder(node.title)) {
            foldersToRemove.push({
              id: node.id,
              title: node.title,
              children: node.children
            });
          }

          findAICreatedFolders(node.children, isRootLevel || node.id === '1');
        }
      });
    };

    findAICreatedFolders(tree);

    for (const folder of foldersToRemove) {
      try {
        const bookmarksToMove = [];
        const collectBookmarks = (nodes) => {
          nodes.forEach(node => {
            if (node.url) {
              bookmarksToMove.push(node.id);
            } else if (node.children) {
              collectBookmarks(node.children);
            }
          });
        };
        collectBookmarks(folder.children);

        for (const bookmarkId of bookmarksToMove) {
          try {
            await this.moveBookmark(bookmarkId, '1');
          } catch (error) {
            console.warn(`移动书签失败 ${bookmarkId}:`, error.message);
          }
        }

        await this.removeFolder(folder.id);
        removedCount++;
      } catch (error) {
        console.warn(`无法删除文件夹 ${folder.title}:`, error.message);
      }
    }

    console.log(`已清理 ${removedCount} 个旧文件夹`);
    return removedCount;
  }

  /**
   * Check if folder should be preserved (system folders)
   * 检查文件夹是否应该保留（系统文件夹）
   * @param {string} name - Folder name | 文件夹名称
   * @returns {boolean} Whether it should be preserved | 是否应该保留
   */
  shouldPreserveFolder(name) {
    const preservedFolders = ['书签栏', 'Bookmarks Bar', 'Favorites Bar', '收藏夹栏', '其他书签', 'Other Bookmarks', '移动端书签', 'Mobile Bookmarks', '未分类'];
    return preservedFolders.includes(name);
  }

  /**
   * Move remaining bookmarks in bookmarks bar to "Other" folder
   * 将书签栏中剩余的书签移入"其他"文件夹
   * @param {Object} stats - Statistics object to update | 统计对象
   */
  async moveRemainingBookmarksToOtherFolder(stats) {
    try {
      const bookmarksBar = await new Promise((resolve) => {
        chrome.bookmarks.getChildren('1', resolve);
      });

      const looseBookmarks = bookmarksBar.filter(node => node.url);

      if (looseBookmarks.length === 0) {
        return;
      }

      let otherFolder = bookmarksBar.find(node => !node.url && node.title === '其他');

      if (!otherFolder) {
        otherFolder = await this.createFolder('其他', '1');
        stats.foldersCreated++;
      }

      for (const bookmark of looseBookmarks) {
        try {
          await this.moveBookmark(bookmark.id, otherFolder.id);
          stats.bookmarksMoved++;
        } catch (error) {
          stats.errors.push(`移动剩余书签 "${bookmark.title}" 失败: ${error.message}`);
        }
      }

      console.log(`已将 ${looseBookmarks.length} 个剩余书签移入"其他"文件夹`);
    } catch (error) {
      console.error('处理剩余书签失败:', error);
    }
  }

  /**
   * Get bookmark statistics
   * 获取书签统计信息
   * @returns {Promise<Object>} Statistics | 统计信息
   */
  async getStatistics() {
    const bookmarks = await this.getAllBookmarks();
    
    const domains = {};
    bookmarks.forEach(bm => {
      try {
        const url = new URL(bm.url);
        domains[url.hostname] = (domains[url.hostname] || 0) + 1;
      } catch (e) {
        // Invalid URL, skip | 无效 URL，跳过
      }
    });

    return {
      totalBookmarks: bookmarks.length,
      uniqueDomains: Object.keys(domains).length,
      topDomains: Object.entries(domains)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    };
  }
}

// Export for use in other modules | 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BookmarkManager;
}
