// ============== 自动布局算法 ==============
// 实现经典的左右展开式（MindMap 风格）布局
// 根节点居中，一级分支左右对称分布，每个子分支占据相应角度范围

(function () {
  // 布局参数
  const CONFIG = {
    hGap: 80,                 // 水平间距（父子之间）
    vGap: 18,                 // 垂直间距（兄弟之间）
    baseFontSize: 15,         // 基础字号（用于估算节点宽度）
    charWidth: 15,            // 中文字符近似宽度（15px 字号 ≈ 1em）
    enCharWidth: 10,          // 英文字符/数字近似宽度（15px 字号）
    paddingX: 32,             // 节点水平内边距（CSS: 14px * 2 + 安全余量）
    paddingY: 14,             // 节点垂直内边距
    minNodeWidth: 64,
    minNodeHeight: 36
  };

  /**
   * 估算节点尺寸
   */
  function estimateSize(text) {
    const t = text || '';
    let width = 0;
    for (let i = 0; i < t.length; i++) {
      const c = t.charCodeAt(i);
      // 中文字符范围
      if ((c >= 0x4e00 && c <= 0x9fff) || (c >= 0xff00 && c <= 0xffef)) {
        width += CONFIG.charWidth;
      } else {
        width += CONFIG.enCharWidth;
      }
    }
    width = Math.max(CONFIG.minNodeWidth, width + CONFIG.paddingX);
    return { width, height: CONFIG.minNodeHeight };
  }

  /**
   * 主布局函数：左-右 树形布局
   * 根节点在 (0,0)，所有节点 x/y 被赋值
   * @param {MindMap} mindmap
   */
  function layoutLR(mindmap) {
    if (!mindmap.rootId) return;
    const root = mindmap.getRoot();
    if (!root) return;

    // 步骤 1：计算每个节点的子树高度（递归）
    const subtreeHeight = new Map();

    function calcHeight(id) {
      const node = mindmap.get(id);
      if (!node) return CONFIG.minNodeHeight;
      const selfSize = estimateSize(node.text);
      if (node.children.length === 0 || node.collapsed) {
        const h = selfSize.height;
        subtreeHeight.set(id, h);
        return h;
      }
      let childrenTotal = 0;
      const visibleChildren = node.collapsed ? [] : node.children;
      visibleChildren.forEach((cid, idx) => {
        if (idx > 0) childrenTotal += CONFIG.vGap;
        childrenTotal += calcHeight(cid);
      });
      const h = Math.max(selfSize.height, childrenTotal);
      subtreeHeight.set(id, h);
      return h;
    }

    calcHeight(mindmap.rootId);

    // 步骤 2：递归布局
    // 父节点居中（垂直方向），子节点围绕父节点对称分布
    function placeNode(id, x, centerY) {
      const node = mindmap.get(id);
      if (!node) return;
      const selfSize = estimateSize(node.text);
      // 节点中心 y 坐标
      node.x = x;
      node.y = centerY;

      if (node.collapsed || node.children.length === 0) return;

      // 子节点起始 y（左上角）
      const totalChildH = node.children.reduce((sum, cid) => {
        return sum + subtreeHeight.get(cid);
      }, 0) + CONFIG.vGap * (node.children.length - 1);

      let childY = centerY - totalChildH / 2;
      node.children.forEach(cid => {
        const ch = subtreeHeight.get(cid);
        const childCenterY = childY + ch / 2;
        placeNode(cid, x + selfSize.width + CONFIG.hGap, childCenterY);
        childY += ch + CONFIG.vGap;
      });
    }

    placeNode(mindmap.rootId, 0, 0);
  }

  /**
   * 计算所有节点的边界框（用于缩放到合适大小）
   */
  function getBounds(mindmap) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    mindmap.getAll().forEach(n => {
      const size = estimateSize(n.text);
      const halfW = size.width / 2;
      const halfH = size.height / 2;
      minX = Math.min(minX, n.x - halfW);
      maxX = Math.max(maxX, n.x + halfW);
      minY = Math.min(minY, n.y - halfH);
      maxY = Math.max(maxY, n.y + halfH);
    });
    if (minX === Infinity) {
      minX = maxX = minY = maxY = 0;
    }
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  }

  // 暴露到全局
  window.MindMapLayout = {
    layoutLR,
    getBounds,
    estimateSize
  };
})();