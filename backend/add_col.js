const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./notemicpro.db');

db.serialize(() => {
    db.run("ALTER TABLE User ADD COLUMN profile_picture TEXT;", (err) => {
        if (err) {
            console.log("Column might already exist or error: " + err.message);
        } else {
            console.log("Added profile_picture column to User table.");
        }
    });
});
