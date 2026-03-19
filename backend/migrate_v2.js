const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'notemicpro.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error opening database " + err.message);
        process.exit(1);
    }
    console.log("Connected to database for migration.");
});

const columns = [
    'institution TEXT',
    'course TEXT',
    'subject TEXT',
    'bio TEXT',
    'qualification TEXT',
    'experience TEXT',
    'semester TEXT',
    'learning_style TEXT'
];

db.serialize(() => {
    columns.forEach(col => {
        db.run(`ALTER TABLE User ADD COLUMN ${col};`, (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log(`Column ${col.split(' ')[0]} already exists.`);
                } else {
                    console.error(`Error adding column ${col}: ${err.message}`);
                }
            } else {
                console.log(`Successfully added column ${col}.`);
            }
        });
    });
});

db.close(() => {
    console.log("Migration completed.");
});
