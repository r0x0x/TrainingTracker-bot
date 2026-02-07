// index.js
import "dotenv/config";
import { Client, GatewayIntentBits, AttachmentBuilder } from "discord.js";
import db from "./db.js";

const TOKEN = process.env.DISCORD_TOKEN;

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// -------------------------
// Utility Functions
// -------------------------

function formatPST(ts) {
  return new Date(ts).toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
}

function parseTags(raw) {
  if (!raw) return [];
  return raw.split(",").map(t => t.trim()).filter(Boolean).slice(0, 5);
}

function tagsToString(tags) {
  return tags.length ? tags.join(", ") : "None";
}

function updateStreak(userId, activity, timestamp) {
  const today = new Date(timestamp).toISOString().slice(0, 10);

  const row = db.prepare(
    "SELECT * FROM streaks WHERE userId = ? AND activity = ?"
  ).get(userId, activity);

  if (!row) {
    db.prepare(
      "INSERT INTO streaks (userId, activity, streak, lastSessionDate) VALUES (?, ?, ?, ?)"
    ).run(userId, activity, 1, today);
    return 1;
  }

  const last = row.lastSessionDate;
  const diff = (new Date(today) - new Date(last)) / 86400000;

  let streak = row.streak;
  if (diff === 1) streak++;
  else if (diff > 1) streak = 1;

  db.prepare(
    "UPDATE streaks SET streak = ?, lastSessionDate = ? WHERE userId = ? AND activity = ?"
  ).run(streak, today, userId, activity);

  return streak;
}

function applyRangeFilter(rows, range) {
  if (!range || range === "all") return rows;
  const now = Date.now();
  let cutoff = 0;

  if (range === "week") cutoff = now - 7 * 86400000;
  else if (range === "month") cutoff = now - 30 * 86400000;
  else if (range === "6months") cutoff = now - 182 * 86400000;
  else if (range === "year") cutoff = now - 365 * 86400000;

  return rows.filter(r => r.timestamp >= cutoff);
}

function asciiBar(value, max, width = 20) {
  if (max === 0) return "";
  const len = Math.round((value / max) * width);
  return "█".repeat(len || 1);
}

function goalProgressBar(current, target, width = 20) {
  if (target <= 0) return "Progress: N/A";
  const ratio = Math.min(current / target, 1);
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const bar = "█".repeat(filled || 0) + "░".repeat(empty || 0);
  const percent = Math.round(ratio * 100);
  return `Progress: ${bar} (${current}/${target}) — ${percent}%`;
}

// -------------------------
// Ready
// -------------------------

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// -------------------------
// Autocomplete Handler
// -------------------------

client.on("interactionCreate", async interaction => {
  if (interaction.isAutocomplete()) {
    const focused = interaction.options.getFocused(true);
    const userId = interaction.user.id;
    const serverId = interaction.guildId;

    const rows = db.prepare(
      "SELECT activity, tags, platform FROM activities WHERE userId = ? AND serverId = ?"
    ).all(userId, serverId);

    const activities = [...new Set(rows.map(r => r.activity))];
    const tags = [...new Set(rows.flatMap(r => (r.tags ? r.tags.split(",") : [])))];
    const platforms = [...new Set(rows.map(r => r.platform))];

    let choices = [];

    if (["activity", "activity1", "activity2"].includes(focused.name)) {
      choices = activities;
    } else if (focused.name === "tags") {
      choices = tags;
    } else if (focused.name === "platform") {
      choices = platforms;
    }

    const filtered = choices
      .filter(c => c && c.toLowerCase().includes(focused.value.toLowerCase()))
      .slice(0, 25)
      .map(c => ({ name: c, value: c }));

    return interaction.respond(filtered);
  }
});

// -------------------------
// Slash Command Handler
// -------------------------

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  const userId = interaction.user.id;
  const serverId = interaction.guildId;

  // -------------------------
  // /trained
  // -------------------------
  if (commandName === "trained") {
    const activity = interaction.options.getString("activity");
    const title = interaction.options.getString("title");
    const description = interaction.options.getString("description");
    const tagsRaw = interaction.options.getString("tags");
    const platform = interaction.options.getString("platform") || "Not specified";
    const duration = interaction.options.getString("duration") || "Not specified";

    const tags = parseTags(tagsRaw);

    const count = db.prepare(
      "SELECT COUNT(*) AS c FROM activities WHERE userId = ? AND serverId = ? AND activity = ?"
    ).get(userId, serverId, activity).c;

    const sessionNumber = count + 1;
    const timestamp = Date.now();

    db.prepare(
      `INSERT INTO activities
       (userId, serverId, activity, sessionNumber, title, description, tags, platform, duration, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId, serverId, activity, sessionNumber,
      title, description, tags.join(","), platform, duration, timestamp
    );

    const streak = updateStreak(userId, activity, timestamp);

    return interaction.reply(
      `**Training Logged**\n` +
      `**Activity:** ${activity}\n` +
      `**Session:** ${sessionNumber}\n` +
      `**Date:** ${formatPST(timestamp)}\n` +
      `**Title:** ${title}\n` +
      `**Description:** ${description}\n` +
      `**Tags:** ${tagsToString(tags)}\n` +
      `**Platform:** ${platform}\n` +
      `**Duration:** ${duration}\n\n` +
      `🔥 **${activity} streak:** ${streak} days`
    );
  }
  // -------------------------
  // /editactivity
  // -------------------------
  if (commandName === "editactivity") {
    const sessionNumber = interaction.options.getInteger("sessionnumber");
    const newActivity = interaction.options.getString("activity");
    const newTitle = interaction.options.getString("title");
    const newDescription = interaction.options.getString("description");
    const newTagsRaw = interaction.options.getString("tags");
    const newPlatform = interaction.options.getString("platform");
    const newDuration = interaction.options.getString("duration");

    const row = db.prepare(
      "SELECT * FROM activities WHERE userId = ? AND serverId = ? AND sessionNumber = ?"
    ).get(userId, serverId, sessionNumber);

    if (!row) {
      return interaction.reply({ content: "Session not found on this server.", ephemeral: true });
    }

    const tags = newTagsRaw ? parseTags(newTagsRaw) : null;

    db.prepare(
      `UPDATE activities SET
        activity = COALESCE(?, activity),
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        tags = COALESCE(?, tags),
        platform = COALESCE(?, platform),
        duration = COALESCE(?, duration)
       WHERE userId = ? AND serverId = ? AND sessionNumber = ?`
    ).run(
      newActivity,
      newTitle,
      newDescription,
      tags ? tags.join(",") : null,
      newPlatform,
      newDuration,
      userId,
      serverId,
      sessionNumber
    );

    const updated = db.prepare(
      "SELECT * FROM activities WHERE userId = ? AND serverId = ? AND sessionNumber = ?"
    ).get(userId, serverId, sessionNumber);

    return interaction.reply(
      `**Activity Updated**\n` +
      `**Activity:** ${updated.activity}\n` +
      `**Session:** ${updated.sessionNumber}\n` +
      `**Date:** ${formatPST(updated.timestamp)}\n` +
      `**Title:** ${updated.title}\n` +
      `**Description:** ${updated.description}\n` +
      `**Tags:** ${tagsToString(parseTags(updated.tags))}\n` +
      `**Platform:** ${updated.platform}\n` +
      `**Duration:** ${updated.duration}`
    );
  }

  // -------------------------
  // /viewactivities
  // -------------------------
  if (commandName === "viewactivities") {
    const dateFilter = interaction.options.getString("date");
    const activityFilter = interaction.options.getString("activity");
    const tagsFilter = interaction.options.getString("tags");
    const platformFilter = interaction.options.getString("platform");
    const serverFilter = interaction.options.getString("server") || "current";

    let query = "SELECT * FROM activities WHERE userId = ?";
    const params = [userId];

    if (serverFilter === "current") {
      query += " AND serverId = ?";
      params.push(serverId);
    }

    if (dateFilter) {
      query += " AND DATE(timestamp / 1000, 'unixepoch') = DATE(?)";
      params.push(dateFilter);
    }

    if (activityFilter) {
      query += " AND activity = ?";
      params.push(activityFilter);
    }

    if (platformFilter) {
      query += " AND platform = ?";
      params.push(platformFilter);
    }

    query += " ORDER BY timestamp DESC LIMIT 50";

    let rows = db.prepare(query).all(...params);

    if (tagsFilter) {
      const wanted = parseTags(tagsFilter);
      rows = rows.filter(r => {
        const rowTags = parseTags(r.tags);
        return wanted.every(t => rowTags.includes(t));
      });
    }

    if (rows.length === 0) {
      return interaction.reply({ content: "No activities found.", ephemeral: true });
    }

    const lines = rows.map(r =>
      `**${r.activity} Session ${r.sessionNumber}** (${formatPST(r.timestamp)})\n` +
      `• Title: ${r.title}\n` +
      `• Description: ${r.description}\n` +
      `• Tags: ${tagsToString(parseTags(r.tags))}\n` +
      `• Platform: ${r.platform}\n` +
      `• Duration: ${r.duration}\n`
    );

    return interaction.reply({ content: lines.join("\n"), ephemeral: true });
  }

  // -------------------------
  // /leaderboard
  // -------------------------
  if (commandName === "leaderboard") {
    const activityFilter = interaction.options.getString("activity");
    const serverFilter = interaction.options.getString("server") || "current";

    let query =
      "SELECT userId, activity, streak FROM streaks WHERE 1=1";
    const params = [];

    if (activityFilter) {
      query += " AND activity = ?";
      params.push(activityFilter);
    }

    if (serverFilter === "current") {
      query +=
        " AND userId IN (SELECT DISTINCT userId FROM activities WHERE serverId = ?)";
      params.push(serverId);
    }

    query += " ORDER BY streak DESC LIMIT 10";

    const rows = db.prepare(query).all(...params);

    if (rows.length === 0) {
      return interaction.reply("No streak data yet.");
    }

    const lines = await Promise.all(
      rows.map(async (r, i) => {
        const user = await client.users.fetch(r.userId).catch(() => null);
        const name = user ? user.username : r.userId;
        return `${i + 1}. **${name}** — ${r.streak} days (${r.activity})`;
      })
    );

    return interaction.reply(
      `**Training Streak Leaderboard**${activityFilter ? ` for ${activityFilter}` : ""}\n\n` +
      lines.join("\n")
    );
  }

  // -------------------------
  // /stats
  // -------------------------
  if (commandName === "stats") {
    const activityFilter = interaction.options.getString("activity");
    const serverFilter = interaction.options.getString("server") || "current";
    const range = interaction.options.getString("range") || "all";
    const charts = interaction.options.getBoolean("charts") || false;

    let query = "SELECT * FROM activities WHERE userId = ?";
    const params = [userId];

    if (serverFilter === "current") {
      query += " AND serverId = ?";
      params.push(serverId);
    }

    if (activityFilter) {
      query += " AND activity = ?";
      params.push(activityFilter);
    }

    let rows = db.prepare(query).all(...params);
    rows = applyRangeFilter(rows, range);

    if (rows.length === 0) {
      return interaction.reply({
        content: "No activity data found for that filter.",
        ephemeral: true,
      });
    }

    const totalSessions = rows.length;

    const totalMinutes = rows.reduce((sum, r) => {
      const match = r.duration && r.duration.match(/(\d+)/);
      return match ? sum + parseInt(match[1]) : sum;
    }, 0);

    const tagCounts = {};
    rows.forEach(r => {
      const t = r.tags ? r.tags.split(",") : [];
      t.forEach(tag => {
        if (!tag) return;
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const platformCounts = {};
    rows.forEach(r => {
      if (!r.platform) return;
      platformCounts[r.platform] = (platformCounts[r.platform] || 0) + 1;
    });

    const topTagsArr = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
    const topPlatformsArr = Object.entries(platformCounts).sort((a, b) => b[1] - a[1]);

    const topTags = topTagsArr.slice(0, 5).map(([tag, count]) => `${tag} (${count})`).join(", ") || "None";
    const topPlatforms = topPlatformsArr.slice(0, 3).map(([p, count]) => `${p} (${count})`).join(", ") || "None";

    let msg =
      `📊 **Training Stats**` +
      `${activityFilter ? ` for **${activityFilter}**` : ""}` +
      `${range !== "all" ? ` (${range})` : ""}\n\n` +
      `**Total Sessions:** ${totalSessions}\n` +
      `**Total Duration:** ~${totalMinutes} minutes\n` +
      `**Top Tags:** ${topTags}\n` +
      `**Top Platforms:** ${topPlatforms}\n`;

    if (charts) {
      const maxTag = topTagsArr[0]?.[1] || 0;
      const maxPlat = topPlatformsArr[0]?.[1] || 0;

      if (topTagsArr.length) {
        msg += `\n**Tag Usage Chart:**\n`;
        topTagsArr.slice(0, 5).forEach(([tag, count]) => {
          msg += `${tag.padEnd(12)} ${asciiBar(count, maxTag)} ${count}\n`;
        });
      }

      if (topPlatformsArr.length) {
        msg += `\n**Platform Usage Chart:**\n`;
        topPlatformsArr.slice(0, 3).forEach(([p, count]) => {
          msg += `${p.padEnd(12)} ${asciiBar(count, maxPlat)} ${count}\n`;
        });
      }
    }

    return interaction.reply({ content: msg, ephemeral: true });
  }

  // -------------------------
  // /compare
  // -------------------------
  if (commandName === "compare") {
    const activity1 = interaction.options.getString("activity1");
    const activity2 = interaction.options.getString("activity2");
    const serverFilter = interaction.options.getString("server") || "current";
    const range = interaction.options.getString("range") || "all";

    if (activity1 === activity2) {
      return interaction.reply({
        content: "Choose two different activities to compare.",
        ephemeral: true,
      });
    }

    const fetchRows = (activity) => {
      let query = "SELECT * FROM activities WHERE userId = ? AND activity = ?";
      const params = [userId, activity];

      if (serverFilter === "current") {
        query += " AND serverId = ?";
        params.push(serverId);
      }

      let rows = db.prepare(query).all(...params);
      return applyRangeFilter(rows, range);
    };

    const rows1 = fetchRows(activity1);
    const rows2 = fetchRows(activity2);

    const summarize = (rows) => {
      const totalSessions = rows.length;
      const totalMinutes = rows.reduce((sum, r) => {
        const match = r.duration && r.duration.match(/(\d+)/);
        return match ? sum + parseInt(match[1]) : sum;
      }, 0);
      return { totalSessions, totalMinutes };
    };

    const s1 = summarize(rows1);
    const s2 = summarize(rows2);

    if (!rows1.length && !rows2.length) {
      return interaction.reply({
        content: "No data found for either activity with that filter.",
        ephemeral: true,
      });
    }

    const diffSessions = s1.totalSessions - s2.totalSessions;
    const diffMinutes = s1.totalMinutes - s2.totalMinutes;

    let msg =
      `⚖️ **Activity Comparison**` +
      `${range !== "all" ? ` (${range})` : ""}\n\n` +
      `**${activity1}:**\n` +
      `• Sessions: ${s1.totalSessions}\n` +
      `• Duration: ~${s1.totalMinutes} minutes\n\n` +
      `**${activity2}:**\n` +
      `• Sessions: ${s2.totalSessions}\n` +
      `• Duration: ~${s2.totalMinutes} minutes\n\n` +
      `**Differences ( ${activity1} - ${activity2} ):**\n` +
      `• Sessions: ${diffSessions}\n` +
      `• Duration: ${diffMinutes} minutes\n`;

    return interaction.reply({ content: msg, ephemeral: true });
  }
  // -------------------------
  // /summary
  // -------------------------
  if (commandName === "summary") {
    const range = interaction.options.getString("range");
    const serverFilter = interaction.options.getString("server");
    const charts = interaction.options.getBoolean("charts") || false;

    // -------------------------
    // Fetch all activities for this user
    // -------------------------
    let baseQuery = "SELECT * FROM activities WHERE userId = ?";
    const baseParams = [userId];

    if (serverFilter === "current") {
      baseQuery += " AND serverId = ?";
      baseParams.push(serverId);
    }

    let allRows = db.prepare(baseQuery).all(...baseParams);
    let rangedRows = applyRangeFilter(allRows, range);

    // Activities with data in this range
    const activitiesWithData = new Set(rangedRows.map(r => r.activity));

    // -------------------------
    // Fetch goals for this range
    // -------------------------
    const goals = db.prepare(
      "SELECT * FROM goals WHERE userId = ? AND range = ?"
    ).all(userId, range);

    const activitiesWithGoals = new Set(goals.map(g => g.activity));

    // -------------------------
    // Combined activity list (Option C)
    // -------------------------
    const combinedActivities = new Set([
      ...activitiesWithData,
      ...activitiesWithGoals
    ]);

    // -------------------------
    // Build GOALS section
    // -------------------------
    let goalsSection = "🎯 **Goals**\n\n";

    if (goals.length === 0) {
      goalsSection += "_No goals set for this range._\n\n";
    } else {
      for (const goal of goals) {
        // Count sessions for this activity in this range
        const rows = rangedRows.filter(r => r.activity === goal.activity);
        const currentSessions = rows.length;

        const bar = goalProgressBar(currentSessions, goal.targetSessions);

        goalsSection +=
          `**${goal.activity}** — Goal: **${goal.targetSessions}** sessions per **${range}**\n` +
          `${bar}\n\n`;
      }
    }

    // -------------------------
    // Build STATS section
    // -------------------------
    let statsSection = "📊 **Stats**\n\n";

    if (combinedActivities.size === 0) {
      statsSection += "_No activity data found for this range._\n\n";
    } else {
      const totalSessions = rangedRows.length;

      const totalMinutes = rangedRows.reduce((sum, r) => {
        const match = r.duration && r.duration.match(/(\d+)/);
        return match ? sum + parseInt(match[1]) : sum;
      }, 0);

      // Tag counts
      const tagCounts = {};
      rangedRows.forEach(r => {
        const t = r.tags ? r.tags.split(",") : [];
        t.forEach(tag => {
          if (!tag) return;
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });

      // Platform counts
      const platformCounts = {};
      rangedRows.forEach(r => {
        if (!r.platform) return;
        platformCounts[r.platform] = (platformCounts[r.platform] || 0) + 1;
      });

      const topTagsArr = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
      const topPlatformsArr = Object.entries(platformCounts).sort((a, b) => b[1] - a[1]);

      const topTags = topTagsArr.slice(0, 5).map(([tag, count]) => `${tag} (${count})`).join(", ") || "None";
      const topPlatforms = topPlatformsArr.slice(0, 3).map(([p, count]) => `${p} (${count})`).join(", ") || "None";

      statsSection +=
        `**Total Sessions:** ${totalSessions}\n` +
        `**Total Duration:** ~${totalMinutes} minutes\n` +
        `**Top Tags:** ${topTags}\n` +
        `**Top Platforms:** ${topPlatforms}\n`;

      if (charts) {
        const maxTag = topTagsArr[0]?.[1] || 0;
        const maxPlat = topPlatformsArr[0]?.[1] || 0;

        if (topTagsArr.length) {
          statsSection += `\n**Tag Usage Chart:**\n`;
          topTagsArr.slice(0, 5).forEach(([tag, count]) => {
            statsSection += `${tag.padEnd(12)} ${asciiBar(count, maxTag)} ${count}\n`;
          });
        }

        if (topPlatformsArr.length) {
          statsSection += `\n**Platform Usage Chart:**\n`;
          topPlatformsArr.slice(0, 3).forEach(([p, count]) => {
            statsSection += `${p.padEnd(12)} ${asciiBar(count, maxPlat)} ${count}\n`;
          });
        }
      }

      statsSection += "\n";
    }

    // -------------------------
    // Build STREAKS section (Option A)
    // -------------------------
    let streakSection = "🔥 **Streaks**\n\n";

    const streakRows = db.prepare(
      "SELECT * FROM streaks WHERE userId = ?"
    ).all(userId);

    if (streakRows.length === 0) {
      streakSection += "_No streak data yet._\n";
    } else {
      for (const s of streakRows) {
        streakSection += `**${s.activity}** — ${s.streak} days\n`;
      }
    }

    // -------------------------
    // Final summary output
    // -------------------------
    const finalMessage =
      `${goalsSection}\n${statsSection}\n${streakSection}`;

    return interaction.reply({
      content: finalMessage,
      ephemeral: true,
    });
  }
  // -------------------------
  // /goals
  // -------------------------
  if (commandName === "goals") {
    const sub = interaction.options.getSubcommand();

    // /goals set
    if (sub === "set") {
      const activity = interaction.options.getString("activity");
      const targetSessions = interaction.options.getInteger("target_sessions");
      const range = interaction.options.getString("range");

      db.prepare(
        `INSERT INTO goals (userId, activity, targetSessions, range)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(userId, activity, range)
         DO UPDATE SET targetSessions = excluded.targetSessions`
      ).run(userId, activity, targetSessions, range);

      return interaction.reply({
        content: `Goal set: **${activity}** — **${targetSessions}** sessions per **${range}**.`,
        ephemeral: true,
      });
    }

    // /goals view
    if (sub === "view") {
      const range = interaction.options.getString("range");

      const goals = db.prepare(
        "SELECT * FROM goals WHERE userId = ? AND range = ?"
      ).all(userId, range);

      if (goals.length === 0) {
        return interaction.reply({
          content: `No goals set for range **${range}**.`,
          ephemeral: true,
        });
      }

      const now = Date.now();

      const lines = goals.map(goal => {
        let query = "SELECT * FROM activities WHERE userId = ? AND activity = ?";
        const params = [userId, goal.activity];
        let rows = db.prepare(query).all(...params);
        rows = applyRangeFilter(rows, range);

        const currentSessions = rows.length;
        const bar = goalProgressBar(currentSessions, goal.targetSessions);

        return (
          `**${goal.activity}** — Goal: **${goal.targetSessions}** sessions per **${range}**\n` +
          `${bar}\n`
        );
      });

      return interaction.reply({
        content: lines.join("\n"),
        ephemeral: true,
      });
    }

    // /goals delete
    if (sub === "delete") {
      const activity = interaction.options.getString("activity");
      const range = interaction.options.getString("range");

      const info = db.prepare(
        "DELETE FROM goals WHERE userId = ? AND activity = ? AND range = ?"
      ).run(userId, activity, range);

      if (info.changes === 0) {
        return interaction.reply({
          content: `No goal found for **${activity}** in range **${range}**.`,
          ephemeral: true,
        });
      }

      return interaction.reply({
        content: `Deleted goal for **${activity}** in range **${range}**.`,
        ephemeral: true,
      });
    }
  }

  // -------------------------
  // /export
  // -------------------------
  if (commandName === "export") {
    const serverFilter = interaction.options.getString("server");
    const format = interaction.options.getString("format");

    let query = "SELECT * FROM activities WHERE userId = ?";
    const params = [userId];

    if (serverFilter === "current") {
      query += " AND serverId = ?";
      params.push(serverId);
    }

    const rows = db.prepare(query).all(...params);

    if (rows.length === 0) {
      return interaction.reply({
        content: "No activity data found to export.",
        ephemeral: true,
      });
    }

    // JSON Export
    if (format === "json") {
      const jsonData = JSON.stringify(rows, null, 2);
      const buffer = Buffer.from(jsonData, "utf-8");

      const file = new AttachmentBuilder(buffer, {
        name: `training_export_${userId}.json`,
      });

      return interaction.reply({
        content: "Here is your JSON export:",
        files: [file],
        ephemeral: true,
      });
    }

    // CSV Export
    if (format === "csv") {
      const header = [
        "activity",
        "sessionNumber",
        "title",
        "description",
        "tags",
        "platform",
        "duration",
        "timestamp",
        "serverId",
      ].join(",");

      const lines = rows.map(r =>
        [
          r.activity,
          r.sessionNumber,
          `"${r.title.replace(/"/g, '""')}"`,
          `"${r.description.replace(/"/g, '""')}"`,
          `"${r.tags || ""}"`,
          r.platform,
          r.duration,
          r.timestamp,
          r.serverId,
        ].join(",")
      );

      const csv = [header, ...lines].join("\n");
      const buffer = Buffer.from(csv, "utf-8");

      const file = new AttachmentBuilder(buffer, {
        name: `training_export_${userId}.csv`,
      });

      return interaction.reply({
        content: "Here is your CSV export:",
        files: [file],
        ephemeral: true,
      });
    }
  }
});

// -------------------------
// Login
// -------------------------

client.login(TOKEN);
