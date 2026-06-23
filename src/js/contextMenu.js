// ============== 右键菜单模块 ==============
// 提供节点上和空白处的右键菜单

(function () {
  // 通用 SVG 图标库
  const ICONS = {
    edit: '<svg viewBox="0 0 24 24"><path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/></svg>',
    addChild: '<svg viewBox="0 0 24 24"><path d="M11,13H5V11H11V5H13V11H19V13H13V19H11V13M17,3H7C5.89,3 5,3.89 5,5V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V5C19,3.89 18.1,3 17,3Z"/></svg>',
    addSibling: '<svg viewBox="0 0 24 24"><path d="M11,3H13V11H21V13H13V21H11V13H3V11H11V3M17,3H19V5H17V3M19,7V9H17V7H19M19,11V13H17V11H19M19,15V17H17V15H19Z"/></svg>',
    collapse: '<svg viewBox="0 0 24 24"><path d="M19,13H5V11H19V13Z"/></svg>',
    expand: '<svg viewBox="0 0 24 24"><path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/></svg>',
    cut: '<svg viewBox="0 0 24 24"><path d="M19,3L13,9L15,11L22,4V3M12,12.5A1.5,1.5 0 0,1 13.5,14A1.5,1.5 0 0,1 12,15.5A1.5,1.5 0 0,1 10.5,14A1.5,1.5 0 0,1 12,12.5M9.8,8.9L7,11.2L11.6,16L14.4,13.2L9.8,8.9M9.8,5.4L14.4,9.9L17.6,6.7L19,8.1L15.8,11.3L19,14.5L17.6,15.9L14.4,12.7L9.8,17.5L2.4,10.1L9.8,2.7L11.2,4.1L7.4,7.9L11.2,11.7L9.8,13.1L5.9,9.3L4.5,10.7L9.8,15.9L13,12.7L9.8,5.4Z"/></svg>',
    paste: '<svg viewBox="0 0 24 24"><path d="M19,2H14.82C14.4,0.84 13.3,0 12,0C10.7,0 9.6,0.84 9.18,2H5A2,2 0 0,0 3,4V20A2,2 0 0,0 5,22H19A2,2 0 0,0 21,20V4A2,2 0 0,0 19,2M12,2A1,1 0 0,1 13,3A1,1 0 0,1 12,4A1,1 0 0,1 11,3A1,1 0 0,1 12,2M19,20H5V4H7V7H17V4H19V20Z"/></svg>',
    delete: '<svg viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>',
    color: '<svg viewBox="0 0 24 24"><path d="M12,3A9,9 0 0,0 3,12C3,16.97 7.03,21 12,21A1.5,1.5 0 0,0 13.5,19.5C13.5,19.11 13.35,18.76 13.11,18.5C12.88,18.23 12.73,17.88 12.73,17.5A1.5,1.5 0 0,1 14.23,16H16A5,5 0 0,0 21,11C21,6.58 16.97,3 12,3M6.5,12C5.67,12 5,11.33 5,10.5C5,9.67 5.67,9 6.5,9C7.33,9 8,9.67 8,10.5C8,11.33 7.33,12 6.5,12M9.5,8C8.67,8 8,7.33 8,6.5C8,5.67 8.67,5 9.5,5C10.33,5 11,5.67 11,6.5C11,7.33 10.33,8 9.5,8M14.5,8C13.67,8 13,7.33 13,6.5C13,5.67 13.67,5 14.5,5C15.33,5 16,5.67 16,6.5C16,7.33 15.33,8 14.5,8M17.5,12C16.67,12 16,11.33 16,10.5C16,9.67 16.67,9 17.5,9C18.33,9 19,9.67 19,10.5C19,11.33 18.33,12 17.5,12Z"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M12.5,8C9.85,8 7.45,8.99 5.6,10.6L2,7V16H11L7.38,12.38C8.77,11.22 10.54,10.5 12.5,10.5C16.04,10.5 19.05,12.81 20.1,16L22.47,15.22C21.08,11.03 17.15,8 12.5,8Z"/></svg>',
    redo: '<svg viewBox="0 0 24 24"><path d="M18.4,10.6C16.55,8.99 14.15,8 11.5,8C6.85,8 2.92,11.03 1.53,15.22L3.9,16C4.95,12.81 7.96,10.5 11.5,10.5C13.46,10.5 15.23,11.22 16.62,12.38L13,16H22V7L18.4,10.6Z"/></svg>',
    layout: '<svg viewBox="0 0 24 24"><path d="M13,2V11H21V13H13V22H11V13H3V11H11V2H13Z"/></svg>',
    fit: '<svg viewBox="0 0 24 24"><path d="M9,3V5H7V3H9M11,3V5H13V3H11M15,3V5H17V3H15M19,5V7H21V5H19M19,9V11H21V9H19M19,13V15H21V13H19M19,17V19H21V17H19M17,19V21H15V19H17M13,19V21H11V19H13M9,19V21H7V19H9M5,19V17H3V19H5M5,13V15H3V13H5M5,9V11H3V9H5M5,5V7H3V5H5M9,5V7H7V5H9M13,5V7H11V5H13M17,5V7H15V5H17Z"/></svg>',
    moveUp: '<svg viewBox="0 0 24 24"><path d="M7,14L12,9L17,14H7M7,5H17L12,10L7,5Z"/></svg>',
    moveDown: '<svg viewBox="0 0 24 24"><path d="M7,10L12,15L17,10H7M7,19H17L12,14L7,19Z"/></svg>',
    moveTop: '<svg viewBox="0 0 24 24"><path d="M13,20H11V8L5.5,13.5L4.08,12.08L12,4.16L19.92,12.08L18.5,13.5L13,8V20Z"/></svg>',
    moveBottom: '<svg viewBox="0 0 24 24"><path d="M11,4H13V16L18.5,10.5L19.92,11.92L12,19.84L4.08,11.92L5.5,10.5L11,16V4Z"/></svg>',
    fontSize: '<svg viewBox="0 0 24 24"><path d="M9,3V5H11V19H9V21H15V19H13V5H15V3H9M16,3V5H18V19H16V21H22V19H20V5H22V3H16Z"/></svg>',
    fontColor: '<svg viewBox="0 0 24 24"><path d="M20,18H22V20H20V18M20,13H22V15H20V13M18,20H20V22H18V20M18,11H20V13H18V11M16,20H18V22H16V20M16,18H18V20H16V18M14,20H16V22H14V20M16,16H18V18H16V16M16,8H18V10H16V8M14,16H16V18H14V16M14,10H16V12H14V10M11,4H13V6H11V4M9,4H11V6H9V4M7,4H9V6H7V4M5,13H7V15H5V13M5,11H7V13H5V11M5,9H7V11H5V9M5,7H7V9H5V7M5,5H7V7H5V5M5,17H7V19H5V17M11,13H13V15H11V13M11,11H13V13H11V11M11,9H13V11H11V9M11,7H13V9H11V7M13,5H15V7H13V5M13,3H15V5H13V3M11,5H13V7H11V5M9,7H11V9H9V7M9,9H11V11H9V9M9,11H11V13H9V11M9,13H11V15H9V13M9,15H11V17H9V15M7,15H9V17H7V15M7,17H9V19H7V17Z"/></svg>',
    fontFamily: '<svg viewBox="0 0 24 24"><path d="M5,3V5H7V19H5V21H11V19H9V13H11L13,21H17L13,3H5M9,5H11L12,11H9V5M17,3V5H19V19H17V21H23V19H21V5H23V3H17Z"/></svg>',
    reset: '<svg viewBox="0 0 24 24"><path d="M12,4V1L8,5L12,9V6A6,6 0 0,1 18,12C18,13.57 17.4,15 16.42,16.06L17.84,17.5C19.18,16.05 20,14.12 20,12A8,8 0 0,0 12,4M12,18A6,6 0 0,1 6,12C6,10.43 6.6,9 7.58,7.94L6.16,6.5C4.82,7.95 4,9.88 4,12A8,8 0 0,0 12,20V23L16,19L12,15V18Z"/></svg>',
    focus: '<svg viewBox="0 0 24 24"><path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/></svg>',
    iconCollapse: '<svg viewBox="0 0 24 24"><path d="M19.5,3.5L18,2L16.5,3.5L15,2L13.5,3.5L12,2L10.5,3.5L9,2L7.5,3.5L6,2V22L7.5,20.5L9,22L10.5,20.5L12,22L13.5,20.5L15,22L16.5,20.5L18,22L19.5,20.5L21,22V2L19.5,3.5M19,19.5L17.5,18L16,19.5L14.5,18L13,19.5L11.5,18L10,19.5L8.5,18L7,19.5V4.5L8.5,6L10,4.5L11.5,6L13,4.5L14.5,6L16,4.5L17.5,6L19,4.5V19.5Z"/></svg>'
  };

  class ContextMenu {
    constructor(mindmap, app) {
      this.mindmap = mindmap;
      this.app = app; // 引用 App 实例以调用其方法
      this.menu = document.getElementById('contextMenu');
      this.clipboard = null; // 剪贴板（仅用于复制粘贴）
      this.cutMode = false;  // 剪切标记
      this._setupEvents();
    }

    _setupEvents() {
      // 点击其它位置关闭菜单
      document.addEventListener('click', (e) => {
        if (!this.menu.contains(e.target)) {
          this.hide();
        }
      });

      // 滚动时关闭菜单
      document.addEventListener('scroll', () => this.hide(), true);

      // 窗口大小变化时关闭
      window.addEventListener('resize', () => this.hide());

      // 右键事件 - 在画布上
      document.getElementById('canvasContainer').addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const nodeEl = e.target.closest('.node');
        if (nodeEl) {
          // 节点上的右键
          const id = nodeEl.dataset.nodeId;
          this.mindmap.select(id);
          this.showNodeMenu(id, e.clientX, e.clientY);
        } else {
          // 空白处的右键
          this.showCanvasMenu(e.clientX, e.clientY);
        }
      });

      // Esc 关闭
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !this.menu.hidden) {
          this.hide();
        }
      });
    }

    /**
     * 显示节点上的右键菜单
     */
    showNodeMenu(nodeId, x, y) {
      const node = this.mindmap.get(nodeId);
      if (!node) return;
      const isRoot = nodeId === this.mindmap.rootId;
      const hasChildren = node.children.length > 0;
      const canPaste = this.clipboard !== null;
      const pos = this.mindmap.getSiblingPosition(nodeId);
      const hasSiblings = pos && pos.total > 1;

      const items = [
        { icon: ICONS.edit, label: '编辑', shortcut: 'F2', action: () => this.app._startEdit?.(nodeId) || this.app.interaction._startEdit(nodeId) },
        { divider: true },
        { icon: ICONS.addChild, label: '添加子节点', shortcut: 'Tab', action: () => this.mindmap.addChild(nodeId, '新节点') },
        { icon: ICONS.addSibling, label: '添加兄弟节点', shortcut: 'Enter', disabled: isRoot, action: () => this.mindmap.addSibling(nodeId, '新节点') },
        { divider: true },
        {
          icon: node.collapsed ? ICONS.expand : ICONS.collapse,
          label: node.collapsed ? '展开子节点' : '折叠子节点',
          shortcut: 'Space',
          disabled: !hasChildren,
          action: () => this.mindmap.toggleCollapse(nodeId)
        },
        {
          icon: node.collapsedToIcon ? ICONS.expand : ICONS.iconCollapse,
          label: node.collapsedToIcon ? '展开节点' : '缩为图标',
          shortcut: 'Alt+E',
          disabled: !hasChildren && !node.collapsedToIcon,
          action: () => {
            if (node.collapsedToIcon) {
              this.mindmap.expandFromIcon(nodeId);
            } else {
              this.mindmap.collapseToIcon(nodeId);
            }
            MindMapLayout.layoutLR(this.mindmap);
            this.app.renderer.render();
            this.app._showStatus(node.collapsedToIcon ? '已展开' : '已缩为图标', 1500);
          }
        },
        { icon: ICONS.moveUp, label: '上移', shortcut: 'Alt+↑', disabled: isRoot || !hasSiblings || pos.first, action: () => this._moveAndLayout(nodeId, -1) },
        { icon: ICONS.moveDown, label: '下移', shortcut: 'Alt+↓', disabled: isRoot || !hasSiblings || pos.last, action: () => this._moveAndLayout(nodeId, 1) },
        { icon: ICONS.moveTop, label: '置顶', shortcut: 'Alt+Shift+↑', disabled: isRoot || !hasSiblings || pos.first, action: () => this._moveToFirst(nodeId) },
        { icon: ICONS.moveBottom, label: '置底', shortcut: 'Alt+Shift+↓', disabled: isRoot || !hasSiblings || pos.last, action: () => this._moveToLast(nodeId) },
        { icon: ICONS.focus, label: '聚焦此节点', action: () => this.app.actionFocus() },
        { divider: true },
        {
          icon: ICONS.color, label: '改变颜色',
          submenu: this._buildColorSubmenu(nodeId)
        },
        {
          icon: ICONS.fontSize, label: '字号',
          submenu: this._buildFontSizeSubmenu(nodeId)
        },
        {
          icon: ICONS.fontColor, label: '字体颜色',
          submenu: this._buildFontColorSubmenu(nodeId)
        },
        {
          icon: ICONS.fontFamily, label: '字体',
          submenu: this._buildFontFamilySubmenu(nodeId)
        },
        { icon: ICONS.reset, label: '重置样式', action: () => {
          this.mindmap.resetNodeStyle(nodeId);
          this._refreshAfterStyleChange(nodeId);
        }},
        { divider: true },
        { icon: ICONS.copy, label: '复制节点', shortcut: 'Ctrl+C', action: () => this._copy(nodeId) },
        { icon: ICONS.cut, label: '剪切节点', shortcut: 'Ctrl+X', disabled: isRoot, action: () => this._cut(nodeId) },
        { icon: ICONS.paste, label: '粘贴为子节点', shortcut: 'Ctrl+V', disabled: !canPaste, action: () => this._paste(nodeId) },
        { divider: true },
        { icon: ICONS.delete, label: '删除节点', shortcut: 'Del', danger: true, disabled: isRoot, action: () => this.mindmap.remove(nodeId) }
      ];

      this._render(items, x, y);
    }

    /**
     * 显示空白处的右键菜单
     */
    showCanvasMenu(x, y) {
      const canPaste = this.clipboard !== null;
      const canUndo = this.app.storage.canUndo();
      const canRedo = this.app.storage.canRedo();

      const items = [
        { icon: ICONS.addChild, label: '在中心添加节点', action: () => this.mindmap.addChild(this.mindmap.rootId, '新节点') },
        { icon: ICONS.paste, label: '粘贴到中心', disabled: !canPaste, action: () => this._paste(this.mindmap.rootId) },
        { divider: true },
        { icon: ICONS.undo, label: '撤销', shortcut: 'Ctrl+Z', disabled: !canUndo, action: () => this.app.actionUndo() },
        { icon: ICONS.redo, label: '重做', shortcut: 'Ctrl+Y', disabled: !canRedo, action: () => this.app.actionRedo() },
        { divider: true },
        { icon: ICONS.layout, label: '重新布局', shortcut: 'Ctrl+L', action: () => this.app.actionLayout() },
        { icon: ICONS.fit, label: '适应视图', shortcut: 'Ctrl+0', action: () => this.app.actionResetView() }
      ];

      this._render(items, x, y);
    }

    /**
     * 构建颜色子菜单（节点背景色）
     */
    _buildColorSubmenu(nodeId) {
      const colors = [
        { name: '默认', value: null, preview: '#ffffff' },
        { name: '靛蓝', value: '#eef2ff', border: '#4f46e5' },
        { name: '翠绿', value: '#ecfdf5', border: '#10b981' },
        { name: '琥珀', value: '#fffbeb', border: '#f59e0b' },
        { name: '玫瑰', value: '#fef2f2', border: '#ef4444' },
        { name: '紫罗兰', value: '#f5f3ff', border: '#8b5cf6' },
        { name: '粉红', value: '#fdf2f8', border: '#ec4899' },
        { name: '青色', value: '#ecfeff', border: '#06b6d4' }
      ];
      return colors.map(c => ({
        icon: `<span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${c.value || '#ffffff'};border:1.5px solid ${c.border || '#cbd5e1'};"></span>`,
        label: c.name,
        action: () => {
          const node = this.mindmap.get(nodeId);
          if (!node) return;
          node.customColor = c.value;
          node.customBorder = c.border;
          this.mindmap._emit('change', { type: 'update', id: nodeId, field: 'color' });
        }
      }));
    }

    /**
     * 构建字号子菜单
     */
    _buildFontSizeSubmenu(nodeId) {
      const sizes = [
        { name: '默认', value: null },
        { name: '极小 (12)', value: 12 },
        { name: '小 (14)', value: 14 },
        { name: '普通 (16)', value: 16 },
        { name: '中 (18)', value: 18 },
        { name: '大 (20)', value: 20 },
        { name: '特大 (24)', value: 24 },
        { name: '超大 (32)', value: 32 }
      ];
      return sizes.map(s => {
        const isSelected = (this.mindmap.get(nodeId)?.fontSize || null) === s.value;
        return {
          icon: isSelected ? '✓' : '  ',
          label: s.name,
          action: () => {
            this.mindmap.setNodeStyle(nodeId, { fontSize: s.value });
            this._refreshAfterStyleChange(nodeId);
          }
        };
      });
    }

    /**
     * 构建字体颜色子菜单
     */
    _buildFontColorSubmenu(nodeId) {
      const colors = [
        { name: '默认', value: null },
        { name: '黑色', value: '#000000' },
        { name: '深灰', value: '#374151' },
        { name: '中灰', value: '#9ca3af' },
        { name: '红色', value: '#dc2626' },
        { name: '橙色', value: '#ea580c' },
        { name: '琥珀', value: '#d97706' },
        { name: '绿色', value: '#059669' },
        { name: '青色', value: '#0891b2' },
        { name: '蓝色', value: '#2563eb' },
        { name: '紫色', value: '#7c3aed' },
        { name: '粉色', value: '#db2777' }
      ];
      return colors.map(c => {
        const isSelected = (this.mindmap.get(nodeId)?.fontColor || null) === c.value;
        return {
          icon: isSelected
            ? `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${c.value || '#111827'};border:1px solid #cbd5e1;"></span>`
            : `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${c.value || '#111827'};border:1px solid transparent;opacity:0.3;"></span>`,
          label: c.name,
          action: () => {
            this.mindmap.setNodeStyle(nodeId, { fontColor: c.value });
            this._refreshAfterStyleChange(nodeId);
          }
        };
      });
    }

    /**
     * 构建字体族子菜单
     */
    _buildFontFamilySubmenu(nodeId) {
      const families = [
        { name: '默认', value: null },
        { name: '系统无衬线', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
        { name: '圆体', value: '"PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif' },
        { name: '宋体 (衬线)', value: '"Songti SC", "SimSun", "Times New Roman", serif' },
        { name: '黑体', value: '"Heiti SC", "SimHei", "Microsoft YaHei", sans-serif' },
        { name: '等宽', value: '"SF Mono", Consolas, "Courier New", monospace' },
        { name: '楷体', value: '"Kaiti SC", "KaiTi", "STKaiti", serif' }
      ];
      return families.map(f => {
        const isSelected = (this.mindmap.get(nodeId)?.fontFamily || null) === f.value;
        return {
          icon: isSelected ? '✓' : '  ',
          label: f.name,
          action: () => {
            this.mindmap.setNodeStyle(nodeId, { fontFamily: f.value });
            this._refreshAfterStyleChange(nodeId);
          }
        };
      });
    }

    /**
     * 样式改变后刷新（重绘 + 重布局以适应字号变化）
     */
    _refreshAfterStyleChange(nodeId) {
      MindMapLayout.layoutLR(this.mindmap);
      this.app.renderer.render();
      this.app._showStatus('已更新样式', 1500);
    }

    /**
     * 复制节点
     */
    _copy(nodeId) {
      this.clipboard = this.mindmap.copySubtree(nodeId);
      this.cutMode = false;
      this.app._showStatus?.('已复制节点');
    }

    /**
     * 移动节点后重新布局
     */
    _moveAndLayout(nodeId, delta) {
      const moved = this.mindmap.moveSibling(nodeId, delta);
      if (moved) {
        MindMapLayout.layoutLR(this.mindmap);
        this.app.renderer.render();
        this.app._showStatus?.(delta < 0 ? '已上移' : '已下移');
      }
    }

    _moveToFirst(nodeId) {
      const moved = this.mindmap.moveToFirst(nodeId);
      if (moved) {
        MindMapLayout.layoutLR(this.mindmap);
        this.app.renderer.render();
        this.app._showStatus?.('已置顶');
      }
    }

    _moveToLast(nodeId) {
      const moved = this.mindmap.moveToLast(nodeId);
      if (moved) {
        MindMapLayout.layoutLR(this.mindmap);
        this.app.renderer.render();
        this.app._showStatus?.('已置底');
      }
    }

    /**
     * 剪切节点
     */
    _cut(nodeId) {
      this.clipboard = this.mindmap.copySubtree(nodeId);
      this.cutMode = true;
      this._pendingCutId = nodeId;
      this.app._showStatus?.('已剪切节点，请粘贴');
    }

    /**
     * 粘贴为子节点
     */
    _paste(parentId) {
      if (!this.clipboard) return;
      this.mindmap.pasteAsChild(parentId, this.clipboard);
      // 重新布局
      MindMapLayout.layoutLR(this.mindmap);
      this.app.renderer.render();
      // 如果是剪切，删除原节点
      if (this.cutMode && this._pendingCutId) {
        this.mindmap.remove(this._pendingCutId);
        this._pendingCutId = null;
        this.cutMode = false;
      }
      this.app._showStatus?.('已粘贴');
    }

    /**
     * 渲染菜单
     */
    _render(items, x, y) {
      // 构建 DOM
      this.menu.innerHTML = '';
      items.forEach(item => {
        if (item.divider) {
          const div = document.createElement('div');
          div.className = 'context-menu-divider';
          this.menu.appendChild(div);
        } else {
          const div = document.createElement('div');
          div.className = 'context-menu-item';
          if (item.disabled) div.classList.add('disabled');
          if (item.danger) div.classList.add('danger');
          if (item.submenu) div.classList.add('context-menu-submenu');

          const icon = document.createElement('span');
          icon.className = 'context-menu-icon';
          icon.innerHTML = item.icon || '';
          div.appendChild(icon);

          const label = document.createElement('span');
          label.className = 'context-menu-label';
          label.textContent = item.label;
          div.appendChild(label);

          if (item.shortcut) {
            const shortcut = document.createElement('span');
            shortcut.className = 'context-menu-shortcut';
            shortcut.textContent = item.shortcut;
            div.appendChild(shortcut);
          }

          if (!item.disabled && item.action) {
            div.addEventListener('click', (e) => {
              e.stopPropagation();
              item.action();
              this.hide();
            });
          }

          // 子菜单
          if (item.submenu) {
            const sub = document.createElement('div');
            sub.className = 'context-submenu';
            item.submenu.forEach(subItem => {
              if (subItem.divider) {
                const div2 = document.createElement('div');
                div2.className = 'context-menu-divider';
                sub.appendChild(div2);
                return;
              }
              const subDiv = document.createElement('div');
              subDiv.className = 'context-menu-item';
              if (subItem.disabled) subDiv.classList.add('disabled');
              const subIcon = document.createElement('span');
              subIcon.className = 'context-menu-icon';
              subIcon.innerHTML = subItem.icon || '';
              subDiv.appendChild(subIcon);
              const subLabel = document.createElement('span');
              subLabel.className = 'context-menu-label';
              subLabel.textContent = subItem.label;
              subDiv.appendChild(subLabel);
              if (!subItem.disabled && subItem.action) {
                subDiv.addEventListener('click', (e) => {
                  e.stopPropagation();
                  subItem.action();
                  this.hide();
                });
              }
              sub.appendChild(subDiv);
            });
            div.appendChild(sub);
          }

          this.menu.appendChild(div);
        }
      });

      // 显示并定位
      this.menu.hidden = false;
      this._positionMenu(x, y);
    }

    /**
     * 智能定位菜单（避免超出屏幕）
     * - 主菜单位置：保证在视口内，必要时调整 X/Y
     * - 子菜单位置：如果右侧会超出，自动改为向左展开
     */
    _positionMenu(x, y) {
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const padding = 4; // 与屏幕边缘的最小距离

      // 临时将菜单设置到 (0,0) 以测量真实尺寸
      this.menu.style.visibility = 'hidden';
      this.menu.style.left = '0px';
      this.menu.style.top = '0px';
      const rect = this.menu.getBoundingClientRect();

      let finalX = x;
      let finalY = y;

      // 水平方向：超出右边则改为向左对齐到鼠标位置
      if (x + rect.width + padding > winW) {
        // 优先尝试向左展开（菜单右边对齐到鼠标位置）
        finalX = Math.max(padding, x - rect.width);
      }
      // 仍在右边外（菜单比屏幕还宽）
      if (finalX + rect.width + padding > winW) {
        finalX = Math.max(padding, winW - rect.width - padding);
      }
      // 防止菜单超出左边
      if (finalX < padding) {
        finalX = padding;
      }

      // 垂直方向：超出底部则改为向上对齐到鼠标位置
      if (y + rect.height + padding > winH) {
        // 优先尝试向上展开（菜单底部对齐到鼠标位置）
        finalY = Math.max(padding, y - rect.height);
      }
      // 仍在底部外
      if (finalY + rect.height + padding > winH) {
        finalY = Math.max(padding, winH - rect.height - padding);
      }
      // 防止菜单超出顶部
      if (finalY < padding) {
        finalY = padding;
      }

      this.menu.style.left = finalX + 'px';
      this.menu.style.top = finalY + 'px';
      this.menu.style.visibility = 'visible';

      // 调整所有子菜单位置（如果会超出右边，则改为向左展开）
      this._positionSubmenus();
    }

    /**
     * 调整所有子菜单的方向和位置，避免超出屏幕
     * 由于子菜单现在用 position: fixed，需要在 JS 中精确计算坐标
     */
    _positionSubmenus() {
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const padding = 4;

      const submenus = this.menu.querySelectorAll('.context-submenu');
      submenus.forEach(sub => {
        const parentItem = sub.parentElement;
        const parentRect = parentItem.getBoundingClientRect();
        // 先测量子菜单的尺寸（显示后立即测量）
        sub.style.visibility = 'hidden';
        sub.style.display = 'block';
        sub.style.left = '0px';
        sub.style.top = '0px';
        const subRect = sub.getBoundingClientRect();
        sub.style.visibility = '';
        sub.style.display = '';

        // 计算位置：默认在父项右侧
        let subX = parentRect.right + 2;
        let subY = parentRect.top;

        // 如果右侧超出，改为左侧
        if (subX + subRect.width + padding > winW) {
          subX = parentRect.left - subRect.width - 2;
        }
        // 防止子菜单超出左边
        if (subX < padding) subX = padding;
        // 防止子菜单超出右边（fallback）
        if (subX + subRect.width + padding > winW) {
          subX = winW - subRect.width - padding;
        }

        // 垂直方向：尽量与父项顶部对齐，但如果超出底部则向上对齐
        if (subY + subRect.height + padding > winH) {
          subY = Math.max(padding, winH - subRect.height - padding);
        }
        if (subY < padding) subY = padding;

        sub.style.left = subX + 'px';
        sub.style.top = subY + 'px';
      });
    }

    hide() {
      this.menu.hidden = true;
    }

    /**
     * 绑定键盘快捷键 Ctrl+C / Ctrl+X / Ctrl+V
     */
    setupKeyboard() {
      document.addEventListener('keydown', (e) => {
        const target = e.target;
        const tagName = target ? target.tagName : '';
        const editing =
          this.app.interaction.editingNodeId !== null ||
          (target && target.getAttribute && target.getAttribute('contenteditable') === 'true') ||
          tagName === 'TEXTAREA' ||
          tagName === 'INPUT' ||
          (target && target.closest && target.closest('#mdEditorPanel'));
        if (editing) return;

        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
          const key = e.key.toLowerCase();
          if (key === 'c' && this.mindmap.selectedId) {
            e.preventDefault();
            this._copy(this.mindmap.selectedId);
          } else if (key === 'x' && this.mindmap.selectedId && this.mindmap.selectedId !== this.mindmap.rootId) {
            e.preventDefault();
            this._cut(this.mindmap.selectedId);
          } else if (key === 'v' && this.clipboard && this.mindmap.selectedId) {
            e.preventDefault();
            this._paste(this.mindmap.selectedId);
          }
        }
      });
    }
  }

  window.MindMapContextMenu = ContextMenu;
})();