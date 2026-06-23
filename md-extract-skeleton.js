// 把预处理后的 MD 转成"骨架版"：只保留标题
const fs = require('fs');

const input = process.argv[2];
const output = process.argv[3];

if (!input || !output) {
  console.log('用法: node md-extract-skeleton.js <input.md> <output.md>');
  process.exit(1);
}

const text = fs.readFileSync(input, 'utf-8');
const lines = text.split('\n');
const out = [];
let inCode = false;
let titleCount = 0;
const seenH2 = new Set(); // 去重 H2
const seenH3 = new Set(); // 去重 H3 (原文档有重复编号)

// 1) 收集所有标题
const allTitles = [];
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (/^```/.test(l.trim())) { inCode = !inCode; continue; }
  if (inCode) continue;
  const m = l.match(/^(#{1,6})\s+(.+)$/);
  if (m) allTitles.push({ line: i, level: m[1].length, text: m[2].trim() });
}

// 2) 检测"孤立 H1"（无 H2 子节）
//    一个 H1 是孤立的，当它和下一个 H1 之间没有任何 H2
const isolatedH1 = new Set();
for (let i = 0; i < allTitles.length; i++) {
  if (allTitles[i].level !== 1) continue;
  let hasH2 = false;
  for (let j = i + 1; j < allTitles.length; j++) {
    if (allTitles[j].level === 1) break; // 下一个 H1
    if (allTitles[j].level === 2) { hasH2 = true; break; }
  }
  if (!hasH2) isolatedH1.add(allTitles[i].text);
}

// 3) 跳过前 16 个 H2（目录），去重，剔除孤立 H1
for (let i = 0; i < allTitles.length; i++) {
  const t = allTitles[i];
  if (t.level === 1 && isolatedH1.has(t.text)) continue; // 孤立 H1
  if (t.level === 1) continue; // 普通 H1（H2 已经够了，H1 不需要）
  if (t.level === 2) {
    if (seenH2.has(t.text)) continue;
    seenH2.add(t.text);
    out.push('#'.repeat(t.level) + ' ' + t.text);
    continue;
  }
  // H3+ ：对 "数字编号 文字" 去重（如 5.4 出现两次）
  const numMatch = t.text.match(/^(\d+(?:\.\d+)+)\s+/);
  if (numMatch && t.level === 3) {
    if (seenH3.has(numMatch[1])) continue;
    seenH3.add(numMatch[1]);
  }
  out.push('#'.repeat(t.level) + ' ' + t.text);
}

const header = [
  '# 思维导图根',
  '# Harness Engineering 完整教程',
  '> 基于 Claude Code 源码（~512,664 行 TypeScript）的逆向工程与系统性分析'
];
fs.writeFileSync(output, header.concat(out).join('\n') + '\n', 'utf-8');
console.log(`[skeleton] ${out.length} 个标题 + 3 行头写入: ${output} (${fs.statSync(output).size} bytes)`);

