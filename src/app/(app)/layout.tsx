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
            <a href="#main" className="skip-link">Skip to main content</a>
            <Sidebar />
            <main id="main" className="main" tabIndex={-1}>{children}</main>
          </div>
        </AccessGate>
      </ToastProvider>
    </AuthProvider>
  );
}
