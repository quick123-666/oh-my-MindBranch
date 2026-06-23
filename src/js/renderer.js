// ============== SVG 渲染引擎 ==============
// 将 MindMap 数据模型渲染到 SVG 画布上

(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const XHTML_NS = 'http://www.w3.org/1999/xhtml';

  class Renderer {
    constructor(mindmap, svgElement) {
      this.mindmap = mindmap;
      this.svg = svgElement;
      this.viewport = svgElement.querySelector('#viewport');
      this.connectionsLayer = svgElement.querySelector('#connectionsLayer');
      this.nodesLayer = svgElement.querySelector('#nodesLayer');
      this.template = document.getElementById('nodeTemplate');

      // 视口变换
      this.scale = 1;
      this.translateX = 0;
      this.translateY = 0;
      // focus 模式：聚焦节点时只显示该分支
      this.focusNodeId = null;
      // 缩略图
      this.minimapSvg = document.getElementById('minimapSvg');
      this.minimapContent = document.getElementById('minimapContent');
      this.minimapViewport = document.getElementById('minimapViewport');
      this._setupMinimap();

      this._setupEventHandlers();
    }

    _setupEventHandlers() {
      // 节点点击事件（使用事件委托）
      this.nodesLayer.addEventListener('mousedown', (e) => {
        const node = e.target.closest('.node');
        if (!node) return;
        const id = node.dataset.nodeId;
        this.mindmap.select(id);
      });

      // 单击事件：图标节点的单击展开
      this.nodesLayer.addEventListener('click', (e) => {
        if (e.button !== 0) return;
        const node = e.target.closest('.node');
        if (!node) return;
        const id = node.dataset.nodeId;
        const nodeData = this.mindmap.get(id);
        if (nodeData && nodeData.collapsedToIcon) {
          this.mindmap.expandFromIcon(id);
          this.mindmap._emit('change', { type: 'update', id, field: 'collapsedToIcon' });
        }
      });

      // 双击折叠按钮：切换折叠
      this.nodesLayer.addEventListener('click', (e) => {
        if (e.target.classList.contains('node-collapse-btn') ||
            e.target.classList.contains('node-collapse-btn-text') ||
            (e.target.parentElement && e.target.parentElement.classList.contains('node-collapse-btn'))) {
          const node = e.target.closest('.node');
          if (node) {
            this.mindmap.toggleCollapse(node.dataset.nodeId);
          }
        }
      });

      // 双击节点文本：进入编辑
      this.nodesLayer.addEventListener('dblclick', (e) => {
        const nodeText = e.target.closest('.node-text');
        if (!nodeText) return;
        const node = nodeText.closest('.node');
        if (!node) return;
        if (this._onEditRequest) {
          this._onEditRequest(node.dataset.nodeId, nodeText);
        }
      });
    }

    onEditRequest(handler) {
      this._onEditRequest = handler;
    }

    /**
     * 完整重绘
     */
    render() {
      this._renderConnections();
      this._renderNodes();
      this._updateViewport();
      this.updateMinimap();
    }

    /**
     * 渲染所有连接线
     */
    _renderConnections() {
      this.connectionsLayer.innerHTML = '';
      const visible = this._getVisibleSet();
      visible.forEach(id => {
        const node = this.mindmap.get(id);
        if (!node) return;
        node.children.forEach(cid => {
          if (!visible.has(cid)) return;
          const child = this.mindmap.get(cid);
          if (!child) return;
          const path = this._createConnectionPath(node, child);
          this.connectionsLayer.appendChild(path);
        });
      });
    }

    /**
     * 创建连接线（贝塞尔曲线）
     */
    _createConnectionPath(parent, child) {
      const pSize = MindMapLayout.estimateSize(parent.text);
      const cSize = MindMapLayout.estimateSize(child.text);
      const x1 = parent.x + pSize.width / 2;
      const y1 = parent.y;
      const x2 = child.x - cSize.width / 2;
      const y2 = child.y;
      const midX = (x1 + x2) / 2;
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`);
      path.setAttribute('class', 'connection');
      return path;
    }

    /**
     * 渲染所有节点
     */
    _renderNodes() {
      this.nodesLayer.innerHTML = '';
      const visible = this._getVisibleSet();
      const selected = this.mindmap.selectedId;

      visible.forEach(id => {
        const node = this.mindmap.get(id);
        if (!node) return;
        const nodeEl = this._createNodeElement(node);
        this.nodesLayer.appendChild(nodeEl);
      });
    }

    /**
     * 获取当前可见节点集合（考虑 focus 模式）
     */
    _getVisibleSet() {
      if (this.focusNodeId) {
        return this.mindmap.getVisible(this.focusNodeId);
      }
      return this.mindmap.getVisible();
    }

    /**
     * 创建单个节点 SVG 元素
     * 注意：必须直接使用 SVG 命名空间创建元素，不能从 <template> 克隆
     * 因为 <template> 是 HTML 元素，其内容是 HTML 命名空间，插入到 SVG 后会被忽略
     *
     * 当节点处于 collapsedToIcon 状态时，渲染为小圆圈图标；
     * 否则渲染为完整矩形节点。
     */
    _createNodeElement(node) {
      // 图标模式：渲染为小圆圈
      if (node.collapsedToIcon) {
        return this._createIconNodeElement(node);
      }
      // 正常模式：渲染为完整节点
      return this._createFullNodeElement(node);
    }

    /**
     * 创建图标节点（小圆圈）
     */
    _createIconNodeElement(node) {
      const depth = this.mindmap.getDepth(node.id);
      const isRoot = node.id === this.mindmap.rootId;
      const isSelected = node.id === this.mindmap.selectedId;
      const radius = 12; // 图标半径

      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class',
        'node node-icon' +
        (isRoot ? ' root' : '') +
        (isSelected ? ' selected' : '') +
        ' collapsed-to-icon'
      );
      g.setAttribute('data-node-id', node.id);
      g.setAttribute('data-depth', String(depth));
      g.setAttribute('transform', `translate(${node.x}, ${node.y})`);

      // 外圈（半透明 halo）
      const halo = document.createElementNS(SVG_NS, 'circle');
      halo.setAttribute('class', 'node-icon-halo');
      halo.setAttribute('cx', '0');
      halo.setAttribute('cy', '0');
      halo.setAttribute('r', String(radius + 6));
      g.appendChild(halo);

      // 主体圆
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('class', 'node-icon-bg');
      circle.setAttribute('cx', '0');
      circle.setAttribute('cy', '0');
      circle.setAttribute('r', String(radius));
      g.appendChild(circle);

      // 首字符
      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('class', 'node-icon-label');
      label.setAttribute('x', '0');
      label.setAttribute('y', '0');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('dominant-baseline', 'central');
      label.textContent = this._getIconChar(node.text);
      g.appendChild(label);

      // 展开提示（小加号）
      const plus = document.createElementNS(SVG_NS, 'text');
      plus.setAttribute('class', 'node-icon-plus');
      plus.setAttribute('x', String(radius - 1));
      plus.setAttribute('y', String(-radius + 1));
      plus.textContent = '+';
      g.appendChild(plus);

      return g;
    }

    /**
     * 获取节点的图标字符（首字符或 emoji）
     */
    _getIconChar(text) {
      if (!text) return '·';
      const trimmed = text.trim();
      // 如果是 emoji 开头
      if (/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(trimmed)) {
        return trimmed[0];
      }
      // 取第一个字符（中文/英文）
      return trimmed.charAt(0);
    }

    /**
     * 创建完整节点（矩形 + 文本）
     */
    _createFullNodeElement(node) {
      const size = MindMapLayout.estimateSize(node.text);
      const halfW = size.width / 2;
      const halfH = size.height / 2;
      const depth = this.mindmap.getDepth(node.id);
      const isRoot = node.id === this.mindmap.rootId;
      const isSelected = node.id === this.mindmap.selectedId;
      const isCollapsed = node.collapsed && node.children.length > 0;

      // 1. 创建 g 容器（SVG 命名空间）
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class',
        'node' +
        (isRoot ? ' root' : '') +
        (isSelected ? ' selected' : '') +
        (isCollapsed ? ' collapsed' : '')
      );
      g.setAttribute('data-node-id', node.id);
      g.setAttribute('data-depth', String(depth));
      g.setAttribute('transform', `translate(${node.x}, ${node.y})`);

      // 2. 创建背景矩形
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('class', 'node-bg');
      rect.setAttribute('x', String(-halfW));
      rect.setAttribute('y', String(-halfH));
      rect.setAttribute('width', String(size.width));
      rect.setAttribute('height', String(size.height));
      rect.setAttribute('rx', '8');
      rect.setAttribute('ry', '8');
      // 自定义颜色（来自右键菜单的颜色子菜单）
      if (node.customColor) {
        rect.setAttribute('style', `fill:${node.customColor}`);
      }
      if (node.customBorder) {
        const style = rect.getAttribute('style') || '';
        rect.setAttribute('style', style + `;stroke:${node.customBorder}`);
      }
      g.appendChild(rect);

      // 3. 创建 foreignObject 承载可编辑文本
      const fo = document.createElementNS(SVG_NS, 'foreignObject');
      fo.setAttribute('class', 'node-content');
      fo.setAttribute('x', String(-halfW));
      fo.setAttribute('y', String(-halfH));
      fo.setAttribute('width', String(size.width));
      fo.setAttribute('height', String(size.height));

      // 4. foreignObject 内部的 div（XHTML 命名空间）
      const wrapper = document.createElementNS(XHTML_NS, 'div');
      wrapper.setAttribute('class', 'node-text-wrapper');
      wrapper.setAttribute('xmlns', XHTML_NS);

      const text = document.createElementNS(XHTML_NS, 'div');
      text.setAttribute('class', 'node-text');
      text.setAttribute('contenteditable', 'false');
      text.setAttribute('spellcheck', 'false');
      text.textContent = node.text || '';
      // 应用节点自定义字体样式（内联样式优先级最高）
      if (node.fontSize) {
        text.style.fontSize = node.fontSize + 'px';
      }
      if (node.fontColor) {
        text.style.color = node.fontColor;
      }
      if (node.fontFamily) {
        text.style.fontFamily = node.fontFamily;
      }
      if (node.fontWeight) {
        text.style.fontWeight = node.fontWeight;
      }

      wrapper.appendChild(text);
      fo.appendChild(wrapper);
      g.appendChild(fo);

      // 5. 折叠按钮（仅当有子节点时）
      if (node.children.length > 0) {
        const collapseBtn = document.createElementNS(SVG_NS, 'circle');
        collapseBtn.setAttribute('class', 'node-collapse-btn');
        collapseBtn.setAttribute('cx', String(halfW));
        collapseBtn.setAttribute('cy', '0');
        collapseBtn.setAttribute('r', '9');
        g.appendChild(collapseBtn);

        const collapseBtnText = document.createElementNS(SVG_NS, 'text');
        collapseBtnText.setAttribute('class', 'node-collapse-btn-text');
        collapseBtnText.setAttribute('x', String(halfW));
        collapseBtnText.setAttribute('y', '0');
        collapseBtnText.textContent = node.collapsed ? '+' : '−';
        g.appendChild(collapseBtnText);
      }

      return g;
    }

    /**
     * 应用视口变换
     */
    _updateViewport() {
      this.viewport.setAttribute(
        'transform',
        `translate(${this.translateX}, ${this.translateY}) scale(${this.scale})`
      );
      // 视口变化时更新缩略图视口框
      this.updateMinimap();
    }

    /**
     * 设置缩放和平移
     */
    setTransform(scale, tx, ty) {
      this.scale = scale;
      this.translateX = tx;
      this.translateY = ty;
      this._updateViewport();
      // 通知外部（用于检测超界等）
      if (this._onTransformChange) this._onTransformChange();
    }

    /**
     * 注册视口变化回调（用于 app 层做超界检测等）
     */
    onTransformChange(fn) {
      this._onTransformChange = fn;
    }

    getScale() { return this.scale; }

    /**
     * 屏幕坐标 -> 思维导图坐标（考虑视口变换）
     */
    screenToWorld(sx, sy) {
      const rect = this.svg.getBoundingClientRect();
      const px = sx - rect.left;
      const py = sy - rect.top;
      return {
        x: (px - this.translateX) / this.scale,
        y: (py - this.translateY) / this.scale
      };
    }

    /**
     * 思维导图坐标 -> 屏幕坐标
     */
    worldToScreen(wx, wy) {
      const rect = this.svg.getBoundingClientRect();
      return {
        x: wx * this.scale + this.translateX + rect.left,
        y: wy * this.scale + this.translateY + rect.top
      };
    }

    /**
     * 平移到合适位置（让所有节点可见）
     */
    fitToView(padding = 60) {
      const bounds = MindMapLayout.getBounds(this.mindmap);
      const rect = this.svg.getBoundingClientRect();
      const viewW = rect.width - padding * 2;
      const viewH = rect.height - padding * 2;
      if (bounds.width === 0 || bounds.height === 0) {
        this.setTransform(1, rect.width / 2, rect.height / 2);
        return;
      }
      // 不限制最大缩放比 - 让大画布缩小到完整可见
      const scale = Math.min(viewW / bounds.width, viewH / bounds.height);
      const cx = (bounds.minX + bounds.maxX) / 2;
      const cy = (bounds.minY + bounds.maxY) / 2;
      const tx = rect.width / 2 - cx * scale;
      const ty = rect.height / 2 - cy * scale;
      this.setTransform(scale, tx, ty);
    }

    /**
     * 设置画布缩略图（右下角小地图）的交互
     */
    _setupMinimap() {
      if (!this.minimapSvg) return;
      const MINIMAP_SIZE = 100; // viewBox 大小
      let isDragging = false;

      const jumpToMinimapPos = (clientX, clientY) => {
        const rect = this.minimapSvg.getBoundingClientRect();
        // 计算在 viewBox 中的位置（viewBox 100x100）
        const vbX = ((clientX - rect.left) / rect.width) * MINIMAP_SIZE;
        const vbY = ((clientY - rect.top) / rect.height) * MINIMAP_SIZE;
        // 转换为画布世界坐标
        const bounds = MindMapLayout.getBounds(this.mindmap);
        if (bounds.width === 0) return;
        const worldX = bounds.minX + (vbX / MINIMAP_SIZE) * bounds.width;
        const worldY = bounds.minY + (vbY / MINIMAP_SIZE) * bounds.height;
        // 将该点设为屏幕中心
        const svgRect = this.svg.getBoundingClientRect();
        const newTx = svgRect.width / 2 - worldX * this.scale;
        const newTy = svgRect.height / 2 - worldY * this.scale;
        this.setTransform(this.scale, newTx, newTy);
        this._updateViewport();
      };

      this.minimapSvg.addEventListener('mousedown', (e) => {
        isDragging = true;
        jumpToMinimapPos(e.clientX, e.clientY);
      });
      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        jumpToMinimapPos(e.clientX, e.clientY);
      });
      document.addEventListener('mouseup', () => { isDragging = false; });
    }

    /**
     * 更新缩略图：节点位置 + 当前视口框
     */
    updateMinimap() {
      if (!this.minimapSvg || !this.minimapContent) return;
      const bounds = MindMapLayout.getBounds(this.mindmap);
      if (bounds.width === 0 || bounds.height === 0) {
        this.minimapContent.innerHTML = '';
        return;
      }

      // 清空旧节点
      this.minimapContent.innerHTML = '';

      // 在 100x100 viewBox 中绘制所有可见节点
      const visible = this._getVisibleSet();
      const padding = 5;
      const sx = (100 - padding * 2) / bounds.width;
      const sy = (100 - padding * 2) / bounds.height;
      const scale = Math.min(sx, sy);
      const offsetX = padding + (100 - padding * 2 - bounds.width * scale) / 2;
      const offsetY = padding + (100 - padding * 2 - bounds.height * scale) / 2;

      visible.forEach(id => {
        const node = this.mindmap.get(id);
        if (!node) return;
        const isRoot = id === this.mindmap.rootId;
        const isSelected = id === this.mindmap.selectedId;
        const cx = offsetX + (node.x - bounds.minX) * scale;
        const cy = offsetY + (node.y - bounds.minY) * scale;
        const r = node.collapsedToIcon ? 1.5 : 1.2;
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', String(cx));
        circle.setAttribute('cy', String(cy));
        circle.setAttribute('r', String(r));
        circle.setAttribute('fill', isSelected ? '#dc2626' : (isRoot ? '#4f46e5' : '#6b7280'));
        this.minimapContent.appendChild(circle);
      });

      // 更新视口指示框
      const svgRect = this.svg.getBoundingClientRect();
      // 世界坐标的视口范围
      const wLeft = -this.translateX / this.scale;
      const wTop = -this.translateY / this.scale;
      const wRight = (svgRect.width - this.translateX) / this.scale;
      const wBottom = (svgRect.height - this.translateY) / this.scale;
      // 转换为 viewBox 坐标
      const vLeft = offsetX + (wLeft - bounds.minX) * scale;
      const vTop = offsetY + (wTop - bounds.minY) * scale;
      const vRight = offsetX + (wRight - bounds.minX) * scale;
      const vBottom = offsetY + (wBottom - bounds.minY) * scale;
      this.minimapViewport.setAttribute('x', String(Math.max(0, vLeft)));
      this.minimapViewport.setAttribute('y', String(Math.max(0, vTop)));
      this.minimapViewport.setAttribute('width', String(Math.min(100, vRight) - Math.max(0, vLeft)));
      this.minimapViewport.setAttribute('height', String(Math.min(100, vBottom) - Math.max(0, vTop)));
    }
  }

  window.MindMapRenderer = Renderer;
})();