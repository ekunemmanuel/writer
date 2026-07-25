import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireAuth } from "./auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await ctx.db.query("images").withIndex("by_creation_time").filter((q) => q.eq(q.field("userId"), userId)).order("desc").collect();
  },
});

export const create = mutation({
  args: {
    storageId: v.id("_storage"),
    url: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const id = await ctx.db.insert("images", {
      storageId: args.storageId,
      url: args.url,
      name: args.name,
      userId: userId,
    });
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("images") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const image = await ctx.db.get(args.id);
    if (!image) throw new ConvexError("Image not found");
    if (image.userId && image.userId !== userId) throw new ConvexError("Unauthorized");

    // Check if any document is currently using this image
    const documents = await ctx.db.query("documents").filter((q) => q.eq(q.field("userId"), userId)).collect();
    const documentsUsingImage = documents.filter(doc => (doc.imageIds || []).includes(args.id));

    if (documentsUsingImage.length > 0) {
      const docNames = documentsUsingImage.map(doc => doc.title || "Untitled Document").join(", ");
      throw new ConvexError(`Cannot delete image. It is currently being used in the following documents: ${docNames}`);
    }

    // Delete the file from storage
    await ctx.storage.delete(image.storageId);

    // Delete the image row
    await ctx.db.delete(args.id);
  },
});
