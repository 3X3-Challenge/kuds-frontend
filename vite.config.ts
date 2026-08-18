import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Cổng 3001 khớp với CORS_ORIGINS mặc định của backend (.env.example).
 * Đổi cổng ở đây thì phải đổi cả CORS_ORIGINS bên kuds-backend, nếu không
 * trình duyệt chặn mọi request trước khi nó rời máy.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 3001, strictPort: true },
  preview: { port: 3001, strictPort: true },
});
