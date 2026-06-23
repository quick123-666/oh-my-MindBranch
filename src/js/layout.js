// ============== 自动布局算法 ==============
// 实现经典的左右展开式（MindMap 风格）布局
// 根节点居中，一级分支左右对称分布，每个子分支占据相应角度范围

(function () {
  // 布局参数
  const CONFIG = {
    hGap: 80,                 // 水平间距（父子之间）
    vGap: 32,                 // 垂直间距（兄弟之间）—— 加大避免多行节点相互贴
    baseFontSize: 15,         // 基础字号（用于估算节点宽度）
    baseLineHeight: 26,       // 基础行高（px）
    charWidth: 14,            // 中文字符近似宽度（实测 PingFang 15px 字号约 14px）
    enCharWidth: 8,           // 英文字符/数字近似宽度（实测 ≈ 7-8px）
    paddingX: 30,             // 节点水平内边距（CSS 14px*2 + 2px 余量）
    paddingY: 20,             // 节点垂直内边距（CSS 6px*2 + 8px 余量）
    minNodeWidth: 60,
    minNodeHeight: 44,
    // 节点最大宽度（超过会换行）。估算高度时按"按这个宽度换行"算行数
    maxNodeWidth: 360,
    // wrap 内宽安全系数（更窄 → 多算行数 → 节点更高 → 不会重叠）
    wrapSafetyFactor: 0.75
  };

  /**
   * 把字符串按"视觉宽度"算像素宽度，再按 maxPx 切行，返回行数
   * 切行策略：优先在空格 / 中英标点处切
   */
  function _wrapLines(text, maxPx) {
    const t = text || '';
    if (!t) return 1;
    const tokens = [];
    // 1) 按空格 / 标点切成 token
    let buf = '';
    const pushBuf = () => { if (buf) { tokens.push(buf); buf = ''; } };
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (ch === ' ' || ch === '\t') { pushBuf(); continue; }
      if ('，。；：、,.;:!?！？'.indexOf(ch) >= 0) {
        buf += ch;
        pushBuf();
        continue;
      }
      buf += ch;
    }
    pushBuf();
    if (tokens.length === 0) tokens.push(t);

    const lines = [];
    let cur = '';
    let curW = 0;
    const tokenPx = (tok) => {
      let w = 0;
      for (let i = 0; i < tok.length; i++) {
        const c = tok.charCodeAt(i);
        const isCJK = (c >= 0x4e00 && c <= 0x9fff) || (c >= 0xff00 && c <= 0xffef);
        w += isCJK ? CONFIG.charWidth : CONFIG.enCharWidth;
      }
      return w;
    };
    for (const tok of tokens) {
      const w = tokenPx(tok);
      // 单词自身比 maxPx 还宽 → 强制字符级切
      if (w > maxPx) {
        if (cur) { lines.push(cur); cur = ''; curW = 0; }
        // 字符级切这个 token
        for (let i = 0; i < tok.length; i++) {
          const ch = tok[i];
          const c = tok.charCodeAt(i);
          const isCJK = (c >= 0x4e00 && c <= 0x9fff) || (c >= 0xff00 && c <= 0xffef);
          const cw = isCJK ? CONFIG.charWidth : CONFIG.enCharWidth;
          if (curW + cw > maxPx && cur) { lines.push(cur); cur = ''; curW = 0; }
          cur += ch; curW += cw;
        }
        continue;
      }
      // 普通 token：加上去不会超 → 加；会超 → 换行
      if (curW + w > maxPx && cur) {
        lines.push(cur);
        cur = tok;
        curW = w;
      } else {
        cur += (cur ? ' ' : '') + tok;
        curW += w + (cur ? CONFIG.enCharWidth : 0);
      }
    }
    if (cur) lines.push(cur);
    return Math.max(1, lines.length);
  }

  /**
   * 估算节点尺寸：宽 = max(最小宽, 文字视觉宽 + padding)，
                  高 = max(最小高, 行数 * 行高 + padding)
   * 注意：高度**真实**按行数算，避免多行节点被布局压扁导致文字溢出
   */
  function estimateSize(text) {
    const t = text || '';
    // 1) 算单行像素宽
    let singleLineW = 0;
    for (let i = 0; i < t.length; i++) {
      const c = t.charCodeAt(i);
      const isCJK = (c >= 0x4e00 && c <= 0x9fff) || (c >= 0xff00 && c <= 0xffef);
      singleLineW += isCJK ? CONFIG.charWidth : CONFIG.enCharWidth;
    }
    // 2) 按 maxNodeWidth 切行
    const innerW = Math.floor((CONFIG.maxNodeWidth - CONFIG.paddingX) * CONFIG.wrapSafetyFactor);
    let width;
    let lineCount;
    if (singleLineW + CONFIG.paddingX <= CONFIG.maxNodeWidth) {
      // 单行
      width = Math.max(CONFIG.minNodeWidth, singleLineW + CONFIG.paddingX);
      lineCount = 1;
    } else {
      // 多行
      lineCount = _wrapLines(t, innerW);
      width = CONFIG.maxNodeWidth;
    }
    const height = Math.max(CONFIG.minNodeHeight, lineCount * CONFIG.baseLineHeight + CONFIG.paddingY);
    return { width, height, lineCount };
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

  /**
   * 聚焦模式下的"子节点重排"：
   * 把 focus 节点的直接子节点按 y 方向均匀分布，腾出空间感
   *  - 不动 x 坐标（连线不会错位）
   *  - 不动 focus 节点自身的位置
   *  - 不动孙节点的绝对位置（它们由 placeNode 跟着父走）
   *  - 仅覆盖子节点 y，让它们从 focus 中心对称展开
   *
   * @param {MindMap} mindmap
   * @param {string} focusId
   * @param {object} [opts] { minGap: 24 }  // 兄弟之间最小垂直间距
   */
  function relayoutFocusChildren(mindmap, focusId, opts) {
    opts = opts || {};
    if (!mindmap || !focusId) return;
    const focus = mindmap.get(focusId);
    if (!focus || !focus.children || focus.children.length === 0) return;

    const minGap = opts.minGap || 24;

    // 计算每个子节点"应该占用的垂直空间" = 它自己的高度 + 子树总高度
    function childSlotHeight(cid) {
      const sub = subtreeHeightCache.get(cid);
      if (typeof sub === 'number') return sub;
      // 没缓存就现场算（防御性，正常流程下 layoutLR 已在前面跑过）
      let h = estimateSize(mindmap.get(cid).text).height;
      const c = mindmap.get(cid);
      if (c && c.children && c.children.length > 0 && !c.collapsed) {
        c.children.forEach(gid => { h += childSlotHeight(gid) + CONFIG.vGap; });
      }
      return h;
    }

    // 复用 layoutLR 的 subtreeHeight 缓存（如果存在）；否则自建
    const subtreeHeightCache = layoutLR._subtreeHeightCache || new Map();
    if (!layoutLR._subtreeHeightCache) {
      // 自建缓存（仅本次聚焦模式使用）
      function build(id) {
        const n = mindmap.get(id);
        if (!n) return CONFIG.minNodeHeight;
        const selfH = estimateSize(n.text).height;
        if (!n.children || n.children.length === 0 || n.collapsed) {
          subtreeHeightCache.set(id, selfH);
          return selfH;
        }
        let total = 0;
        n.children.forEach((cid, i) => {
          if (i > 0) total += CONFIG.vGap;
          total += build(cid);
        });
        const h = Math.max(selfH, total);
        subtreeHeightCache.set(id, h);
        return h;
      }
      build(mindmap.rootId);
    }

    // 计算所有子节点总高度 + 间距
    let total = 0;
    focus.children.forEach((cid, i) => {
      if (i > 0) total += Math.max(CONFIG.vGap, minGap);
      total += childSlotHeight(cid);
    });

    // 让子节点围绕 focus.y 对称分布
    let y = focus.y - total / 2;
    focus.children.forEach((cid, i) => {
      const h = childSlotHeight(cid);
      const centerY = y + h / 2;
      const c = mindmap.get(cid);
      if (c) {
        c.y = centerY;
        // 同步调整子节点的子节点：让它们在 c 周围重新分布
        if (c.children && c.children.length > 0 && !c.collapsed) {
          redistributeChildren(mindmap, cid, c.y);
        }
      }
      y += h + Math.max(CONFIG.vGap, minGap);
    });
  }

  /**
   * 递归把某节点的所有后代 y 居中在它周围
   * （聚焦时让孙节点也跟着居中，不至于堆在父的同一行）
   */
  function redistributeChildren(mindmap, parentId, parentY) {
    const p = mindmap.get(parentId);
    if (!p || !p.children || p.children.length === 0) return;
    let total = 0;
    p.children.forEach((cid, i) => {
      if (i > 0) total += CONFIG.vGap;
      const cn = mindmap.get(cid);
      if (cn) total += estimateSize(cn.text).height;
    });
    let y = parentY - total / 2;
    p.children.forEach(cid => {
      const cn = mindmap.get(cid);
      if (!cn) return;
      const h = estimateSize(cn.text).height;
      cn.y = y + h / 2;
      if (cn.children && cn.children.length > 0 && !cn.collapsed) {
        redistributeChildren(mindmap, cid, cn.y);
      }
      y += h + CONFIG.vGap;
    });
  }

  // 暴露到全局
  window.MindMapLayout = {
    layoutLR,
    relayoutFocusChildren,
    getBounds,
    estimateSize
  };
})();