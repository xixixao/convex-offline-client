import { Toggle } from "@/components/ui/toggle";
import { useState } from "react";

// Just a simple way to demo the offline capabilities
export function useControls() {
  const [online, setOnline] = useState(false);
  const [syncOn, setSyncOn] = useState(false);

  return {
    online,
    syncOn,
    controls: (
      <div className="flex justify-end">
        <div className="flex gap-2">
          <Toggle
            variant="destructive"
            pressed={online}
            onPressedChange={() => {
              if (online) {
                setSyncOn(false);
              }
              setOnline(!online);
            }}
          >
            {online ? <>Online</> : <>Offline</>}
          </Toggle>
          <Toggle
            variant="destructive"
            pressed={syncOn}
            onPressedChange={() => {
              if (!syncOn) {
                setOnline(true);
              }
              setSyncOn(!syncOn);
            }}
          >
            {syncOn ? <>Sync On</> : <>Sync Off</>}
          </Toggle>
        </div>
      </div>
    ),
  };
}
