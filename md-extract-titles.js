// 从预处理后的 MD 抽取所有标题行（去掉段落正文），生成一份"骨架版 MD"
// 让用户能直接复制到 app 里导入
const fs = require('fs');

const input = process.argv[2] || '/tmp/harness-preprocessed.md';
const output = process.argv[3] || '/tmp/harness-skeleton.md';

const text = fs.readFileSync(input, 'utf-8');
const lines = text.split('\n');
const out = [];
let inCode = false;

for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (/^```/.test(l.trim())) {
    inCode = !inCode;
    continue; // 代码块不保留
  }
  if (inCode) continue;
  // 标题行
  const m = l.match(/^(#{1,6})\s+(.+)$/);
  if (m) {
    out.push(l);
  }
}

fs.writeFileSync(output, out.join('\n') + '\n', 'utf-8');
console.log(`[extract-titles] ${out.length} 个标题写入: ${output}`);
console.log(`[extract-titles] 文件大小: ${fs.statSync(output).size} bytes`);
