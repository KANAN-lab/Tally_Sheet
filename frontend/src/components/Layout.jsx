import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import Sidebar, { Brand, NavList, SidebarUser } from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggle = () => (window.innerWidth >= 1024 ? setCollapsed((c) => !c) : setMobileOpen(true));
  return (
    <div className="min-h-screen bg-[#f4f6fb]">
      <Sidebar collapsed={collapsed} />
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-[#0B2149] border-0 flex flex-col" data-testid="mobile-sidebar">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Brand />
          <NavList onNavigate={() => setMobileOpen(false)} />
          <SidebarUser />
        </SheetContent>
      </Sheet>
      <div className={`transition-[padding] duration-200 ${collapsed ? "lg:pl-20" : "lg:pl-64"} print:pl-0`}>
        <Topbar onMenu={toggle} />
        <main className="px-4 py-6 sm:px-6 lg:px-8 max-w-[1600px] print:p-0 print:max-w-none" data-testid="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
