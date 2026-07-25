import { components } from "./_generated/api";
import { Permissions } from "@vllnt/convex-permissions";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAuth, parseNameFromEmail } from "./auth";
import { modifyAccountCredentials } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

export type Role = "admin" | "editor" | "staff" | "reader";
export type Action =
  | "doc.create"
  | "doc.read"
  | "doc.read.own"
  | "doc.update"
  | "doc.update.own"
  | "doc.delete"
  | "doc.delete.own"
  | "role.manage"
  | "*";

export const permissions = new Permissions<Role, Action>(components.permissions);

/**
 * Initializes/seeds standard roles, permissions, and pivot table links
 * in both @vllnt/convex-permissions component and system relational tables.
 */
export const setupDefaultRoles = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Setup in @vllnt/convex-permissions component
    await permissions.defineRole(ctx, {
      name: "admin",
      description: "Superadministrator with full access to all resources and management.",
      grants: ["*"],
    });

    await permissions.defineRole(ctx, {
      name: "editor",
      description: "Editor capable of managing any staff document.",
      grants: ["doc.create", "doc.read", "doc.update", "doc.delete"],
    });

    await permissions.defineRole(ctx, {
      name: "staff",
      description: "Staff member who can manage their own documents.",
      grants: ["doc.create", "doc.read.own", "doc.update.own", "doc.delete.own"],
    });

    await permissions.defineRole(ctx, {
      name: "reader",
      description: "Reader with view-only permissions.",
      grants: ["doc.read"],
    });

    await permissions.assign(ctx, {
      subjectRef: "guest",
      role: "reader",
    });

    await permissions.assign(ctx, {
      subjectRef: "k57397yafx45cbpyd8v3skc3wh8asef3",
      role: "admin",
    });

    // 2. Populate relational schema tables: roles, permissions, role_permissions, user_roles
    const roleDefinitions = [
      { name: "admin", description: "Superadministrator with full access", grants: ["*"] },
      { name: "editor", description: "Editor for staff documents", grants: ["doc.create", "doc.read", "doc.update", "doc.delete"] },
      { name: "staff", description: "Staff member for own documents", grants: ["doc.create", "doc.read.own", "doc.update.own", "doc.delete.own"] },
      { name: "reader", description: "Reader with view-only access", grants: ["doc.read"] },
    ];

    const permissionDefinitions = [
      { name: "Full Access", action: "*" },
      { name: "Create Document", action: "doc.create" },
      { name: "Read Document", action: "doc.read" },
      { name: "Update Document", action: "doc.update" },
      { name: "Update Own Document", action: "doc.update.own" },
      { name: "Delete Document", action: "doc.delete" },
      { name: "Delete Own Document", action: "doc.delete.own" },
      { name: "Manage Roles", action: "role.manage" },
    ];

    // Seed permissions
    const permissionMap = new Map<string, Id<"permissions">>();
    for (const perm of permissionDefinitions) {
      const existing = await ctx.db
        .query("permissions")
        .withIndex("by_action", (q) => q.eq("action", perm.action))
        .unique();

      if (existing) {
        permissionMap.set(perm.action, existing._id);
      } else {
        const id = await ctx.db.insert("permissions", {
          name: perm.name,
          action: perm.action,
        });
        permissionMap.set(perm.action, id);
      }
    }

    // Seed roles & role_permissions pivot links
    for (const rdef of roleDefinitions) {
      let roleId: Id<"roles">;
      const existingRole = await ctx.db
        .query("roles")
        .withIndex("by_name", (q) => q.eq("name", rdef.name))
        .unique();

      if (existingRole) {
        roleId = existingRole._id;
      } else {
        roleId = await ctx.db.insert("roles", {
          name: rdef.name,
          description: rdef.description,
        });
      }

      // Link grants in role_permissions pivot table
      for (const grantAction of rdef.grants) {
        const permId = permissionMap.get(grantAction);
        if (permId) {
          const existingPivot = await ctx.db
            .query("role_permissions")
            .withIndex("by_roleId_and_permissionId", (q) =>
              q.eq("roleId", roleId).eq("permissionId", permId)
            )
            .unique();

          if (!existingPivot) {
            await ctx.db.insert("role_permissions", {
              roleId,
              permissionId: permId,
            });
          }
        }
      }
    }

    // Seed user_roles pivot for initial admin user
    const adminUser = await ctx.db.get("k57397yafx45cbpyd8v3skc3wh8asef3" as Id<"users">);
    if (adminUser) {
      const adminRole = await ctx.db
        .query("roles")
        .withIndex("by_name", (q) => q.eq("name", "admin"))
        .unique();

      if (adminRole) {
        const existingUserRole = await ctx.db
          .query("user_roles")
          .withIndex("by_userId_and_roleId", (q) =>
            q.eq("userId", adminUser._id).eq("roleId", adminRole._id)
          )
          .unique();

        if (!existingUserRole) {
          await ctx.db.insert("user_roles", {
            userId: adminUser._id,
            roleId: adminRole._id,
          });
        } 
      }
    }

    return { success: true };
  },
});

/**
 * Assigns 'staff' role to all existing non-admin users in the database.
 */
export const backfillExistingUsersAsStaff = mutation({
  args: {},
  handler: async (ctx) => {
    const allUsers = await ctx.db.query("users").collect();
    const staffRole = await ctx.db
      .query("roles")
      .withIndex("by_name", (q) => q.eq("name", "staff"))
      .unique();

    const results = [];

    for (const user of allUsers) {
      const userRoles = await permissions.rolesFor(ctx, { subjectRef: user._id });
      const isAdmin =
        userRoles.includes("admin") ||
        user._id === ("k57397yafx45cbpyd8v3skc3wh8asef3" as any);

      if (!isAdmin) {
        // Assign staff role in @vllnt/convex-permissions component
        await permissions.assign(ctx, {
          subjectRef: user._id,
          role: "staff",
        });

        // Assign staff role in user_roles pivot table
        if (staffRole) {
          const existingPivot = await ctx.db
            .query("user_roles")
            .withIndex("by_userId_and_roleId", (q) =>
              q.eq("userId", user._id).eq("roleId", staffRole._id)
            )
            .unique();

          if (!existingPivot) {
            await ctx.db.insert("user_roles", {
              userId: user._id,
              roleId: staffRole._id,
            });
          }
        }

        results.push({ userId: user._id, roleAssigned: "staff" });
      } else {
        results.push({ userId: user._id, roleAssigned: "admin" });
      }
    }

    return { success: true, processedUsers: results };
  },
});

/**
 * Seeds initial admin user role.
 */
export const seedInitialAdmin = mutation({
  args: {
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = args.userId ?? "k57397yafx45cbpyd8v3skc3wh8asef3";

    await permissions.assign(ctx, {
      subjectRef: adminId,
      role: "admin",
    });

    return { success: true, adminId };
  },
});

/**
 * Ensures signed in user gets the 'staff' role if they currently have no role assigned.
 */
export const ensureUserHasDefaultRole = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const existingRoles = await permissions.rolesFor(ctx, { subjectRef: userId });
    if (existingRoles.length === 0) {
      await permissions.assign(ctx, { subjectRef: userId, role: "staff" });
      return { assigned: true, role: "staff" };
    }
    return { assigned: false, roles: existingRoles };
  },
});

/**
 * Assigns a role to a target user (requires role.manage or admin access).
 */
export const assignUserRole = mutation({
  args: {
    userId: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("editor"),
      v.literal("staff"),
      v.literal("reader")
    ),
    scopeRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const callerId = await requireAuth(ctx);
    await permissions.require(ctx, {
      subjectRef: callerId,
      action: "role.manage",
      scopeRef: args.scopeRef,
    });

    await permissions.assign(ctx, {
      subjectRef: args.userId,
      role: args.role,
      scopeRef: args.scopeRef,
    });

    // Link in user_roles pivot table
    const roleDoc = await ctx.db
      .query("roles")
      .withIndex("by_name", (q) => q.eq("name", args.role))
      .unique();

    if (roleDoc) {
      const existingPivot = await ctx.db
        .query("user_roles")
        .withIndex("by_userId_and_roleId", (q) =>
          q.eq("userId", args.userId as any).eq("roleId", roleDoc._id)
        )
        .unique();

      if (!existingPivot) {
        await ctx.db.insert("user_roles", {
          userId: args.userId as any,
          roleId: roleDoc._id,
          scopeRef: args.scopeRef,
        });
      }
    }

    return { success: true };
  },
});

/**
 * Directly assigns a role to a user (used by admin CLI or setup scripts).
 */
export const assignRoleDirect = mutation({
  args: {
    userId: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("editor"),
      v.literal("staff"),
      v.literal("reader")
    ),
    scopeRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Assign in @vllnt/convex-permissions component
    await permissions.assign(ctx, {
      subjectRef: args.userId,
      role: args.role,
      scopeRef: args.scopeRef,
    });

    // 2. Link in user_roles pivot table
    const roleDoc = await ctx.db
      .query("roles")
      .withIndex("by_name", (q) => q.eq("name", args.role))
      .unique();

    if (roleDoc) {
      const existingPivot = await ctx.db
        .query("user_roles")
        .withIndex("by_userId_and_roleId", (q) =>
          q.eq("userId", args.userId as any).eq("roleId", roleDoc._id)
        )
        .unique();

      if (!existingPivot) {
        await ctx.db.insert("user_roles", {
          userId: args.userId as any,
          roleId: roleDoc._id,
          scopeRef: args.scopeRef,
        });
      }
    }

    const currentRoles = await permissions.rolesFor(ctx, { subjectRef: args.userId });
    const currentPermissions = await permissions.permissionsFor(ctx, { subjectRef: args.userId });

    return {
      success: true,
      userId: args.userId,
      roles: currentRoles,
      permissions: currentPermissions,
    };
  },
});

/**
 * Revokes a role from a target user (requires role.manage or admin access).
 */
export const revokeUserRole = mutation({
  args: {
    userId: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("editor"),
      v.literal("staff"),
      v.literal("reader")
    ),
    scopeRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const callerId = await requireAuth(ctx);
    await permissions.require(ctx, {
      subjectRef: callerId,
      action: "role.manage",
      scopeRef: args.scopeRef,
    });

    await permissions.revoke(ctx, {
      subjectRef: args.userId,
      role: args.role,
      scopeRef: args.scopeRef,
    });

    return { success: true };
  },
});

const DEFAULT_ROLE_ACTION_GRANTS: Record<string, Action[]> = {
  admin: ["*"],
  editor: ["doc.create", "doc.read", "doc.update", "doc.delete"],
  staff: ["doc.create", "doc.read.own", "doc.update.own", "doc.delete.own"],
  reader: ["doc.read.own"],
};

async function getDbRolesForUser(ctx: QueryCtx | MutationCtx, userId: Id<'users'>): Promise<string[]> {
  const pivotRows = await ctx.db
    .query("user_roles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();

  const roles: string[] = [];
  for (const pivot of pivotRows) {
    const roleDoc = await ctx.db.get(pivot.roleId);
    if (roleDoc) roles.push(roleDoc.name);
  }

  if (userId === "k57397yafx45cbpyd8v3skc3wh8asef3" && !roles.includes("admin")) {
    roles.push("admin");
  }

  return roles;
}

async function revokeAllAssignedRolesInComponent(ctx: MutationCtx, userId: string) {
  try {
    const existingRoles = await permissions.rolesFor(ctx, { subjectRef: userId });
    for (const r of existingRoles) {
      try {
        await permissions.revoke(ctx, { subjectRef: userId, role: r as Role });
      } catch (e) { }
    }
  } catch (e) { }
}

/**
 * Retrieves all roles for a given user.
 */
export const getUserRoles = query({
  args: {
    userId: v.optional(v.id("users")),
    scopeRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const targetId = args.userId ?? (await requireAuth(ctx));
    const roles = await getDbRolesForUser(ctx, targetId);
    return roles;
  },
});

/**
 * Retrieves all distinct permission grants for a given user.
 */
export const getUserPermissions = query({
  args: {
    userId: v.optional(v.id("users")),
    scopeRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const targetId = args.userId ?? (await requireAuth(ctx));
    const grants = await permissions.permissionsFor(ctx, {
      subjectRef: targetId,
      scopeRef: args.scopeRef,
    });
    return grants;
  },
});

/**
 * Retrieves all registered users in the platform along with their assigned roles and effective permissions.
 * Guarded by role.manage or admin access.
 */
export const listAllUsersWithRBAC = query({
  args: {},
  handler: async (ctx) => {
    const callerId = await requireAuth(ctx);
    const userRoles = await permissions.rolesFor(ctx, { subjectRef: callerId });
    const isAdmin = userRoles.includes("admin") || callerId === "k57397yafx45cbpyd8v3skc3wh8asef3";

    if (!isAdmin) {
      await permissions.require(ctx, {
        subjectRef: callerId,
        action: "role.manage",
      });
    }

    const users = await ctx.db.query("users").collect();
    const result = [];

    for (const user of users) {
      const userRoleNames = await getDbRolesForUser(ctx, user._id);
      const userPermissions = await permissions.permissionsFor(ctx, { subjectRef: user._id });

      result.push({
        _id: user._id,
        email: user.email ?? "No Email",
        name: user.name ?? user.email?.split("@")[0] ?? "User",
        roles: userRoleNames,
        permissions: userPermissions,
        creationTime: user._creationTime,
      });
    }

    return result;
  },
});

/**
 * Toggles a role for a user (assigns if missing, revokes if already held).
 * Updates user_roles pivot table and computes merged default grants.
 */
export const toggleUserRole = mutation({
  args: {
    userId: v.id('users'),
    role: v.union(
      v.literal("admin"),
      v.literal("editor"),
      v.literal("staff"),
      v.literal("reader")
    ),
  },
  handler: async (ctx, args) => {
    const callerId = await requireAuth(ctx);
    const callerRoles = await permissions.rolesFor(ctx, { subjectRef: callerId });
    const isAdmin = callerRoles.includes("admin") || callerId === "k57397yafx45cbpyd8v3skc3wh8asef3";

    if (!isAdmin) {
      await permissions.require(ctx, {
        subjectRef: callerId,
        action: "role.manage",
      });
    }

    const roleDoc = await ctx.db
      .query("roles")
      .withIndex("by_name", (q) => q.eq("name", args.role))
      .unique();

    if (!roleDoc) {
      throw new ConvexError(`Role '${args.role}' not found in database.`);
    }

    const pivot = await ctx.db
      .query("user_roles")
      .withIndex("by_userId_and_roleId", (q) =>
        q.eq("userId", args.userId).eq("roleId", roleDoc._id)
      )
      .unique();

    if (pivot) {
      // Admin explicitly removing this role
      await ctx.db.delete(pivot._id);
    } else {
      // Admin explicitly assigning this role
      await ctx.db.insert("user_roles", {
        userId: args.userId,
        roleId: roleDoc._id,
      });
    }

    // Query exact active DB role names assigned to user
    const updatedDbRoles = await getDbRolesForUser(ctx, args.userId);

    // Merge default grants for all currently assigned DB roles
    const mergedGrantsSet = new Set<Action>();
    for (const rName of updatedDbRoles) {
      const grants = DEFAULT_ROLE_ACTION_GRANTS[rName] || [];
      grants.forEach((g) => mergedGrantsSet.add(g));
    }
    const mergedGrants = Array.from(mergedGrantsSet);

    // Purge ALL existing component assigned roles for this user (including legacy custom_user:... roles)
    await revokeAllAssignedRolesInComponent(ctx, args.userId);

    // Assign custom action grants for user in @vllnt/convex-permissions
    const customRoleName = `user_custom_grants:${args.userId}` as Role;
    await permissions.defineRole(ctx, {
      name: customRoleName,
      description: `Custom action permissions for ${args.userId}`,
      grants: mergedGrants,
    });

    await permissions.assign(ctx, {
      subjectRef: args.userId,
      role: customRoleName,
    });

    const updatedPermissions = await permissions.permissionsFor(ctx, { subjectRef: args.userId });

    return {
      success: true,
      userId: args.userId,
      roles: updatedDbRoles,
      permissions: updatedPermissions,
    };
  },
});

/**
 * Resets a target user account password from the Admin Management UI.
 * Guarded by role.manage or admin access.
 */
export const adminResetUserPassword = mutation({
  args: {
    email: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const callerId = await requireAuth(ctx);
    const callerRoles = await permissions.rolesFor(ctx, { subjectRef: callerId });
    const isAdmin = callerRoles.includes("admin") || callerId === "k57397yafx45cbpyd8v3skc3wh8asef3";

    if (!isAdmin) {
      await permissions.require(ctx, {
        subjectRef: callerId,
        action: "role.manage",
      });
    }

    const accounts = await ctx.db.query("authAccounts").collect();
    const account = accounts.find(
      (acc) =>
        acc.provider === "password" &&
        acc.providerAccountId.toLowerCase() === args.email.toLowerCase()
    );

    if (!account) {
      throw new ConvexError(`No password account found for email '${args.email}'.`);
    }

    await modifyAccountCredentials(ctx as any, {
      provider: "password",
      account: {
        id: args.email,
        secret: args.newPassword,
      },
    });

    return {
      success: true,
      email: args.email,
      message: `Password for ${args.email} successfully updated.`,
    };
  },
});

/**
 * Toggles an explicit individual permission action for a user independently of their assigned role.
 * Allows adding or removing any specific permission (e.g. doc.delete, doc.update, role.manage) per user.
 */
export const toggleUserPermissionOverride = mutation({
  args: {
    userId: v.id('users'),
    action: v.union(
      v.literal("doc.create"),
      v.literal("doc.read"),
      v.literal("doc.read.own"),
      v.literal("doc.update"),
      v.literal("doc.update.own"),
      v.literal("doc.delete"),
      v.literal("doc.delete.own"),
      v.literal("role.manage"),
      v.literal("*")
    ),
  },
  handler: async (ctx, args) => {
    const callerId = await requireAuth(ctx);
    const callerRoles = await permissions.rolesFor(ctx, { subjectRef: callerId });
    const isAdmin = callerRoles.includes("admin") || callerId === "k57397yafx45cbpyd8v3skc3wh8asef3";

    if (!isAdmin) {
      await permissions.require(ctx, {
        subjectRef: callerId,
        action: "role.manage",
      });
    }

    const currentPermissions = await permissions.permissionsFor(ctx, { subjectRef: args.userId });
    const hasPermission = currentPermissions.includes(args.action);

    let newGrants: Action[];
    if (hasPermission) {
      // Remove action from user permissions
      newGrants = (currentPermissions as Action[]).filter((p) => p !== args.action);
    } else {
      // Add action to user permissions
      newGrants = Array.from(new Set([...(currentPermissions as Action[]), args.action]));
    }

    // Purge ALL existing component assigned roles for this user (including legacy custom_user:... roles)
    await revokeAllAssignedRolesInComponent(ctx, args.userId);

    // Define and assign custom permissions role in @vllnt/convex-permissions
    const customRoleName = `user_custom_grants:${args.userId}` as Role;
    await permissions.defineRole(ctx, {
      name: customRoleName,
      description: `Custom action permissions for ${args.userId}`,
      grants: newGrants,
    });

    await permissions.assign(ctx, {
      subjectRef: args.userId,
      role: customRoleName,
    });

    // If ALL permissions for a role are revoked, remove that role from user_roles table
    const rolesToEvaluate: Role[] = ["editor", "staff", "reader"];
    for (const roleName of rolesToEvaluate) {
      const roleGrants = DEFAULT_ROLE_ACTION_GRANTS[roleName] || [];
      const hasAnyGrantForRole =
        newGrants.includes("*") ||
        roleGrants.some((g) => newGrants.includes(g));

      if (!hasAnyGrantForRole) {
        const roleDoc = await ctx.db
          .query("roles")
          .withIndex("by_name", (q) => q.eq("name", roleName))
          .unique();
        if (roleDoc) {
          const pivot = await ctx.db
            .query("user_roles")
            .withIndex("by_userId_and_roleId", (q) =>
              q.eq("userId", args.userId).eq("roleId", roleDoc._id)
            )
            .unique();
          if (pivot) {
            await ctx.db.delete(pivot._id);
          }
        }
      }
    }

    const dbRoleNames = await getDbRolesForUser(ctx, args.userId);
    const updatedPermissions = await permissions.permissionsFor(ctx, { subjectRef: args.userId });

    return {
      success: true,
      userId: args.userId,
      roles: dbRoleNames,
      permissions: updatedPermissions,
    };
  },
});

/**
 * Wipes stale legacy roles in @vllnt/convex-permissions for all users and re-syncs current active permissions.
 */
export const cleanupStaleUserPermissions = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const count = users.length;

    for (const user of users) {
      const dbRoles = await getDbRolesForUser(ctx, user._id);

      const mergedGrantsSet = new Set<Action>();
      for (const rName of dbRoles) {
        const grants = DEFAULT_ROLE_ACTION_GRANTS[rName] || [];
        grants.forEach((g) => mergedGrantsSet.add(g));
      }
      const grants = Array.from(mergedGrantsSet);

      await revokeAllAssignedRolesInComponent(ctx, user._id);

      const customRoleName = `user_custom_grants:${user._id}` as Role;
      await permissions.defineRole(ctx, {
        name: customRoleName,
        description: `Custom action permissions for ${user._id}`,
        grants,
      });

      await permissions.assign(ctx, {
        subjectRef: user._id,
        role: customRoleName,
      });
    }

    return { success: true, processedUsersCount: count };
  },
});

/**
 * Returns all system roles and their defined default permission grants.
 */
export const listRoleDefinitions = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    const roleDocs = await permissions.listRoles(ctx);
    return roleDocs;
  },
});

/**
 * Backfills formatted names for existing users based on their email address.
 * Only updates users with missing or unformatted names. Does not overwrite custom names.
 */
export const backfillUserNames = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let updatedCount = 0;

    for (const user of users) {
      if (user.email) {
        const computedName = parseNameFromEmail(user.email);
        if (!user.name || user.name === user.email) {
          await ctx.db.patch(user._id, { name: computedName });
          updatedCount++;
        }
      }
    }

    return { success: true, updatedCount, totalUsers: users.length };
  },
});
