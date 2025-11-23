"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useStudySession } from "@/hooks/useStudySession";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { dailyLimit, setDailyLimit } = useStudySession();
  const [localLimit, setLocalLimit] = useState(dailyLimit);

  // Keep local input in sync if dailyLimit changes remotely
  useEffect(() => {
    setLocalLimit(dailyLimit);
  }, [dailyLimit]);

  const handleSave = async () => {
    await setDailyLimit(localLimit);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="dailyLimit"
              className="text-sm font-medium block pb-2"
            >
              Daily New Card Limit
            </label>
            <input
              id="dailyLimit"
              type="number"
              min={1}
              value={localLimit}
              onChange={(e) =>
                setLocalLimit(parseInt(e.target.value, 10) || 20)
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <Button onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
