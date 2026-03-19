const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'notemicpro.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error opening database " + err.message);
        process.exit(1);
    }
    console.log("Connected for migration.");
    
    // Check if status column exists
    db.all("PRAGMA table_info(Lecture)", (err, columns) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }
        
        const hasStatus = columns.some(c => c.name === 'status');
        if (!hasStatus) {
            console.log("Adding status column to Lecture table...");
            db.run("ALTER TABLE Lecture ADD COLUMN status TEXT DEFAULT 'completed'", (err) => {
                if (err) {
                    console.error("Migration failed:", err.message);
                } else {
                    console.log("Migration successful: status column added.");
                }
                db.close();
            });
        } else {
            console.log("Status column already exists. No migration needed.");
            db.close();
        }
    });
});
