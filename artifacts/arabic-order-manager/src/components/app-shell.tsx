import { useState, type ReactNode } from "react";
import { useClerk } from "@clerk/react";
import { Link, useLocation } from "wouter";
import { Bell, ChevronLeft, ChevronRight, CircleDollarSign, ClipboardList, ContactRound, FileBarChart, LayoutDashboard, LogOut, Menu, PackageCheck, ReceiptText, Settings, ShoppingBag, Truck, WalletCards, X } from "lucide-react";

const navGroups = [
    { label: "المتابعة اليومية", items: [
    { href: "/dashboard", label: "نظرة عامة", icon: LayoutDashboard },
    { href: "/orders", label: "الطلبات", icon: ClipboardList },
    { href: "/customers", label: "العملاء", icon: ContactRound },
  ]},
  { label: "الاستلام والتسليم", items: [
    { href: "/purchases", label: "مشتريات SHEIN", icon: ShoppingBag },
    { href: "/shipments", label: "الشحنات", icon: Truck },
  ]},
  { label: "الأموال والتقارير", items: [
    { href: "/payments", label: "الدفعات", icon: CircleDollarSign },
    { href: "/wallet", label: "المحفظة", icon: WalletCards },
    { href: "/reports", label: "التقارير", icon: FileBarChart },
  ]},
];

export function AppShell({ children }: { children: ReactNode }) {
  const { signOut } = useClerk();
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <aside className={`fixed inset-y-0 right-0 z-40 flex w-[272px] flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-300 ${collapsed ? "lg:w-[84px]" : ""} ${open ? "translate-x-0" : "translate-x-full lg:translate-x-0"}`}>
        <div className="flex h-[86px] items-center justify-between border-b border-sidebar-border px-5">
          <Link href="/" data-testid="link-brand" className={`flex items-center gap-3 ${collapsed ? "lg:mx-auto" : ""}`}>
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-secondary text-primary shadow-lg shadow-black/10">
              <span className="font-display text-2xl font-bold">س</span>
            </span>
            {!collapsed && <span className="hidden lg:block"><strong className="font-display block text-lg leading-none text-sidebar-accent-foreground">سِجلّ</strong><small className="mt-1 block text-[11px] text-sidebar-foreground/60">مركز الشراكة والطلبات</small></span>}
            <span className="lg:hidden"><strong className="font-display block text-lg leading-none text-sidebar-accent-foreground">سِجلّ</strong><small className="mt-1 block text-[11px] text-sidebar-foreground/60">مركز الشراكة والطلبات</small></span>
          </Link>
          <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent lg:hidden" data-testid="button-close-sidebar"><X size={18}/></button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-6">
          {navGroups.map((group) => <div key={group.label} className="mb-7">
            {!collapsed && <p className="mb-2 px-3 text-[10px] font-bold tracking-[.16em] text-sidebar-foreground/40">{group.label}</p>}
            <div className="space-y-1">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = href === "/dashboard" ? location === "/dashboard" : location.startsWith(href);
                return <Link href={href} key={href} onClick={() => setOpen(false)} data-testid={`link-nav-${href.replace("/", "") || "dashboard"}`} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold transition-colors ${active ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-black/10" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"} ${collapsed ? "lg:justify-center" : ""}`}>
                  <Icon size={18} strokeWidth={active ? 2.4 : 1.8}/>{!collapsed && <span>{label}</span>}
                  {active && !collapsed && <ChevronLeft size={15} className="mr-auto opacity-70"/>}
                </Link>;
              })}
            </div>
          </div>)}
        </div>
        <div className="border-t border-sidebar-border p-3">
          <Link href="/settings" data-testid="link-nav-settings" className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${collapsed ? "lg:justify-center" : ""}`}>
            <Settings size={18} strokeWidth={1.8}/>{!collapsed && <span>الإعدادات وسجل التدقيق</span>}
          </Link>
          {!collapsed && <div className="mt-3 flex items-center gap-3 rounded-xl bg-sidebar-accent/60 p-3">
            <span className="grid size-9 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground">ش</span>
            <div className="min-w-0"><p className="truncate text-xs font-bold">شريكان موثوقان</p><p className="mt-0.5 text-[10px] text-sidebar-foreground/50">إدارة مشتركة</p></div>
            <button onClick={() => void signOut()} className="mr-auto rounded-md p-1.5 text-sidebar-foreground/50 hover:bg-sidebar-accent" data-testid="button-sign-out" title="تسجيل الخروج"><LogOut size={15}/></button>
          </div>}
        </div>
        <button onClick={() => setCollapsed(!collapsed)} className="absolute -left-3 top-24 hidden size-6 place-items-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm lg:grid" data-testid="button-collapse-sidebar" title={collapsed ? "توسيع القائمة" : "تصغير القائمة"}>{collapsed ? <ChevronRight size={13}/> : <ChevronLeft size={13}/>}</button>
      </aside>
      {open && <button className="fixed inset-0 z-30 bg-primary/30 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} aria-label="إغلاق القائمة" data-testid="button-sidebar-overlay"/>}
      <div className={`min-h-[100dvh] transition-[margin] duration-300 lg:mr-[272px] ${collapsed ? "lg:mr-[84px]" : ""}`}>
        <header className="sticky top-0 z-20 flex h-[74px] items-center justify-between border-b border-border/80 bg-background/90 px-4 backdrop-blur-md sm:px-7">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="rounded-xl border border-border bg-card p-2.5 lg:hidden" data-testid="button-open-sidebar"><Menu size={19}/></button>
          <div><p className="text-[11px] font-medium text-muted-foreground">الثلاثاء، ١٥ أكتوبر ٢٠٢٤</p><h1 className="font-display text-xl font-bold sm:text-2xl">{location === "/dashboard" ? "صباح هادئ، كل شيء في مكانه" : "مركز العمليات"}</h1></div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button className="relative rounded-xl border border-border bg-card p-2.5 text-muted-foreground transition-colors hover:text-foreground" data-testid="button-notifications" title="التنبيهات"><Bell size={18}/><i className="absolute right-2 top-2 size-1.5 rounded-full bg-accent"/></button>
            <Link href="/orders/new" data-testid="link-quick-new-order" className="hidden items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5 sm:flex"><ClipboardList size={15}/> طلب جديد</Link>
          </div>
        </header>
        <main className="mx-auto max-w-[1520px] px-4 py-6 sm:px-7 sm:py-8">{children}</main>
      </div>
    </div>
  );
}