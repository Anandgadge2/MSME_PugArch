const fs = require('fs');

function resolveConflict(filePath, strategy) {
    const content = fs.readFileSync(filePath, 'utf8');
    const regex = /<<<<<<< HEAD\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>> [a-f0-9]+\r?\n/g;
    
    let matchCount = 0;
    const resolved = content.replace(regex, (match, headCode, mainCode) => {
        matchCount++;
        if (typeof strategy === 'function') {
            return strategy(headCode, mainCode);
        } else if (strategy === 'ours') {
            return headCode;
        } else {
            return mainCode;
        }
    });
    
    if (matchCount > 0) {
        fs.writeFileSync(filePath, resolved, 'utf8');
        console.log(`Resolved ${matchCount} conflicts in ${filePath}`);
    } else {
        console.log(`No conflicts found in ${filePath}`);
    }
}

// 1. BuyerProfile.tsx -> use theirs (main)
resolveConflict('frontend/src/views/BuyerProfile.tsx', 'theirs');

// 2. MyProcurementsPage.tsx -> use theirs (main)
resolveConflict('frontend/src/features/procurement/pages/MyProcurementsPage.tsx', 'theirs');

// 3. SupplierResponsesPage.tsx -> use theirs (main)
resolveConflict('frontend/src/features/procurement/pages/SupplierResponsesPage.tsx', 'theirs');

// 4. TeamManagementPage.tsx -> use theirs (main)
resolveConflict('frontend/src/features/orgTeam/pages/TeamManagementPage.tsx', 'theirs');

// 5. PaymentHistoryPage.tsx -> custom strategy
let paymentHistoryIndex = 0;
resolveConflict('frontend/src/features/payments/pages/PaymentHistoryPage.tsx', (headCode, mainCode) => {
    paymentHistoryIndex++;
    if (paymentHistoryIndex === 1) {
        // First conflict: Add Upload Payment Proof button (main branch)
        return mainCode;
    } else {
        return headCode;
    }
});

console.log("Conflicts resolved.");
