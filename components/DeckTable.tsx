"use client";
import { useState } from "react";
import useAuth from "@/hooks/useAuth";
import { DashboardDeck } from "@/lib/dashboard-data"; // type
import { Button } from "@/components/ui/button";
import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import SignInDialog from "@/components/SignInDialog";
interface DeckTableProps {
  deck: DashboardDeck;
}

function DeckTable({ deck }: DeckTableProps) {
  const isDue = (deck.dueNowCount ?? 0) > 0;
  const { user } = useAuth();

  //Button state
  const [dialogState, setDialogState] = useState(false);

  return (
    <div className="px-4 py-3 border-b bg-muted hover:bg-background transition-colors last:border-b-0">
      <div className="grid grid-cols-2 justify-between gap-5 items-center">
        <div className="space-y-2">
          <h4 className="font-semibold text-lg"># {deck.title}</h4>
          {/*Stats */}
          <div className="flex flex-wrap gap-y-1 gap-x-5 font-mono text-sm text-muted-foreground">
            <div className="text-nowrap">
              Total Cards:{" "}
              <span className="font-bold text-base text-secondary">
                {deck.totalCards}
              </span>
            </div>
            {user && (
              <div className="text-nowrap">
                Due Now:{" "}
                <span
                  className={`font-bold text-base ${
                    isDue ? "text-destructive" : "text-secondary"
                  }`}
                >
                  {deck.dueNowCount ?? 0}
                </span>
              </div>
            )}
          </div>
        </div>
        {user && (
          <Link href={`/study/${deck.id}`} className="ml-auto">
            <Button
              variant={isDue ? "default" : user ? "secondary" : "default"}
            >
              Study
              <ArrowRight className="size-5" />
            </Button>
          </Link>
        )}
        {!user && (
          <Button className="ml-auto" onClick={() => setDialogState(true)}>
            Study <Lock className="size-5" />
          </Button>
        )}
        <SignInDialog
          showTrigger={false}
          open={dialogState}
          onOpenChange={setDialogState}
        />
      </div>
    </div>
  );
}

export default DeckTable;
