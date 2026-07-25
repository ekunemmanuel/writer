import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";
import { permissions } from "./permissions";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    // Check if user has global doc.read, doc.update, doc.delete, or wildcard *
    const canReadGlobal = await permissions.check(ctx, {
      subjectRef: userId,
      action: "doc.read",
    });

    const canUpdateGlobal = await permissions.check(ctx, {
      subjectRef: userId,
      action: "doc.update",
    });

    const canDeleteGlobal = await permissions.check(ctx, {
      subjectRef: userId,
      action: "doc.delete",
    });

    const canSeeAllDocs = canReadGlobal || canUpdateGlobal || canDeleteGlobal;

    const canReadOwn = await permissions.check(ctx, {
      subjectRef: userId,
      action: "doc.read.own",
    });

    if (!canSeeAllDocs && !canReadOwn) {
      await permissions.require(ctx, { subjectRef: userId, action: "doc.read.own" });
    }

    const allDocs = await ctx.db
      .query("documents")
      .withIndex("by_creation_time")
      .order("desc")
      .collect();

    // Draft filtering: Non-editors/non-authors can only view published documents
    const filteredDocs = allDocs.filter((doc) => {
      const isAuthor = doc.userId === userId;
      const canEdit = canUpdateGlobal || isAuthor;
      // Show document if user is editor/author OR if document is published
      if (canEdit || doc.isPublished === true) {
        return canSeeAllDocs || isAuthor;
      }
      return false;
    });

    // Attach author details for display in dropdown UI
    const users = await ctx.db.query("users").collect();
    const userMap = new Map(users.map((u) => [u._id, u.email ?? u.name ?? "Staff Member"]));

    return filteredDocs.map((doc) => ({
      ...doc,
      authorEmail: doc.userId ? userMap.get(doc.userId) ?? "Staff Member" : "Guest Author",
      isOwn: doc.userId === userId,
      isPublished: doc.isPublished ?? false,
    }));
  },
});

export const get = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const subjectRef = userId ?? "guest";

    const doc = await ctx.db.get(args.id);
    if (!doc) return null;

    const canReadGlobal = await permissions.check(ctx, {
      subjectRef,
      action: "doc.read",
    });

    const canReadOwn =
      doc.userId === userId &&
      (await permissions.check(ctx, {
        subjectRef,
        action: "doc.read.own",
      }));

    if (!canReadGlobal && !canReadOwn) {
      await permissions.require(ctx, { subjectRef, action: "doc.read.own" });
    }

    // Check draft status visibility
    const canUpdateGlobal = userId ? await permissions.check(ctx, { subjectRef: userId, action: "doc.update" }) : false;
    const isAuthor = doc.userId === userId;
    if (doc.isPublished !== true && !canUpdateGlobal && !isAuthor) {
      throw new ConvexError("This document is currently a draft and has not been published yet.");
    }

    return doc;
  },
});

export const getPublic = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (doc && doc.isPublished !== true) {
      return null;
    }
    return doc;
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_creation_time")
      .order("desc")
      .collect();

    const users = await ctx.db.query("users").collect();
    const userMap = new Map(users.map((u) => [u._id, u.email ?? u.name ?? "Staff Member"]));

    return docs.map((d) => ({
      ...d,
      authorEmail: d.userId ? userMap.get(d.userId) ?? "Staff Member" : "Guest Author",
    }));
  },
});

export const save = mutation({
  args: {
    id: v.optional(v.id("documents")),
    title: v.string(),
    content: v.string(),
    imageIds: v.optional(v.array(v.id("images"))),
    isPublished: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    if (args.id) {
      // Updating an existing document
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new ConvexError("Document not found");

      // Check if user has global doc.update (editors/admins) or doc.update.own for owned documents (staff)
      const canUpdateGlobal = await permissions.check(ctx, {
        subjectRef: userId,
        action: "doc.update",
      });

      const canUpdateOwn =
        existing.userId === userId &&
        (await permissions.check(ctx, {
          subjectRef: userId,
          action: "doc.update.own",
        }));

      if (!canUpdateGlobal && !canUpdateOwn) {
        // Enforce require() to trigger standard ConvexError<PermissionDenied>
        await permissions.require(ctx, { subjectRef: userId, action: "doc.update" });
      }

      await ctx.db.patch(args.id, {
        title: args.title,
        content: args.content,
        updatedAt: Date.now(),
        imageIds: args.imageIds,
        isPublished: args.isPublished !== undefined ? args.isPublished : (existing.isPublished ?? false),
      });
      return args.id;
    } else {
      // Creating a new document
      await permissions.require(ctx, { subjectRef: userId, action: "doc.create" });

      const newId = await ctx.db.insert("documents", {
        title: args.title,
        content: args.content,
        updatedAt: Date.now(),
        imageIds: args.imageIds,
        userId: userId,
        isPublished: args.isPublished ?? false, // Default to draft
      });
      return newId;
    }
  },
});

export const togglePublishStatus = mutation({
  args: {
    id: v.id("documents"),
    isPublished: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError("Document not found");

    const canUpdateGlobal = await permissions.check(ctx, {
      subjectRef: userId,
      action: "doc.update",
    });

    const canUpdateOwn =
      doc.userId === userId &&
      (await permissions.check(ctx, {
        subjectRef: userId,
        action: "doc.update.own",
      }));

    if (!canUpdateGlobal && !canUpdateOwn) {
      await permissions.require(ctx, { subjectRef: userId, action: "doc.update" });
    }

    await ctx.db.patch(args.id, {
      isPublished: args.isPublished,
      updatedAt: Date.now(),
    });

    return { success: true, isPublished: args.isPublished };
  },
});

export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const doc = await ctx.db.get(args.id);
    if (!doc) return;

    // Check if user has global doc.delete (editors/admins) or doc.delete.own for owned documents (staff)
    const canDeleteGlobal = await permissions.check(ctx, {
      subjectRef: userId,
      action: "doc.delete",
    });

    const canDeleteOwn =
      doc.userId === userId &&
      (await permissions.check(ctx, {
        subjectRef: userId,
        action: "doc.delete.own",
      }));

    if (!canDeleteGlobal && !canDeleteOwn) {
      await permissions.require(ctx, { subjectRef: userId, action: "doc.delete" });
    }

    await ctx.db.delete(args.id);
  },
});