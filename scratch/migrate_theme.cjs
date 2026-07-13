const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

// Function to recursively find all .tsx files
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
  // Backgrounds
  { from: /bg-slate-950(\/[0-9]+)?/g, to: 'bg-slate-50$1' },
  { from: /bg-slate-900(\/[0-9]+)?/g, to: 'bg-white$1' },
  { from: /bg-slate-850(\/[0-9]+)?/g, to: 'bg-slate-50$1' },
  { from: /bg-slate-800(\/[0-9]+)?/g, to: 'bg-slate-100$1' },
  { from: /bg-slate-700(\/[0-9]+)?/g, to: 'bg-slate-200$1' },
  
  // Hover Backgrounds
  { from: /hover:bg-slate-800/g, to: 'hover:bg-slate-100' },
  { from: /hover:bg-slate-700/g, to: 'hover:bg-slate-200' },
  { from: /hover:bg-slate-650/g, to: 'hover:bg-slate-300' },
  { from: /hover:bg-slate-600/g, to: 'hover:bg-slate-200' },
  
  // Borders
  { from: /border-slate-800(\/[0-9]+)?/g, to: 'border-slate-200$1' },
  { from: /border-slate-700(\/[0-9]+)?/g, to: 'border-slate-300$1' },
  { from: /border-slate-600(\/[0-9]+)?/g, to: 'border-slate-300$1' },
  { from: /hover:border-slate-650/g, to: 'hover:border-slate-400' },
  { from: /hover:border-slate-600/g, to: 'hover:border-slate-400' },
  { from: /focus:border-emerald-500/g, to: 'focus:border-emerald-500' }, // keep

  // Texts
  { from: /text-slate-100/g, to: 'text-slate-900' },
  { from: /text-slate-200/g, to: 'text-slate-800' },
  { from: /text-slate-300/g, to: 'text-slate-700' },
  { from: /text-slate-400/g, to: 'text-slate-600' },
  { from: /text-white/g, to: 'text-slate-900' },
  
  // Special buttons text overrides (since we changed text-slate-100 to 900, we might break buttons that should be white text on colored bg)
  // This is tricky. Let's do some specific button text reverts below.
  
  // Custom scrollbar
  { from: /custom-scrollbar/g, to: 'custom-scrollbar-light' }
];

let modifiedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Apply general theme replacements
  for (const { from, to } of replacements) {
    content = content.replace(from, to);
  }

  // FIx specific buttons where text-white was replaced by text-slate-900 but the background is a solid color like emerald-500
  // e.g. bg-emerald-500 text-slate-900 -> text-white
  content = content.replace(/(bg-(?:emerald|blue|rose|indigo|teal|purple|red)-[56]00[^"']*)text-slate-900/g, '$1text-white');
  
  // Tooltips should stay dark
  content = content.replace(/bg-white border border-slate-300 text-slate-900 text-xs px-3 py-1.5 rounded-lg shadow-xl opacity-0/g, 'bg-slate-800 border border-slate-700 text-white text-xs px-3 py-1.5 rounded-lg shadow-xl opacity-0');

  // Input placeholders
  content = content.replace(/placeholder-slate-600/g, 'placeholder-slate-400');
  
  // Empty states / borders inside inputs
  content = content.replace(/bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500/g, 'bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500');

  // Fix App.tsx specific tooltips
  if (file.endsWith('App.tsx')) {
    content = content.replace(/bg-white border-slate-300 text-slate-900 text-xs px-3 py-1.5 rounded-lg shadow-xl opacity-0/g, 'bg-slate-800 border-slate-700 text-white text-xs px-3 py-1.5 rounded-lg shadow-xl opacity-0');
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    modifiedCount++;
    console.log(`Updated ${file}`);
  }
}

console.log(`Migration completed. Modified ${modifiedCount} files.`);
