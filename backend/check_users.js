const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'notemicpro.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error opening database " + err.message);
        process.exit(1);
    }
});

db.all("SELECT id, name, email, role FROM User", [], (err, rows) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log("Users in database:");
        console.table(rows);
    }
    db.close();
});
