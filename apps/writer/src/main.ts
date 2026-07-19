import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { initConvex, initAuth } from "@writer/shared";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
initConvex(convexUrl);
initAuth(convexUrl);
createApp(App).mount("#app");
