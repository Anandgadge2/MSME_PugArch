const fs = require('fs');
const path = require('path');

const walk = (dir, fileList = []) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        walk(path.join(dir, file), fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
      fileList.push(path.join(dir, file));
    }
  }
  return fileList;
};

const srcDir = path.join('C:\\Users\\vansh\\Desktop\\internship task\\MSME_PugArch\\frontend', 'src');
const files = walk(srcDir);

let filesModified = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;
  
  if (content.includes('KpiCard') || content.includes('function KpiCard')) {
    const origContent1 = content;
    // Replace <div className="flex h-10 w-10 shrink-0
    content = content.replace(/className=\{cn\(\s*['"]flex h-10 w-10 shrink-0/g, "className={cn('flex h-8 w-8 sm:h-10 sm:w-10 shrink-0");
    // KpiCard icon size
    content = content.replace(/<Icon className="h-5 w-5"/g, '<Icon className="h-4 w-4 sm:h-5 sm:w-5"');
    
    // KpiCard text size for values
    content = content.replace(/<p className="mt-1 text-2xl font-black/g, '<p className="mt-1 text-xl sm:text-2xl font-black');
    content = content.replace(/<p className=\{cn\(\s*['"]text-2xl font-black/g, '<p className={cn("text-xl sm:text-2xl font-black');
    
    // Check if changed
    if (content !== origContent1) modified = true;
  }

  // Filter / Search bars wrapper
  if (content.includes('rounded-2xl border') && content.includes('p-4')) {
    const origContent2 = content;
    content = content.replace(/p-4 shadow-2xs space-y-3/g, 'p-3 sm:p-4 shadow-2xs space-y-2.5 sm:space-y-3');
    content = content.replace(/gap-3/g, 'gap-2.5 sm:gap-3');
    if (content !== origContent2) modified = true;
  }

  // Action Buttons & Inputs
  if (content.includes('h-10')) {
    const origContent3 = content;
    content = content.replace(/h-10(\s+w-full)?\s+rounded-xl\s+border\s+border-slate-200\s+bg-slate-50\/50\s+pl-10\s+pr-4/g, 'h-9 sm:h-10$1 rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4');
    
    // buttons
    content = content.replace(/h-10\s+rounded-xl\s+bg-\[#12335f\]\s+px-5/g, 'h-9 sm:h-10 rounded-xl bg-[#12335f] px-3 sm:px-5');
    content = content.replace(/h-10\s+rounded-xl\s+border\s+border-slate-200\s+bg-white\s+text-xs\s+font-black\s+uppercase\s+text-slate-700/g, 'h-9 sm:h-10 px-3 sm:px-4 rounded-xl border border-slate-200 bg-white text-xs font-black uppercase text-slate-700');
    
    // select
    content = content.replace(/h-10\s+w-full\s+rounded-xl\s+border\s+border-slate-200\s+bg-white\s+px-3/g, 'h-9 sm:h-10 w-full rounded-xl border border-slate-200 bg-white px-2 sm:px-3');

    // KpiCard wrapper replacing p-4 (inline KpiCard)
    content = content.replace(/rounded-2xl border bg-white p-4 text-left/g, 'rounded-2xl border bg-white p-3 sm:p-4 text-left');
    // KpiCard wrapper replacing p-4 (cn version)
    content = content.replace(/rounded-2xl border p-4 transition-all/g, 'rounded-2xl border p-3 sm:p-4 transition-all');
    
    if (content !== origContent3) modified = true;
  }

  if (modified) {
    fs.writeFileSync(file, content, 'utf8');
    filesModified++;
    console.log('Modified:', file);
  }
}

console.log(`\nCompleted! Modified ${filesModified} files.`);
