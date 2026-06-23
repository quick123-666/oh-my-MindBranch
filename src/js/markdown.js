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

  /**
   * 文章级 Markdown 解析：把任意一篇 MD 文章解析为思维导图
   *
   * 解析规则（按"读文章"思路设计）：
   *   1. 第一个 H1（# xxx）作为根节点；如果没有 H1，根节点用"导入的思维导图"或第一个 H2
   *   2. 多个 H1 视为根节点的兄弟分支
   *   3. 标题层级（H1=1, H2=2, ..., H6=6）按大小关系建父子：
   *        - 同级或更高级（数字更小）出现时，回到该层级重新分支
   *        - 任意标题直接作为其最近的、更高级标题的子节点
   *   4. 标题下的正文段落：作为该标题节点的"内容子节点"（单条文字）
   *        - 段落之间用空行分隔
   *   5. 列表项：作为该标题的子节点（带缩进则建层级）
   *   6. 代码块、引用、表格等忽略（或转成单个"代码/引用/表格"占位节点）
   *   7. 同一标题下的连续段落会合并为单条内容
   *   8. 若整篇文章无任何标题 / 列表，回退到普通 markdownToMindmap 解析
   *
   * @param {string} text Markdown 文本
   * @param {object} [opts] 选项
   * @param {string} [opts.rootText] 自定义根节点文字（默认取第一个 H1）
   * @returns {{rootId: string, nodes: Array, summary: {h1Count:number, h2Count:number, totalNodes:number, warnings:string[]}}}
   */
  function markdownArticleToMindmap(text, opts) {
    opts = opts || {};
    if (!text || !text.trim()) {
      throw new Error('文本为空');
    }

    const lines = text.split(/\r?\n/);
    const warnings = [];

    // ===== 预扫描：检测代码块围栏（反引号 3+ 和 ~ 3+） =====
    //   用于在"孤立 H1 排除"和"伪标题提升"中跳过代码块
    const inCodeFence = new Array(lines.length).fill(false);
    {
      let inFence = false;
      let fenceStart = -1;
      let fenceChar = null;
      // 用 new RegExp 构造，避免反引号在正则字面量里被误解
      const fenceRe = new RegExp('^(' + String.fromCharCode(96) + '{3,}|~{3,})');
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i].trim();
        if (!inFence) {
          const m = l.match(fenceRe);
          if (m) { inFence = true; fenceStart = i; fenceChar = m[1][0]; }
        } else {
          const re = new RegExp('^' + fenceChar + '{3,}\\s*$');
          if (re.test(l)) {
            for (let k = fenceStart; k <= i; k++) inCodeFence[k] = true;
            inFence = false; fenceStart = -1; fenceChar = null;
          }
        }
      }
      if (inFence) for (let k = fenceStart; k < lines.length; k++) inCodeFence[k] = true;
    }

    // ===== 预扫描：排除"孤立的真实 H1" =====
    //   BNF 示例、配置示例里的 # 标题：H1 但下面没有 H2 子节 → 排除
    //   必须在"伪标题提升"之前做，否则伪标题会"补齐"孤立的 H1
    {
      // 收集所有"真 H1"（在非代码块内）
      const trueH1Idxs = [];
      for (let i = 0; i < lines.length; i++) {
        if (inCodeFence[i]) continue;
        const m = lines[i].match(/^#\s+(.+)$/);
        if (m) trueH1Idxs.push(i);
      }
      // 找孤立 H1
      const isolatedH1Idxs = new Set();
      for (let k = 0; k < trueH1Idxs.length; k++) {
        const idx = trueH1Idxs[k];
        let hasChild = false;
        // 扫描 [idx+1, nextH1)
        const nextIdx = k + 1 < trueH1Idxs.length ? trueH1Idxs[k + 1] : lines.length;
        for (let j = idx + 1; j < nextIdx; j++) {
          if (inCodeFence[j]) continue;
          if (/^#{1,2}\s/.test(lines[j])) { hasChild = true; break; }
        }
        if (!hasChild) isolatedH1Idxs.add(idx);
      }
      // 排除孤立 H1：把它们替换成普通文本（去掉 # 前缀）
      if (isolatedH1Idxs.size > 0) {
        for (const idx of isolatedH1Idxs) {
          lines[idx] = lines[idx].replace(/^#\s+/, '');
        }
        warnings.push(`已忽略 ${isolatedH1Idxs.size} 个孤立 H1（无 H1/H2 子节，可能是 BNF/示例）`);
      }
    }

    // ===== 预扫描：去除"目录段" =====
    //   文档开头的"目录"段（连续列出"第 X 章"或"H1 标题"）通常是重复的目录
    //   找到第一段非空文字 → 之前的"第 X 章"和"# H1"行视为目录，去掉
    {
      // 找"目录"标记行（含"目录"二字，非代码块内）
      let tocMarker = -1;
      for (let i = 0; i < lines.length; i++) {
        if (inCodeFence[i]) continue;
        const l = lines[i].trim();
        // 找单字"目录"或"Contents"或"Table of Contents"
        if (l === '目录' || l === 'Contents' || /^Table of Contents$/i.test(l) || /^目\s*录$/.test(l)) {
          tocMarker = i;
          break;
        }
      }
      if (tocMarker >= 0) {
        // 目录段：从 tocMarker 到下一个"非 # 非 第 X 章" 行
        let tocEnd = tocMarker + 1;
        for (let i = tocMarker + 1; i < lines.length; i++) {
          if (inCodeFence[i]) continue;
          const l = lines[i].trim();
          if (!l) continue;
          // 跳过 # H1 / 第 X 章
          if (/^#{1,6}\s/.test(l)) continue;
          if (/^第\s*[一二三四五六七八九十百千零0-9]+\s*[章节讲篇部]/.test(l)) continue;
          // 遇到其他内容 → 目录段结束
          tocEnd = i;
          break;
        }
        // 移除 tocMarker 到 tocEnd 之间的内容（用空行替换）
        let removed = 0;
        for (let i = tocMarker; i < tocEnd; i++) {
          if (lines[i].trim() && lines[i].trim() !== '目录' && lines[i].trim() !== 'Contents') {
            if (!inCodeFence[i]) {
              lines[i] = '';
              removed++;
            }
          }
        }
        if (removed > 0) warnings.push(`已移除 ${removed} 行目录段`);
      }
    }

    // ===== 伪标题提升 pass =====
    // 把"看起来像小节标题"但没有 # 前缀的行，升级为 H2/H3/H4
    // 规则：
    //   1. 数字编号（必须是 2 级以上，如 1.1 / 2.3.4）→ 升级为 H3
    //   2. 数字编号（3 级以上，如 1.1.1）→ 升级为 H4
    //   3. "第 X 章" / "Chapter X" → 升级为 H2
    //   4. "第 X 章" 全程都识别（不要求前置 H1），但有"上下文"窗口限制（防误伤）
    //      数字编号必须在前一个 heading 之后才生效
    {
      // 先扫一遍：有没有真实标题？
      let hasRealHeading = false;
      for (const l of lines) {
        if (/^#{1,6}\s/.test(l)) { hasRealHeading = true; break; }
      }
      let lastRealHeadingLevel = hasRealHeading ? 0 : 1; // 无真实标题时，全程启用
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (/^#{1,6}\s/.test(l)) {
          const m = l.match(/^(#{1,6})\s/);
          if (m) lastRealHeadingLevel = m[1].length;
          continue;
        }
        // "第 X 章" 形式：全程识别（哪怕没前置 H1），但要在"前 200 行"内或"前一个 H 之后 200 行内"
        const chapterMatch = l.match(/^第\s*[一二三四五六七八九十百千零0-9]+\s*[章节讲篇部]\s*[：:、]?\s*(.{0,40})$/);
        if (chapterMatch && chapterMatch[1].trim().length > 0 && chapterMatch[1].length <= 40) {
          // 只在"文档靠前位置"识别（避免误伤正文中"第一章"这样的描述）
          // 或者在"上一个真 H" 200 行内
          let inValidRange = false;
          if (i < 300) inValidRange = true; // 文档前 300 行
          else {
            for (let j = i - 1; j >= Math.max(0, i - 200); j--) {
              if (/^#{1,6}\s/.test(lines[j])) { inValidRange = true; break; }
            }
          }
          if (inValidRange) {
            lines[i] = '## ' + l.trim();
            lastRealHeadingLevel = 2;
            continue;
          }
        }
        if (lastRealHeadingLevel === 0) continue;
        // 检测数字编号小标题：1.1 / 2.3.4
        const numMatch = l.match(/^(\d+(?:\.\d+)+)\s+(.+)$/);
        if (numMatch) {
          const numDepth = numMatch[1].split('.').length;
          const titleText = numMatch[2].trim();
          if (titleText.length <= 60 && titleText.length > 0) {
            const newLevel = Math.min(6, numDepth + 1);
            lines[i] = '#'.repeat(newLevel) + ' ' + numMatch[1] + ' ' + titleText;
            lastRealHeadingLevel = newLevel;
            continue;
          }
        }
      }
    }
    // ===== 伪标题提升 pass 结束 =====

    // 提取代码块区域（这些区域内的 # 不当标题）
    // 复用前面已经算好的 inCodeFence 数组
    const inCodeBlock = (idx) => inCodeFence[idx];

    // 提取引用块起始（这些行的 # 也不当标题）
    const quoteRanges = [];
    let qStart = -1;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/^\s*>+\s?/.test(l)) {
        if (qStart < 0) qStart = i;
      } else {
        if (qStart >= 0 && i - qStart > 0) {
          quoteRanges.push([qStart, i - 1]);
        }
        qStart = -1;
      }
    }
    if (qStart >= 0) quoteRanges.push([qStart, lines.length - 1]);
    const inQuote = (idx) => quoteRanges.some(([a, b]) => idx >= a && idx <= b);

    // 1) 收集所有"标题行"
    const headingLines = []; // {lineIdx, level, text}
    for (let i = 0; i < lines.length; i++) {
      if (inCodeBlock(i) || inQuote(i)) continue;
      const m = lines[i].match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (m) {
        headingLines.push({ lineIdx: i, level: m[1].length, text: cleanInline(m[2]) });
      }
    }
    // 注：孤立 H1 排除在前面（伪标题提升 pass 之前）已经做过了

    // 2) 若完全没有 H1~H6 标题，回退
    if (headingLines.length === 0) {
      try {
        const fallback = markdownToMindmap(text);
        return Object.assign({ summary: { h1Count: 0, h2Count: 0, totalNodes: fallback.nodes.length, warnings: ['未识别到任何标题，已使用缩进式解析'] } }, fallback);
      } catch (e) {
        throw new Error('文章中没有可识别的标题或列表');
      }
    }

    // 3) 根节点
    const firstH1 = headingLines.find(h => h.level === 1);
    let rootText;
    if (opts.rootText && opts.rootText.trim()) {
      rootText = opts.rootText.trim();
    } else if (firstH1) {
      // 默认策略：第一个 H1 当根。但 H1 太短（≤ 20 字）且是孤立的 → 找首段文字当根
      const isFirstH1Short = firstH1.text.length <= 20;
      if (isFirstH1Short) {
        // 找首段非空非标题非列表的文字
        for (let i = 0; i < lines.length; i++) {
          if (inCodeFence[i]) continue;
          const l = lines[i].trim();
          if (!l) continue;
          if (/^#{1,6}\s/.test(l)) continue;
          if (/^[-*+·•●]/.test(l)) continue;
          if (l.length >= 5 && l.length <= 80) {
            rootText = l;
            break;
          }
        }
        if (!rootText) rootText = firstH1.text;
      } else {
        rootText = firstH1.text;
      }
    } else {
      // 没有 H1，找最小的 level 当作"伪根"层
      const minLevel = Math.min.apply(null, headingLines.map(h => h.level));
      const pseudo = headingLines.find(h => h.level === minLevel);
      rootText = '文章导图：' + pseudo.text.slice(0, 20);
    }

    const nodes = [];
    const idSeq = { n: 0 };
    function newId() { return 'a_' + (++idSeq.n); }

    const root = {
      id: newId(),
      text: rootText,
      parentId: null,
      children: [],
      collapsed: false,
      x: 0, y: 0
    };
    nodes.push(root);

    // 4) 用栈建立层级
    // 栈里是 {level, node}，level 是该标题在文章中的级别（H1~H6）
    // 行为：遇到标题时，弹出所有 level >= 当前 level 的元素，栈顶即为父节点
    const stack = [{ level: 0, node: root }];

    // 5) 处理标题间的正文段落
    // 我们记录每个标题"管辖的范围"：从该行之后，到下一个标题（任意级别）之前
    // 范围内的非空非列表行就是正文段落
    function processParagraphsForHeading(headingNode, startLine, endLine) {
      const buf = [];
      const flush = () => {
        if (buf.length > 0) {
          const content = buf.join(' ').trim();
          if (content) {
            const child = makeContentChild(headingNode, content);
            if (child) pushNode(child);
          }
          buf.length = 0;
        }
      };
      for (let i = startLine; i <= endLine; i++) {
        const l = lines[i];
        if (inCodeBlock(i)) {
          // 跳过普通代码块
          flush();
          // ASCII box（┌─┐│ 等）：提取其中的列表行作为子节点
          // 检查"是不是代码块的第一行"：前一行不在代码块里
          if (!inCodeBlock(i - 1)) {
            // 找代码块结束位置
            let blockEnd = i;
            while (blockEnd <= endLine && inCodeBlock(blockEnd)) blockEnd++;
            blockEnd--; // 最后一行还在代码块内
            extractAsciiBoxItems(headingNode, i, blockEnd);
            i = blockEnd; // 跳到代码块外
            continue;
          }
          continue;
        }
        if (/^\s*$/.test(l)) { flush(); continue; }
        // 跳过列表行 / 引用行 / 表格行（已另外处理或在标题外）
        if (/^\s*([-*+·•●]|\d+\.)\s+/.test(l)) { flush(); continue; }
        if (/^\s*>+/.test(l)) { flush(); continue; }
        if (/^\s*\|/.test(l)) { flush(); continue; }
        if (/^---+\s*$/.test(l) || /^\*\*\*+\s*$/.test(l)) { flush(); continue; }

        // 普通段落
        buf.push(l.trim());
      }
      flush();
    }

    /**
     * 提取 ASCII box（如 4.2 节的 "类型 1: ..."）里的列表行作为 heading 的子节点
     * 支持：
     *   - "├── xxx" / "└── xxx"（树状）
     *   - "类型 1: Command Hook" / "步骤 1: CLAUDE.md"（编号段）
     *   - 单独的 "xxx" 段
     */
    function extractAsciiBoxItems(headingNode, startLine, endLine) {
      // 检查是不是 ASCII box（有 ┌─┐│ 等字符）
      let isBox = false;
      for (let i = startLine; i <= endLine; i++) {
        if (/[┌┐└┘├┤┬┴┼─│╭╮╰╯]/.test(lines[i])) { isBox = true; break; }
      }
      if (!isBox) return;

      // 提取行
      const items = [];
      for (let i = startLine; i <= endLine; i++) {
        const raw = lines[i];
        // 跳过围栏行
        if (/^\s*```/.test(raw)) continue;
        // 跳过纯 box 边框行（只包含 box 字符 + 空白）
        if (/^[\s┌┐└┘├┤┬┴┼─│╭╮╰╯\-+=*]+$/.test(raw)) continue;
        // 跳过 "矩阵" 表头行（"低成本 ← → 高成本"）
        if (/[←→]/.test(raw) && /[高低]/.test(raw)) continue;
        // 剥掉 box 字符 + 树状前缀 + 列表符号
        const stripped = raw
          .replace(/[│┌┐└┘├┤┬┴┼─╭╮╰╯]/g, '')  // box 字符
          .replace(/^\s*[·•]+\s+/, '')             // • 标记
          .replace(/^\s*\d+\.\s+/, '')             // 1. 数字
          .replace(/^\s*\|/, '')                   // 行首 |
          .trim();
        if (!stripped) continue;
        if (/^[\s\-\=\*]+$/.test(stripped)) continue;
        items.push(stripped);
      }
      if (items.length === 0) return;

      // 把"类型 N: xxx"分组；其他作为"内容"
      const groups = [];
      let currentGroup = null;
      for (const it of items) {
        const m = it.match(/^(类型|步骤|模式|阶段|章节|##|###|层|Layer|Stage|Step|Type|Step)\s*(\d+|[一二三四五六七八九十]+)\s*[:：、]\s*(.+)$/);
        if (m) {
          if (currentGroup) groups.push(currentGroup);
          currentGroup = { header: it, children: [] };
        } else if (currentGroup) {
          currentGroup.children.push(it);
        } else {
          groups.push({ header: null, item: it });
        }
      }
      if (currentGroup) groups.push(currentGroup);

      for (const g of groups) {
        if (g.header) {
          const headerNode = makeListChild(headingNode, g.header);
          if (headerNode) {
            pushNode(headerNode);
            for (const c of g.children) {
              const sub = makeListChild(headerNode, c);
              if (sub) pushNode(sub);
            }
          }
        } else {
          const child = makeListChild(headingNode, g.item);
          if (child) pushNode(child);
        }
      }
    }

    function makeContentChild(parent, text) {
      if (!text) return null;
      const cleaned = cleanInline(text);
      if (!cleaned) return null;
      // 段落文本过长截断
      const t = cleaned.length > 200 ? cleaned.slice(0, 197) + '...' : cleaned;
      return {
        id: newId(),
        text: t,
        parentId: parent.id,
        children: [],
        collapsed: false,
        x: 0, y: 0,
        _kind: 'content'
      };
    }

    function makeListChild(parent, text, level) {
      const t = text.length > 120 ? text.slice(0, 117) + '...' : text;
      return {
        id: newId(),
        text: t,
        parentId: parent.id,
        children: [],
        collapsed: false,
        x: 0, y: 0,
        _kind: 'list'
      };
    }

    function pushNode(node) {
      nodes.push(node);
      const parent = nodes.find(n => n.id === node.parentId);
      if (parent) parent.children.push(node.id);
    }

    // 6) 遍历所有标题（含第一个 H1）
    let skipFirstH1 = !!firstH1;
    for (let i = 0; i < headingLines.length; i++) {
      const h = headingLines[i];
      // 跳过第一个 H1（它已经当根了），但处理其下的段落 / 列表
      if (skipFirstH1 && h === firstH1) {
        skipFirstH1 = false;
        const nextHeadingIdx = i + 1 < headingLines.length ? headingLines[i + 1].lineIdx : lines.length;
        processParagraphsForHeading(root, h.lineIdx + 1, nextHeadingIdx - 1);
        const listStack = [{ indent: -1, node: root }];
        for (let li = h.lineIdx + 1; li <= nextHeadingIdx - 1; li++) {
          if (inCodeBlock(li)) continue;
          const raw = lines[li];
          if (/^\s*$/.test(raw)) continue;
          if (/^\s*>+/.test(raw)) continue;
          const lm = raw.match(/^(\s*)([-*+·•●○■□◆◇★☆]|\d+\.)\s+(.+?)\s*$/);
          if (!lm) continue;
          const indent = lm[1].replace(/\t/g, '  ').length;
          const itemText = cleanInline(lm[3]);
          if (!itemText) continue;
          while (listStack.length > 1 && listStack[listStack.length - 1].indent >= indent) {
            listStack.pop();
          }
          const listParent = listStack[listStack.length - 1].node;
          const listNode = makeListChild(listParent, itemText, indent);
          if (listNode) {
            pushNode(listNode);
            listStack.push({ indent: indent, node: listNode });
          }
        }
        // 第一个 H1 之后，将 H1 级别压栈
        stack.push({ level: h.level, node: root });
        continue;
      }
      // 弹栈：level >= 当前 level 的全部弹出
      while (stack.length > 1 && stack[stack.length - 1].level >= h.level) {
        stack.pop();
      }
      const parent = stack[stack.length - 1].node;
      const node = {
        id: newId(),
        text: h.text,
        parentId: parent.id,
        children: [],
        collapsed: false,
        x: 0, y: 0,
        _kind: 'heading',
        _level: h.level
      };
      pushNode(node);
      stack.push({ level: h.level, node });

      // 收集这个标题范围内的"列表项"（支持嵌套）
      // 列表项作为该标题节点的子节点，缩进建层级
      const nextHeadingIdx = i + 1 < headingLines.length ? headingLines[i + 1].lineIdx : lines.length;
      const listStart = h.lineIdx + 1;
      const listEnd = nextHeadingIdx - 1;

      // 段落正文
      processParagraphsForHeading(node, listStart, listEnd);

      // 列表
      // 简单做法：按行解析"- item"，"  - sub-item"，按缩进建栈
      const listStack = [{ indent: -1, node: node }];
      for (let li = listStart; li <= listEnd; li++) {
        if (inCodeBlock(li)) continue;
        const raw = lines[li];
        if (/^\s*$/.test(raw)) continue;
        if (/^\s*>+/.test(raw)) continue;
        const lm = raw.match(/^(\s*)([-*+·•●○■□◆◇★☆]|\d+\.)\s+(.+?)\s*$/);
        if (!lm) continue;
        const indent = lm[1].replace(/\t/g, '  ').length;
        const itemText = cleanInline(lm[3]);
        if (!itemText) continue;
        // 弹栈：indent <= 栈顶 indent 的弹掉
        while (listStack.length > 1 && listStack[listStack.length - 1].indent >= indent) {
          listStack.pop();
        }
        const listParent = listStack[listStack.length - 1].node;
        const listNode = makeListChild(listParent, itemText, indent);
        if (listNode) {
          pushNode(listNode);
          listStack.push({ indent: indent, node: listNode });
        }
      }
    }

    const h1Count = headingLines.filter(h => h.level === 1).length;
    const h2Count = headingLines.filter(h => h.level === 2).length;
    if (h1Count === 0) {
      warnings.push('文章没有 # H1 一级标题，已用最小标题级别建树');
    }
    if (h1Count > 1) {
      warnings.push('检测到 ' + h1Count + ' 个 H1 一级标题');
    }

    return {
      rootId: root.id,
      nodes: nodes,
      summary: {
        h1Count: h1Count,
        h2Count: h2Count,
        totalNodes: nodes.length,
        warnings: warnings
      }
    };
  }

  // 清理行内 MD 标记
  function cleanInline(text) {
    if (!text) return '';
    var s = String(text);
    // 链接
    s = s.replace(/\[[^\]]+\]\([^)]+\)/g, function (m) {
      var t = m.match(/^\[([^\]]+)\]/);
      return t ? t[1] : '';
    });
    // 图片
    s = s.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
    // 行内 code
    s = s.replace(/`[^`]+`/g, function (m) {
      return m.slice(1, -1);
    });
    // 粗体
    s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
    s = s.replace(/__([^_]+)__/g, '$1');
    // 斜体
    s = s.replace(/\*([^*]+)\*/g, '$1');
    s = s.replace(/_([^_]+)_/g, '$1');
    // 删除线
    s = s.replace(/~~([^~]+)~~/g, '$1');
    return s.trim();
  }

  // ============== 导出 ==============
  window.MindMapMarkdown = {
    mindmapToMarkdown,
    markdownToMindmap,
    markdownArticleToMindmap,
    cleanInline
  };
})();
