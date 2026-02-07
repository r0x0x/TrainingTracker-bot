// deploy-commands.js
import "dotenv/config";
import { REST, Routes, SlashCommandBuilder } from "discord.js";

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error("Missing DISCORD_TOKEN or CLIENT_ID in .env");
  process.exit(1);
}

const activityChoices = [
  { name: "dryfire", value: "dryfire" },
  { name: "workout", value: "workout" },
  { name: "cardio", value: "cardio" },
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
  ".22",
].map(p => ({ name: p, value: p }));

const rangeChoices = [
  { name: "last week", value: "week" },
  { name: "last month", value: "month" },
  { name: "last 6 months", value: "6months" },
  { name: "last year", value: "year" },
  { name: "all time", value: "all" },
];

const goalRangeChoices = [
  { name: "week", value: "week" },
  { name: "month", value: "month" },
  { name: "6 months", value: "6months" },
  { name: "year", value: "year" },
];

const serverChoices = [
  { name: "current server", value: "current" },
  { name: "all servers", value: "all" },
];

const exportFormatChoices = [
  { name: "JSON", value: "json" },
  { name: "CSV", value: "csv" },
];

const commands = [

  // --- existing commands omitted for brevity (unchanged) ---

  new SlashCommandBuilder()
    .setName("summary")
    .setDescription("Show goals, stats, and streaks for a time range")
    .addStringOption(opt =>
      opt.setName("range").setDescription("Time range").setRequired(true).addChoices(...rangeChoices)
    )
    .addStringOption(opt =>
      opt.setName("server").setDescription("Which servers to include").setRequired(true).addChoices(...serverChoices)
    )
    .addBooleanOption(opt =>
      opt.setName("charts").setDescription("Show ASCII charts")
    ),

].map(c => c.toJSON());

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
