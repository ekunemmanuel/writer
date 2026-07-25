import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { initConvex, initAuth } from "@writer/shared";
import { router } from "./router";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
initConvex(convexUrl);
initAuth(convexUrl);

const app = createApp(App);
app.use(router);
app.mount("#app");
