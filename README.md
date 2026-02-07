 📘 TrainingTracker Bot
A powerful, privacy‑first Discord bot for logging, analyzing, and improving your training habits.
TrainingTracker helps you track sessions, set goals, monitor streaks, compare activities, and export your data — all through clean, intuitive slash commands.

🚀 Features
✔ Log Training Sessions
Record detailed training entries with:

Activity

Title & description

Up to 5 tags

Platform

Duration

Automatic session numbering

Automatic streak tracking

✔ Edit Past Sessions
Update any session using:

/editactivity  
Modify activity, title, description, tags, platform, or duration.

✔ View Activity History
Filter your logs by:

Date

Activity

Tags

Platform

Server (current or all)

Returns up to 50 recent entries.

✔ Streak Leaderboards
See who’s training consistently:

Global or per‑server

Optional activity filter

Sorted by streak length

✔ Stats Engine
Analyze your training with:

Total sessions

Total duration

Top tags

Top platforms

Optional ASCII charts

Supports:

Week

Month

6 months

Year

All time

✔ Compare Activities
Use /compare to contrast two activities:

Sessions

Duration

Differences

Range and server filters

✔ Goal Tracking
Set and track goals per activity:

/goals set

/goals view

/goals delete

Supports weekly, monthly, 6‑month, and yearly goals

Includes progress bars

✔ Data Export
Export your personal training data:

JSON

CSV

Server‑specific or all servers

Privacy‑first: users can only export their own data

✔ Summary Dashboard
/summary combines:

Goals

Stats

Streaks

Optional ASCII charts

Only shows activities with goals or data in the selected range

A clean, all‑in‑one snapshot of your training.

✔ Autocomplete Everywhere
Smart autocomplete for:

Activities

Tags

Platforms

Learns from your own history.

✔ Privacy‑First Design
All data is scoped to the user

No cross‑user visibility except streak leaderboards

Exports include only the requesting user’s data

🛠 Installation
1. Clone the repository
Code
git clone https://github.com/r0x0x/TrainingTracker-bot
cd TrainingTracker-bot
2. Install dependencies
Code
npm install
3. Create a .env file
Code
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
4. Deploy slash commands
Run locally:

Code
npm run deploy
5. Start the bot
Locally:

Code
npm start
Or deploy via Railway, Docker, or your preferred host.

📂 Project Structure
Code
TrainingTracker-bot/
│
├── index.js
├── deploy-commands.js
├── db.js
├── package.json
├── package-lock.json
├── .env.example
└── README.md
🧱 Tech Stack
Node.js

Discord.js  v14

SQLite (via better‑sqlite3)

Railway (optional hosting)

📄 License
MIT License — free to use, modify, and build on.
