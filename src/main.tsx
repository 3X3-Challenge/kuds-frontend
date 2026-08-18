import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { AuthProvider } from "./lib/auth";
import { ToastProvider } from "./lib/toast";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dữ liệu quản trị đọc nhiều, đổi ít. 30 giây đủ để chuyển qua lại giữa
      // các trang mà không gọi lại API, vẫn đủ mới cho một trang nội bộ.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // 401 nghĩa là hết phiên — thử lại chỉ tổ chậm rồi vẫn về trang đăng nhập.
      retry: (failureCount, error) => {
        const status = (error as { status?: number }).status;
        if (status && status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
