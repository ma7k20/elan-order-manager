import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, Redirect, Route, Switch, Router as WouterRouter } from "wouter";
import { ArrowLeft, CheckCircle2, CircleDollarSign, PackageCheck, ShieldCheck, Truck, type LucideIcon } from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import { AuthProvider, useAppAuth } from "@/lib/auth";
import {
  CustomersPage, CustomerProfilePage, DashboardPage, NewOrderPage, OrderDetailsPage,
  OrdersPage, PaymentsPage, PurchasesPage, ReportsPage, SettingsPage, ShipmentsPage, WalletPage,
} from "@/pages/main";
import { AiAssistantPage } from "@/pages/ai-assistant";

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function Landing() {
  const featureCards: Array<[string, string, LucideIcon, string]> = [
    ["رصيد المحفظة", "₪ 2,480.00", CircleDollarSign, "bg-primary text-primary-foreground"],
    ["طلبات نشطة", "١٢ طلباً", PackageCheck, "bg-secondary text-secondary-foreground"],
    ["شحنات بالطريق", "٣ شحنات", Truck, "bg-[#dce9df] text-[#1d5945]"],
    ["كل شيء موثق", "سجل تدقيق", CheckCircle2, "bg-accent text-accent-foreground"],
  ];
  return (
    <div className="min-h-[100dvh] overflow-hidden bg-background">
      <div className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-primary text-secondary shadow-lg shadow-primary/10">
              <span className="font-display text-2xl font-bold">س</span>
            </span>
            <span>
              <strong className="font-display block text-lg leading-none">سِجلّ</strong>
              <small className="mt-1 block text-[11px] text-muted-foreground">مركز الشراكة والطلبات</small>
            </span>
          </Link>
          <Link href="/sign-in" className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-primary transition hover:-translate-y-0.5">
            تسجيل الدخول
          </Link>
        </header>
        <main className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.1fr_.9fr] lg:py-24">
          <div>
            <p className="mb-4 text-xs font-bold tracking-[.18em] text-accent">مساحة واحدة · رؤية كاملة</p>
            <h1 className="max-w-xl font-display text-5xl font-bold leading-[1.28] tracking-tight text-primary sm:text-7xl">
              كل طلب محسوب.<br /><span className="text-accent">كل شيكل معروف.</span>
            </h1>
            <p className="mt-7 max-w-lg text-base leading-8 text-muted-foreground sm:text-lg">
              مساحة عمل مشتركة لشريكين يديران طلبات شي إن، وصول المنتجات، التسليم، والمدفوعات من مكان واحد واضح وآمن.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/sign-up" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/15 transition hover:-translate-y-0.5">
                ابدأ مساحة الشراكة <ArrowLeft size={17} />
              </Link>
              <span className="inline-flex items-center gap-2 px-3 text-xs text-muted-foreground"><ShieldCheck size={16} className="text-accent" /> بياناتك محفوظة ومشتركة بأمان</span>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-8 rounded-[3rem] bg-secondary/20 blur-3xl" />
            <div className="relative rounded-[2rem] border border-border bg-card p-5 shadow-[0_24px_80px_rgba(31,62,64,.12)] sm:p-7">
              <div className="flex items-center justify-between border-b border-border/70 pb-5">
                <div><p className="text-xs text-muted-foreground">صورة اليوم</p><h2 className="mt-1 font-display text-xl font-bold">لوحة القيادة</h2></div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-800">محدّثة الآن</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {featureCards.map(([label, value, Icon, cls]) => (
                  <div key={String(label)} className={`rounded-2xl p-4 ${cls}`}><Icon size={18} /><p className="mt-5 text-[11px] opacity-70">{label}</p><strong className="mt-1 block font-display text-lg">{value}</strong></div>
                ))}
              </div>
              <div className="mt-3 rounded-2xl bg-muted/70 p-4"><div className="flex items-center justify-between"><span className="text-xs font-bold">منتجات وصلت ولم تُسلّم</span><strong className="font-display text-xl text-accent">٠٤</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-border"><div className="h-full w-3/5 rounded-full bg-accent" /></div></div>
            </div>
          </div>
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 py-5 text-xs text-muted-foreground"><span>صُنع للشراكة الواضحة</span><span>أسعار المنتجات، تكلفة شي إن، والربح — كل قيمة في مكانها</span></footer>
      </div>
    </div>
  );
}

function Protected({ children }: { children: ReactNode }) {
  const { account, loading } = useAppAuth();
  if (loading) return null;
  return account ? children : <Redirect to="/sign-in" />;
}

function HomeRedirect() {
  const { account, loading } = useAppAuth();
  if (loading) return null;
  return account ? <Redirect to="/dashboard" /> : <Landing />;
}

function Router() {
  return <ErrorBoundary><Switch>
    <Route path="/" component={HomeRedirect} />
    <Route path="/sign-in" component={LoginPage} />
    <Route path="/dashboard" component={() => <Protected><DashboardPage /></Protected>} />
    <Route path="/customers" component={() => <Protected><CustomersPage /></Protected>} />
    <Route path="/customers/:id" component={() => <Protected><CustomerProfilePage /></Protected>} />
    <Route path="/orders/new" component={() => <Protected><NewOrderPage /></Protected>} />
    <Route path="/orders/:id" component={() => <Protected><OrderDetailsPage /></Protected>} />
    <Route path="/orders" component={() => <Protected><OrdersPage /></Protected>} />
    <Route path="/payments" component={() => <Protected><PaymentsPage /></Protected>} />
    <Route path="/purchases" component={() => <Protected><PurchasesPage /></Protected>} />
    <Route path="/shipments" component={() => <Protected><ShipmentsPage /></Protected>} />
    <Route path="/wallet" component={() => <Protected><WalletPage /></Protected>} />
    <Route path="/reports" component={() => <Protected><ReportsPage /></Protected>} />
    <Route path="/settings" component={() => <Protected><SettingsPage /></Protected>} />
    <Route path="/ai-assistant" component={() => <Protected><AiAssistantPage /></Protected>} />
    <Route component={NotFound} />
  </Switch></ErrorBoundary>;
}

function App() {
  return <WouterRouter base={basePath}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </QueryClientProvider>
    <Toaster />
  </WouterRouter>;
}

export default App;