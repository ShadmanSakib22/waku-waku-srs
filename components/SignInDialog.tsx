"use client";

import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { signInWithGithub, signInWithGoogle } from "@/lib/auth-client";
import useAuth from "@/hooks/useAuth";

interface SignInDialogProps {
  open?: boolean; // controlled
  defaultOpen?: boolean; // for uncontrolled fallback
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean; // if you want to hide the "Login" button
}

const SignInDialog = ({
  open,
  defaultOpen,
  onOpenChange,
  showTrigger = true,
}: SignInDialogProps) => {
  const { user } = useAuth();
  if (user) {
    open = false;
  }
  return (
    <Dialog open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {/* Trigger only shown if enabled */}
      {showTrigger && (
        <DialogTrigger className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium h-9 px-4 py-2">
          Login
        </DialogTrigger>
      )}

      <DialogContent className="p-0 overflow-hidden border-4 border-double max-w-[320px]! max-h-screen overflow-y-auto">
        <DialogHeader className="pt-4 px-4">
          <DialogTitle>
            <Image
              src={"/waku-logo.png"}
              alt="WakuWakuSRS"
              width={140}
              height={33}
              loading="eager"
            />
          </DialogTitle>
          <DialogDescription>
            Requires <b>Login</b> to track study progress.
          </DialogDescription>
        </DialogHeader>

        <hr />

        <div className="space-y-5">
          <div className="px-4 grid gap-4">
            <div className="text-xs text-center border rounded-3xl px-3 py-1.5 border-primary font-mono">
              Select OAuth Provider
            </div>

            <Button
              variant="outline"
              className="z-100"
              onClick={signInWithGoogle}
            >
              <Image
                src="/svg/google.svg"
                alt="Google"
                width={20}
                height={20}
              />
              Continue with Google
            </Button>

            <Button
              variant="outline"
              className="z-100"
              onClick={signInWithGithub}
            >
              <Image
                src="/svg/github.svg"
                alt="GitHub"
                width={20}
                height={20}
              />
              Continue with GitHub
            </Button>
          </div>

          <DialogFooter className="uppercase text-xs text-muted-foreground bg-muted py-4 font-mono flex-row items-center justify-center">
            Secured by Firebase{" "}
            <Image
              src="/svg/firebase.svg"
              alt="Firebase"
              width={16}
              height={16}
            />
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SignInDialog;
