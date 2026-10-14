const bcrypt = require("bcryptjs");

const ROUNDS = 11;

// Pre-computed hash used to keep login timing similar when the username does not exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password-0", ROUNDS);

const hashPassword = (plain) => bcrypt.hash(plain, ROUNDS);

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash || DUMMY_HASH);
}

module.exports = { hashPassword, verifyPassword };
