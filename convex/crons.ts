import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const checkRecentEditsCron = internalMutation({
  args: {},
  handler: async (ctx) => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const allDocs = await ctx.db.query("documents").collect();
    const recentlyModified = allDocs.filter((d) => d.updatedAt >= fiveMinutesAgo);

    console.log(
      `[Cron Job - 5 Min Check] Checked platform activity. ${recentlyModified.length} document(s) edited in the last 5 minutes.`
    );
  },
});

const crons = cronJobs();

crons.interval(
  "5-minute-editor-notification",
  { minutes: 5 },
  internal.crons.checkRecentEditsCron
);

export default crons;
