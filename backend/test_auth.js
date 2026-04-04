async function testRegister() {
    try {
        const response = await fetch('http://localhost:5000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test Student',
                email: 'test@student.com',
                password: 'password123',
                role: 'student'
            })
        });
        const data = await response.json();
        console.log('Registration Success:', data);
    } catch (error) {
        console.error('Registration Failed:', error.message);
    }
}

async function testLogin() {
    try {
        const response = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'test@student.com',
                password: 'password123',
                role: 'student'
            })
        });
        const data = await response.json();
        console.log('Login Success:', data);
    } catch (error) {
        console.error('Login Failed:', error.message);
    }
}

async function runTests() {
    console.log('--- Testing Registration ---');
    await testRegister();
    console.log('\n--- Testing Login ---');
    await testLogin();
}

runTests();
