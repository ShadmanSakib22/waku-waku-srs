"use client";

import Link from "next/link";
import Image from "next/image";
import SignInDialog from "@/components/sign-in";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import useAuth from "@/hooks/useAuth";
import { signOutAndClearSession } from "@/lib/auth-client";

const Navbar = () => {
  const { user, loading } = useAuth();

  const handleLogout = async () => {
    try {
      await signOutAndClearSession();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <header className="shadow-2xl">
      <nav className="container py-2 bg-background/70">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-primary" aria-label="WakuWakuSRS Home">
            <Image
              src={"/logo.png"}
              alt="WakuWakuSRS"
              width={150}
              height={48}
              className="h-12 w-[150px]"
              loading="eager"
            />
          </Link>
          <menu className="flex gap-4 items-center">
            <li>
              <Button variant={"outline"} aria-label="Settings">
                <Settings />
                {/*Todo: open modal to increase daily new word limit and option to clear all study progress */}
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
      {loading ? (
        <div className="text-sm text-muted-foreground" aria-live="polite">
          Loading...
        </div>
      ) : user ? (
        <aside
          className="bg-primary text-primary-foreground text-center py-0.5 border-y text-xs font-mono"
          aria-label="Welcome message"
        >
          Goodluck! {user?.displayName || user?.email}
        </aside>
      ) : null}
    </header>
  );
};

export default Navbar;
