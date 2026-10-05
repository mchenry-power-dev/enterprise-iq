import { useCallback, useEffect, useRef, useState } from "react";
import {
  createPersistence,
  STORAGE_KEY,
  migrateState,
  initialState,
} from "./model.mjs";
import { recordEvent } from "./telemetry.mjs";

export type DemoState = any;
export type DemoStore = {
  state: DemoState;
  storage: { status: string; message: string; recoveryRaw: string | null };
  conflict: {
    remote?: DemoState;
    pending?: DemoState;
    message?: string;
  } | null;
  update: (reducer: (state: DemoState) => DemoState) => boolean;
  reset: () => void;
  resolveConflict: (choice: "remote" | "local") => void;
  useSessionOnly: () => void;
  track: (name: string, details?: Record<string, any>) => void;
};
export type PageProps = {
  store: DemoStore;
  workspace: string;
  navigate: (route: string) => void;
  resources?: any[];
};

export function useDemoStore(): DemoStore {
  const persistence = useRef<ReturnType<typeof createPersistence> | null>(null);
  if (!persistence.current) {
    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {}
    persistence.current = createPersistence(storage);
  }
  const [state, setState] = useState(() => persistence.current!.read());
  const current = useRef(state);
  const [storage, setStorage] = useState(() => persistence.current!.status());
  const [conflict, setConflict] = useState<DemoStore["conflict"]>(null);
  const accept = useCallback((next: DemoState) => {
    current.current = next;
    setState(next);
  }, []);
  const update = useCallback(
    (reducer: (value: DemoState) => DemoState) => {
      const before = current.current;
      const next = reducer(before);
      if (next === before) return false;
      const result = persistence.current!.write(next, before.revision);
      setStorage(persistence.current!.status());
      if (result.status === "conflict" || result.status === "recovery") {
        setConflict({ ...result, pending: next });
        return false;
      }
      accept(result.state);
      return true;
    },
    [accept],
  );
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      if (!event.newValue) {
        setConflict({
          remote: initialState(),
          message:
            "Enterprise IQ data was reset in another tab. Choose which version to keep.",
        });
        return;
      }
      try {
        const remote = migrateState(JSON.parse(event.newValue));
        if (remote.revision !== current.current.revision)
          setConflict({
            remote,
            message:
              "Enterprise IQ data changed in another tab. Choose which version to continue with.",
          });
      } catch {
        setConflict({
          message:
            "Another tab changed stored data to an unreadable format. Your session is preserved.",
        });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return {
    state,
    storage,
    conflict,
    update,
    reset: () => {
      accept(persistence.current!.reset());
      setStorage(persistence.current!.status());
      setConflict(null);
    },
    useSessionOnly: () => {
      persistence.current!.sessionOnly();
      setStorage(persistence.current!.status());
      if (conflict?.pending) accept(conflict.pending);
      setConflict(null);
    },
    resolveConflict: (choice) => {
      if (choice === "remote" && conflict?.remote) {
        accept(conflict.remote);
        setConflict(null);
      }
      if (choice === "local") {
        const next = conflict?.pending ?? current.current;
        const result = persistence.current!.write(
          next,
          conflict?.remote?.revision ?? next.revision,
          { overwrite: true },
        );
        if (result.state) accept(result.state);
        setStorage(persistence.current!.status());
        setConflict(null);
      }
    },
    track: (name, details) => {
      update((value) => recordEvent(value, name, details));
    },
  };
}
