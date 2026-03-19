const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./notemicpro.db');

db.serialize(() => {
    console.log("---- TABLES ----");
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        if (err) console.error(err);
        else console.log(rows);
    });

    console.log("---- USERS ----");
    db.all("SELECT * FROM User", (err, rows) => {
        if (err) console.error("Error reading User table:", err.message);
        else console.log("User table rows:", rows);
    });
    
    // Check if Teacher exists
    db.all("SELECT * FROM Teacher", (err, rows) => {
        if (err) console.error("Error reading Teacher table:", err.message);
        else console.log("Teacher table rows:", rows);
    });
});
