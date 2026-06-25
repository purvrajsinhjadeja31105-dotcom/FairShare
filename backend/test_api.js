async function runTests() {
    console.log('--- Starting API Tests ---');
    const API_URL = 'http://localhost:5000/api';
    
    try {
        // 1. Register User
        const randomEmail = `testuser_${Date.now()}@example.com`;
        console.log(`Registering user ${randomEmail}...`);
        const regRes = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'TestUser', email: randomEmail, password: 'password123' })
        });
        const regData = await regRes.json();
        console.log('Register Response:', regData);
        
        // 2. Manual Verify
        console.log('Verifying user manually...');
        const verifyRes = await fetch(`${API_URL}/auth/manual-verify?email=${randomEmail}`);
        const verifyText = await verifyRes.text();
        console.log('Verification status:', verifyRes.status);
        
        // 3. Login
        console.log('Logging in...');
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: randomEmail, password: 'password123' })
        });
        const loginData = await loginRes.json();
        console.log('Login Response:', loginData);
        
        if (!loginData.token) {
            console.error('Failed to get JWT token, aborting tests.');
            return;
        }
        const token = loginData.token;
        
        // 4. Create Group
        console.log('Creating group...');
        const groupRes = await fetch(`${API_URL}/groups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name: 'Test Group', is_personal: true, members: [] })
        });
        const groupData = await groupRes.json();
        console.log('Group Response:', groupData);
        const groupId = groupData.groupId;
        
        // 5. Add Expense
        console.log(`Adding expense to group ${groupId}...`);
        const expRes = await fetch(`${API_URL}/expenses/${groupId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                amount: 100,
                description: 'Dinner',
                splits: [{ userId: loginData.user.id, amount_owed: 100 }]
            })
        });
        const expData = await expRes.json();
        console.log('Expense Response:', expData);
        
        // 6. Get Summary
        console.log('Getting expense summary...');
        const summaryRes = await fetch(`${API_URL}/expenses/summary`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const summaryData = await summaryRes.json();
        console.log('Summary Response:', JSON.stringify(summaryData, null, 2));
        
        console.log('--- All Tests Completed Successfully! ---');
    } catch (err) {
        console.error('Test failed:', err);
    }
}

runTests();
