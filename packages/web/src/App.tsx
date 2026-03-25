import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Dashboard } from "./pages/Dashboard";
import { Signals } from "./pages/Signals";
import { Research } from "./pages/Research";
import { Orders } from "./pages/Orders";
import { Performance } from "./pages/Performance";
import { Lessons } from "./pages/Lessons";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/signals", label: "Signals" },
  { to: "/research", label: "Research" },
  { to: "/orders", label: "Orders" },
  { to: "/performance", label: "Performance" },
  { to: "/lessons", label: "Lessons" },
];

export function App() {
  return (
    <TooltipProvider>
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        <nav className="border-b bg-card">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-1 px-4">
            <span className="mr-6 text-lg font-bold tracking-tight">
              Claude Trade
            </span>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
        <main className="mx-auto max-w-7xl p-4">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/signals" element={<Signals />} />
            <Route path="/research" element={<Research />} />
            <Route path="/research/:id" element={<Research />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/performance" element={<Performance />} />
            <Route path="/lessons" element={<Lessons />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
    </TooltipProvider>
  );
}
