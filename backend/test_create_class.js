async function test() {
    try {
        console.log("Registering teacher...");
        const email = "teacher" + Date.now() + "@test.com";
        const regRes = await fetch('http://localhost:5000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: "Test Teacher",
                email: email,
                password: "password123",
                role: "teacher"
            })
        });
        
        console.log("Logging in...");
        const loginRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                password: "password123",
                role: "teacher"
            })
        });
        
        const loginData = await loginRes.json();
        const token = loginData.token;
        
        console.log("Creating classroom...");
        const classRes = await fetch('http://localhost:5000/api/classrooms/create', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                name: "My New Class"
            })
        });
        
        const classData = await classRes.json();
        if (classRes.ok) {
            console.log("Classroom created:", classData);
        } else {
            console.log("Error creating classroom:", classData);
        }
    } catch(e) {
        console.log("Outer error:", e.message);
    }
}
test();
