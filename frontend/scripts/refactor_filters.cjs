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

const srcDir = path.join(__dirname, '..', 'src');
const files = walk(srcDir);

let filesModified = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // 1. Search Bar Wrapper
  const searchWrapperRegex = /className="relative min-w-0 flex-1 max-w-md"/g;
  if (searchWrapperRegex.test(content)) {
    content = content.replace(searchWrapperRegex, 'className="relative min-w-0 w-full sm:flex-1 max-w-md"');
    modified = true;
  }
  const searchWrapperRegex2 = /className="relative min-w-0 flex-1"/g;
  if (searchWrapperRegex2.test(content)) {
    content = content.replace(searchWrapperRegex2, 'className="relative min-w-0 w-full sm:flex-1"');
    modified = true;
  }
  
  const searchWrapperRegex3 = /className="relative flex-1 min-w-\[240px\] max-w-md"/g;
  if (searchWrapperRegex3.test(content)) {
    content = content.replace(searchWrapperRegex3, 'className="relative w-full sm:flex-1 sm:min-w-[240px] max-w-md"');
    modified = true;
  }

  // 2. Filter Inner Wrapper Stacking
  // e.g. flex flex-col gap-2.5 sm:gap-3 sm:flex-row sm:items-center
  // replace with grid grid-cols-2 gap-2.5 sm:flex sm:flex-row sm:items-center w-full md:w-auto
  const filterWrapperRegex = /className="flex flex-col gap-2\.5 sm:gap-3 sm:flex-row sm:items-center(\s+justify-[a-z]+)?"/g;
  if (filterWrapperRegex.test(content)) {
    content = content.replace(filterWrapperRegex, (match, j) => {
      return `className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-row sm:items-center w-full sm:w-auto${j || ''}"`;
    });
    modified = true;
  }

  const filterWrapperRegex2 = /className="flex items-center gap-2\.5 sm:gap-3(\s+justify-[a-z]+)?"/g;
  if (filterWrapperRegex2.test(content)) {
    content = content.replace(filterWrapperRegex2, (match, j) => {
      return `className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-row sm:items-center w-full sm:w-auto${j || ''}"`;
    });
    modified = true;
  }

  // 3. Select Dropdowns in these forms
  // Replace w-32 sm:w-36 with w-full sm:w-36 (if inside grid)
  // Actually, wait, it's safer to just replace w-32 with w-full sm:w-32 if it's a dropdown container
  const dropdownWrapperRegex = /className="w-32 sm:w-36"/g;
  if (dropdownWrapperRegex.test(content)) {
    content = content.replace(dropdownWrapperRegex, 'className="w-full sm:w-36"');
    modified = true;
  }
  const dropdownWrapperRegex2 = /className="w-32"/g;
  if (dropdownWrapperRegex2.test(content) && content.includes('<select')) {
    // risky without AST, but usually w-32 is the container for selects.
    // let's do targeted replace around <select
    content = content.replace(/<div className="w-32">(\s*<select)/g, '<div className="w-full sm:w-32">$1');
    modified = true;
  }

  // Add min-w-0 to selects so they don't blow out grid cols
  const selectRegex = /<select([\s\S]*?)className="(.*?)"/g;
  content = content.replace(selectRegex, (match, inner, classNames) => {
    if (!classNames.includes('min-w-0') && !classNames.includes('w-full')) {
      const newClassNames = classNames + ' min-w-0 w-full sm:w-auto';
      return `<select${inner}className="${newClassNames}"`;
    }
    return match;
  });

  // 4. ViewModeToggle / Result Count Alignment
  // Make ViewModeToggle span 2 columns on mobile if it's alone
  const viewModeRegex = /<ViewModeToggle([\s\S]*?)\/>/g;
  if (viewModeRegex.test(content)) {
    content = content.replace(viewModeRegex, (match, inner) => {
      if (!inner.includes('col-span-2')) {
        // Find existing className or add it
        if (inner.includes('className=')) {
          return `<ViewModeToggle${inner.replace(/className=['"](.*?)['"]/, 'className="$1 col-span-2 sm:col-span-1 flex justify-end"')} />`;
        } else {
          return `<ViewModeToggle className="col-span-2 sm:col-span-1 flex justify-end"${inner}/>`;
        }
      }
      return match;
    });
    modified = true;
  }

  // Tab buttons row (e.g. ['Open', 'Delivered'])
  const tabsRegex = /<div className="flex min-w-0 items-center gap-1 rounded-lg border border-slate-200 bg-white p-1"/g;
  if (tabsRegex.test(content)) {
    content = content.replace(tabsRegex, '<div className="flex min-w-0 items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 col-span-2 sm:col-span-1 overflow-x-auto"');
    modified = true;
  }

  if (modified) {
    if (content !== fs.readFileSync(file, 'utf8')) {
      fs.writeFileSync(file, content, 'utf8');
      filesModified++;
      console.log('Modified layout in:', file);
    }
  }
}

console.log(`\nCompleted! Modified filters in ${filesModified} files.`);
