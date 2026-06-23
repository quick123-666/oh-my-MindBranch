// ============== 持久化模块 ==============
// 使用 localStorage 自动保存/恢复思维导图数据
// 包含历史快照（用于撤销/重做）

(function () {
  const STORAGE_KEY_CURRENT = 'mindmap:current';
  const STORAGE_KEY_DOCS = 'mindmap:docs';
  const HISTORY_KEY = 'mindmap:history';
  const HISTORY_LIMIT = 50;
  const AUTOSAVE_DELAY = 600; // ms

  class Storage {
    constructor(mindmap) {
      this.mindmap = mindmap;
      this.autosaveTimer = null;
      this.history = [];   // 历史快照栈
      this.historyIndex = -1;  // 当前位置
      this.suppressHistory = false;

      this._setupAutoSave();
      this._setupHistoryTracking();
    }

    _setupAutoSave() {
      this.mindmap.onChange(() => {
        this._scheduleSave();
      });
    }

    _setupHistoryTracking() {
      // 数据变化时记录快照（debounce 合并连续操作）
      let lastSnapshot = null;
      this.mindmap.onChange(() => {
        if (this.suppressHistory) return;
        // 立即生成快照（简化处理：每次变化都生成）
        // 但删除/重做不应该记录太多
        this._pushHistory();
      });
    }

    _scheduleSave() {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = setTimeout(() => {
        this.save();
      }, AUTOSAVE_DELAY);
    }

    /**
     * 保存当前文档到 localStorage
     */
    save() {
      try {
        const data = this.mindmap.toJSON();
        // 添加视图状态（创建新对象，不修改 toJSON() 的返回值）
        const saveData = {
          ...data,
          view: {
            scale: this.mindmap._viewScale || 1,
            translateX: this.mindmap._viewX || 0,
            translateY: this.mindmap._viewY || 0,
            savedAt: Date.now()
          }
        };
        localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify(saveData));
        if (this._onSave) this._onSave(true);
        return true;
      } catch (err) {
        console.error('Save failed:', err);
        if (this._onSave) this._onSave(false, err);
        return false;
      }
    }

    /**
     * 从 localStorage 恢复当前文档
     */
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_CURRENT);
        if (!raw) return false;
        const data = JSON.parse(raw);
        this.mindmap.load(data);
        if (data.view) {
          this.mindmap._viewScale = data.view.scale;
          this.mindmap._viewX = data.view.translateX;
          this.mindmap._viewY = data.view.translateY;
        }
        return true;
      } catch (err) {
        console.error('Load failed:', err);
        return false;
      }
    }

    /**
     * 另存为命名文档
     */
    saveAsDoc(name) {
      const data = { ...this.mindmap.toJSON(), title: name };
      const docs = this._getDocs();
      docs[name] = data;
      localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(docs));
    }

    _getDocs() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY_DOCS) || '{}');
      } catch {
        return {};
      }
    }

    listDocs() {
      const docs = this._getDocs();
      return Object.entries(docs).map(([name, data]) => ({
        name,
        title: data.title || name,
        savedAt: data.view?.savedAt || 0
      }));
    }

    loadDoc(name) {
      const docs = this._getDocs();
      if (!docs[name]) return false;
      this.mindmap.load(docs[name]);
      return true;
    }

    deleteDoc(name) {
      const docs = this._getDocs();
      delete docs[name];
      localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(docs));
    }

    onSave(fn) {
      this._onSave = fn;
    }

    // ====== 撤销/重做 ======

    _pushHistory() {
      // 如果当前不是最新位置，丢弃后面的历史
      if (this.historyIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.historyIndex + 1);
      }
      const snapshot = JSON.stringify(this.mindmap.toJSON());
      // 避免重复快照
      if (this.history[this.history.length - 1] === snapshot) return;
      this.history.push(snapshot);
      // 限制历史大小
      if (this.history.length > HISTORY_LIMIT) {
        this.history.shift();
      }
      this.historyIndex = this.history.length - 1;
      if (this._onHistoryChange) this._onHistoryChange();
    }

    canUndo() { return this.historyIndex > 0; }
    canRedo() { return this.historyIndex < this.history.length - 1; }

    undo() {
      if (!this.canUndo()) return false;
      this.historyIndex--;
      this._restoreSnapshot(this.history[this.historyIndex]);
      return true;
    }

    redo() {
      if (!this.canRedo()) return false;
      this.historyIndex++;
      this._restoreSnapshot(this.history[this.historyIndex]);
      return true;
    }

    _restoreSnapshot(snapshot) {
      try {
        const data = JSON.parse(snapshot);
        this.suppressHistory = true;
        this.mindmap.load(data);
        this.suppressHistory = false;
        if (this._onHistoryChange) this._onHistoryChange();
        return true;
      } catch (err) {
        console.error('Restore failed:', err);
        this.suppressHistory = false;
        return false;
      }
    }

    onHistoryChange(fn) {
      this._onHistoryChange = fn;
    }

    clearHistory() {
      this.history = [];
      this.historyIndex = -1;
      if (this._onHistoryChange) this._onHistoryChange();
    }
  }

  window.MindMapStorage = Storage;
})();