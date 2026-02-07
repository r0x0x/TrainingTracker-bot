// db.js
import Database from "better-sqlite3";

const db = new Database("training-tracker.db");

db.exec(`
CREATE TABLE IF NOT EXISTS activities (
  userId TEXT,
  serverId TEXT,
  activity TEXT,
  sessionNumber INTEGER,
  title TEXT,
  description TEXT,
  tags TEXT,
  platform TEXT,
  duration TEXT,
  timestamp INTEGER
);

CREATE TABLE IF NOT EXISTS streaks (
  userId TEXT,
  activity TEXT,
  streak INTEGER,
  lastSessionDate TEXT,
  PRIMARY KEY (userId, activity)
);

CREATE TABLE IF NOT EXISTS goals (
  userId TEXT,
  activity TEXT,
  targetSessions INTEGER,
  range TEXT,
  PRIMARY KEY (userId, activity, range)
);
`);

export default db;
