import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { LayoutDashboard, LogOut, Menu, MonitorSpeaker, Users } from "lucide-react";

import { Badge, Button } from "@/components/ui";
import { useAuth } from "@entities/auth";
import { isV2PageEnabled, type V2PageKey } from "@shared/config";
import { cn } from "@shared/lib";
import { useUiStore } from "@shared/store";
import { HeaderMetaProvider } from "@shared/ui/HeaderMetaProvider";
import { useHeaderMeta } from "@shared/ui/useHeaderMeta";

type V2MenuItem = {
  key: V2PageKey;
  label: string;
  icon: ReactNode;
  route: string;
};

function AppShellV2Inner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const { meta, setLastUpdated } = useHeaderMeta();
  const [currentTime, setCurrentTime] = useState(dayjs());

  const schoolId = location.pathname.match(/\/schools\/([^/]+)/)?.[1] || user?.schoolId;

  useEffect(() => {
    if (!meta.showTime) return;
    const timer = setInterval(() => setCurrentTime(dayjs()), 60000);
    return () => clearInterval(timer);
  }, [meta.showTime]);

  const menuItems = useMemo<V2MenuItem[]>(() => {
    const baseItems: V2MenuItem[] = [];
    if (!schoolId) return baseItems;
    if (isV2PageEnabled("dashboard")) {
      baseItems.push({
        key: "dashboard",
        label: "Boshqaruv",
        icon: <LayoutDashboard className="h-4 w-4" />,
        route: `/v2/schools/${schoolId}/dashboard`,
      });
    }
    if (isV2PageEnabled("students")) {
      baseItems.push({
        key: "students",
        label: "O'quvchilar",
        icon: <Users className="h-4 w-4" />,
        route: `/v2/schools/${schoolId}/students`,
      });
    }
    if (isV2PageEnabled("devices")) {
      baseItems.push({
        key: "devices",
        label: "Qurilmalar",
        icon: <MonitorSpeaker className="h-4 w-4" />,
        route: `/v2/schools/${schoolId}/devices`,
      });
    }
    return baseItems;
  }, [schoolId]);

  const handleRefresh = async () => {
    if (!meta.refresh) return;
    const result = meta.refresh();
    if (result instanceof Promise) {
      await result;
    }
    setLastUpdated(new Date());
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_#dbeafe_0%,_#eef4fb_40%,_#f8fafc_100%)] text-foreground">
      <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
      <aside
        className={cn(
          "relative z-10 border-r border-border/70 bg-card/95 backdrop-blur transition-all duration-200",
          sidebarCollapsed ? "w-[72px]" : "w-[220px]",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border/70 px-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white shadow-sm">
              <LayoutDashboard className="h-4 w-4" />
            </div>
            <div className={cn("min-w-0", sidebarCollapsed && "hidden")}>
              <p className="truncate text-sm font-semibold tracking-tight">Attendance V2</p>
              <p className="truncate text-[11px] text-muted">Pilot Workspace</p>
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={toggleSidebar} aria-label="Sidebar toggle">
            <Menu className="h-4 w-4" />
          </Button>
        </div>

        <nav className="space-y-1 px-3 py-3">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.route;
            return (
              <NavLink
                key={item.key}
                to={item.route}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-white shadow-sm hover:bg-primary/90"
                    : "text-foreground/75 hover:bg-muted/20 hover:text-foreground",
                )}
              >
                {item.icon}
                <span className={cn(sidebarCollapsed && "hidden")}>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur">
          <div className="flex h-14 w-full items-center justify-between px-3 md:px-4">
            <div className="flex min-w-0 items-center gap-3">
              <Badge variant={meta.isConnected ? "success" : "destructive"}>
                {meta.isConnected ? "Jonli" : "Oflayn"}
              </Badge>
              {meta.lastUpdated && (
                <span className="truncate text-xs text-muted">
                  Yangilandi: {dayjs(meta.lastUpdated).format("HH:mm:ss")}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {meta.showTime && (
                <span className="hidden text-sm text-foreground/80 sm:inline">
                  {currentTime.format("DD MMM, HH:mm")}
                </span>
              )}
              {meta.refresh && (
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                  Yangilash
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
              >
                <LogOut className="mr-1 h-4 w-4" />
                Chiqish
              </Button>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-3 md:p-4">
          <div className="w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export function AppShellV2() {
  return (
    <HeaderMetaProvider>
      <AppShellV2Inner />
    </HeaderMetaProvider>
  );
}
