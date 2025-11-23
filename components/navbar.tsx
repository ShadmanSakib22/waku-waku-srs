"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import SignInDialog from "@/components/SignInDialog";
import { SettingsModal } from "@/components/SettingsModal";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import useAuth from "@/hooks/useAuth";
import { signOutAndClearSession } from "@/lib/auth-client";

const Navbar = () => {
  const { user, loading } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOutAndClearSession();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const displayName = user?.displayName?.split(" ")[0] || "Guest";

  return (
    <header className="sticky top-0 z-50 bg-background border-b-4 border-double shadow-xl">
      <nav className="container py-2">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-primary" aria-label="WakuWakuSRS Home">
            <Image
              src={"/waku-logo.png"}
              alt="WakuWakuSRS"
              width={140}
              height={33}
              className="h-[33px] w-[140px]"
              loading="eager"
            />
          </Link>
          <menu className="flex gap-4 items-center">
            <li>
              <Button
                variant={"outline"}
                onClick={() => setSettingsOpen(true)}
                aria-label="Settings"
              >
                <Settings />
              </Button>
            </li>
            <li>
              {loading ? (
                <div
                  className="text-sm text-muted-foreground"
                  aria-live="polite"
                >
                  Loading...
                </div>
              ) : user ? (
                <Button
                  variant={"secondary"}
                  onClick={handleLogout}
                  aria-label="Logout"
                >
                  Logout
                </Button>
              ) : (
                <SignInDialog />
              )}
            </li>
          </menu>
        </div>
      </nav>
      <div className="bg-secondary text-secondary-foreground py-1 text-center font-mono text-xs sm:text-sm">
        {user ? (
          <>Logged as, {displayName}!</>
        ) : (
          <>Log in to track your progress and start studying!</>
        )}
      </div>
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  );
};

export default Navbar;
