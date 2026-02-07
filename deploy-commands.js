// deploy-commands.js
import "dotenv/config";
import { REST, Routes, SlashCommandBuilder } from "discord.js";

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error("Missing DISCORD_TOKEN or CLIENT_ID in .env");
  process.exit(1);
}

// Shared choices
const activityChoices = [
  { name: "dryfire", value: "dryfire" },
  { name: "workout", value: "workout" },
  { name: "cardio", value: "cardio" }
];

const platformChoices = [
  "production",
  "revolver",
  "single stack",
  "limited",
  "limited 10",
  "limited optics",
  "carry optics",
  "open",
  "rifle",
  "shotgun",
  ".22"
].map(p => ({ name: p, value: p }));

const rangeChoices = [
  { name: "last week", value: "week" },
  { name: "last month", value: "month" },
  { name: "last 6 months", value: "6months" },
  { name: "last year", value: "year" },
  { name: "all time", value: "all" }
];

const goalRangeChoices = [
  { name: "week", value: "week" },
  { name: "month", value: "month" },
  { name: "6 months", value: "6months" },
  { name: "year", value: "year" }
];

const serverChoices = [
  { name: "current server", value: "current" },
  { name: "all servers", value: "all" }
];

const exportFormatChoices = [
  { name: "JSON", value: "json" },
  { name: "CSV", value: "csv" }
];

// -------------------------
// COMMAND DEFINITIONS
// -------------------------

const commands = [

  // /trained
  new SlashCommandBuilder()
    .setName("trained")
    .setDescription("Log a training session")
    .addStringOption(opt =>
      opt.setName("activity").setDescription("Activity").setRequired(true).addChoices(...activityChoices)
    )
    .addStringOption(opt =>
      opt.setName("title").setDescription("Title").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("description").setDescription("Description").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("tags").setDescription("Comma-separated tags")
    )
    .addStringOption(opt =>
      opt.setName("platform").setDescription("Platform").addChoices(...platformChoices)
    )
    .addStringOption(opt =>
      opt.setName("duration").setDescription("Duration in minutes")
    ),

  // /editactivity
  new SlashCommandBuilder()
    .setName("editactivity")
    .setDescription("Edit a logged activity")
    .addIntegerOption(opt =>
      opt.setName("sessionnumber").setDescription("Session number").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("activity").setDescription("New activity").addChoices(...activityChoices)
    )
    .addStringOption(opt =>
      opt.setName("title").setDescription("New title")
    )
    .addStringOption(opt =>
      opt.setName("description").setDescription("New description")
    )
    .addStringOption(opt =>
      opt.setName("tags").setDescription("New comma-separated tags")
    )
    .addStringOption(opt =>
      opt.setName("platform").setDescription("New platform").addChoices(...platformChoices)
    )
    .addStringOption(opt =>
      opt.setName("duration").setDescription("New duration")
    ),

  // /viewactivities
  new SlashCommandBuilder()
    .setName("viewactivities")
    .setDescription("View your logged activities")
    .addStringOption(opt =>
      opt.setName("date").setDescription("YYYY-MM-DD")
    )
    .addStringOption(opt =>
      opt.setName("activity").setDescription("Activity").addChoices(...activityChoices)
    )
    .addStringOption(opt =>
      opt.setName("tags").setDescription("Filter by tags")
    )
    .addStringOption(opt =>
      opt.setName("platform").setDescription("Platform").addChoices(...platformChoices)
    )
    .addStringOption(opt =>
      opt.setName("server").setDescription("Which server").addChoices(...serverChoices)
    ),

  // /leaderboard
  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show streak leaderboard")
    .addStringOption(opt =>
      opt.setName("activity").setDescription("Activity").addChoices(...activityChoices)
    )
    .addStringOption(opt =>
      opt.setName("server").setDescription("Which server").addChoices(...serverChoices)
    ),

  // /stats
  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Show stats for an activity")
    .addStringOption(opt =>
      opt.setName("activity").setDescription("Activity").addChoices(...activityChoices)
    )
    .addStringOption(opt =>
      opt.setName("server").setDescription("Which server").addChoices(...serverChoices)
    )
    .addStringOption(opt =>
      opt.setName("range").setDescription("Time range").addChoices(...rangeChoices)
    )
    .addBooleanOption(opt =>
      opt.setName("charts").setDescription("Show ASCII charts")
    ),

  // /compare
  new SlashCommandBuilder()
    .setName("compare")
    .setDescription("Compare two activities")
    .addStringOption(opt =>
      opt.setName("activity1").setDescription("First activity").setRequired(true).addChoices(...activityChoices)
    )
    .addStringOption(opt =>
      opt.setName("activity2").setDescription("Second activity").setRequired(true).addChoices(...activityChoices)
    )
    .addStringOption(opt =>
      opt.setName("server").setDescription("Which server").addChoices(...serverChoices)
    )
    .addStringOption(opt =>
      opt.setName("range").setDescription("Time range").addChoices(...rangeChoices)
    ),

  // /goals
  new SlashCommandBuilder()
    .setName("goals")
    .setDescription("Manage training goals")
    .addSubcommand(sub =>
      sub.setName("set")
        .setDescription("Set a goal")
        .addStringOption(opt =>
          opt.setName("activity").setDescription("Activity").setRequired(true).addChoices(...activityChoices)
        )
        .addIntegerOption(opt =>
          opt.setName("target_sessions").setDescription("Target sessions").setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName("range").setDescription("Range").setRequired(true).addChoices(...goalRangeChoices)
        )
    )
    .addSubcommand(sub =>
      sub.setName("view")
        .setDescription("View your goals")
        .addStringOption(opt =>
          opt.setName("range").setDescription("Range").setRequired(true).addChoices(...goalRangeChoices)
        )
    )
    .addSubcommand(sub =>
      sub.setName("delete")
        .setDescription("Delete a goal")
        .addStringOption(opt =>
          opt.setName("activity").setDescription("Activity").setRequired(true).addChoices(...activityChoices)
        )
        .addStringOption(opt =>
          opt.setName("range").setDescription("Range").setRequired(true).addChoices(...goalRangeChoices)
        )
    ),

  // /export
  new SlashCommandBuilder()
    .setName("export")
    .setDescription("Export your training data")
    .addStringOption(opt =>
      opt.setName("server").setDescription("Which server").setRequired(true).addChoices(...serverChoices)
    )
    .addStringOption(opt =>
      opt.setName("format").setDescription("Export format").setRequired(true).addChoices(...exportFormatChoices)
    ),

  // /summary
  new SlashCommandBuilder()
    .setName("summary")
    .setDescription("Show goals, stats, and streaks for a time range")
    .addStringOption(opt =>
      opt.setName("range").setDescription("Time range").setRequired(true).addChoices(...rangeChoices)
    )
    .addStringOption(opt =>
      opt.setName("server").setDescription("Which server").setRequired(true).addChoices(...serverChoices)
    )
    .addBooleanOption(opt =>
      opt.setName("charts").setDescription("Show ASCII charts")
    )

].map(cmd => cmd.toJSON());

// -------------------------
// DEPLOY
// -------------------------

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function deploy() {
  try {
    console.log("Registering commands...");
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Commands registered.");
  } catch (err) {
    console.error(err);
  }
}

deploy();
