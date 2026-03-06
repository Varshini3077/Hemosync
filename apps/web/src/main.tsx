import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LayoutDashboard, PlusCircle, BarChart2, Droplets } from "lucide-react";
import { Dashboard } from "./pages/Dashboard";
import { NewRequest } from "./pages/NewRequest";
import { RequestDetail } from "./pages/RequestDetail";
import { Analytics } from "./pages/Analytics";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
});

function NavItem({
  to,
  icon,
  label,
}: {
  readonly to: string;
  readonly icon: React.ReactNode;
  readonly label: string;
}): React.ReactElement {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          isActive
            ? "bg-white/20 text-white"
            : "text-blue-200 hover:bg-white/10 hover:text-white",
        ].join(" ")
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

function AppShell(): React.ReactElement {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="bg-hemosync-navy text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand */}
            <div className="flex items-center gap-2.5">
              <Droplets className="w-6 h-6 text-hemosync-red" />
              <span className="text-lg font-bold tracking-tight">
                HemoSync
              </span>
              <span className="hidden sm:inline text-blue-300 text-xs ml-1">
                Emergency Blood Coordination
              </span>
            </div>

            {/* Nav links */}
            <nav className="flex items-center gap-1">
              <NavItem
                to="/"
                icon={<LayoutDashboard className="w-4 h-4" />}
                label="Dashboard"
              />
              <NavItem
                to="/requests/new"
                icon={<PlusCircle className="w-4 h-4" />}
                label="New Request"
              />
              <NavItem
                to="/analytics"
                icon={<BarChart2 className="w-4 h-4" />}
                label="Analytics"
              />
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/requests/new" element={<NewRequest />} />
          <Route path="/requests/:id" element={<RequestDetail />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-4 text-center text-xs text-gray-400">
        HemoSync &copy; {new Date().getFullYear()} — Emergency Blood Coordination Platform
      </footer>
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
