#!/usr/bin/env node
/**
 * MD 文章预处理 v2：智能识别纯文本标题，升级为 # 标签
 *
 * 关键改进：
 *   1. 完全不修改已存在的 # 标题（只增不删）
 *   2. 只识别"裸标题"（无 # 前缀），跳过所有代码块/示例
 *   3. "第 X 章" / "Chapter X" → H2
 *   4. 数字编号 (1.1 / 2.3.4) → H3/H4/H5
 *
 * 用法：
 *   node md-preprocess.js <input.md> [output.md]
 *   node md-preprocess.js -   # stdin
 */

const fs = require('fs');

const NUM_HEADING_RE = /^(\d+(?:\.\d+)+)\s+(.+)$/;
const CHAPTER_RE = /^第\s*[一二三四五六七八九十百千零0-9]+\s*[章节讲篇部]\s*[：:、]?\s*(.{0,60})$/;

function preprocess(text) {
  const lines = text.split(/\r?\n/);
  const stats = { numH2: 0, numH3: 0, numH4: 0, numH5: 0, numChapter: 0, skippedInCode: 0 };

  // 1) 检测代码块范围（只识别 ``` 和 ~~~ 开头的）
  const inCode = new Array(lines.length).fill(false);
  let inFence = false;
  let fenceStart = -1;
  let fenceChar = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!inFence) {
      const m = l.match(/^(`{3,}|~{3,})/);
      if (m) {
        inFence = true;
        fenceStart = i;
        fenceChar = m[1][0];
      }
    } else {
      // 在围栏里，匹配关闭
      const m = l.match(new RegExp('^' + fenceChar + '{3,}\\s*$'));
      if (m) {
        for (let k = fenceStart; k <= i; k++) inCode[k] = true;
        inFence = false;
        fenceStart = -1;
        fenceChar = null;
      }
    }
  }
  if (inFence) {
    for (let k = fenceStart; k < lines.length; k++) inCode[k] = true;
  }

  // 2) 逐行处理
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (inCode[i]) { stats.skippedInCode++; continue; }

    // 已存在的 # 标题 → 不动
    if (/^#{1,6}\s/.test(l)) continue;

    // 必须是非缩进的纯文本行（避免误伤代码示例里的 `#`）
    if (/^\s/.test(l)) continue;

    // 检测"第 X 章"
    const chapterMatch = l.match(CHAPTER_RE);
    if (chapterMatch) {
      const title = chapterMatch[1].trim();
      if (title.length > 0 && title.length <= 50) {
        lines[i] = '## ' + l.trim();
        stats.numChapter++;
        continue;
      }
    }

    // 检测数字编号
    const numMatch = l.match(NUM_HEADING_RE);
    if (numMatch) {
      const numDepth = numMatch[1].split('.').length;
      const titleText = numMatch[2].trim();
      if (titleText.length > 0 && titleText.length <= 60) {
        const newLevel = Math.min(6, numDepth + 1);
        lines[i] = '#'.repeat(newLevel) + ' ' + numMatch[1] + ' ' + titleText;
        if (newLevel === 3) stats.numH3++;
        else if (newLevel === 4) stats.numH4++;
        else if (newLevel >= 5) stats.numH5++;
        continue;
      }
    }
  }

  return { text: lines.join('\n'), stats };
}

// === CLI ===
const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '-h') {
  console.log('用法: node md-preprocess.js <input.md> [output.md]');
  process.exit(0);
}

let input;
if (args[0] === '-') {
  input = fs.readFileSync(0, 'utf-8');
} else {
  input = fs.readFileSync(args[0], 'utf-8');
}

const { text, stats } = preprocess(input);
console.error(`[preprocess] 提升: H2(chapter)=${stats.numChapter}, H3=${stats.numH3}, H4=${stats.numH4}, H5+=${stats.numH5}, 跳过代码块行=${stats.skippedInCode}`);

if (args.length >= 2) {
  fs.writeFileSync(args[1], text, 'utf-8');
  console.error(`[preprocess] 已写入: ${args[1]}`);
} else {
  process.stdout.write(text);
}
