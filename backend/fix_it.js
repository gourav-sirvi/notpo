const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'notemicpro.db');
const uploadsPath = path.resolve(__dirname, 'uploads');

console.log("Checking uploads directory...");
if (!fs.existsSync(uploadsPath)) {
    console.log("Uploads directory missing. Creating it...");
    fs.mkdirSync(uploadsPath);
} else {
    console.log("Uploads directory exists.");
}

console.log("\nChecking database schema...");
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error opening database " + err.message);
        process.exit(1);
    }
    
    db.all("PRAGMA table_info(Lecture);", [], (err, rows) => {
        if (err) {
            console.error(err.message);
            process.exit(1);
        }
        console.log("Lecture table columns:");
        rows.forEach(row => console.log(`- ${row.name} (${row.type})`));
        
        const hasTeacherId = rows.some(row => row.name === 'teacher_id');
        if (!hasTeacherId) {
            console.log("\n!!! teacher_id column is MISSING from Lecture table !!!");
            console.log("Attempting to add teacher_id column...");
            db.run("ALTER TABLE Lecture ADD COLUMN teacher_id INTEGER;", (err) => {
                if (err) {
                    console.error("Failed to add column: " + err.message);
                } else {
                    console.log("Successfully added teacher_id column.");
                }
                db.close();
            });
        } else {
            console.log("\nteacher_id column is present.");
            db.close();
        }
    });
});
