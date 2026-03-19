const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'notemicpro.db');
const db = new sqlite3.Database(dbPath);

const columns = [
    { name: 'institution', type: 'TEXT' },
    { name: 'course', type: 'TEXT' },
    { name: 'subject', type: 'TEXT' },
    { name: 'bio', type: 'TEXT' },
    { name: 'qualification', type: 'TEXT' },
    { name: 'experience', type: 'INTEGER' },
    { name: 'semester', type: 'TEXT' },
    { name: 'learning_style', type: 'TEXT' }
];

db.serialize(() => {
    columns.forEach(col => {
        db.run(`ALTER TABLE User ADD COLUMN ${col.name} ${col.type}`, (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log(`Column ${col.name} already exists.`);
                } else {
                    console.error(`Error adding column ${col.name}:`, err.message);
                }
            } else {
                console.log(`Column ${col.name} added successfully.`);
            }
        });
    });
});

db.close();
