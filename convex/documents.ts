import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await ctx.db.query("documents").withIndex("by_creation_time").filter((q) => q.eq(q.field("userId"), userId)).order("desc").collect();
  },
});

export const get = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) return null;
    return doc;
  },
});

export const getPublic = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    return doc;
  },
});

export const save = mutation({
  args: {
    id: v.optional(v.id("documents")),
    title: v.string(),
    content: v.string(),
    imageIds: v.optional(v.array(v.id("images"))),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (existing && existing.userId !== userId) throw new Error("Unauthorized");
      await ctx.db.patch(args.id, {
        title: args.title,
        content: args.content,
        updatedAt: Date.now(),
        imageIds: args.imageIds,
      });
      return args.id;
    } else {
      const newId = await ctx.db.insert("documents", {
        title: args.title,
        content: args.content,
        updatedAt: Date.now(),
        imageIds: args.imageIds,
        userId: userId,
      });
      return newId;
    }
  },
});

export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const doc = await ctx.db.get(args.id);
    if (doc && doc.userId !== userId) throw new Error("Unauthorized");
    await ctx.db.delete(args.id);
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    //const userId = await requireAuth(ctx);
    return await ctx.db.query("documents").withIndex("by_creation_time").order("desc").collect();
  },
});