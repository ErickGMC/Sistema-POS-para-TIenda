const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

function findTsxFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findTsxFiles(filePath, fileList);
    } else if (filePath.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const files = findTsxFiles(srcDir);

const replacements = [
  // Improve contrast for text colors on light background
  { from: /text-emerald-400/g, to: 'text-emerald-600' },
  { from: /text-emerald-500/g, to: 'text-emerald-600' },
  { from: /text-rose-400/g, to: 'text-rose-600' },
  { from: /text-blue-400/g, to: 'text-blue-600' },
  { from: /text-indigo-400/g, to: 'text-indigo-600' },
  { from: /text-amber-400/g, to: 'text-amber-600' },
  { from: /text-amber-500/g, to: 'text-amber-600' },
  
  // Fix divide color
  { from: /divide-slate-800/g, to: 'divide-slate-200' },
  { from: /divide-slate-700/g, to: 'divide-slate-300' },
  
  // Custom scrollbar
  { from: /custom-scrollbar/g, to: 'custom-scrollbar-light' }
];

let modifiedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Custom scrollbar fix if it became custom-scrollbar-light-light
  content = content.replace(/custom-scrollbar-light-light/g, 'custom-scrollbar-light');

  for (const { from, to } of replacements) {
    content = content.replace(from, to);
  }

  // specifically inside CajaRegistradora, fix the borders of inputs
  if (file.endsWith('CajaRegistradora.tsx')) {
     content = content.replace(/border-slate-650/g, 'border-slate-300');
     content = content.replace(/bg-slate-950\/80/g, 'bg-slate-900/60'); // Dark backdrop for modals is fine, keep it dark or change to slate-900/40
     content = content.replace(/text-emerald-600/g, 'text-emerald-600'); 
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    modifiedCount++;
  }
}

console.log(`Contrast fix completed. Modified ${modifiedCount} files.`);
