import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  documents: defineTable({
    title: v.string(),
    content: v.string(),
    updatedAt: v.number(),
    userId: v.optional(v.id("users")),
    imageIds: v.optional(v.array(v.id("images"))), // Track which images are inside this document
  }),
  
  images: defineTable({
    storageId: v.id("_storage"),
    url: v.string(),
    name: v.string(),
    userId: v.optional(v.id("users")),
  })
});
