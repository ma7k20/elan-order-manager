import { useEffect, useRef, type ReactNode } from "react";
import { ClerkProvider, Show, SignIn, SignUp, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Link, Redirect, Route, Switch, Router as WouterRouter, useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, CircleDollarSign, PackageCheck, ShieldCheck, Truck, type LucideIcon } from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import {
  CustomersPage, CustomerProfilePage, DashboardPage, NewOrderPage, OrderDetailsPage,
  OrdersPage, PaymentsPage, PurchasesPage, ReportsPage, SettingsPage, ShipmentsPage, WalletPage,
} from "@/pages/main";

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#0F4C4C",
    colorForeground: "#173A3A",
    colorMutedForeground: "#667B7B",
    colorDanger: "#B94A3A",
    colorBackground: "#FFFCF6",
    colorInput: "#FFFFFF",
    colorInputForeground: "#173A3A",
    colorNeutral: "#D8E1D9",
    fontFamily: "IBM Plex Sans Arabic, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#fffdf8] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#d8e1d9]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#173a3a] font-bold",
    headerSubtitle: "text-[#667b7b]",
    socialButtonsBlockButtonText: "text-[#173a3a]",
    formFieldLabel: "text-[#173a3a]",
    footerActionLink: "text-[#0f4c4c] font-bold",
    footerActionText: "text-[#667b7b]",
    dividerText: "text-[#667b7b]",
    identityPreviewEditButton: "text-[#0f4c4c]",
    formFieldSuccessText: "text-[#1d7959]",
    alertText: "text-[#b94a3a]",
    logoBox: "mb-4",
    logoImage: "max-h-12",
    socialButtonsBlockButton: "border-[#d8e1d9] bg-white hover:bg-[#f4f0e6]",
    formButtonPrimary: "bg-[#0f4c4c] hover:bg-[#0b3e3e] text-white",
    formFieldInput: "border-[#d8e1d9] bg-white text-[#173a3a]",
    footerAction: "bg-transparent",
    dividerLine: "bg-[#d8e1d9]",
    alert: "border-[#e9b8ab] bg-[#fff3ef]",
    otpCodeFieldInput: "border-[#d8e1d9]",
    formFieldRow: "mb-4",
    main: "gap-5",
  },
};

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

function SignInPage() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>;
}

function SignUpPage() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>;
}

function LogoutButton() {
  const { signOut } = useClerk();
  return <button type="button" onClick={() => signOut({ redirectUrl: basePath || "/" })}>تسجيل الخروج</button>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previous.current !== undefined && previous.current !== userId) queryClient.clear();
      previous.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);
  return null;
}

function Protected({ children }: { children: ReactNode }) {
  return <><Show when="signed-in">{children}</Show><Show when="signed-out"><Redirect to="/sign-in" /></Show></>;
}

function HomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/dashboard" /></Show><Show when="signed-out"><Landing /></Show></>;
}

function Router() {
  return <ErrorBoundary><Switch>
    <Route path="/" component={HomeRedirect} />
    <Route path="/sign-in/*?" component={SignInPage} />
    <Route path="/sign-up/*?" component={SignUpPage} />
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
    <Route component={NotFound} />
  </Switch></ErrorBoundary>;
}

function App() {
  if (!clerkPubKey) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
  return <WouterRouter base={basePath}>
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{ signIn: { start: { title: "مرحباً بعودتك", subtitle: "سجّل الدخول إلى مساحة الشراكة" } }, signUp: { start: { title: "أنشئ مساحة الشراكة", subtitle: "ابدأ بإدارة الطلبات والأموال بوضوح" } } }}
      routerPush={(to) => window.history.pushState({}, "", stripBase(to))}
      routerReplace={(to) => window.history.replaceState({}, "", stripBase(to))}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Router />
      </QueryClientProvider>
    </ClerkProvider>
    <Toaster />
  </WouterRouter>;
}

export default App;