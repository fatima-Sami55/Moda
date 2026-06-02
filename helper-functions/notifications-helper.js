const fs = require("fs");
const path = require("path");

const notificationsPath = path.join(__dirname, "../seeds/notifications.json");

let notifications;
try {
  const notificationsJson = fs.readFileSync(notificationsPath, "utf8");
  notifications = JSON.parse(notificationsJson);
} catch (error) {
  console.error(
    `Error reading or parsing notifications file at ${notificationsPath}:`,
    error
  );
  process.exit(1);
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function getRandomNotifications(count) {
  const shuffledNotifications = shuffleArray([...notifications]);
  return shuffledNotifications.slice(0, count);
}

module.exports = { getRandomNotifications };
