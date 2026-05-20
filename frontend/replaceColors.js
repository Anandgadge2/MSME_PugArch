const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'src'));
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const modified = content
    .replace(/#12335f/g, '#1d4ed8')
    .replace(/#0b2445/g, '#1e3a8a')
    .replace(/bg-slate-900/g, 'bg-blue-800')
    .replace(/bg-slate-800/g, 'bg-blue-700')
    .replace(/text-slate-900/g, 'text-blue-900');
  
  if (content !== modified) {
    fs.writeFileSync(file, modified, 'utf8');
    console.log('Updated ' + file);
  }
});
