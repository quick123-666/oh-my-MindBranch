// ============== MD 文章导入器 ==============
// 提供：
//   - openImporterDialog(app)：弹出对话框（粘贴 / 选文件 / 实时预览 / 应用）
//   - importFromText(app, text, opts)：从文本直接生成（不弹对话框）
//   - importFromClipboard(app)：从剪贴板读取并生成
//   - importFromFile(app)：通过文件对话框读取 .md 文件
//
// 所有"直接生成"路径都自动替换当前导图（保留撤销）。

(function () {

  /**
   * 把解析结果应用到导图
   * @param {App} app
   * @param {string} text
   * @param {object} [opts] { rootText, source, skipDirtyCheck }
   * @returns {Promise<{success: boolean, totalNodes?: number, error?: string, canceled?: boolean}>}
   */
  async function importFromText(app, text, opts) {
    opts = opts || {};
    if (!text || !text.trim()) {
      return { success: false, error: 'Markdown 内容为空' };
    }
    if (!window.MindMapMarkdown || !window.MindMapMarkdown.markdownArticleToMindmap) {
      return { success: false, error: 'Markdown 模块未加载' };
    }

    // 解析
    let data;
    try {
      data = window.MindMapMarkdown.markdownArticleToMindmap(text, { rootText: opts.rootText });
    } catch (err) {
      console.error('Parse markdown failed:', err);
      if (app._showStatus) app._showStatus('解析失败：' + (err.message || '未知错误'), 3000);
      return { success: false, error: err.message || '解析失败' };
    }
    if (!data || !data.rootId || !Array.isArray(data.nodes) || data.nodes.length === 0) {
      return { success: false, error: '解析结果为空' };
    }

    // 冲突检测：当前画布有未保存内容？弹三选一
    if (!opts.skipDirtyCheck && _hasContent(app) && app.mindmap.dirty) {
      const choice = await _confirmReplace(app, data);
      if (choice === 'cancel') {
        if (app._showStatus) app._showStatus('已取消导入', 1200);
        return { success: false, canceled: true };
      }
      if (choice === 'merge') {
        // 复制为子节点：把新导图根节点挂到当前根节点下
        return _mergeAsChildren(app, data, opts);
      }
      // choice === 'replace' → 走下方替换逻辑
    }

    // 替换当前导图
    return _applyReplace(app, data, opts);
  }

  /**
   * 当前画布是否有内容（节点数 > 0）
   */
  function _hasContent(app) {
    try {
      const all = app.mindmap.getAll ? app.mindmap.getAll() : [];
      return all.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * 弹三选一确认对话框：替换 / 合并为子节点 / 取消
   * @returns {Promise<'replace' | 'merge' | 'cancel'>}
   */
  function _confirmReplace(app, parsedData) {
    return new Promise((resolve) => {
      // 已有则复用
      let modal = document.getElementById('mdImportConfirmModal');
      if (modal) modal.remove();
      modal = document.createElement('div');
      modal.id = 'mdImportConfirmModal';
      modal.className = 'modal-mask';
      const nodeCount = parsedData.nodes.length;
      const h1Count = (parsedData.summary && parsedData.summary.h1Count) || 0;
      const oldCount = _hasContent(app) ? (app.mindmap.getAll().length) : 0;
      modal.innerHTML = `
        <div class="md-confirm-dialog">
          <div class="md-confirm-header">
            <span class="md-confirm-icon">⚠️</span>
            <span class="md-confirm-title">当前画布有未保存的修改</span>
          </div>
          <div class="md-confirm-body">
            <p>当前画布上有 <b>${oldCount}</b> 个节点，导入会覆盖这部分内容。</p>
            <p>将导入的 Markdown 共 <b>${nodeCount}</b> 个节点${h1Count ? `（含 ${h1Count} 个 H1）` : ''}。</p>
            <p>请选择处理方式：</p>
            <ul class="md-confirm-options">
              <li><b>替换</b>：清空当前画布，导入新内容（可通过 Ctrl+Z 撤销）</li>
              <li><b>合并</b>：把导入的导图作为当前根节点的子分支（保留两边内容）</li>
              <li><b>取消</b>：不导入，保持当前画布</li>
            </ul>
          </div>
          <div class="md-confirm-footer">
            <button class="md-btn md-btn-secondary" data-action="cancel">取消</button>
            <button class="md-btn md-btn-secondary" data-action="merge">合并为子节点</button>
            <button class="md-btn md-btn-primary" data-action="replace">替换（清空后导入）</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      // 默认焦点在"取消"上（防误操作）
      setTimeout(() => {
        const cancelBtn = modal.querySelector('[data-action="cancel"]');
        if (cancelBtn) cancelBtn.focus();
      }, 30);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          // 点遮罩不关闭（强制三选一）
          return;
        }
      });
      modal.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.getAttribute('data-action');
          modal.remove();
          resolve(action);
        });
      });
      // ESC 关闭 = 取消
      const onKey = (e) => {
        if (e.key === 'Escape') {
          document.removeEventListener('keydown', onKey, true);
          if (modal.parentNode) modal.remove();
          resolve('cancel');
        }
      };
      document.addEventListener('keydown', onKey, true);
    });
  }

  /**
   * 替换模式：清空后导入新数据
   */
  function _applyReplace(app, data, opts) {
    try {
      app.storage.suppressHistory = false;
      app.mindmap.load(data);
      app._relayoutAndRender && app._relayoutAndRender();
      if (app.renderer && app.renderer.fitToView) app.renderer.fitToView();
      if (app._updateStatus) app._updateStatus();
      if (app._updateDocTitle) app._updateDocTitle();
      if (app._refreshSaveIndicator) app._refreshSaveIndicator();
      const src = opts.source || '文本';
      const warn = data.summary && data.summary.warnings && data.summary.warnings.length
        ? '（提示：' + data.summary.warnings.join('；') + '）'
        : '';
      if (app._showStatus) {
        app._showStatus('已从 ' + src + ' 生成导图：' + data.nodes.length + ' 个节点' + warn, 3000);
      }
      return { success: true, totalNodes: data.nodes.length, summary: data.summary };
    } catch (err) {
      console.error('Apply replace failed:', err);
      if (app._showStatus) app._showStatus('导入失败：' + (err.message || ''), 3000);
      return { success: false, error: err.message || '导入失败' };
    }
  }

  /**
   * 合并模式：把新导图挂到当前根节点下
   * - 新导图根节点 → 当前根的子节点
   * - 新导图原根的子节点 → reparent 到新根（然后新根已经移到当前根下）
   */
  function _mergeAsChildren(app, parsedData, opts) {
    try {
      const currentRootId = app.mindmap.rootId;
      const currentRoot = currentRootId ? app.mindmap.get(currentRootId) : null;
      if (!currentRoot) {
        // 没有根，回退到替换
        return _applyReplace(app, parsedData, opts);
      }
      const newRootId = parsedData.rootId;
      const newRoot = parsedData.nodes.find(n => n.id === newRootId);
      if (!newRoot) {
        return _applyReplace(app, parsedData, opts);
      }
      // 把新导图的所有节点（除根外）加入 mindmap
      // 然后把新根挂到当前根下
      // 1) 先把新节点的 parentId 重映射到本地图的根
      // 2) 新节点直接加入 nodes Map
      const reparentedNodes = parsedData.nodes.map(n => {
        if (n.id === newRootId) {
          return Object.assign({}, n, { parentId: currentRootId, _kind: undefined });
        }
        // 子节点：保持原 parentId（在解析结果里）
        const copy = Object.assign({}, n, { _kind: undefined });
        return copy;
      });
      // 把新节点逐个加入 mindmap
      // 注意：mindmap.addChild / addNode 会自动建历史
      // 这里为了简单：把所有节点加到 mindmap.nodes
      if (app.mindmap.nodes instanceof Map) {
        reparentedNodes.forEach(n => {
          app.mindmap.nodes.set(n.id, n);
        });
      }
      // 修正子节点的 parentId
      reparentedNodes.forEach(n => {
        if (n.id !== newRootId) {
          const realNode = app.mindmap.nodes.get(n.id);
          if (realNode) realNode.parentId = n.parentId;
        }
      });
      // 修正新根的子节点：children 数组里要替换原 rootId
      const finalNewRoot = app.mindmap.nodes.get(newRootId);
      if (finalNewRoot) {
        finalNewRoot.parentId = currentRootId;
        // 保留它原来的 children
      }
      // 把新根挂到当前根的 children
      currentRoot.children = currentRoot.children || [];
      if (!currentRoot.children.includes(newRootId)) {
        currentRoot.children.push(newRootId);
      }
      // 触发 onChange
      if (typeof app.mindmap._emit === 'function') {
        app.mindmap._emit('change', { type: 'merge' });
      }
      app._relayoutAndRender && app._relayoutAndRender();
      if (app.renderer && app.renderer.fitToView) app.renderer.fitToView();
      if (app._updateStatus) app._updateStatus();
      if (app._updateDocTitle) app._updateDocTitle();
      if (app._refreshSaveIndicator) app._refreshSaveIndicator();
      const src = opts.source || '文本';
      if (app._showStatus) {
        app._showStatus('已合并：新增 ' + parsedData.nodes.length + ' 个节点到「' + (currentRoot.text || '根') + '」下', 3000);
      }
      return { success: true, merged: true, totalNodes: parsedData.nodes.length };
    } catch (err) {
      console.error('Merge failed:', err);
      if (app._showStatus) app._showStatus('合并失败：' + (err.message || ''), 3000);
      return { success: false, error: err.message || '合并失败' };
    }
  }

  /**
   * 从剪贴板读取并生成
   */
  async function importFromClipboard(app) {
    try {
      let text = '';
      // Electron 环境下用 clipboard API
      if (window.electronAPI && window.electronAPI.readClipboard) {
        text = await window.electronAPI.readClipboard();
      } else if (navigator.clipboard && navigator.clipboard.readText) {
        text = await navigator.clipboard.readText();
      } else {
        return { success: false, error: '当前环境不支持读取剪贴板' };
      }
      if (!text || !text.trim()) {
        if (app._showStatus) app._showStatus('剪贴板为空', 1500);
        return { success: false, error: '剪贴板为空' };
      }
      return importFromText(app, text, { source: '剪贴板' });
    } catch (err) {
      // 剪贴板权限被拒等
      console.error('Read clipboard failed:', err);
      if (app._showStatus) app._showStatus('读取剪贴板失败：' + (err.message || ''), 2000);
      return { success: false, error: err.message };
    }
  }

  /**
   * 从 .md 文件读取并生成
   */
  async function importFromFile(app) {
    try {
      if (!window.electronAPI || !window.electronAPI.openMd) {
        return { success: false, error: '文件 API 不可用' };
      }
      const result = await window.electronAPI.openMd();
      if (result && result.canceled) return { success: false, canceled: true };
      if (!result || !result.success) {
        return { success: false, error: (result && result.error) || '打开文件失败' };
      }
      return importFromText(app, result.content, { source: '文件 ' + (result.filePath || '') });
    } catch (err) {
      console.error('Import from file failed:', err);
      if (app._showStatus) app._showStatus('导入文件失败：' + (err.message || ''), 2000);
      return { success: false, error: err.message };
    }
  }

  /**
   * 弹出导入对话框
   */
  function openImporterDialog(app) {
    if (document.getElementById('mdImporterModal')) {
      // 已存在则显示
      showImporterDialog();
      return;
    }
    buildImporterDialog();
    showImporterDialog();

    // 绑定事件
    const $ = (id) => document.getElementById(id);
    const textarea = $('mdImporterText');
    const preview = $('mdImporterPreview');
    const stats = $('mdImporterStats');
    const applyBtn = $('mdImporterApply');
    const cancelBtn = $('mdImporterCancel');
    const closeBtn = $('mdImporterClose');
    const pickBtn = $('mdImporterPickFile');
    const pasteBtn = $('mdImporterPaste');
    const rootInput = $('mdImporterRootText');

    function updatePreview() {
      const text = textarea.value;
      const wc = text.length;
      const lc = text ? text.split('\n').length : 0;
      stats.textContent = wc + ' 字符 · ' + lc + ' 行';
      // 记下滚动位置（用户当前在看哪段 MD）
      const scrollRatio = textarea.scrollHeight > textarea.clientHeight
        ? textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight)
        : 0;
      try {
        if (!text.trim()) {
          preview.innerHTML = '<div class="md-importer-empty">在上方粘贴 Markdown 文章，右侧会显示将要生成的导图结构</div>';
          applyBtn.disabled = true;
          return;
        }
        const data = window.MindMapMarkdown.markdownArticleToMindmap(text, { rootText: rootInput.value });
        if (!data || !data.nodes || data.nodes.length === 0) {
          preview.innerHTML = '<div class="md-importer-empty">没有可解析的内容</div>';
          applyBtn.disabled = true;
          return;
        }
        renderPreviewTree(preview, data);
        // 同步滚动到对应位置
        requestAnimationFrame(() => {
          if (preview.scrollHeight > preview.clientHeight) {
            preview.scrollTop = Math.round(scrollRatio * (preview.scrollHeight - preview.clientHeight));
          }
        });
        applyBtn.disabled = false;
      } catch (err) {
        preview.innerHTML = '<div class="md-importer-error">⚠ ' + (err.message || '解析错误') + '</div>';
        applyBtn.disabled = true;
      }
    }

    textarea.addEventListener('input', updatePreview);
    rootInput.addEventListener('input', updatePreview);

    pasteBtn.addEventListener('click', async () => {
      try {
        let text = '';
        if (window.electronAPI && window.electronAPI.readClipboard) {
          text = await window.electronAPI.readClipboard();
        } else if (navigator.clipboard && navigator.clipboard.readText) {
          text = await navigator.clipboard.readText();
        }
        if (text) {
          textarea.value = text;
          updatePreview();
          if (app._showStatus) app._showStatus('已从剪贴板粘贴', 1200);
        } else {
          if (app._showStatus) app._showStatus('剪贴板为空', 1200);
        }
      } catch (e) {
        if (app._showStatus) app._showStatus('粘贴失败：' + (e.message || ''), 1500);
      }
    });

    pickBtn.addEventListener('click', async () => {
      try {
        const r = await window.electronAPI.openMd();
        if (r && r.success && r.content) {
          textarea.value = r.content;
          // 默认用文件名（去掉后缀）做根
          if (r.filePath && !rootInput.value) {
            const name = r.filePath.replace(/\\/g, '/').split('/').pop() || '';
            rootInput.value = name.replace(/\.(md|markdown|txt)$/i, '');
          }
          updatePreview();
        }
      } catch (e) {
        if (app._showStatus) app._showStatus('打开文件失败：' + (e.message || ''), 1500);
      }
    });

    applyBtn.addEventListener('click', () => {
      const text = textarea.value;
      const r = importFromText(app, text, { rootText: rootInput.value, source: 'MD 导入' });
      if (r && r.success) {
        hideImporterDialog();
      }
    });

    cancelBtn.addEventListener('click', hideImporterDialog);
    closeBtn.addEventListener('click', hideImporterDialog);

    // ESC 关闭
    document.addEventListener('keydown', escClose);
  }

  function escClose(e) {
    if (e.key === 'Escape' && document.getElementById('mdImporterModal')) {
      hideImporterDialog();
      document.removeEventListener('keydown', escClose);
    }
  }

  function showImporterDialog() {
    const m = document.getElementById('mdImporterModal');
    if (m) m.hidden = false;
    setTimeout(() => {
      const t = document.getElementById('mdImporterText');
      if (t) t.focus();
    }, 30);
  }

  function hideImporterDialog() {
    const m = document.getElementById('mdImporterModal');
    if (m) m.hidden = true;
  }

  function buildImporterDialog() {
    const html = `
<div class="modal-mask" id="mdImporterModal">
  <div class="md-importer-dialog">
    <div class="md-importer-header">
      <span class="md-importer-title">📥 从 Markdown 文章生成思维导图</span>
      <button class="md-importer-close" id="mdImporterClose" title="关闭 (Esc)">×</button>
    </div>
    <div class="md-importer-toolbar">
      <label>根节点：</label>
      <input type="text" id="mdImporterRootText" placeholder="留空则用文章第一个 H1" />
      <button class="md-btn md-btn-secondary" id="mdImporterPickFile" title="选择 .md 文件">📄 打开文件</button>
      <button class="md-btn md-btn-secondary" id="mdImporterPaste" title="从剪贴板粘贴">📋 粘贴</button>
    </div>
    <div class="md-importer-body">
      <div class="md-importer-pane md-importer-input-pane">
        <div class="md-importer-pane-title">Markdown 原文</div>
        <textarea id="mdImporterText" spellcheck="false" placeholder="# 你的文章标题&#10;&#10;## 第一章&#10;内容段落...&#10;- 要点 1&#10;- 要点 2&#10;&#10;## 第二章&#10;...&#10;&#10;支持：# H1～###### H6 · 列表（缩进建层级）· 段落正文"></textarea>
        <div class="md-importer-stats" id="mdImporterStats">0 字符 · 0 行</div>
      </div>
      <div class="md-importer-pane md-importer-preview-pane">
        <div class="md-importer-pane-title">将要生成的导图结构</div>
        <div class="md-importer-preview" id="mdImporterPreview">
          <div class="md-importer-empty">在上方粘贴 Markdown 文章，右侧会显示将要生成的导图结构</div>
        </div>
      </div>
    </div>
    <div class="md-importer-footer">
      <span class="md-importer-hint">💡 第一个 H1 当根；多个 H1 视为根的兄弟分支；段落正文作内容子节点；列表按缩进建层级</span>
      <button class="md-btn md-btn-secondary" id="mdImporterCancel">取消</button>
      <button class="md-btn md-btn-primary" id="mdImporterApply" disabled>✓ 应用到导图</button>
    </div>
  </div>
</div>
    `;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    document.body.appendChild(wrapper.firstChild);
  }

  function renderPreviewTree(container, data) {
    if (!data || !data.nodes || data.nodes.length === 0) {
      container.innerHTML = '<div class="md-importer-empty">没有可解析的内容</div>';
      return;
    }
    const byId = new Map();
    data.nodes.forEach(n => byId.set(n.id, n));
    const root = byId.get(data.rootId);
    if (!root) {
      container.innerHTML = '<div class="md-importer-empty">没有根节点</div>';
      return;
    }

    // 渲染树状结构
    const lines = [];
    lines.push('<div class="md-preview-tree" data-depth="0">');

    // 统计每个节点的子节点数（用于显示折叠按钮）
    const childCount = new Map();
    data.nodes.forEach(n => childCount.set(n.id, (n.children || []).length));

    function walk(node, depth) {
      const kind = node._kind || 'content';
      const level = node._level || (kind === 'heading' ? depth + 1 : 99);
      const children = node.children || [];
      const hasChild = children.length > 0;

      // 选图标
      let icon = '📝';
      if (node.id === data.rootId) icon = '🌳';
      else if (kind === 'heading') {
        if (level === 1) icon = '📕';
        else if (level === 2) icon = '📘';
        else if (level === 3) icon = '📗';
        else icon = '📒';
      } else if (kind === 'list') icon = '•';
      else if (kind === 'content') icon = '¶';

      // 折叠按钮：默认深度 0-2 展开，更深层默认折叠
      const defaultExpanded = depth < 2;
      const collapseCls = hasChild ? 'md-preview-collapsible' : '';
      const expandedAttr = hasChild ? (defaultExpanded ? 'expanded' : 'collapsed') : '';

      // 文本
      const text = escapeHtml(node.text);
      const childNum = hasChild ? ' <span class="md-preview-count">(' + children.length + ')</span>' : '';

      // 行 HTML
      const indentPx = depth * 18;
      lines.push('<div class="md-preview-row md-preview-depth-' + depth + ' md-preview-' + kind + ' ' + collapseCls + '" data-id="' + node.id + '" data-depth="' + depth + '" ' + expandedAttr + '>');
      // 缩进
      lines.push('<span class="md-preview-indent" style="width:' + indentPx + 'px"></span>');
      // 折叠按钮
      if (hasChild) {
        lines.push('<span class="md-preview-toggle">' + (defaultExpanded ? '▼' : '▶') + '</span>');
      } else {
        lines.push('<span class="md-preview-toggle md-preview-toggle-empty">·</span>');
      }
      // 图标
      lines.push('<span class="md-preview-icon">' + icon + '</span>');
      // 文字
      lines.push('<span class="md-preview-text">' + text + childNum + '</span>');
      lines.push('</div>');

      // 子节点容器
      if (hasChild) {
        lines.push('<div class="md-preview-children" data-parent="' + node.id + '" ' + (defaultExpanded ? '' : 'hidden') + '>');
        children.forEach(cid => {
          const child = byId.get(cid);
          if (child) walk(child, depth + 1);
        });
        lines.push('</div>');
      }
    }
    walk(root, 0);
    lines.push('</div>');

    // 摘要
    const summary = data.summary;
    if (summary) {
      lines.push('<div class="md-preview-summary">共 ' + summary.totalNodes + ' 个节点（根 → ' + (summary.h1Count || 0) + ' 一级 → ' + (summary.h2Count || 0) + ' 二级）');
      if (summary.warnings && summary.warnings.length) {
        lines.push(' · <span class="md-preview-warn">⚠ ' + escapeHtml(summary.warnings.join('；')) + '</span>');
      }
      lines.push('</div>');
    }
    container.innerHTML = lines.join('');

    // 绑定折叠事件（用 event delegation）
    if (!container._treeBound) {
      container.addEventListener('click', function (e) {
        const toggle = e.target.closest('.md-preview-toggle');
        if (!toggle) return;
        const row = toggle.closest('.md-preview-row');
        if (!row || !row.classList.contains('md-preview-collapsible')) return;
        const id = row.getAttribute('data-id');
        const childrenBox = container.querySelector('.md-preview-children[data-parent="' + id + '"]');
        if (!childrenBox) return;
        const isHidden = childrenBox.hasAttribute('hidden');
        if (isHidden) {
          childrenBox.removeAttribute('hidden');
          row.setAttribute('expanded', '');
          toggle.textContent = '▼';
        } else {
          childrenBox.setAttribute('hidden', '');
          row.setAttribute('collapsed', '');
          toggle.textContent = '▶';
        }
      });
      container._treeBound = true;
    }
  }

  function escapeHtml(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.MindMapMDImporter = {
    openImporterDialog,
    importFromText,
    importFromClipboard,
    importFromFile
  };
})();
