import { useState, useCallback, useRef } from "react";

export function useUndoRedo<T>(initialState: T) {
  const [current, setCurrent] = useState<T>(initialState);
  const [history, setHistory] = useState<T[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const timer = useRef<NodeJS.Timeout | null>(null);

  const setState = (newState: T | ((prev: T) => T)) => {
    setCurrent((prev) => {
      const resolvedState =
        newState instanceof Function ? newState(prev) : newState;

      // skip if unchanged
      if (prev === resolvedState) return prev;

      if (timer.current) clearTimeout(timer.current);

      timer.current = setTimeout(() => {
        setHistory((prevHistory) => {
          const nextHistory = prevHistory.slice(0, currentIndex + 1);
          // shallow or JSON compare? let's do a simple JSON stringify compare for basic objects/arrays
          // to avoid saving refs that just mutated (though react state should be immutable)
          nextHistory.push(resolvedState);
          if (nextHistory.length > 30) nextHistory.shift();
          return nextHistory;
        });
        setCurrentIndex((prevIndex) => Math.min(prevIndex + 1, 30));
      }, 500);

      return resolvedState;
    });
  };

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      if (timer.current) clearTimeout(timer.current);
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      setCurrent(history[newIndex]);
    }
  }, [currentIndex, history]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      if (timer.current) clearTimeout(timer.current);
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      setCurrent(history[newIndex]);
    }
  }, [currentIndex, history.length, history]);

  const resetHistory = useCallback((newState: T) => {
    if (timer.current) clearTimeout(timer.current);
    setCurrent(newState);
    setHistory([newState]);
    setCurrentIndex(0);
  }, []);

  const commitHistory = useCallback(
    (newState: T) => {
      if (timer.current) clearTimeout(timer.current);
      setCurrent(newState);
      setHistory((prevHistory) => {
        const nextHistory = prevHistory.slice(0, currentIndex + 1);
        nextHistory.push(newState);
        if (nextHistory.length > 30) nextHistory.shift();
        setCurrentIndex(nextHistory.length - 1);
        return nextHistory;
      });
    },
    [currentIndex],
  );

  return {
    state: current,
    setState,
    undo,
    redo,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
    resetHistory,
    commitHistory,
  };
}
