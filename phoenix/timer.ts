export type TimerId = number;
type TimerCallback = () => void;
type TimerCalculation = (tries: number) => number;

/**
 * Creates a timer that accepts a `timerCalc` function to perform
 * calculated timeout retries, such as exponential backoff.
 *
 * @example
 * let reconnectTimer = new Timer(() => this.connect(), tries => [1000, 5000, 10000][tries - 1] || 10000);
 * reconnectTimer.scheduleTimeout(); // fires after 1000 ms
 * reconnectTimer.scheduleTimeout(); // fires after 5000 ms
 * reconnectTimer.reset();
 * reconnectTimer.scheduleTimeout(); // fires after 1000 ms
 */
export default class Timer {
  timer: TimerId | null = null;
  tries: number = 0;
  callback: TimerCallback;
  timerCalc: TimerCalculation;

  constructor(callback: TimerCallback, timerCalc: TimerCalculation) {
    this.callback = callback;
    this.timerCalc = timerCalc;
  }

  /**
   * Resets the timer and tries counter.
   */
  reset(): void {
    this.tries = 0;
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }

  /**
   * Cancels any previous scheduleTimeout and schedules callback.
   */
  scheduleTimeout(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(
      () => {
        this.tries += 1;
        this.callback();
      },
      this.timerCalc(this.tries + 1),
    );
  }
}
