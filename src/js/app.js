// ============== 思维导图应用主程序 ==============
// 负责：初始化所有模块、模板选择、工具栏、Markdown 编辑器、状态更新

(function () {

  class MindMapApp {
    constructor() {
      // 核心数据模型
      this.mindmap = new window.MindMap();
      // SVG 渲染器
      this.svgEl = document.getElementById('mindmapSvg');
      this.renderer = new window.MindMapRenderer(this.mindmap, this.svgEl);
      // 交互模块（拖拽、平移、缩放、键盘）
      this.interaction = new window.MindMapInteraction(this.mindmap, this.renderer, document.getElementById('canvasContainer'));
      // 持久化（含历史）
      this.storage = new window.MindMapStorage(this.mindmap);
      // Markdown 编辑状态
      this._mdBackup = null;
      this._statusTimer = null;

      // 初始化
      this._init();

      // 暴露到全局便于调试
      window.app = this;
    }

    _init() {
      this._setupTemplateModal();
      this._setupToolbar();
      this._setupMarkdownEditor();
      this._setupCallbacks();

      // 数据变化回调：重新布局与渲染，更新状态栏
      this.mindmap.onChange(() => {
        this._updateStatus();
      });

      // 优先尝试恢复本地存储的文档；若失败则显示模板选择
      const hasSaved = this.storage.load();
      if (hasSaved && this.mindmap.rootId) {
        this._relayoutAndRender();
      } else {
        // 没有本地文档 → 首次使用，显示模板选择
        this._showTemplateModal();
      }

      this._updateStatus();
      this._updateDocTitle();
    }

    // ====== 布局 + 渲染 ======
    _relayoutAndRender() {
      try {
        window.MindMapLayout.layoutLR(this.mindmap);
        this.renderer.render();
        // 恢复视图（如果有保存的视图状态）
        if (typeof this.mindmap._viewScale === 'number' && this.mindmap._viewScale !== 1) {
          this.renderer.setTransform(
            this.mindmap._viewScale,
            this.mindmap._viewX || 0,
            this.mindmap._viewY || 0
          );
        }
      } catch (e) {
        console.error('Layout/render failed:', e);
      }
    }

    // ====== 模板选择模态框 ======
    _setupTemplateModal() {
      this.templateModal = document.getElementById('templateModal');
      this.templateGrid = document.getElementById('templateGrid');
      this.modalCloseBtn = document.getElementById('modalClose');

      // 渲染模板网格
      if (this.templateGrid && window.MindMapTemplates) {
        this.templateGrid.innerHTML = '';
        window.MindMapTemplates.forEach(tpl => {
          const card = document.createElement('div');
          card.className = 'template-card';
          card.dataset.templateId = tpl.id;
          card.innerHTML = `
            <div class="template-icon">${tpl.icon || ''}</div>
            <div class="template-name">${tpl.name || ''}</div>
            <div class="template-desc">${tpl.description || ''}</div>
          `;
          card.addEventListener('click', () => {
            this._loadTemplate(tpl.id);
            this._hideTemplateModal();
          });
          this.templateGrid.appendChild(card);
        });
      }

      if (this.modalCloseBtn) {
        this.modalCloseBtn.addEventListener('click', () => this._hideTemplateModal());
      }

      // 点击遮罩关闭（点击 modal 本身而非内容）
      if (this.templateModal) {
        this.templateModal.addEventListener('click', (e) => {
          if (e.target === this.templateModal) this._hideTemplateModal();
        });
      }

      // Esc 关闭模板模态
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.templateModal && !this.templateModal.hidden) {
          // 如果没有打开 Markdown 面板，则关闭模板模态
          const mdPanel = document.getElementById('mdEditorPanel');
          if (!mdPanel || mdPanel.hidden) {
            this._hideTemplateModal();
          }
        }
      });
    }

    _showTemplateModal() {
      if (this.templateModal) this.templateModal.hidden = false;
    }

    _hideTemplateModal() {
      if (this.templateModal) this.templateModal.hidden = true;
    }

    _loadTemplate(templateId) {
      if (!window.MindMapTemplates) return;
      const tpl = window.MindMapTemplates.find(t => t.id === templateId);
      if (!tpl || typeof tpl.build !== 'function') return;
      try {
        const data = tpl.build();
        this.storage.clearHistory();
        this.mindmap.load(data);
        this._relayoutAndRender();
        this.renderer.fitToView();
        this._showStatus('已加载模板：' + (tpl.name || templateId), 1800);
        this._updateDocTitle();
      } catch (err) {
        console.error('Template load failed:', err);
        this._showStatus('模板加载失败', 2000);
      }
    }

    // ====== 工具栏按钮 ======
    _setupToolbar() {
      const byId = (id) => document.getElementById(id);

      // 新建：显示模板选择
      if (byId('btnNew')) byId('btnNew').addEventListener('click', () => this._showTemplateModal());
      // 模板：显示模板选择
      if (byId('btnTemplates')) byId('btnTemplates').addEventListener('click', () => this._showTemplateModal());

      // 打开 / 保存
      if (byId('btnOpen')) byId('btnOpen').addEventListener('click', () => this.actionOpen());
      if (byId('btnSave')) byId('btnSave').addEventListener('click', () => this.actionSave());

      // 导出下拉
      const exportBtn = byId('btnExport');
      const exportDropdown = byId('exportDropdown');
      if (exportBtn && exportDropdown) {
        exportBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          exportDropdown.hidden = !exportDropdown.hidden;
        });
        document.addEventListener('click', () => {
          exportDropdown.hidden = true;
        });
        // 菜单项
        const pngItem = byId('menuExportPng');
        const mdItem = byId('menuExportMd');
        if (pngItem) pngItem.addEventListener('click', (e) => { e.stopPropagation(); exportDropdown.hidden = true; this.actionExportPng(); });
        if (mdItem) mdItem.addEventListener('click', (e) => { e.stopPropagation(); exportDropdown.hidden = true; this.actionExportMarkdown(); });
      }

      // 撤销 / 重做
      if (byId('btnUndo')) byId('btnUndo').addEventListener('click', () => this.actionUndo());
      if (byId('btnRedo')) byId('btnRedo').addEventListener('click', () => this.actionRedo());

      // 布局
      if (byId('btnLayout')) byId('btnLayout').addEventListener('click', () => this.actionLayout());

      // 概览
      if (byId('btnOverview')) byId('btnOverview').addEventListener('click', () => this.actionOverview());

      // 放大 / 缩小 / 重置视图 / 适应画布
      if (byId('btnZoomIn')) byId('btnZoomIn').addEventListener('click', () => this.actionZoomIn());
      if (byId('btnZoomOut')) byId('btnZoomOut').addEventListener('click', () => this.actionZoomOut());
      if (byId('btnZoomReset')) byId('btnZoomReset').addEventListener('click', () => this.actionResetView());
      if (byId('btnFit')) byId('btnFit').addEventListener('click', () => this.actionFitToView());

      // 操作提示关闭 / 显示
      const hintClose = byId('hintClose');
      const hintToggle = byId('hintToggle');
      const canvasHint = byId('canvasHint');
      if (hintClose && canvasHint) {
        hintClose.addEventListener('click', () => {
          canvasHint.hidden = true;
          if (hintToggle) hintToggle.hidden = false;
        });
      }
      if (hintToggle && canvasHint) {
        hintToggle.addEventListener('click', () => {
          canvasHint.hidden = false;
          hintToggle.hidden = true;
        });
      }

      // 保存指示回调
      this.storage.onSave((ok) => {
        const el = byId('saveIndicator');
        if (!el) return;
        if (ok) {
          el.textContent = '已自动保存';
        } else {
          el.textContent = '保存失败';
        }
      });
    }

    _setupCallbacks() {
      // 交互结束后重新布局（例如拖拽节点）
      if (this.interaction && typeof this.interaction.onAfterDrag === 'function') {
        this.interaction.onAfterDrag(() => {
          // 拖拽节点后只重绘，不重新布局（尊重用户的拖拽结果）
          try { this.renderer.render(); } catch (e) {}
        });
      }
      if (this.interaction && typeof this.interaction.onZoomChange === 'function') {
        this.interaction.onZoomChange(() => this._updateStatus());
      }
      // 视口变换更新缩略图与状态
      if (this.renderer && typeof this.renderer.onTransformChange === 'function') {
        this.renderer.onTransformChange(() => {
          // 记录当前视图状态（用于恢复）
          this.mindmap._viewScale = this.renderer.scale;
          this.mindmap._viewX = this.renderer.translateX;
          this.mindmap._viewY = this.renderer.translateY;
          this._updateStatus();
        });
      }
      // 数据变化触发重布局与重绘
      this.mindmap.onChange(() => {
        try {
          window.MindMapLayout.layoutLR(this.mindmap);
          this.renderer.render();
        } catch (e) {}
        this._updateDocTitle();
      });

      // 右键菜单（绑定到节点上，使用 ContextMenu 类）
      if (typeof window.MindMapContextMenu === 'function') {
        this.contextMenu = new window.MindMapContextMenu(this.mindmap, this);
        if (typeof this.contextMenu.setupKeyboard === 'function') {
          this.contextMenu.setupKeyboard();
        }
      }

      // 全局快捷键（不与 textarea 冲突的）
      document.addEventListener('keydown', (e) => {
        // 如果焦点在可编辑元素里则不处理
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'TEXTAREA' || tag === 'INPUT') return;
        if (e.target && e.target.closest && e.target.closest('#mdEditorPanel')) return;

        // Ctrl+Z / Ctrl+Y
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          this.actionUndo();
        } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
          e.preventDefault();
          this.actionRedo();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          this.actionSave();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
          e.preventDefault();
          this.actionOpen();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
          e.preventDefault();
          this.actionLayout();
        } else if (e.key === 'F1') {
          e.preventDefault();
          this.actionFitToView();
        }
      });
    }

    // ====== 动作方法（供工具栏与右键菜单调用） ======
    actionOpen() {
      if (!window.mindmapIO) {
        // 延迟初始化一次
        window.mindmapIO = new window.MindMapExporter(this.mindmap, this.renderer);
      }
      this._showStatus('正在打开文件…', 1500);
      window.mindmapIO.openJSON().then(result => {
        if (result && result.success) {
          this.storage.clearHistory();
          this._relayoutAndRender();
          this.renderer.fitToView();
          this._updateDocTitle();
          this._updateStatus();
          this._showStatus('已打开：' + (this.mindmap.title || '未命名'), 2000);
        } else if (result && result.canceled) {
          // 用户取消
        } else {
          this._showStatus('打开失败：' + ((result && result.error) || '未知错误'), 2500);
        }
      }).catch(err => {
        this._showStatus('打开失败：' + err.message, 2500);
      });
    }

    actionSave() {
      if (!window.mindmapIO) {
        window.mindmapIO = new window.MindMapExporter(this.mindmap, this.renderer);
      }
      this._showStatus('正在保存…', 1200);
      window.mindmapIO.saveAsJSON().then(result => {
        if (result && result.success) {
          this.storage.save();
          this._showStatus('已保存', 1500);
        } else {
          this._showStatus('保存失败', 2000);
        }
      }).catch(err => {
        this._showStatus('保存失败：' + err.message, 2000);
      });
    }

    actionExportPng() {
      if (!window.mindmapIO) window.mindmapIO = new window.MindMapExporter(this.mindmap, this.renderer);
      this._showStatus('正在生成 PNG…', 1500);
      window.mindmapIO.saveAsPNG().then(result => {
        if (result && result.success) this._showStatus('已导出 PNG', 1500);
        else this._showStatus('导出 PNG 失败', 2000);
      }).catch(err => this._showStatus('导出失败：' + err.message, 2000));
    }

    actionExportMarkdown() {
      if (!window.mindmapIO) window.mindmapIO = new window.MindMapExporter(this.mindmap, this.renderer);
      this._showStatus('正在导出 Markdown…', 1500);
      window.mindmapIO.saveAsMarkdown().then(result => {
        if (result && result.success) this._showStatus('已导出 Markdown', 1500);
        else this._showStatus('导出 Markdown 失败', 2000);
      }).catch(err => this._showStatus('导出失败：' + err.message, 2000));
    }

    actionUndo() {
      if (!this.storage.canUndo()) {
        this._showStatus('没有可撤销的操作', 1200);
        return;
      }
      if (this.storage.undo()) {
        this._relayoutAndRender();
        this._showStatus('已撤销', 1200);
      }
    }

    actionRedo() {
      if (!this.storage.canRedo()) {
        this._showStatus('没有可重做的操作', 1200);
        return;
      }
      if (this.storage.redo()) {
        this._relayoutAndRender();
        this._showStatus('已重做', 1200);
      }
    }

    actionLayout() {
      this._relayoutAndRender();
      this._showStatus('已重新布局', 1200);
    }

    actionOverview() {
      // 折叠所有非根节点以提供概览；若已折叠则展开
      const nodes = this.mindmap.getAll();
      let anyExpandedChild = false;
      nodes.forEach(n => {
        if (n.id !== this.mindmap.rootId && !n.collapsed && n.children && n.children.length > 0) {
          anyExpandedChild = true;
        }
      });
      nodes.forEach(n => {
        if (n.id !== this.mindmap.rootId) n.collapsed = anyExpandedChild;
      });
      this.mindmap._emit('change', { type: 'overview' });
      this._showStatus(anyExpandedChild ? '已进入概览模式' : '已展开所有节点', 1500);
    }

    /**
     * 更新概览按钮的图标和文字（折叠/展开状态）
     */
    _updateOverviewButton() {
      const btn = document.getElementById('btnOverview');
      if (!btn) return;
      const icon = btn.querySelector('svg path');
      const label = btn.querySelector('span');
      if (this.overviewMode === null) {
        // 正常模式：显示"概览"图标
        if (icon) icon.setAttribute('d', 'M3,3H21V5H3V3M3,7H21V9H3V7M3,11H21V13H3V11M3,15H21V17H3V15M3,19H21V21H3V19Z');
        if (label) label.textContent = '概览';
        btn.title = '折叠所有分支（概览模式）';
        btn.classList.remove('active');
      } else {
        // 概览/焦点模式：显示"展开"图标
        if (icon) icon.setAttribute('d', 'M12,18.5L6,12.5L7.41,11.09L11,14.67V3H13V14.67L16.59,11.09L18,12.5L12,18.5Z');
        if (label) label.textContent = '展开';
        btn.title = '恢复全部节点';
        btn.classList.add('active');
      }
    }

    /**
     * 从 _expandSnapshot 恢复所有节点的折叠状态
     * 用于退出概览/聚焦模式时恢复原始展开
     */
    _restoreFromSnapshot() {
      if (this._expandSnapshot && this._expandSnapshot.length > 0) {
        // 先全部折叠
        this.mindmap.nodes.forEach((node, id) => {
          if (id !== this.mindmap.rootId) node.collapsed = true;
        });
        // 然后恢复原本展开的节点
        this._expandSnapshot.forEach(id => {
          const node = this.mindmap.get(id);
          if (node) node.collapsed = false;
        });
      } else {
        // 没有快照，展开所有
        this.mindmap.nodes.forEach((node, id) => {
          if (id !== this.mindmap.rootId) node.collapsed = false;
        });
      }
      this._expandSnapshot = null;
    }

    actionZoomIn() {
      this._zoomBy(1.2);
    }

    actionZoomOut() {
      this._zoomBy(1 / 1.2);
    }

    _zoomBy(factor) {
      const cur = this.renderer.scale || 1;
      const next = Math.max(0.2, Math.min(3, cur * factor));
      const w = this.svgEl.clientWidth || 800;
      const h = this.svgEl.clientHeight || 600;
      // 以画布中心为锚点缩放
      const cx = w / 2;
      const cy = h / 2;
      const newTx = cx - (cx - this.renderer.translateX) * (next / cur);
      const newTy = cy - (cy - this.renderer.translateY) * (next / cur);
      this.renderer.setTransform(next, newTx, newTy);
      this._updateStatus();
    }

    actionResetView() {
      this.renderer.setTransform(1, 0, 0);
      this._showStatus('已重置视图', 1200);
      this._updateStatus();
    }

    actionFitToView() {
      this.renderer.fitToView();
      this._showStatus('已适应画布', 1200);
      this._updateStatus();
    }

    actionFocus() {
      if (!this.mindmap.selectedId || this.mindmap.selectedId === this.mindmap.rootId) {
        this._showStatus('请先选择一个非根节点', 1500);
        return;
      }
      const selectedId = this.mindmap.selectedId;

      // 如果当前已经是 focus 模式且聚焦的是同一个节点 → 退出 focus
      if (this.overviewMode === 'focus' && this._focusedNodeId === selectedId) {
        this._restoreFromSnapshot();
        this.overviewMode = null;
        this._focusedNodeId = null;
        this.renderer.focusNodeId = null;
        MindMapLayout.layoutLR(this.mindmap);
        this.renderer.render();
        requestAnimationFrame(() => this.renderer.fitToView());
        this._updateOverviewButton();
        this._showStatus('已退出聚焦', 1500);
        return;
      }

      // 进入 focus 模式
      if (this.overviewMode === null) {
        // 保存当前展开状态
        this._expandSnapshot = [];
        this.mindmap.nodes.forEach((node, id) => {
          if (id !== this.mindmap.rootId && !node.collapsed) {
            this._expandSnapshot.push(id);
            node.collapsed = true;
          }
        });
      }
      // 让 focusId 及其所有后代都展开
      const focusDescendants = new Set();
      const walk = (id) => {
        focusDescendants.add(id);
        const node = this.mindmap.get(id);
        if (node) node.children.forEach(walk);
      };
      walk(selectedId);
      // 重新计算 focusDescendants（包括父链，确保路径上的节点都展开）
      const focusAncestors = new Set();
      let cur = this.mindmap.get(selectedId);
      while (cur && cur.parentId) {
        focusAncestors.add(cur.parentId);
        cur = this.mindmap.get(cur.parentId);
      }
      const focusPath = new Set([...focusDescendants, ...focusAncestors]);

      this.mindmap.nodes.forEach((node, id) => {
        if (id !== this.mindmap.rootId) {
          // focus 路径上的节点全部展开，其他全部折叠
          node.collapsed = !focusPath.has(id);
        }
      });
      this.overviewMode = 'focus';
      this._focusedNodeId = selectedId;
      this.renderer.focusNodeId = selectedId;
      MindMapLayout.layoutLR(this.mindmap);
      this.renderer.render();
      requestAnimationFrame(() => this.renderer.fitToView());
      this._updateOverviewButton();
      const focusNode = this.mindmap.get(selectedId);
      this._showStatus(`正在聚焦：${focusNode?.text || '节点'}（再次点击可退出）`, 2500);
    }

    // ====== Markdown 编辑器 ======
    _setupMarkdownEditor() {
      this.mdPanel = document.getElementById('mdEditorPanel');
      this.mdTextarea = document.getElementById('mdTextarea');
      this.mdLineNumbers = document.getElementById('mdLineNumbers');
      this.mdStatus = document.getElementById('mdStatus');
      this.mdApplyBtn = document.getElementById('mdApplyBtn');
      this.mdCancelBtn = document.getElementById('mdCancelBtn');
      this.mdSyncBtn = document.getElementById('mdSyncBtn');
      this.mdCloseBtn = document.getElementById('mdCloseBtn');
      this.modeToggle = document.getElementById('modeToggle');

      if (this.modeToggle) {
        this.modeToggle.addEventListener('click', () => {
          if (this.mdPanel && this.mdPanel.hidden) this.openMarkdownEditor();
          else this.closeMarkdownEditor();
        });
      }

      if (this.mdApplyBtn) this.mdApplyBtn.addEventListener('click', () => this._applyMarkdownToMindmap());
      if (this.mdCancelBtn) this.mdCancelBtn.addEventListener('click', () => this._cancelMarkdown());
      if (this.mdSyncBtn) this.mdSyncBtn.addEventListener('click', () => this._syncMindmapToMarkdown());
      if (this.mdCloseBtn) this.mdCloseBtn.addEventListener('click', () => this.closeMarkdownEditor());

      // 快捷键速查按钮（可点击插入式）
      this.mdShortcutBtn = document.getElementById('mdShortcutBtn');
      this.mdShortcutPanel = document.getElementById('mdShortcutPanel');
      this.mdShortcutClose = document.getElementById('mdShortcutClose');
      this.mdShortcutSearch = document.getElementById('mdShortcutSearch');
      this.mdShortcutBody = document.getElementById('mdShortcutBody');
      this._initShortcutPanel();
      if (this.mdShortcutBtn) {
        this.mdShortcutBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.mdShortcutPanel) {
            this.mdShortcutPanel.hidden = !this.mdShortcutPanel.hidden;
            if (!this.mdShortcutPanel.hidden) {
              setTimeout(() => this.mdShortcutSearch && this.mdShortcutSearch.focus(), 50);
            }
          }
        });
      }
      if (this.mdShortcutClose) {
        this.mdShortcutClose.addEventListener('click', () => {
          if (this.mdShortcutPanel) this.mdShortcutPanel.hidden = true;
        });
      }
      if (this.mdShortcutSearch) {
        this.mdShortcutSearch.addEventListener('input', () => this._renderShortcutItems());
      }
      // 点击其他位置关闭快捷键面板
      document.addEventListener('click', (e) => {
        if (!this.mdShortcutPanel || this.mdShortcutPanel.hidden) return;
        if (this.mdShortcutPanel.contains(e.target)) return;
        if (this.mdShortcutBtn && this.mdShortcutBtn.contains(e.target)) return;
        this.mdShortcutPanel.hidden = true;
      });

      if (this.mdTextarea) {
        // 输入时更新行号和状态
        this.mdTextarea.addEventListener('input', () => {
          this._updateLineNumbers();
          if (this.mdStatus) this.mdStatus.textContent = '已修改（Ctrl+S 应用，Esc 关闭）';
        });
        // 滚动同步行号
        this.mdTextarea.addEventListener('scroll', () => {
          if (this.mdLineNumbers) this.mdLineNumbers.scrollTop = this.mdTextarea.scrollTop;
        });
        // 键盘：标准 Markdown 编辑器快捷键（Typora/VS Code 风格）
        this.mdTextarea.addEventListener('keydown', (e) => {
          const isCtrl = e.ctrlKey || e.metaKey;

          // Ctrl+S 应用
          if (isCtrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            this._applyMarkdownToMindmap();
            return;
          }
          // Ctrl+F 打开快捷键面板
          if (isCtrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            if (this.mdShortcutPanel) {
              this.mdShortcutPanel.hidden = false;
              setTimeout(() => this.mdShortcutSearch && this.mdShortcutSearch.focus(), 50);
            }
            return;
          }
          // Esc 关闭
          if (e.key === 'Escape') {
            e.preventDefault();
            this.closeMarkdownEditor();
            return;
          }
          // Ctrl+B 加粗
          if (isCtrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            this._mdWrap('**', '**');
            return;
          }
          // Ctrl+I 斜体
          if (isCtrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'i') {
            e.preventDefault();
            this._mdWrap('*', '*');
            return;
          }
          // Ctrl+D 删除线
          if (isCtrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'd') {
            e.preventDefault();
            this._mdWrap('~~', '~~');
            return;
          }
          // Ctrl+E 行内代码
          if (isCtrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'e') {
            e.preventDefault();
            this._mdWrap('`', '`');
            return;
          }
          // Ctrl+K 链接
          if (isCtrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            this._mdInsertLink();
            return;
          }
          // Ctrl+1~6 标题
          if (isCtrl && !e.shiftKey && !e.altKey && /^[1-6]$/.test(e.key)) {
            e.preventDefault();
            this._mdSetHeading(parseInt(e.key, 10));
            return;
          }
          // Ctrl+0 清除标题
          if (isCtrl && !e.shiftKey && !e.altKey && e.key === '0') {
            e.preventDefault();
            this._mdSetHeading(0);
            return;
          }
          // Ctrl+Shift+7 有序列表
          if (isCtrl && e.shiftKey && !e.altKey && e.key === '7') {
            e.preventDefault();
            this._mdInsertList('1. ');
            return;
          }
          // Ctrl+Shift+8 无序列表
          if (isCtrl && e.shiftKey && !e.altKey && e.key === '8') {
            e.preventDefault();
            this._mdInsertList('- ');
            return;
          }
          // Ctrl+Shift+K 代码块
          if (isCtrl && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            this._mdWrap('```\n', '\n```');
            return;
          }
          // Ctrl+Shift+Q 引用
          if (isCtrl && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'q') {
            e.preventDefault();
            this._mdInsertPrefix('> ');
            return;
          }
          // Ctrl+/ 注释（在选区前后加 <!---->）
          if (isCtrl && !e.shiftKey && !e.altKey && e.key === '/') {
            e.preventDefault();
            this._mdWrap('<!-- ', ' -->');
            return;
          }
          // Ctrl+Z 撤销
          if (isCtrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            document.execCommand('undo');
            this._updateLineNumbers();
            return;
          }
          // Ctrl+Y 或 Ctrl+Shift+Z 重做
          if (isCtrl && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
            e.preventDefault();
            document.execCommand('redo');
            this._updateLineNumbers();
            return;
          }
          // Tab / Shift+Tab
          if (e.key === 'Tab') {
            e.preventDefault();
            const ta = this.mdTextarea;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const val = ta.value;
            if (start === end) {
              // 无选区：逐级缩进（每按一次 Tab 缩进 2 空格，到 6 空格循环）
              // 计算当前行起始
              const lineStart = val.lastIndexOf('\n', start - 1) + 1;
              // 计算当前行已有的缩进（连续空格数）
              let existingIndent = 0;
              for (let i = lineStart; i < val.length; i++) {
                if (val[i] === ' ') existingIndent++;
                else break;
              }
              // 计算光标在行内的列
              const colInLine = start - lineStart;

              if (e.shiftKey) {
                // Shift+Tab：减少一级缩进
                if (existingIndent >= 2) {
                  ta.value = val.substring(0, lineStart) + val.substring(lineStart + 2);
                  ta.selectionStart = ta.selectionEnd = Math.max(lineStart, start - 2);
                  ta.dispatchEvent(new Event('input', { bubbles: true }));
                } else if (existingIndent === 1) {
                  ta.value = val.substring(0, lineStart) + val.substring(lineStart + 1);
                  ta.selectionStart = ta.selectionEnd = Math.max(lineStart, start - 1);
                  ta.dispatchEvent(new Event('input', { bubbles: true }));
                }
              } else {
                // Tab：逐级缩进 0 → 2 → 4 → 6 → 0（循环）
                const levels = [0, 2, 4, 6];
                // 找到当前最接近的级别
                let currentLevel = 0;
                for (let i = 0; i < levels.length; i++) {
                  if (Math.abs(existingIndent - levels[i]) < Math.abs(existingIndent - levels[currentLevel])) {
                    currentLevel = i;
                  }
                }
                // 下一级
                const nextLevel = (currentLevel + 1) % levels.length;
                const targetIndent = levels[nextLevel];
                const diff = targetIndent - existingIndent;

                if (diff > 0) {
                  // 添加空格
                  const spaces = ' '.repeat(diff);
                  ta.value = val.substring(0, lineStart) + spaces + val.substring(lineStart);
                  ta.selectionStart = ta.selectionEnd = start + diff;
                } else if (diff < 0) {
                  // 删除空格
                  ta.value = val.substring(0, lineStart) + val.substring(lineStart - diff);
                  ta.selectionStart = ta.selectionEnd = Math.max(lineStart, start + diff);
                } else {
                  // 无变化（当前已是对齐到某个级别）
                  ta.selectionStart = ta.selectionEnd = start;
                }
                ta.dispatchEvent(new Event('input', { bubbles: true }));
              }
            } else {
              // 有选区：逐行缩进/取消缩进
              const lineStart = val.lastIndexOf('\n', start - 1) + 1;
              const before = val.slice(0, lineStart);
              const selected = val.slice(lineStart, end);
              const after = val.slice(end);
              let processed;
              if (e.shiftKey) {
                processed = selected.split('\n').map(line => {
                  if (line.startsWith('  ')) return line.slice(2);
                  if (line.startsWith('\t')) return line.slice(1);
                  return line;
                }).join('\n');
              } else {
                processed = selected.split('\n').map(line => '  ' + line).join('\n');
              }
              ta.value = before + processed + after;
              ta.selectionStart = lineStart;
              ta.selectionEnd = lineStart + processed.length;
            }
            this._updateLineNumbers();
            if (this.mdStatus) this.mdStatus.textContent = '已修改（Ctrl+S 应用，Esc 关闭）';
            return;
          }
          // Enter 智能续行
          if (e.key === 'Enter' && !e.shiftKey) {
            const ta = this.mdTextarea;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const val = ta.value;
            // 取当前行
            const lineStartIdx = val.lastIndexOf('\n', start - 1) + 1;
            const curLine = val.slice(lineStartIdx, start);
            const lineAfter = val.slice(start, val.indexOf('\n', start) === -1 ? val.length : val.indexOf('\n', start));
            // 只对简单情况续行：当光标在行尾或在整行中间
            const match = curLine.match(/^(\s*)([•\-*+]|\d+\.)(\s+)(.*)$/);
            const headingMatch = curLine.match(/^(#+)\s+(.*)$/);
            if (headingMatch) {
              // 标题行：不延续标题前缀，普通换行
              // 保持空白，但不重复 # 前缀
              e.preventDefault();
              ta.value = val.slice(0, start) + '\n' + val.slice(end);
              ta.selectionStart = ta.selectionEnd = start + 1;
              this._updateLineNumbers();
              return;
            }
            if (match) {
              e.preventDefault();
              const indent = match[1];
              const marker = match[2];
              const middle = match[3] || ' ';
              const rest = match[4] || '';
              // 如果列表项文本为空（未输入内容），按 Enter 则退格降级
              if (rest.trim() === '' && (lineAfter === '' || !lineAfter)) {
                // 取消当前列表标记：将整行变为前一级缩进
                const newLine = indent.length >= 2 ? indent.slice(0, -2) : '';
                // 用一个空行替代当前空列表项（保留缩进的"上一级"）
                ta.value = val.slice(0, lineStartIdx) + (indent.length >= 2 ? indent.slice(0, -2) : '') + val.slice(start);
                ta.selectionStart = ta.selectionEnd = lineStartIdx + (indent.length >= 2 ? indent.length - 2 : 0);
                this._updateLineNumbers();
                return;
              }
              // 否则：延续相同前缀（对数字标记重置为数字+1，对符号保持相同）
              let newMarker = marker;
              if (/^\d+\.$/.test(marker)) {
                const n = parseInt(marker, 10);
                newMarker = (n + 1) + '.';
              }
              const insertStr = '\n' + indent + newMarker + middle;
              ta.value = val.slice(0, start) + insertStr + val.slice(end);
              ta.selectionStart = ta.selectionEnd = start + insertStr.length;
              this._updateLineNumbers();
              return;
            }
            // 普通 Enter：默认行为
          }
        });
      }
    }

    openMarkdownEditor() {
      // 打开编辑器：从导图生成 Markdown + 备份
      if (window.MindMapMarkdown && typeof window.MindMapMarkdown.mindmapToMarkdown === 'function') {
        const md = window.MindMapMarkdown.mindmapToMarkdown(this.mindmap);
        this._setTextareaValue(md || '');
      }
      // 备份当前导图状态（用于"取消"）
      try {
        this._mdBackup = JSON.stringify(this.mindmap.toJSON());
      } catch (e) {
        this._mdBackup = null;
      }
      if (this.mdPanel) this.mdPanel.hidden = false;
      this._updateLineNumbers();
      if (this.mdStatus) this.mdStatus.textContent = '同步自思维导图（编辑后 Ctrl+S 应用）';
      setTimeout(() => {
        if (this.mdTextarea) {
          try { this.mdTextarea.focus(); } catch (e) {}
        }
      }, 30);
    }

    closeMarkdownEditor() {
      if (this.mdPanel) this.mdPanel.hidden = true;
    }

    _cancelMarkdown() {
      // 从备份恢复导图
      if (this._mdBackup) {
        try {
          const data = JSON.parse(this._mdBackup);
          this.storage.suppressHistory = true;
          this.mindmap.load(data);
          this.storage.suppressHistory = false;
          this._relayoutAndRender();
          this._updateStatus();
        } catch (e) {
          console.error('Restore from md backup failed:', e);
        }
      }
      this._mdBackup = null;
      this.closeMarkdownEditor();
      this._showStatus('已取消 Markdown 编辑', 1500);
    }

    _applyMarkdownToMindmap() {
      const text = this._getTextareaValue();
      if (!text || !text.trim()) {
        this._showStatus('Markdown 内容为空', 1500);
        return;
      }
      try {
        if (!window.MindMapMarkdown || typeof window.MindMapMarkdown.markdownToMindmap !== 'function') {
          throw new Error('Markdown 模块未加载');
        }
        const data = window.MindMapMarkdown.markdownToMindmap(text);
        if (!data || !data.rootId || !Array.isArray(data.nodes) || data.nodes.length === 0) {
          throw new Error('解析结果为空');
        }
        this.storage.suppressHistory = true;
        this.mindmap.load(data);
        this.storage.suppressHistory = false;
        this._relayoutAndRender();
        this.renderer.fitToView();
        this._updateStatus();
        this._updateDocTitle();
        if (this.mdStatus) this.mdStatus.textContent = '已应用到思维导图（' + data.nodes.length + ' 个节点）';
        this._showStatus('已将 Markdown 应用到思维导图', 1800);
      } catch (err) {
        console.error('Apply markdown failed:', err);
        this._showStatus('解析失败：' + (err.message || '未知错误'), 3000);
      }
    }

    _syncMindmapToMarkdown() {
      if (!window.MindMapMarkdown) return;
      try {
        const md = window.MindMapMarkdown.mindmapToMarkdown(this.mindmap);
        this._setTextareaValue(md || '');
        // 重新备份（同步后以当前导图为基准）
        this._mdBackup = JSON.stringify(this.mindmap.toJSON());
        if (this.mdStatus) this.mdStatus.textContent = '已从思维导图同步';
        this._showStatus('已从思维导图同步最新内容', 1500);
      } catch (e) {
        console.error('Sync markdown failed:', e);
      }
    }

    _updateLineNumbers() {
      if (!this.mdLineNumbers || !this.mdTextarea) return;
      const text = this.mdTextarea.value || '';
      const lines = text.split('\n').length;
      let html = '';
      for (let i = 1; i <= lines; i++) html += i + '\n';
      this.mdLineNumbers.textContent = html;
    }

    _getTextareaValue() {
      return this.mdTextarea ? this.mdTextarea.value : '';
    }

    _setTextareaValue(val) {
      if (!this.mdTextarea) return;
      this.mdTextarea.value = val || '';
      this._updateLineNumbers();
    }

    // ====== 状态栏 & 标题 ======
    _showStatus(msg, duration) {
      const modeEl = document.getElementById('statusMode');
      if (!modeEl) return;
      modeEl.textContent = msg || '';
      if (this._statusTimer) {
        clearTimeout(this._statusTimer);
        this._statusTimer = null;
      }
      if (duration && duration > 0) {
        this._statusTimer = setTimeout(() => {
          this._updateStatus();
          this._statusTimer = null;
        }, duration);
      }
    }

    /**
     * Markdown 快捷键数据（可点击插入）
     */
    _mdShortcuts = [
      { category: '格式', keys: 'Ctrl + B', name: '加粗', desc: '重要文本 **', keywords: 'bold 加粗 b strong' },
      { category: '格式', keys: 'Ctrl + I', name: '斜体', desc: '强调文本 *', keywords: 'italic 斜体 i em' },
      { category: '格式', keys: 'Ctrl + D', name: '删除线', desc: '已删除 ~~', keywords: 'strike 删除线 d' },
      { category: '格式', keys: 'Ctrl + E', name: '行内代码', desc: '代码片段 `', keywords: 'code 代码 e inline' },
      { category: '格式', keys: 'Ctrl + K', name: '插入链接', desc: '超链接 [text](url)', keywords: 'link 链接 k url' },
      { category: '格式', keys: 'Ctrl + Shift + K', name: '代码块', desc: '多行代码 ```', keywords: 'block 代码块 块' },
      { category: '格式', keys: 'Ctrl + Shift + Q', name: '引用', desc: '引用块 >', keywords: 'quote 引用 q blockquote' },
      { category: '标题', keys: 'Ctrl + 1', name: '一级标题', desc: '# 标题', keywords: 'h1 一级 标题 1' },
      { category: '标题', keys: 'Ctrl + 2', name: '二级标题', desc: '## 标题', keywords: 'h2 二级 标题 2' },
      { category: '标题', keys: 'Ctrl + 3', name: '三级标题', desc: '### 标题', keywords: 'h3 三级 标题 3' },
      { category: '标题', keys: 'Ctrl + 4', name: '四级标题', desc: '#### 标题', keywords: 'h4 四级 标题 4' },
      { category: '标题', keys: 'Ctrl + 5', name: '五级标题', desc: '##### 标题', keywords: 'h5 五级 标题 5' },
      { category: '标题', keys: 'Ctrl + 6', name: '六级标题', desc: '###### 标题', keywords: 'h6 六级 标题 6' },
      { category: '标题', keys: 'Ctrl + 0', name: '清除标题', desc: '转为正文', keywords: 'clear 清除 0 normal' },
      { category: '列表', keys: 'Ctrl + Shift + 7', name: '有序列表', desc: '1. 项目', keywords: 'ol 有序 ordered 7' },
      { category: '列表', keys: 'Ctrl + Shift + 8', name: '无序列表', desc: '- 项目', keywords: 'ul 无序 bullet 8' },
      { category: '列表', keys: 'Tab', name: '缩进', desc: '增加缩进 2 空格', keywords: 'tab 缩进 indent' },
      { category: '列表', keys: 'Shift + Tab', name: '反缩进', desc: '减少缩进 2 空格', keywords: 'shift 反缩进 outdent' },
      { category: '编辑', keys: 'Ctrl + Z', name: '撤销', desc: '撤销上一步', keywords: 'undo 撤销 z' },
      { category: '编辑', keys: 'Ctrl + Y', name: '重做', desc: '重做下一步', keywords: 'redo 重做 y' },
      { category: '编辑', keys: 'Ctrl + S', name: '应用', desc: '应用到思维导图', keywords: 'save apply 应用 s' },
      { category: '编辑', keys: 'Esc', name: '关闭', desc: '关闭编辑器', keywords: 'close esc 关闭' },
      { category: '编辑', keys: 'Ctrl + F', name: '显示快捷键', desc: '显示此面板', keywords: 'help f 快捷键 帮助' },
    ];

    _initShortcutPanel() {
      this._renderShortcutItems();
    }

    _renderShortcutItems() {
      if (!this.mdShortcutBody) return;
      const keyword = (this.mdShortcutSearch && this.mdShortcutSearch.value || '').toLowerCase().trim();
      const items = keyword
        ? this._mdShortcuts.filter(s =>
            s.name.toLowerCase().includes(keyword) ||
            s.desc.toLowerCase().includes(keyword) ||
            s.category.toLowerCase().includes(keyword) ||
            s.keys.toLowerCase().includes(keyword) ||
            s.keywords.toLowerCase().includes(keyword))
        : this._mdShortcuts;

      if (items.length === 0) {
        this.mdShortcutBody.innerHTML = '<div class="md-shortcut-empty">没有找到匹配的快捷键<br>试试：加粗、标题、撤销</div>';
        return;
      }

      // 按分类分组
      const groups = {};
      items.forEach(s => {
        if (!groups[s.category]) groups[s.category] = [];
        groups[s.category].push(s);
      });

      const html = Object.entries(groups).map(([cat, list]) => `
        <div class="md-shortcut-category">
          <div class="md-shortcat-title">${cat}</div>
          ${list.map(s => `
            <div class="md-shortcut-item" title="${this._escapeHtml(s.desc)}">
              <div class="md-shortcut-info">
                <div class="md-shortcut-name">${this._escapeHtml(s.name)}</div>
                <div class="md-shortcut-desc">${this._escapeHtml(s.desc)}</div>
              </div>
              <div class="md-shortcut-keys">${this._formatKeys(s.keys)}</div>
            </div>
          `).join('')}
        </div>
      `).join('');

      this.mdShortcutBody.innerHTML = html;
    }

    /**
     * 格式化键盘按键显示（Ctrl + B → Ctrl + B 样式）
     */
    _formatKeys(keys) {
      return keys.split('+').map(k => `<kbd>${this._escapeHtml(k.trim())}</kbd>`).join(' + ');
    }

    _highlightCursor(snippet) {
      return snippet.replace(/\|/g, '<span class="md-cursor-marker">│</span>');
    }

    _insertSnippet(snippet) {
      if (!this.mdTextarea) return;
      const cursorPos = snippet.indexOf('|');
      const insertText = snippet.replace(/\|/g, '');
      const cursorOffset = cursorPos >= 0 ? cursorPos : insertText.length;

      this.mdTextarea.focus();
      const success = document.execCommand('insertText', false, insertText);
      if (!success) {
        const el = this.mdTextarea;
        if (el.tagName === 'TEXTAREA') {
          const start = el.selectionStart || 0;
          const end = el.selectionEnd || 0;
          el.value = el.value.substring(0, start) + insertText + el.value.substring(end);
          el.selectionStart = el.selectionEnd = start + cursorOffset;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          const sel = window.getSelection();
          if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const textNode = document.createTextNode(insertText);
            range.insertNode(textNode);
            range.setStart(textNode, cursorOffset);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      }
    }

    _escapeHtml(text) {
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    // ===== Markdown 编辑辅助方法 =====

    /**
     * 在选区或光标处包裹前缀和后缀（加粗、斜体、代码等）
     * @param {string} before 前缀
     * @param {string} after 后缀
     */
    _mdWrap(before, after) {
      if (!this.mdTextarea) return;
      this.mdTextarea.focus();
      const el = this.mdTextarea;
      if (el.tagName === 'TEXTAREA') {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const val = el.value;
        const selected = val.substring(start, end);
        const replacement = before + (selected || '文本') + after;
        el.value = val.substring(0, start) + replacement + val.substring(end);
        // 选中新插入的"文本"部分
        const selStart = start + before.length;
        const selEnd = selStart + (selected ? selected.length : 2);
        el.selectionStart = selStart;
        el.selectionEnd = selEnd;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        document.execCommand('insertText', false, before + after);
        // 移动光标到中间
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          range.setStart(range.startContainer, before.length);
          range.collapse(true);
        }
      }
    }

    /**
     * 插入链接 [text](url)
     */
    _mdInsertLink() {
      if (!this.mdTextarea) return;
      this.mdTextarea.focus();
      const el = this.mdTextarea;
      if (el.tagName === 'TEXTAREA') {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const val = el.value;
        const selected = val.substring(start, end);
        const text = selected || '链接文本';
        const replacement = `[${text}](https://)`;
        el.value = val.substring(0, start) + replacement + val.substring(end);
        // 选中 URL 部分以便立即输入
        const urlStart = start + text.length + 3; // [text](
        const urlEnd = urlStart + 8; // "https://"
        el.selectionStart = urlStart;
        el.selectionEnd = urlEnd;
        el.focus();
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        document.execCommand('insertText', false, '[链接文本](https://)');
      }
    }

    /**
     * 设置当前行为 1-6 级标题（0 = 清除）
     */
    _mdSetHeading(level) {
      if (!this.mdTextarea) return;
      this.mdTextarea.focus();
      const el = this.mdTextarea;
      if (el.tagName === 'TEXTAREA') {
        const start = el.selectionStart;
        // 找到当前行起始
        const val = el.value;
        const lineStart = val.lastIndexOf('\n', start - 1) + 1;
        // 找到当前行结束
        let lineEnd = val.indexOf('\n', start);
        if (lineEnd === -1) lineEnd = val.length;
        // 找到行首的 # 前缀
        const line = val.substring(lineStart, lineEnd);
        const match = line.match(/^(#{1,6})\s+(.*)$/);
        let content;
        if (match) {
          content = match[2];
        } else {
          content = line.replace(/^\s+/, '');
        }
        const prefix = level === 0 ? '' : '#'.repeat(level) + ' ';
        const newLine = prefix + content;
        el.value = val.substring(0, lineStart) + newLine + val.substring(lineEnd);
        el.selectionStart = el.selectionEnd = lineStart + newLine.length;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    /**
     * 插入列表（有序/无序）
     */
    _mdInsertList(prefix) {
      if (!this.mdTextarea) return;
      this.mdTextarea.focus();
      const el = this.mdTextarea;
      if (el.tagName === 'TEXTAREA') {
        const start = el.selectionStart;
        const val = el.value;
        // 当前行
        const lineStart = val.lastIndexOf('\n', start - 1) + 1;
        // 找到行首空白
        const lineMatch = val.substring(lineStart, start).match(/^(\s*)/);
        const indent = lineMatch ? lineMatch[1] : '';
        const insertText = indent + prefix;
        el.value = val.substring(0, start) + insertText + val.substring(start);
        el.selectionStart = el.selectionEnd = start + insertText.length;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    /**
     * 在当前行添加前缀（如引用 "> "）
     */
    _mdInsertPrefix(prefix) {
      if (!this.mdTextarea) return;
      this.mdTextarea.focus();
      const el = this.mdTextarea;
      if (el.tagName === 'TEXTAREA') {
        const start = el.selectionStart;
        const val = el.value;
        const lineStart = val.lastIndexOf('\n', start - 1) + 1;
        const insertText = prefix;
        el.value = val.substring(0, lineStart) + insertText + val.substring(lineStart);
        el.selectionStart = el.selectionEnd = start + insertText.length;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    _updateStatus() {
      const nodesEl = document.getElementById('statusNodes');
      const zoomEl = document.getElementById('statusZoom');
      const modeEl = document.getElementById('statusMode');
      const timeEl = document.getElementById('statusTime');
      if (nodesEl) {
        const total = this.mindmap && this.mindmap.getAll ? this.mindmap.getAll().length : 0;
        nodesEl.textContent = '节点：' + total;
      }
      if (zoomEl) {
        const s = this.renderer && typeof this.renderer.scale === 'number' ? this.renderer.scale : 1;
        zoomEl.textContent = '缩放：' + Math.round(s * 100) + '%';
      }
      if (modeEl) {
        if (!modeEl.textContent || modeEl.textContent === '') modeEl.textContent = '就绪';
      }
      if (timeEl) {
        const now = new Date();
        const pad = (n) => n < 10 ? '0' + n : '' + n;
        timeEl.textContent = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
      }
    }

    _updateDocTitle() {
      const nameEl = document.getElementById('docName');
      if (nameEl) nameEl.textContent = this.mindmap.title || '未命名';
    }
  }

  // 启动应用
  const app = new MindMapApp();

})();
