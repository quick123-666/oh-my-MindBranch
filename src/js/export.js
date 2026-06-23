// ============== 导入导出模块 ==============
// 支持 JSON 文件的导入/导出，以及将 SVG 渲染为 PNG 图片

(function () {
  class Exporter {
    constructor(mindmap, renderer) {
      this.mindmap = mindmap;
      this.renderer = renderer;
    }

    /**
     * 导出为 JSON 字符串
     */
    toJSONString(pretty = true) {
      return JSON.stringify(this.mindmap.toJSON(), null, pretty ? 2 : 0);
    }

    /**
     * 触发 JSON 文件下载（通过 Electron 主进程或浏览器）
     */
    async saveAsJSON() {
      try {
        const content = this.toJSONString();
        if (window.electronAPI) {
          const result = await window.electronAPI.saveJson(content);
          if (result.success) {
            this.mindmap.setTitle(this._fileNameFromPath(result.filePath));
            return { success: true, filePath: result.filePath };
          }
          return result;
        } else {
          // 浏览器回退：触发下载（无法获得真实文件路径）
          const blob = new Blob([content], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'mindmap.json';
          a.style.cssText = 'position:fixed;left:-10000px';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 100);
          return { success: true, filePath: null };
        }
      } catch (err) {
        return { success: false, error: err.message || '保存失败' };
      }
    }

    /**
     * 打开 JSON 文件
     */
    async openJSON() {
      let content, filePath;

      try {
        if (window.electronAPI) {
          const result = await window.electronAPI.openJson();
          if (!result.success) return result;
          content = result.content;
          filePath = result.filePath;
        } else {
          // 浏览器回退：使用文件选择器（带"取消"检测 + 超时兜底）
          const fileResult = await new Promise((resolve) => {
            let resolved = false;
            const done = (val) => {
              if (resolved) return;
              resolved = true;
              resolve(val);
              if (input.parentNode) input.parentNode.removeChild(input);
            };

            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,application/json';
            input.style.cssText = 'position:fixed;left:-10000px;top:-10000px;opacity:0;pointer-events:none';
            document.body.appendChild(input);

            input.onchange = (e) => {
              const file = e.target.files && e.target.files[0];
              if (!file) return done({ success: false, canceled: true });
              const reader = new FileReader();
              reader.onload = (ev) => done({
                success: true,
                content: ev.target.result,
                filePath: file.name
              });
              reader.onerror = () => done({ success: false, error: '读取失败' });
              reader.readAsText(file, 'utf-8');
            };

            // 用「窗口重新获得焦点」+ 延时来检测用户点了"取消"
            const focusHandler = () => {
              window.removeEventListener('focus', focusHandler);
              setTimeout(() => {
                if (!resolved) done({ success: false, canceled: true });
              }, 300);
            };
            window.addEventListener('focus', focusHandler);

            // 30 秒兜底超时：防止任何异常场景下 UI 卡死
            setTimeout(() => done({ success: false, canceled: true }), 30000);

            input.click();
          });

          if (!fileResult.success) return fileResult;
          content = fileResult.content;
          filePath = fileResult.filePath;
        }

        const data = JSON.parse(content);
        this.mindmap.load(data);
        if (filePath) this.mindmap.setTitle(this._fileNameFromPath(filePath));
        return { success: true, filePath };
      } catch (err) {
        return { success: false, error: err.message || '未知错误' };
      }
    }

    /**
     * 导出为 PNG（通过 Electron 主进程或浏览器）
     */
    async saveAsPNG() {
      try {
        const dataUrl = await this._svgToPngDataURL();
        if (!dataUrl) return { success: false, error: '生成图片失败' };

        if (window.electronAPI) {
          const result = await window.electronAPI.savePng(dataUrl);
          return result;
        } else {
          // 浏览器回退：触发下载（无法获得真实文件路径）
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = 'mindmap.png';
          a.style.cssText = 'position:fixed;left:-10000px';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => document.body.removeChild(a), 100);
          return { success: true, filePath: null };
        }
      } catch (err) {
        return { success: false, error: err.message || '导出失败' };
      }
    }

    /**
     * 导出为 Markdown 文本
     * @returns {Promise<{success: boolean, filePath?: string, canceled?: boolean, error?: string}>}
     */
    async saveAsMarkdown() {
      try {
        // 使用 markdown.js 模块生成内容
        if (!window.MindMapMarkdown) {
          return { success: false, error: 'Markdown 模块未加载' };
        }
        const content = window.MindMapMarkdown.mindmapToMarkdown(this.mindmap);
        if (!content) {
          return { success: false, error: '没有内容可导出' };
        }

        if (window.electronAPI && window.electronAPI.saveMd) {
          const result = await window.electronAPI.saveMd(content);
          return result;
        } else {
          // 浏览器回退：触发下载（无法获得真实文件路径）
          const blob = new Blob([content + '\n'], { type: 'text/markdown;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'mindmap.md';
          a.style.cssText = 'position:fixed;left:-10000px';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 100);
          return { success: true, filePath: null };
        }
      } catch (err) {
        return { success: false, error: err.message || '导出失败' };
      }
    }

    /**
     * 将 SVG 转换为 PNG 的 dataURL
     */
    async _svgToPngDataURL() {
      // 检查是否有节点
      if (this.mindmap.getAll().length === 0) {
        throw new Error('没有内容可导出');
      }
      const bounds = MindMapLayout.getBounds(this.mindmap);
      if (!bounds || bounds.width === 0 || bounds.height === 0) {
        throw new Error('画布尺寸无效');
      }

      try {
        // 创建干净的 SVG 副本（用于导出）
        const padding = 60;
        const viewW = bounds.width + padding * 2;
        const viewH = bounds.height + padding * 2;

        // 构造导出的 SVG
        const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svgEl.setAttribute('width', viewW);
        svgEl.setAttribute('height', viewH);
        svgEl.setAttribute('viewBox', `${bounds.minX - padding} ${bounds.minY - padding} ${viewW} ${viewH}`);

        // 白色背景
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('x', bounds.minX - padding);
        bg.setAttribute('y', bounds.minY - padding);
        bg.setAttribute('width', viewW);
        bg.setAttribute('height', viewH);
        bg.setAttribute('fill', '#ffffff');
        svgEl.appendChild(bg);

        // 添加节点和连线（直接从现有 SVG 克隆）
        const originalConnections = document.querySelector('#connectionsLayer');
        const originalNodes = document.querySelector('#nodesLayer');
        if (originalConnections) {
          Array.from(originalConnections.children).forEach(c => svgEl.appendChild(c.cloneNode(true)));
        }
        if (originalNodes) {
          Array.from(originalNodes.children).forEach(n => svgEl.appendChild(n.cloneNode(true)));
        }

        // 添加样式
        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.textContent = this._getExportStyles();
        svgEl.insertBefore(style, svgEl.firstChild.nextSibling);

        // 序列化 - 添加 XML 声明和命名空间（避免字符解析失败）
        const serializer = new XMLSerializer();
        let svgString = serializer.serializeToString(svgEl);
        // 添加 XML 声明和命名空间前缀（避免作为 image 加载时的解析问题）
        if (!svgString.startsWith('<?xml')) {
          svgString = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + svgString;
        }
        // 注入命名空间属性（防止克隆时丢失）
        if (!svgString.includes('xmlns:xlink')) {
          svgString = svgString.replace(
            '<svg ',
            '<svg xmlns:xlink="http://www.w3.org/1999/xlink" '
          );
        }
        // 转义可能导致解析问题的特殊字符（在文本节点中的 < > &）
        // 但 textContent 已经是转义后的，所以这里不需要额外处理

        // 使用 base64 data URL 替代 Blob URL（更可靠，避免 CSP/编码问题）
        const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
        const dataUrl = 'data:image/svg+xml;base64,' + svgBase64;

        // 加载为图片并绘制到 canvas
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = (e) => reject(new Error('SVG 加载失败：可能是字符无法解析'));
          img.src = dataUrl;
        });

        const scale = 2; // 2x 缩放以提高清晰度
        const canvas = document.createElement('canvas');
        canvas.width = viewW * scale;
        canvas.height = viewH * scale;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);

        return canvas.toDataURL('image/png');
      } catch (err) {
        console.error('PNG export failed:', err);
        throw new Error('PNG 生成失败：' + (err.message || '未知错误'));
      }
    }

    /**
     * 获取导出时需要的样式
     */
    _getExportStyles() {
      return `
        .node-bg {
          fill: #ffffff;
          stroke: #cbd5e1;
          stroke-width: 1.5;
        }
        .node.root .node-bg {
          fill: #4f46e5;
          stroke: #4338ca;
        }
        .node.root .node-text {
          fill: #ffffff;
        }
        .node-text {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
          font-size: 14px;
          fill: #1f2937;
          text-anchor: middle;
          dominant-baseline: central;
        }
        .node[data-depth="1"] .node-bg { fill: #ecfdf5; stroke: #10b981; }
        .node[data-depth="2"] .node-bg { fill: #fffbeb; stroke: #f59e0b; }
        .node[data-depth="3"] .node-bg { fill: #fef2f2; stroke: #ef4444; }
        .node[data-depth="4"] .node-bg { fill: #f5f3ff; stroke: #8b5cf6; }
        .node[data-depth="5"] .node-bg { fill: #fdf2f8; stroke: #ec4899; }
        .node[data-depth="6"] .node-bg { fill: #ecfeff; stroke: #06b6d4; }
        .connection {
          fill: none;
          stroke: #cbd5e1;
          stroke-width: 2;
          stroke-linecap: round;
        }
        .node-collapse-btn {
          fill: #ffffff;
          stroke: #cbd5e1;
        }
        .node-collapse-btn-text {
          font-size: 11px;
          font-weight: 700;
          fill: #6b7280;
          text-anchor: middle;
          dominant-baseline: central;
        }
      `;
    }

    _fileNameFromPath(filePath) {
      if (!filePath) return '未命名';
      const name = filePath.replace(/\\/g, '/').split('/').pop();
      return name.replace(/\.json$/i, '');
    }
  }

  window.MindMapExporter = Exporter;
})();