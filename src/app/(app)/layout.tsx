import Sidebar from "@/components/Sidebar";
import AuthProvider from "@/components/AuthProvider";
import ToastProvider from "@/components/Toast";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <div className="app">
          <Sidebar />
          <main className="main">{children}</main>
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}
