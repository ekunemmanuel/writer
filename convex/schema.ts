import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  
  // Core application documents
  documents: defineTable({
    title: v.string(),
    content: v.string(),
    updatedAt: v.number(),
    userId: v.optional(v.id("users")),
    imageIds: v.optional(v.array(v.id("images"))), // Track which images are inside this document
    isPublished: v.optional(v.boolean()), // Draft = false/undefined, Published = true
  }),
  
  images: defineTable({
    storageId: v.id("_storage"),
    url: v.string(),
    name: v.string(),
    userId: v.optional(v.id("users")),
  }),

  // Role-Based Access Control (RBAC) Relational Tables
  // 1. Roles table
  roles: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
  }).index("by_name", ["name"]),

  // 2. Permissions table
  permissions: defineTable({
    name: v.string(),
    action: v.string(),
    description: v.optional(v.string()),
  })
    .index("by_name", ["name"])
    .index("by_action", ["action"]),

  // 3. Pivot table: Role <-> Permission
  role_permissions: defineTable({
    roleId: v.id("roles"),
    permissionId: v.id("permissions"),
  })
    .index("by_roleId", ["roleId"])
    .index("by_permissionId", ["permissionId"])
    .index("by_roleId_and_permissionId", ["roleId", "permissionId"]),

  // 4. Pivot table: User <-> Role
  user_roles: defineTable({
    userId: v.id("users"),
    roleId: v.id("roles"),
    scopeRef: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_roleId", ["roleId"])
    .index("by_userId_and_roleId", ["userId", "roleId"]),
});
