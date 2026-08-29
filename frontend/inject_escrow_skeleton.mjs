import fs from 'fs';
import path from 'path';

const targetPath = path.join('frontend', 'src', 'features', 'escrow', 'pages', 'EscrowPage.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// Add Skeleton import
if (!content.includes('import { Skeleton }')) {
  // Find a good place to insert, right after `import { KpiCard }`
  content = content.replace(
    /import \{ KpiCard \} from '\.\.\/\.\.\/shared\/KpiCard';/,
    "import { KpiCard } from '../../shared/KpiCard';\nimport { Skeleton } from '../../../components/ui/skeleton';"
  );
}

// Replace loading condition
const loadingCondition = "if (loading) return <div className=\"flex min-h-[240px] items-center justify-center text-sm font-black text-[#12335f]\"><Loader2 className=\"mr-2 h-5 w-5 animate-spin\" />Loading escrow ledger...</div>;";
const newLoadingCondition = "if (loading) return <EscrowPageSkeleton />;";
content = content.replace(loadingCondition, newLoadingCondition);

// Add EscrowPageSkeleton component
const skeletonComponent = `
function EscrowPageSkeleton() {
  return (
    <div className="space-y-4">
      {/* 1. Header Skeleton */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Skeleton className="h-8 w-64 rounded-md" />
        </div>
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>

      {/* 2. KPI Cards Skeleton */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <Skeleton className="mt-4 h-8 w-32 rounded-md" />
            <Skeleton className="mt-3 h-3 w-40 rounded-md" />
          </div>
        ))}
      </div>

      {/* 3. Filter Bar Skeleton */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-sm">
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 w-full">
          <Skeleton className="flex-[1_1_auto] min-w-[240px] h-10 rounded-xl" />
          <Skeleton className="flex-[0_0_auto] w-full sm:w-[140px] h-10 rounded-xl" />
          <Skeleton className="flex-[0_0_auto] w-full sm:w-[140px] h-10 rounded-xl" />
          <div className="flex-[0_0_auto] ml-auto">
             <Skeleton className="h-10 w-20 rounded-xl" />
          </div>
        </div>
      </div>

      {/* 4. Escrow Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white p-4 shadow-none">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
              <div>
                <Skeleton className="h-5 w-24 rounded-md" />
                <Skeleton className="mt-2 h-4 w-40 rounded-md" />
                <Skeleton className="mt-2 h-4 w-56 rounded-md" />
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <Skeleton className="h-6 w-20 rounded-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-16 rounded-md" />
                  <Skeleton className="h-8 w-16 rounded-md" />
                </div>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {[1, 2, 3].map(j => (
                <div key={j} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <Skeleton className="h-3 w-16 rounded-md" />
                  <Skeleton className="mt-2 h-4 w-20 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
`;

if (!content.includes('function EscrowPageSkeleton()')) {
  content += skeletonComponent;
}

fs.writeFileSync(targetPath, content);
console.log('Skeleton injected successfully!');
