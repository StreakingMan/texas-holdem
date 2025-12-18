import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { VitePluginRadar } from "vite-plugin-radar";
import { fileURLToPath, URL } from "node:url";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      vue(),
      tailwindcss(),
      // Microsoft Clarity 分析（仅在设置了环境变量时启用）
      ...(env.VITE_CLARITY_ID
        ? [
            VitePluginRadar({
              enableDev: false,
              microsoftClarity: {
                id: env.VITE_CLARITY_ID,
              },
            }),
          ]
        : []),
    ],
    server: {
      host: true, // 监听所有地址，包括局域网
      port: 3847,
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
