// ============== Markdown 与思维导图互转模块 ==============
// 解析规则：
//   - 每行一个节点（空行跳过）
//   - 前导空格数 / 2 = 相对深度（2 空格 = 一层）
//   - 第一个非空行是根节点（深度 0）
//   - 后续节点的"树深度" = floor(leadingSpaces / 2) + 1
//   - 行首的 #、-、*、+、数字. 等标记被去除，仅保留纯文本

(function () {

  /**
   * 将 MindMap 数据转换为 Markdown 文本
   */
  function mindmapToMarkdown(mindmap) {
    if (!mindmap || !mindmap.rootId) return '';
    const lines = [];
    const root = mindmap.get(mindmap.rootId);
    if (!root) return '';

    // 根节点用 # 标题
    lines.push('# ' + root.text);

    // 递归处理子节点
    function walkChildren(parentId, depth) {
      const parent = mindmap.get(parentId);
      if (!parent) return;
      parent.children.forEach(cid => {
        const child = mindmap.get(cid);
        if (!child) return;
        const indent = '  '.repeat(depth);
        lines.push(indent + '• ' + child.text);
        walkChildren(cid, depth + 1);
      });
    }

    walkChildren(mindmap.rootId, 1);
    return lines.join('\n');
  }

  /**
   * 解析一行：计算缩进 + 提取纯文本
   */
  function parseLine(line) {
    if (!line || !line.trim()) return null;

    // 计算前导空格数（tab 按 2 空格）
    let leadingSpaces = 0;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === ' ') leadingSpaces++;
      else if (line[i] === '\t') leadingSpaces += 2;
      else break;
    }

    const trimmed = line.trim();
    let text = trimmed;

    // 去除 Markdown 标记（包括常见字符）
    // # / ## / ### ...
    const headingMatch = text.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      text = headingMatch[2].trim();
    } else {
      // - / * / + 以及 • (包括中文全角 ·、•、●、★ 等项目符号
      const listMatch = text.match(/^[-*+·•●○■□◆◇★☆♦□▲▼▶◀★☆♠♣♥♦]\s+(.+)$/);
      if (listMatch) {
        text = listMatch[1].trim();
      } else {
        // 数字.
        const numMatch = text.match(/^\d+\.\s+(.+)$/);
        if (numMatch) text = numMatch[1].trim();
      }
    }

    return { leadingSpaces, text: text.trim() };
  }

  /**
   * 将 Markdown 文本解析为思维导图数据
   * 核心算法：栈管理父子关系
   *   - 第一个节点 = 根节点（treeDepth = 0）
   *   - 其他节点的 treeDepth = floor(leadingSpaces / 2) + 1
   *   - 栈中维护当前路径：[{depth, id}, ...]
   *   - 弹出所有 depth >= 当前节点 depth 的元素
   *   - 栈顶即为父节点
   *   - 推入当前节点
   */
  function markdownToMindmap(text) {
    if (!text || !text.trim()) {
      throw new Error('文本为空');
    }

    const rawLines = text.split('\n');
    const parsedLines = [];

    for (const line of rawLines) {
      const parsed = parseLine(line);
      if (parsed) parsedLines.push(parsed);
    }

    if (parsedLines.length === 0) {
      throw new Error('没有有效的内容');
    }

    const nodes = [];
    const stack = [];  // [{ depth, id }]

    for (let i = 0; i < parsedLines.length; i++) {
      const line = parsedLines[i];
      let treeDepth;

      let nodeId = 'md_' + (i + 1);

      if (i === 0) {
        // 第一个节点 = 根节点 (depth 0)
        treeDepth = 0;
        const node = {
          id: nodeId,
          text: line.text,
          parentId: null,
          children: [],
          collapsed: false,
          x: 0, y: 0
        };
        nodes.push(node);
        stack.length = 0;
        stack.push({ depth: treeDepth, id: nodeId });
      } else {
        // 非根节点：treeDepth = 缩进空格数 / 2 + 1
        treeDepth = Math.floor(line.leadingSpaces / 2) + 1;

        const node = {
          id: nodeId,
          text: line.text,
          parentId: null,
          children: [],
          collapsed: false,
          x: 0, y: 0
        };

        // 弹出栈中 depth >= 当前 depth 的节点
        while (stack.length > 0 && stack[stack.length - 1].depth >= treeDepth) {
          stack.pop();
        }

        // 栈顶即为父节点（若栈为空， fallback 到根节点）
        let parentRef;
        if (stack.length === 0) {
          parentRef = nodes[0];
        } else {
          parentRef = nodes.find(n => n.id === stack[stack.length - 1].id) || nodes[0];
        }

        node.parentId = parentRef.id;
        parentRef.children.push(nodeId);
        nodes.push(node);
        stack.push({ depth: treeDepth, id: nodeId });
      }
    }

    return {
      rootId: nodes[0].id,
      nodes: nodes
    };
  }

  // ============== 导出 ==============
  window.MindMapMarkdown = {
    mindmapToMarkdown,
    markdownToMindmap
  };
})();
