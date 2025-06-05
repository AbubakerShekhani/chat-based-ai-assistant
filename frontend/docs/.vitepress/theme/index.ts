// https://vitepress.dev/guide/custom-theme
import type { Theme } from "vitepress";
import Layout from "./Layout.vue";
import DefaultTheme from "vitepress/theme";
import "./style.css";

export default {
  extends: DefaultTheme,
  Layout,
} satisfies Theme;
