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

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Upgrade standard inputs
  // from: bg-white border border-slate-300
  // to: bg-slate-50 border border-slate-300 shadow-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20
  
  // Replace simple input fields
  content = content.replace(/bg-white border border-slate-300( rounded-[a-z]+ p-[0-9.]+ text-sm text-slate-900) focus:border-emerald-500 outline-none/g, 
    'bg-slate-50 border-2 border-slate-200$1 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all');
    
  // Inputs without focus:border-emerald-500 explicitly
  content = content.replace(/bg-white border border-slate-300( rounded-[a-z]+ p-[0-9.]+ text-sm text-slate-900) outline-none/g, 
    'bg-slate-50 border-2 border-slate-200$1 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all');

  // Textareas
  content = content.replace(/bg-white border border-slate-300( focus:border-emerald-500 rounded-[a-z]+ p-[0-9.]+ text-slate-900)/g,
    'bg-slate-50 border-2 border-slate-200 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all$1');

  // Upgrade search input in POS
  content = content.replace(/bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500/g,
    'bg-slate-50 hover:bg-white text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 shadow-sm');
    
  content = content.replace(/border-2 border-slate-300 rounded-lg leading-5 bg-slate-50 hover:bg-white/g,
    'border-2 border-slate-300 rounded-xl leading-5 bg-slate-50 hover:bg-white shadow-inner');

  // Secondary buttons that look too flat (bg-slate-100 hover:bg-slate-200) -> add shadow and border
  content = content.replace(/bg-slate-100 hover:bg-slate-200 text-slate-900/g, 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-sm');

  // Cancel buttons inside modals
  content = content.replace(/bg-slate-100 hover:bg-slate-200 text-slate-700/g, 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm');

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Upgraded inputs/buttons in ${path.basename(file)}`);
  }
}
