// 智能版本：去前 6 行 BNF 假 H1，把第一个真章当根
const fs = require('fs');

const input = process.argv[2] || '/tmp/harness-preprocessed.md';
const output = process.argv[3] || '/tmp/harness-clean.md';

const text = fs.readFileSync(input, 'utf-8');
const lines = text.split('\n');
const out = [];
let inCode = false;
let titleCount = 0;
let skipFirstN = 6; // 跳过的前 N 行 BNF 假 H1

for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (/^```/.test(l.trim())) { inCode = !inCode; continue; }
  if (inCode) continue;
  const m = l.match(/^(#{1,6})\s+(.+)$/);
  if (m) {
    titleCount++;
    if (titleCount <= skipFirstN) continue; // 跳过前 6 个假 H1
    out.push(l);
  }
}

// 在最前面加一个根标题
out.unshift('# Harness Engineering 完整教程');
out.unshift('# 思维导图根');

fs.writeFileSync(output, out.join('\n') + '\n', 'utf-8');
console.log(`[extract-clean] 共 ${out.length - 2} 个标题 + 1 根写入: ${output}`);
