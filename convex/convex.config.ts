import { defineApp } from "convex/server";
import permissions from "@vllnt/convex-permissions/convex.config";

const app = defineApp();
app.use(permissions);

export default app;
