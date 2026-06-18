import Sidebar from "@/components/Sidebar";
import AuthProvider from "@/components/AuthProvider";
import ToastProvider from "@/components/Toast";
import AccessGate from "@/components/AccessGate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <AccessGate>
          <div className="app">
            <Sidebar />
            <main className="main">{children}</main>
          </div>
        </AccessGate>
      </ToastProvider>
    </AuthProvider>
  );
}
