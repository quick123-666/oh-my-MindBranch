// ============== 思维导图核心数据模型 ==============

/**
 * 节点结构：
 * {
 *   id: string,          // 唯一 ID
 *   text: string,        // 显示文本
 *   parentId: string|null,
 *   children: string[],  // 子节点 ID 列表（按顺序）
 *   collapsed: boolean,  // 是否折叠（隐藏子节点）
 *   x: number, y: number // 屏幕坐标（由布局算法填充）
 * }
 */

class MindMap {
  constructor() {
    this.nodes = new Map();        // id -> node
    this.rootId = null;
    this.listeners = new Set();    // 数据变化监听器
    this.selectedId = null;
    this.title = '未命名';
  }

  // 生成唯一 ID
  static genId() {
    return 'n_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // 监听数据变化
  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit(event = 'change', payload = {}) {
    this.listeners.forEach(fn => fn(event, payload));
  }

  // ====== 创建 ======

  /**
   * 创建新文档（一个根节点）
   * @param {string} rootText 根节点文本
   */
  create(rootText = '中心主题') {
    this.nodes.clear();
    this.rootId = null;
    this.selectedId = null;
    this.title = '未命名';
    const root = {
      id: MindMap.genId(),
      text: rootText,
      parentId: null,
      children: [],
      collapsed: false,
      x: 0, y: 0
    };
    this.nodes.set(root.id, root);
    this.rootId = root.id;
    this.selectedId = root.id;
    this._emit('change', { type: 'create' });
    return root.id;
  }

  /**
   * 从 JSON 数据恢复
   * @param {Object} data { title, rootId, nodes: [{id, text, parentId, children, collapsed}] }
   */
load(data) {
      // ====== Schema 校验 ======
      if (!data || typeof data !== 'object') {
        throw new Error('数据格式错误：不是合法对象');
      }
      if (!Array.isArray(data.nodes)) {
        throw new Error('数据格式错误：nodes 必须是数组');
      }
      if (typeof data.rootId !== 'string') {
        throw new Error('数据格式错误：rootId 必须是字符串');
      }
      if (data.nodes.length === 0) {
        throw new Error('数据格式错误：nodes 为空');
      }

      // 检查 ID 唯一性 & 构建 ID 集合
      const ids = new Set();
      for (const n of data.nodes) {
        if (!n || typeof n.id !== 'string') {
          throw new Error('数据格式错误：节点缺少有效 id');
        }
        if (ids.has(n.id)) {
          throw new Error('数据格式错误：节点 id 重复：' + n.id);
        }
        ids.add(n.id);
        if (!Array.isArray(n.children)) {
          throw new Error('数据格式错误：节点 ' + n.id + ' 的 children 不是数组');
        }
        // 检查 parentId 指向有效节点（或为 null）
        if (n.parentId !== null && n.parentId !== undefined && !data.nodes.some(x => x.id === n.parentId)) {
          // 容忍但警告：将孤立节点挂到根下
          console.warn('节点 ' + n.id + ' 的 parentId 指向不存在的节点，将挂到根下');
        }
      }
      if (!ids.has(data.rootId)) {
        throw new Error('数据格式错误：rootId 不在节点列表中');
      }

      // ====== 正式加载 ======
      this.nodes.clear();
      data.nodes.forEach(n => {
        const node = {
          id: n.id,
          text: typeof n.text === 'string' ? n.text : '',
          parentId: n.parentId || null,
          children: Array.isArray(n.children) ? [...n.children] : [],
          collapsed: !!n.collapsed,
          collapsedToIcon: !!n.collapsedToIcon,
          x: typeof n.x === 'number' ? n.x : 0,
          y: typeof n.y === 'number' ? n.y : 0,
          customColor: n.customColor || null,
          customBorder: n.customBorder || null,
          fontSize: n.fontSize || null,
          fontColor: n.fontColor || null,
          fontFamily: n.fontFamily || null,
          fontWeight: n.fontWeight || null
        };
        // 如果 parentId 指向不存在的节点，则挂到根节点下
        if (node.parentId && !data.nodes.some(x => x.id === node.parentId)) {
          node.parentId = data.rootId;
        }
        this.nodes.set(node.id, node);
      });
    this.rootId = data.rootId;
    this.title = data.title || '未命名';
    this.selectedId = this.rootId;
    this._emit('change', { type: 'load' });
  }

  /**
   * 序列化为 JSON（与 load() 使用完全相同的字段定义，保证往返对称）
   */
toJSON() {
      const nodes = Array.from(this.nodes.values()).map(n => ({
        id: n.id,
        text: n.text,
        parentId: n.parentId,
        children: [...n.children],
        collapsed: !!n.collapsed,
        collapsedToIcon: !!n.collapsedToIcon,
        x: n.x,
        y: n.y,
        customColor: n.customColor || null,
        customBorder: n.customBorder || null,
        fontSize: n.fontSize || null,
        fontColor: n.fontColor || null,
        fontFamily: n.fontFamily || null,
        fontWeight: n.fontWeight || null
      }));
      return {
        version: 1,
        title: this.title,
        rootId: this.rootId,
        nodes
      };
    }

  // ====== 查询 ======

  get(id) { return this.nodes.get(id); }
  getRoot() { return this.nodes.get(this.rootId); }

  getAll() {
    return Array.from(this.nodes.values());
  }

  getVisible(focusId = null) {
    // 根据折叠状态获取可见节点
    // 如果传 focusId，则只显示 focus 路径及其子树
    const visible = new Set();

    if (focusId) {
      // focus 模式：只显示从根到 focus 的路径 + focus 的所有后代
      const focusPath = [];
      let cur = this.nodes.get(focusId);
      while (cur) {
        focusPath.unshift(cur.id);
        cur = cur.parentId ? this.nodes.get(cur.parentId) : null;
      }
      // 从根开始，但只展开 focus 路径上的子节点
      const walk = (id, pathIdx) => {
        const n = this.nodes.get(id);
        if (!n) return;
        visible.add(id);
        // 如果是 focus 路径上的节点，展开所有子节点
        if (pathIdx < focusPath.length - 1) {
          const nextId = focusPath[pathIdx + 1];
          walk(nextId, pathIdx + 1);
        } else {
          // 到达 focus 节点，展开所有子节点（不考虑折叠状态）
          n.children.forEach(cid => walk(cid, focusPath.length));
        }
      };
      walk(this.rootId, 0);
    } else {
      // 正常模式
      const walk = (id) => {
        const n = this.nodes.get(id);
        if (!n) return;
        visible.add(id);
        if (!n.collapsed) {
          n.children.forEach(walk);
        }
      };
      walk(this.rootId);
    }
    return visible;
  }

  getDepth(id) {
    let depth = 0;
    let cur = this.nodes.get(id);
    while (cur && cur.parentId) {
      depth++;
      cur = this.nodes.get(cur.parentId);
    }
    return depth;
  }

  getParent(id) {
    const n = this.nodes.get(id);
    return n && n.parentId ? this.nodes.get(n.parentId) : null;
  }

  getSiblings(id) {
    const n = this.nodes.get(id);
    if (!n || !n.parentId) return [];
    const p = this.nodes.get(n.parentId);
    return p ? p.children.filter(cid => cid !== id).map(cid => this.nodes.get(cid)) : [];
  }

  /**
   * 广度优先遍历
   * @param {Function} visit (node, depth) => boolean (返回 false 停止遍历)
   */
  traverse(visit) {
    if (!this.rootId) return;
    const queue = [{ id: this.rootId, depth: 0 }];
    while (queue.length) {
      const { id, depth } = queue.shift();
      const node = this.nodes.get(id);
      if (!node) continue;
      const stop = visit(node, depth);
      if (stop === false) return;
      node.children.forEach(cid => queue.push({ id: cid, depth: depth + 1 }));
    }
  }

  // ====== 修改 ======

  /**
   * 添加子节点
   * @param {string} parentId
   * @param {string} text
   * @returns 新节点 ID
   */
  addChild(parentId, text = '新节点') {
    const parent = this.nodes.get(parentId);
    if (!parent) return null;
    const node = {
      id: MindMap.genId(),
      text,
      parentId,
      children: [],
      collapsed: false,
      x: parent.x + 100,
      y: parent.y
    };
    this.nodes.set(node.id, node);
    parent.children.push(node.id);
    this._emit('change', { type: 'add', id: node.id, parentId });
    return node.id;
  }

  /**
   * 添加兄弟节点（在指定节点之后）
   */
  addSibling(id, text = '新节点') {
    const node = this.nodes.get(id);
    if (!node || !node.parentId) return null; // 根节点无兄弟
    return this.addChild(node.parentId, text);
  }

  /**
   * 删除节点及其所有后代
   */
  remove(id) {
    if (id === this.rootId) return false; // 不能删除根
    const node = this.nodes.get(id);
    if (!node) return false;
    // 递归删除
    const toRemove = [];
    const walk = (nid) => {
      const n = this.nodes.get(nid);
      if (!n) return;
      toRemove.push(nid);
      n.children.forEach(walk);
    };
    walk(id);
    // 从父节点移除引用
    const parent = this.nodes.get(node.parentId);
    if (parent) {
      parent.children = parent.children.filter(cid => cid !== id);
    }
    toRemove.forEach(rid => this.nodes.delete(rid));
    if (this.selectedId === id) {
      this.selectedId = parent ? parent.id : this.rootId;
    }
    this._emit('change', { type: 'remove', id });
    return true;
  }

/**
     * 更新节点文本
     * 默认不触发 change（因为通常在编辑结束时调用，避免重建 DOM 打断编辑）
     * 如果需要通知其他订阅者，传入 silent=false
     */
    updateText(id, text, emit = false) {
      const node = this.nodes.get(id);
      if (!node) return;
      node.text = text;
      if (emit) {
        this._emit('change', { type: 'update', id, field: 'text' });
      }
    }

  /**
   * 设置节点坐标
   */
  setPosition(id, x, y) {
    const node = this.nodes.get(id);
    if (!node) return;
    node.x = x;
    node.y = y;
    this._emit('change', { type: 'update', id, field: 'position' });
  }

/**
     * 切换折叠状态
     */
    toggleCollapse(id) {
      const node = this.nodes.get(id);
      if (!node) return;
      node.collapsed = !node.collapsed;
      this._emit('change', { type: 'update', id, field: 'collapsed' });
    }

    /**
     * 切换"缩为图标"状态
     * 当节点缩为图标时，它自身显示为小圆圈，且所有后代一并缩为图标
     * @param {string} id 节点 ID
     * @returns {boolean} 是否成功切换
     */
    toggleCollapsedToIcon(id) {
      const node = this.nodes.get(id);
      if (!node) return false;
      const newState = !node.collapsedToIcon;
      // 递归设置：当前节点 + 所有后代
      const apply = (nid) => {
        const n = this.nodes.get(nid);
        if (!n) return;
        n.collapsedToIcon = newState;
        if (!newState) {
          // 展开时同时取消 collapsed（显示完整）
          n.collapsed = false;
        }
        n.children.forEach(apply);
      };
      apply(id);
      this._emit('change', { type: 'toggleIcon', id, state: newState });
      return true;
    }

    /**
     * 设置节点为图标模式
     */
    collapseToIcon(id) {
      const node = this.nodes.get(id);
      if (!node) return false;
      const apply = (nid) => {
        const n = this.nodes.get(nid);
        if (!n) return;
        n.collapsedToIcon = true;
        n.children.forEach(apply);
      };
      apply(id);
      this._emit('change', { type: 'update', id, field: 'collapsedToIcon' });
      return true;
    }

    /**
     * 展开节点（从图标恢复）
     */
    expandFromIcon(id) {
      const node = this.nodes.get(id);
      if (!node) return false;
      const apply = (nid) => {
        const n = this.nodes.get(nid);
        if (!n) return;
        n.collapsedToIcon = false;
        n.children.forEach(apply);
      };
      apply(id);
      this._emit('change', { type: 'update', id, field: 'collapsedToIcon' });
      return true;
    }

    /**
     * 折叠所有节点（除了根节点）
     * 返回折叠前的状态（用于恢复）
     */
    collapseAll() {
      const snapshot = [];
      this.nodes.forEach((node, id) => {
        if (id !== this.rootId && !node.collapsed) {
          snapshot.push(id);
          node.collapsed = true;
        }
      });
      this._emit('change', { type: 'collapseAll' });
      return snapshot;
    }

    /**
     * 展开所有节点
     */
    expandAll() {
      const snapshot = [];
      this.nodes.forEach((node, id) => {
        if (node.collapsed) {
          snapshot.push(id);
          node.collapsed = false;
        }
      });
      this._emit('change', { type: 'expandAll' });
      return snapshot;
    }

    /**
     * 恢复指定节点列表的折叠状态
     * @param {string[]} ids 要恢复展开的节点 ID
     */
    restoreCollapsed(ids) {
      ids.forEach(id => {
        const node = this.nodes.get(id);
        if (node) node.collapsed = false;
      });
      this._emit('change', { type: 'restoreCollapsed' });
    }

    /**
     * 仅折叠指定节点列表
     */
    collapseNodes(ids) {
      ids.forEach(id => {
        const node = this.nodes.get(id);
        if (node) node.collapsed = true;
      });
      this._emit('change', { type: 'collapseNodes' });
    }

    /**
     * 切换"全部折叠"模式（用于概览）
     * 如果当前有任意子节点展开，则折叠所有；否则全部展开
     * @returns {'collapsed' | 'expanded' | 'nochange'}
     */
    toggleCollapseAll() {
      // 检查是否有任何节点是展开的（非根）
      let anyExpanded = false;
      this.nodes.forEach((node, id) => {
        if (id !== this.rootId && !node.collapsed && node.children.length > 0) {
          anyExpanded = true;
        }
      });
      if (anyExpanded) {
        this.collapseAll();
        return 'collapsed';
      } else {
        this.expandAll();
        return 'expanded';
      }
    }

/**
     * 选中节点
     */
    select(id) {
      if (this.selectedId === id) return;
      this.selectedId = id;
      this._emit('change', { type: 'select', id });
    }

    /**
     * 复制节点（含子树）到剪贴板
     * 返回序列化的节点数据
     */
    copySubtree(id) {
      const node = this.nodes.get(id);
      if (!node) return null;
      const result = this._serializeSubtree(id);
      return result;
    }

    _serializeSubtree(id) {
      const node = this.nodes.get(id);
      if (!node) return null;
      return {
        text: node.text,
        collapsed: node.collapsed,
        children: node.children.map(cid => this._serializeSubtree(cid)).filter(Boolean)
      };
    }

    /**
     * 从剪贴板数据添加为子节点
     * @returns 新节点 ID
     */
    pasteAsChild(parentId, data) {
      if (!data) return null;
      const parent = this.nodes.get(parentId);
      if (!parent) return null;
      const newId = this.addChild(parentId, data.text || '粘贴的节点');
      const newNode = this.nodes.get(newId);
      if (newNode && data.collapsed) {
        newNode.collapsed = data.collapsed;
      }
      // 递归粘贴子节点
      if (data.children && data.children.length > 0) {
        data.children.forEach(childData => {
          this.pasteAsChild(newId, childData);
        });
      }
      return newId;
    }

/**
     * 设置文档标题
     */
    setTitle(title) {
      this.title = title || '未命名';
      this._emit('change', { type: 'title', title: this.title });
    }

    // ====== 节点样式 ======

    /**
     * 设置节点的字体样式
     * @param {string} id 节点 ID
     * @param {object} style { fontSize, fontColor, fontFamily, fontWeight }
     */
    setNodeStyle(id, style) {
      const node = this.nodes.get(id);
      if (!node) return;
      const changes = {};
      if ('fontSize' in style) {
        node.fontSize = style.fontSize || null;
        changes.fontSize = node.fontSize;
      }
      if ('fontColor' in style) {
        node.fontColor = style.fontColor || null;
        changes.fontColor = node.fontColor;
      }
      if ('fontFamily' in style) {
        node.fontFamily = style.fontFamily || null;
        changes.fontFamily = node.fontFamily;
      }
      if ('fontWeight' in style) {
        node.fontWeight = style.fontWeight || null;
        changes.fontWeight = node.fontWeight;
      }
      this._emit('change', { type: 'update', id, field: 'style', changes });
    }

    /**
     * 重置节点的字体样式（恢复全局默认）
     */
    resetNodeStyle(id) {
      const node = this.nodes.get(id);
      if (!node) return;
      node.fontSize = null;
      node.fontColor = null;
      node.fontFamily = null;
      node.fontWeight = null;
      this._emit('change', { type: 'update', id, field: 'style', changes: 'reset' });
    }

    // ====== 同级排序 ======

    /**
     * 在同级兄弟节点中移动节点位置
     * @param {string} id 节点 ID
     * @param {number} delta 移动步数（-1 上移，+1 下移）
     * @returns {boolean} 是否移动成功
     */
    moveSibling(id, delta) {
      const node = this.nodes.get(id);
      if (!node || !node.parentId) return false; // 根节点不能排序
      const parent = this.nodes.get(node.parentId);
      if (!parent) return false;
      const idx = parent.children.indexOf(id);
      if (idx === -1) return false;
      const newIdx = idx + delta;
      if (newIdx < 0 || newIdx >= parent.children.length) return false;
      // 交换位置
      parent.children.splice(idx, 1);
      parent.children.splice(newIdx, 0, id);
      this._emit('change', { type: 'reorder', id, delta });
      return true;
    }

    /**
     * 将节点移动到同级最前面
     */
    moveToFirst(id) {
      const node = this.nodes.get(id);
      if (!node || !node.parentId) return false;
      const parent = this.nodes.get(node.parentId);
      if (!parent) return false;
      const idx = parent.children.indexOf(id);
      if (idx <= 0) return false; // 已经在最前
      parent.children.splice(idx, 1);
      parent.children.unshift(id);
      this._emit('change', { type: 'reorder', id, position: 'first' });
      return true;
    }

    /**
     * 将节点移动到同级最后
     */
    moveToLast(id) {
      const node = this.nodes.get(id);
      if (!node || !node.parentId) return false;
      const parent = this.nodes.get(node.parentId);
      if (!parent) return false;
      const idx = parent.children.indexOf(id);
      if (idx === -1 || idx === parent.children.length - 1) return false;
      parent.children.splice(idx, 1);
      parent.children.push(id);
      this._emit('change', { type: 'reorder', id, position: 'last' });
      return true;
    }

    /**
     * 查询节点在同级中的位置信息（用于 UI 决定哪些排序项可用）
     * @returns {object} { first, last, index, total }
     */
    getSiblingPosition(id) {
      const node = this.nodes.get(id);
      if (!node || !node.parentId) return null;
      const parent = this.nodes.get(node.parentId);
      if (!parent) return null;
      const idx = parent.children.indexOf(id);
      return {
        index: idx,
        total: parent.children.length,
        first: idx === 0,
        last: idx === parent.children.length - 1
      };
    }
  }

// 导出到全局
window.MindMap = MindMap;