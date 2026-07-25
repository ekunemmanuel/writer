import { convexAuth, getAuthUserId, modifyAccountCredentials } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ConvexError, v } from "convex/values";
import { QueryCtx, MutationCtx, ActionCtx, internalMutation, internalAction } from "./_generated/server";
import { permissions } from "./permissions";
import { internal } from "./_generated/api";

export function parseNameFromEmail(email?: string): string {
  if (!email || !email.includes("@")) return "User";
  const localPart = email.split("@")[0];
  if (!localPart) return "User";

  const tokens = localPart.split(/[\._\-\+]+/).filter(Boolean);
  if (tokens.length === 0) return localPart.charAt(0).toUpperCase() + localPart.slice(1);

  const capitalizedTokens = tokens.map(
    (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
  );

  return capitalizedTokens.join(" ");
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      if (args.existingUserId) {
        return args.existingUserId;
      }

      const mCtx = ctx as MutationCtx;

      const profileData = { ...args.profile };
      if (!profileData.name && profileData.email) {
        profileData.name = parseNameFromEmail(profileData.email);
      }

      // Create new user in users table
      const userId = await mCtx.db.insert("users", profileData);

      // Link 'staff' role in user_roles pivot table
      const staffRole = await mCtx.db
        .query("roles")
        .withIndex("by_name", (q) => q.eq("name", "staff"))
        .unique();

      if (staffRole) {
        await mCtx.db.insert("user_roles", {
          userId,
          roleId: staffRole._id,
        });
      }

      // Assign default staff grants to user_custom_grants:<userId> in @vllnt/convex-permissions component
      const customRoleName = `user_custom_grants:${userId}` as any;
      await permissions.defineRole(mCtx, {
        name: customRoleName,
        description: `Custom action permissions for ${userId}`,
        grants: ["doc.create", "doc.read.own", "doc.update.own", "doc.delete.own"],
      });

      await permissions.assign(mCtx, {
        subjectRef: userId,
        role: customRoleName,
      });

      return userId;
    },
  },
});

export async function requireAuth(ctx: QueryCtx | MutationCtx | ActionCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError("Client is not authenticated!");
  }
  return userId;
}

/**
 * Internal administration function to immediately reset/change a user's password.
 * Designed for execution via the Convex Dashboard (Functions -> internal.auth.resetUserPassword) or CLI.
 */
export const resetUserPassword = internalMutation({
  args: {
    email: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Verify user exists
    const users = await ctx.db.query("users").collect();
    const user = users.find(
      (u) => u.email?.toLowerCase() === args.email.toLowerCase()
    );

    const accounts = await ctx.db.query("authAccounts").collect();
    const account = accounts.find(
      (acc) =>
        acc.provider === "password" &&
        acc.providerAccountId.toLowerCase() === args.email.toLowerCase()
    );

    if (!account && !user) {
      throw new ConvexError(`No account or user found with email '${args.email}'.`);
    }

    // 2. Use Convex Auth helper to re-hash and update secret in authAccounts
    await modifyAccountCredentials(ctx as any, {
      provider: "password",
      account: {
        id: args.email,
        secret: args.newPassword,
      },
    });

    await ctx.scheduler.runAfter(0, internal.auth.updatePassword, { email: args.email, password: args.newPassword });

    return {
      success: true,
      email: args.email,
      userId: account?.userId ?? user?._id,
      message: `Password for ${args.email} has been successfully updated.`,
    };
  },
});


export const updatePassword = internalAction(async (ctx, args: { email: string, password: string }) => {
  await modifyAccountCredentials(ctx, {
    provider: "password",
    account: {
      id: args.email,
      secret: args.password,
    },
  });
})
