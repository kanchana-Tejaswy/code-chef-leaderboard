const mysql = require('mariadb');

const passwords = [
  "admin", "root", "", "123456", "admin123", "admin@123", "root@123", "password", "mysql", "Teja", "teja",
  "Teja@123", "teja@123", "Tejaswy", "tejaswy", "Tejaswy@123", "tejaswy@123", "Kanchana", "kanchana",
  "Kanchana@123", "kanchana@123", "1234", "12345", "12345678", "root123", "root1234", "root12345",
  "admin1234", "admin12345", "mysql123", "rootroot", "adminadmin", "mysql80", "MySQL80",
  "codechef", "codechef123", "codechef@123", "leaderboard", "ace", "ace123", "ace@123"
];
const users = ["root", "admin", "Teja"];

async function test() {
  for (const user of users) {
    for (const pass of passwords) {
      console.log(`Testing user: ${user}, password: ${pass}`);
      let conn;
      try {
        conn = await mysql.createConnection({
          host: '127.0.0.1',
          port: 3306,
          user: user,
          password: pass,
          allowPublicKeyRetrieval: true
        });
        console.log(`SUCCESS! Connected with user: ${user}, password: ${pass}`);
        await conn.end();
        process.exit(0);
      } catch (err) {
        console.log(`Failed: ${err.message}`);
      }
    }
  }
  console.log("All combinations failed.");
  process.exit(1);
}

test();
