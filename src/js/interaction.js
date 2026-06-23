// ============== 交互模块 ==============
// 处理鼠标拖拽节点、平移画布、滚轮缩放、键盘快捷键、节点编辑

(function () {
  class Interaction {
    constructor(mindmap, renderer, container) {
      this.mindmap = mindmap;
      this.renderer = renderer;
      this.container = container;
      this.svg = renderer.svg;

      this.dragState = null;       // 节点拖拽状态
      this.panState = null;        // 画布平移状态
      this.editingNodeId = null;   // 正在编辑的节点 ID

      this._setupNodeDrag();
      this._setupCanvasPan();
      this._setupZoom();
      this._setupKeyboard();
      this._setupEditHandler();
    }

    // ====== 节点拖拽 ======
    _setupNodeDrag() {
      this.nodesLayer = this.svg.querySelector('#nodesLayer');

      this.nodesLayer.addEventListener('mousedown', (e) => {
        // 折叠按钮不触发拖拽
        if (e.target.classList.contains('node-collapse-btn') ||
            e.target.classList.contains('node-collapse-btn-text')) {
          return;
        }
        const nodeEl = e.target.closest('.node');
        if (!nodeEl) return;

        // 如果正在编辑文本，不开始拖拽
        const nodeText = nodeEl.querySelector('.node-text');
        if (nodeText && nodeText.getAttribute('contenteditable') === 'true') return;

        const id = nodeEl.dataset.nodeId;
        const node = this.mindmap.get(id);
        if (!node) return;

        // 图标模式节点不进入拖拽（让 click 事件处理展开）
        if (node.collapsedToIcon) {
          return;
        }

        const world = this.renderer.screenToWorld(e.clientX, e.clientY);
        this.dragState = {
          id,
          offsetX: world.x - node.x,
          offsetY: world.y - node.y,
          moved: false,
          startX: e.clientX,
          startY: e.clientY
        };

        e.stopPropagation();
        e.preventDefault();
      });

      document.addEventListener('mousemove', (e) => {
        if (!this.dragState) return;
        const world = this.renderer.screenToWorld(e.clientX, e.clientY);
        const newX = world.x - this.dragState.offsetX;
        const newY = world.y - this.dragState.offsetY;
        this.mindmap.setPosition(this.dragState.id, newX, newY);

        // 标记为已移动
        const dx = e.clientX - this.dragState.startX;
        const dy = e.clientY - this.dragState.startY;
        if (Math.abs(dx) + Math.abs(dy) > 4) {
          this.dragState.moved = true;
        }
      });

document.addEventListener('mouseup', () => {
      const wasDragging = this.dragState && this.dragState.moved;
      this.dragState = null;
      if (wasDragging && this._onAfterDrag) this._onAfterDrag();
    });
    }

    // ====== 画布平移 ======
    _setupCanvasPan() {
      let lastX, lastY;
      const onDown = (e) => {
        // 只有点击空白区域才平移
        if (e.target.closest('.node')) return;
        if (e.button !== 0) return;
        this.panState = { startX: e.clientX, startY: e.clientY };
        lastX = e.clientX;
        lastY = e.clientY;
        this.container.classList.add('panning');
      };

      const onMove = (e) => {
        if (!this.panState) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        const scale = this.renderer.getScale();
        const t = this.renderer;
        t.setTransform(scale, t.translateX + dx, t.translateY + dy);
      };

      const onUp = () => {
        if (this.panState) {
          this.panState = null;
          this.container.classList.remove('panning');
        }
      };

      this.svg.addEventListener('mousedown', onDown);
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }

    // ====== 滚轮缩放 ======
    _setupZoom() {
      this.svg.addEventListener('wheel', (e) => {
        e.preventDefault();
        const scale = this.renderer.getScale();
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const newScale = Math.max(0.2, Math.min(3, scale * factor));

        // 以鼠标位置为锚点缩放
        const rect = this.svg.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const t = this.renderer;
        const worldX = (mx - t.translateX) / scale;
        const worldY = (my - t.translateY) / scale;
        const newTx = mx - worldX * newScale;
        const newTy = my - worldY * newScale;
        t.setTransform(newScale, newTx, newTy);

        if (this._onZoomChange) this._onZoomChange(newScale);
      }, { passive: false });
    }

    // ====== 键盘快捷键 ======
    _setupKeyboard() {
      document.addEventListener('keydown', (e) => {
        const target = e.target;
        const tagName = target ? target.tagName : '';

        // —— 情形 1：在节点编辑器中（contenteditable） ——
        const isNodeEditing =
          this.editingNodeId !== null ||
          (target && target.getAttribute && target.getAttribute('contenteditable') === 'true');

        if (isNodeEditing) {
          // 在节点编辑模式下：Enter 提交，Escape 取消
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this._finishEdit(true);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            this._finishEdit(false);
          }
          return;
        }

        // —— 情形 2：在其他可编辑元素中（如 MD 编辑器的 textarea、input） ——
        const inTextEditor =
          tagName === 'TEXTAREA' ||
          tagName === 'INPUT' ||
          (target && target.closest && target.closest('#mdEditorPanel'));

        if (inTextEditor) {
          // 让浏览器原生处理，不拦截任何快捷键（Enter、Tab、Esc 等）
          // 仅拦截 Ctrl/Cmd + 字母键（如 C/X/V 的拦截由 contextMenu.js 负责，此处放行）
          // 放行：不再执行导图快捷键
          return;
        }

        // —— 情形 3：导图画布上的快捷键 ——
        const selectedId = this.mindmap.selectedId;
        if (!selectedId) return;

        if (e.key === 'Tab') {
          e.preventDefault();
          this.mindmap.addChild(selectedId, '新节点');
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (selectedId === this.mindmap.rootId) {
            this.mindmap.addChild(selectedId, '新节点');
          } else {
            this.mindmap.addSibling(selectedId, '新节点');
          }
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          if (selectedId !== this.mindmap.rootId) {
            e.preventDefault();
            this.mindmap.remove(selectedId);
          }
        } else if (e.key === 'F2') {
          e.preventDefault();
          this._startEdit(selectedId);
        } else if (e.key === ' ') {
          e.preventDefault();
          this.mindmap.toggleCollapse(selectedId);
        } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          if (selectedId === this.mindmap.rootId) return;
          if (e.shiftKey) {
            if (e.key === 'ArrowUp') this.mindmap.moveToFirst(selectedId);
            else this.mindmap.moveToLast(selectedId);
          } else {
            this.mindmap.moveSibling(selectedId, e.key === 'ArrowUp' ? -1 : 1);
          }
          if (this._onAfterMutation) this._onAfterMutation();
        } else if (e.altKey && e.key.toLowerCase() === 'e') {
          e.preventDefault();
          const node = this.mindmap.get(selectedId);
          if (node && (node.children.length > 0 || node.collapsedToIcon)) {
            this.mindmap.toggleCollapsedToIcon(selectedId);
            this.mindmap._emit('change', { type: 'update', id: selectedId, field: 'collapsedToIcon' });
            if (this._onAfterMutation) this._onAfterMutation();
          }
        }
      });
    }

    // ====== 节点编辑 ======
    _setupEditHandler() {
      this.renderer.onEditRequest((id, textEl) => {
        this._startEdit(id, textEl);
      });
    }

    _startEdit(id, textEl) {
      // 如果已经在编辑同一个节点，不要重复启动（避免打断当前输入）
      if (this.editingNodeId === id) return;
      // 如果正在编辑其他节点，先提交那个节点
      if (this.editingNodeId) {
        this._finishEdit(true);
      }
      const node = this.mindmap.get(id);
      if (!node) return;
      const nodeEl = this.svg.querySelector(`.node[data-node-id="${id}"]`);
      if (!nodeEl) return;
      const targetTextEl = textEl || nodeEl.querySelector('.node-text');
      if (!targetTextEl) return;

      // 先注册监听器（必须在修改 contenteditable 之前！）
      // 避免 contenteditable 状态切换时触发的 blur 事件丢失
      targetTextEl.addEventListener('blur', this._onEditBlur);
      // 阻止在编辑文本时触发父节点拖拽
      targetTextEl.addEventListener('mousedown', this._stopPropagation);
      targetTextEl.addEventListener('dblclick', this._stopPropagation);
      this._currentTextEl = targetTextEl;

      // 然后才修改属性并设置状态
      this.editingNodeId = id;
      targetTextEl.textContent = node.text;
      targetTextEl.setAttribute('contenteditable', 'true');
      targetTextEl.style.cursor = 'text';

      // 选中所有文本
      setTimeout(() => {
        const range = document.createRange();
        range.selectNodeContents(targetTextEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        try { targetTextEl.focus(); } catch (e) { /* 可能在不可见元素 */ }
      }, 10);
    }

    _onEditBlur = (e) => {
      // 延迟判断：避免在 _finishEdit 主动提交时也触发
      setTimeout(() => {
        // 检查是否是当前正在编辑的元素触发的 blur
        // （可能中间已经切换到别的节点了）
        if (e && e.target && this._currentTextEl && e.target !== this._currentTextEl) {
          return;
        }
        if (this.editingNodeId) {
          this._finishEdit(true);
        }
      }, 50);
    };

    _stopPropagation = (e) => {
      e.stopPropagation();
    };

    _finishEdit(commit) {
      if (!this.editingNodeId) return;
      const id = this.editingNodeId;
      this.editingNodeId = null; // 先清空，避免 blur 回调再次进入
      this._currentTextEl = null; // 清空当前编辑元素引用
      const nodeEl = this.svg.querySelector(`.node[data-node-id="${id}"]`);
      if (nodeEl) {
        const textEl = nodeEl.querySelector('.node-text');
        if (textEl) {
          if (commit) {
            const newText = (textEl.textContent || '').trim() || '新节点';
            // 更新内存数据（不触发 change 事件，避免重建 DOM 打断其他可能的编辑）
            this.mindmap.updateText(id, newText, false);
          }
          textEl.setAttribute('contenteditable', 'false');
          textEl.style.cursor = '';
          // 移除事件监听器（避免泄漏）
          textEl.removeEventListener('blur', this._onEditBlur);
          textEl.removeEventListener('mousedown', this._stopPropagation);
          textEl.removeEventListener('dblclick', this._stopPropagation);
        }
      }
      // 注意：这里不主动重绘，因为：
      // 1. 如果是同一节点结束编辑，不需要重绘（textEl 已经显示新文本）
      // 2. 如果是切换节点结束编辑，目标节点已经在 _startEdit 中处理
      // 3. 如果文本长度变化导致布局需要重排，会由下次 onChange 自动触发
    }

    // ====== 外部回调 ======
    onZoomChange(fn) {
      this._onZoomChange = fn;
    }

    /**
     * 数据变更后回调（用于重新布局并重绘）
     */
    onAfterMutation(fn) {
      this._onAfterMutation = fn;
    }

    /**
     * 拖拽节点结束后回调
     */
    onAfterDrag(fn) {
      this._onAfterDrag = fn;
    }

    /**
     * 缩放到指定比例（围绕画布中心）
     */
    zoomTo(newScale, centerX = null, centerY = null) {
      const scale = this.renderer.getScale();
      const t = this.renderer;
      const rect = this.svg.getBoundingClientRect();
      const cx = centerX !== null ? centerX : rect.width / 2;
      const cy = centerY !== null ? centerY : rect.height / 2;
      const worldX = (cx - t.translateX) / scale;
      const worldY = (cy - t.translateY) / scale;
      const newTx = cx - worldX * newScale;
      const newTy = cy - worldY * newScale;
      t.setTransform(newScale, newTx, newTy);
      if (this._onZoomChange) this._onZoomChange(newScale);
    }
  }

  window.MindMapInteraction = Interaction;
})();