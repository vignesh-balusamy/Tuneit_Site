const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const USERS_FILE = path.join(__dirname, 'users.json');

const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
    console.error("❌ Error: Missing credentials");
    console.log("Usage: node create-user.js <username> <password>");
    process.exit(1);
}

let usersDB = {};
if (fs.existsSync(USERS_FILE)) {
    try {
        usersDB = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (e) {
        console.error("Error reading users.json");
    }
}

if (usersDB[username]) {
    console.log(`⚠️ User '${username}' already exists. Updating password...`);
}

// Generate secure salt and hash
const salt = bcrypt.genSaltSync(10);
const hashedPassword = bcrypt.hashSync(password, salt);

usersDB[username] = {
    password: hashedPassword,
    likedSongs: usersDB[username] ? usersDB[username].likedSongs : []
};

fs.writeFileSync(USERS_FILE, JSON.stringify(usersDB, null, 2));
console.log(`✅ User '${username}' saved successfully with securely hashed password!`);
