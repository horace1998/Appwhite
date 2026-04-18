import { SYNKProvider, useSYNK } from "./lib/Store";
import WelcomeScreen from "./lib/WelcomeScreen";
import AppLayout from "./lib/AppLayout";
import { AnimatePresence } from "motion/react";

function AppContent() {
  const { loading, user, hasProfile } = useSYNK();
  
  if (loading) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="text-[10px] text-white/30 tracking-[0.5em] uppercase animate-pulse">
          Synchronizing...
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {!user || !hasProfile ? (
        <WelcomeScreen key="welcome" />
      ) : (
        <AppLayout key="app" />
      )}
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <SYNKProvider>
      <AppContent />
    </SYNKProvider>
  );
}
