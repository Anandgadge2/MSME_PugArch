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

  // Let's use a regex to find all <table ...> tags that have a min-w-[...] class
  // and are NOT preceded by overflow-x-auto.
  // A safer approach: we can replace <table className="... min-w-[...] ..."> with 
  // <div className="overflow-x-auto w-full border border-slate-200/60 rounded-xl bg-white"><table ...>
  // BUT we must also replace the closing </table>.
  // To do this reliably without AST:
  // We can split the string by "<table" and "</table>".
  // Actually, we can just find <table ...>...</table> using regex if we assume no nested tables.
  const tableRegex = /<table([\s\S]*?)<\/table>/g;
  
  content = content.replace(tableRegex, (match, inner) => {
    // Check if this table has a min-w-[...] class
    if (match.includes('min-w-[')) {
      // Check if it's already wrapped (we can't easily check the preceding string here with replace, 
      // but we can check if it has a custom data attribute we add).
      if (!match.includes('data-ux-wrapped')) {
        // Add data-ux-wrapped="true" to the table tag
        let newTable = match.replace('<table', '<table data-ux-wrapped="true"');
        return `<div className="overflow-x-auto w-full rounded-xl border border-slate-200 bg-white mb-6 shadow-sm">\n${newTable}\n</div>`;
      }
    }
    return match;
  });

  if (content !== fs.readFileSync(file, 'utf8')) {
    fs.writeFileSync(file, content, 'utf8');
    filesModified++;
    console.log('Wrapped tables in:', file);
  }
}

console.log(`\nCompleted! Wrapped tables in ${filesModified} files.`);
