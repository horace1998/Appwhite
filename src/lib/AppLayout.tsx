import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { Sparkles, Vault, Zap, Fingerprint, Gem } from "lucide-react";
import { cn } from "./utils";
import { useSYNK } from "./Store";
import { motion, AnimatePresence } from "motion/react";

// Lazy load tabs to dramatically decrease initial bundle size and boost rendering speed
const RitualDashboard = lazy(() => import("./tabs/RitualDashboard"));
const GoalVault = lazy(() => import("./tabs/GoalVault"));
const SynkOracle = lazy(() => import("./tabs/SynkOracle"));
const IdentityCard = lazy(() => import("./tabs/IdentityCard"));

const TABS = [
  { id: "ritual", label: "PORTAL", subLabel: "共鳴中心", icon: Sparkles },
  { id: "vault", label: "DIRECTIVES", subLabel: "核心指令", icon: Vault },
  { id: "oracle", label: "ORACLE", subLabel: "靈魂神諭", icon: Gem },
  { id: "identity", label: "IDENTITY", subLabel: "數位通行", icon: Fingerprint },
] as const;

type TabId = typeof TABS[number]["id"];

export default function AppLayout() {
  const { stats, achievement, bias } = useSYNK();
  const [activeTab, setActiveTab] = useState<TabId>("ritual");
  const [direction, setDirection] = useState(0);

  const handleNav = (id: TabId) => {
    if (id === activeTab) return;
    const currentIndex = TABS.findIndex(t => t.id === activeTab);
    const nextIndex = TABS.findIndex(t => t.id === id);
    setDirection(nextIndex > currentIndex ? 1 : -1);
    setActiveTab(id);
  };

  return (
    <div className="relative w-full h-screen bg-synk-bg text-synk-foreground overflow-hidden flex font-sans">
      <div className="flex w-full h-full max-w-[1440px] mx-auto bg-white border-x border-synk-border overflow-hidden">
        
        {/* Sidebar - Left Navigation */}
        <aside className="hidden lg:flex w-[240px] flex-col p-6 border-r border-synk-border bg-white flex-shrink-0">
          <div className="text-2xl font-extrabold tracking-tighter mb-10 text-synk-foreground">SYNKIFY</div>
          <nav className="flex flex-col gap-5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleNav(tab.id)}
                  className={cn(
                    "flex items-center gap-3 text-base font-medium transition-all group",
                    isActive ? "text-black font-bold" : "text-zinc-500 hover:text-black"
                  )}
                >
                  {isActive && <div className="nav-dot" />}
                  {!isActive && <div className="w-2" />}
                  <Icon className={cn("w-5 h-5", isActive ? "text-black" : "text-zinc-400")} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Feed Content - Center */}
        <main className="flex-1 flex flex-col min-w-0 bg-white">
          {/* Mobile Header */}
          <header className="lg:hidden h-16 flex items-center justify-between px-6 border-b border-synk-border flex-shrink-0">
            <div className="text-xl font-bold tracking-tighter text-synk-foreground">SYNKIFY</div>
            <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100 rounded-full text-xs font-bold">
              <Zap className="w-3 h-3 text-black" />
              {stats.crystals}
            </div>
          </header>

          <div className="flex-1 relative overflow-hidden">
            <AnimatePresence mode="popLayout" custom={direction}>
              <motion.div
                key={activeTab}
                custom={direction}
                variants={{
                  initial: (direction: number) => ({
                    opacity: 0,
                    x: direction > 0 ? 30 : -30,
                  }),
                  animate: {
                    opacity: 1,
                    x: 0,
                    transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] }
                  },
                  exit: (direction: number) => ({
                    opacity: 0,
                    x: direction > 0 ? -30 : 30,
                    transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] }
                  })
                }}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full h-full"
              >
                <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-xs text-zinc-300 font-medium">Loading...</div>}>
                  {activeTab === "ritual" && <RitualDashboard />}
                  {activeTab === "vault" && <GoalVault />}
                  {activeTab === "oracle" && <SynkOracle />}
                  {activeTab === "identity" && <IdentityCard />}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Mobile Tab Bar */}
          <nav className="lg:hidden h-16 border-t border-synk-border flex items-center justify-around px-2 flex-shrink-0">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleNav(tab.id)}
                  className={isActive ? "text-black" : "text-zinc-400"}
                >
                  <Icon className="w-6 h-6" />
                </button>
              );
            })}
          </nav>
        </main>

        {/* Right Sidebar - Stats & Info */}
        <aside className="hidden xl:flex w-[280px] flex-col p-6 border-l border-synk-border bg-white flex-shrink-0 gap-6">
          <div className="bg-zinc-100 p-3 rounded-full text-zinc-500 text-sm flex items-center gap-2">
            Search directives...
          </div>

          <div className="bg-zinc-50 p-4 rounded-2xl">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-4 text-zinc-400">Status Matrix</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-[10px] text-zinc-500 uppercase font-bold">Resonance Level</span>
                <span className="text-xl font-bold">{stats.level}</span>
              </div>
              <div className="w-full h-1 bg-zinc-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-black transition-all duration-500" 
                  style={{ width: `${(stats.experience % 100)}%` }} 
                />
              </div>
              
              <div className="flex justify-between items-center pt-2">
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">Energy Crystals</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Zap className="w-3.5 h-3.5" />
                    <span className="text-lg font-bold">{stats.crystals}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">Directives Done</span>
                  <span className="text-lg font-bold mt-1">{stats.completed_goals}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-synk-border text-[10px] text-zinc-300 font-bold uppercase tracking-widest text-center">
            SYNKIFY Concept v1.0.4
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {achievement.show && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full bg-black text-white shadow-xl flex items-center gap-3"
          >
            <Sparkles className="w-4 h-4 text-zinc-400" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-widest leading-none">{achievement.title}</span>
              <span className="text-[8px] text-zinc-400 uppercase tracking-widest mt-1">{achievement.sub}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

