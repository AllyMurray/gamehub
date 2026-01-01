import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface TimerState {
  timeRemaining: number;
  isRunning: boolean;
  intervalId: ReturnType<typeof setInterval> | null;

  // Actions
  start: (durationSeconds: number) => void;
  pause: () => void;
  resume: () => void;
  reset: (durationSeconds: number) => void;
  stop: () => void;
}

export const useTimerStore = create<TimerState>()(
  subscribeWithSelector((set, get) => ({
    timeRemaining: 0,
    isRunning: false,
    intervalId: null,

    start: (durationSeconds: number) => {
      const { intervalId } = get();

      // Clear any existing interval
      if (intervalId) {
        clearInterval(intervalId);
      }

      // Set initial time and start interval
      const newIntervalId = setInterval(() => {
        const { timeRemaining, isRunning } = get();

        if (!isRunning) return;

        if (timeRemaining <= 1) {
          const { intervalId: currentId } = get();
          if (currentId) {
            clearInterval(currentId);
          }
          set({ timeRemaining: 0, isRunning: false, intervalId: null });
        } else {
          set({ timeRemaining: timeRemaining - 1 });
        }
      }, 1000);

      set({
        timeRemaining: durationSeconds,
        isRunning: true,
        intervalId: newIntervalId,
      });
    },

    pause: () => {
      set({ isRunning: false });
    },

    resume: () => {
      const { timeRemaining } = get();
      if (timeRemaining > 0) {
        set({ isRunning: true });
      }
    },

    reset: (durationSeconds: number) => {
      const { intervalId } = get();
      if (intervalId) {
        clearInterval(intervalId);
      }
      set({
        timeRemaining: durationSeconds,
        isRunning: false,
        intervalId: null,
      });
    },

    stop: () => {
      const { intervalId } = get();
      if (intervalId) {
        clearInterval(intervalId);
      }
      set({
        timeRemaining: 0,
        isRunning: false,
        intervalId: null,
      });
    },
  }))
);
