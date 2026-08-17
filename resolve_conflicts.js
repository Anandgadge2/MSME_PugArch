const fs = require('fs');

function resolveConflict(filePath, strategy) {
    const content = fs.readFileSync(filePath, 'utf8');
    const regex = /<<<<<<< HEAD\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> [a-f0-9]+\n/g;
    
    const resolved = content.replace(regex, (match, headCode, mainCode) => {
        if (typeof strategy === 'function') {
            return strategy(headCode, mainCode);
        } else if (strategy === 'ours') {
            return headCode;
        } else {
            return mainCode;
        }
    });
    
    fs.writeFileSync(filePath, resolved, 'utf8');
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
        // Second conflict: filter bar.
        // head uses ResponsiveFilterBar
        // main uses Inline Filters Bar
        // Because head branch has ResponsiveFilterBar, but main just modified the select inputs,
        // let's just keep HEAD for the second conflict, otherwise we end up with syntax errors because
        // main's snippet doesn't close ResponsiveFilterBar correctly.
        return headCode;
    }
});

console.log("Conflicts resolved.");
