/** Deterministic pose timing. The caller owns input, ball physics, drawing, and audio. */
export const FULL_IMPACT_SECONDS = 0.14;
export const PUTT_IMPACT_SECONDS = 0.16;
export const SWING_TIMING = {
  backswing: 0.45,
  returnToAddress: 0.26,
  fullImpact: FULL_IMPACT_SECONDS,
  fullFollowThrough: 0.45,
  puttImpact: PUTT_IMPACT_SECONDS,
  puttFollowThrough: 0.26,
  maxDelta: 1,
} as const;

export interface SwingPose {
  windup: number;
  followThrough: number;
  /** A one-update pulse, true only when that update crosses impact. */
  impact: boolean;
  finished: boolean;
  phase: 'address' | 'backswing' | 'downswing' | 'followThrough' | 'finish';
  /** Seconds since the accepted strike, capped at the completed animation's duration. */
  strokeElapsed: number;
}

type Tween = { from: number; to: number; elapsed: number };
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const emptyPose = (): SwingPose => ({
  windup: 0, followThrough: 0, impact: false, finished: false, phase: 'address', strokeElapsed: 0,
});

/**
 * update() follows held backswing intent until strike(). A strike snapshots the pose with
 * no minimum windup. Its finish remains held until reset(), usually when the ball rests.
 * Feed seconds of active game time: a pause supplies no dt and creates no wall-clock jump.
 */
export class SwingAnimation {
  private current = emptyPose();
  private tween: Tween | null = null;
  private held = false;
  private striking = false;
  private putting = false;
  private launchWindup = 0;
  private elapsed = 0;
  private impactSent = false;

  get pose(): Readonly<SwingPose> { return this.current; }

  reset(): void {
    this.current = emptyPose();
    this.tween = null;
    this.held = false;
    this.striking = false;
    this.putting = false;
    this.launchWindup = 0;
    this.elapsed = 0;
    this.impactSent = false;
  }

  /** Returns false while an earlier stroke is still playing or holding its finish. */
  strike(putting = false): boolean {
    if (this.striking) return false;
    this.striking = true;
    this.putting = putting;
    this.launchWindup = this.current.windup;
    this.elapsed = 0;
    this.impactSent = false;
    this.tween = null;
    this.current = { ...this.current, impact: false, finished: false, phase: 'downswing', strokeElapsed: 0 };
    return true;
  }

  update(dtSeconds: number, backswingHeld: boolean, putting = false): SwingPose {
    this.current = { ...this.current, impact: false };
    if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return this.current;
    const dt = Math.min(dtSeconds, SWING_TIMING.maxDelta);
    if (this.striking) {
      const impactAt = this.putting ? SWING_TIMING.puttImpact : SWING_TIMING.fullImpact;
      const followDuration = this.putting ? SWING_TIMING.puttFollowThrough : SWING_TIMING.fullFollowThrough;
      const finishAt = impactAt + followDuration;
      this.elapsed = Math.min(finishAt, this.elapsed + dt);
      const impacted = this.elapsed + 1e-9 >= impactAt;
      const impact = impacted && !this.impactSent;
      if (impact) this.impactSent = true;
      if (!impacted) {
        // Cubic acceleration starts gently and gathers speed toward the ball.
        this.current = { windup: this.launchWindup * (1 - (this.elapsed / impactAt) ** 3),
          followThrough: 0, impact: false, finished: false, phase: 'downswing', strokeElapsed: this.elapsed };
      } else {
        const t = clamp01((this.elapsed - impactAt) / followDuration);
        const finished = this.elapsed + 1e-9 >= finishAt;
        this.current = { windup: 0, followThrough: finished ? 1 : easeOut(t), impact, finished,
          phase: finished ? 'finish' : 'followThrough', strokeElapsed: this.elapsed };
      }
      return this.current;
    }

    this.putting = putting;
    if (backswingHeld !== this.held) {
      this.held = backswingHeld;
      this.tween = { from: this.current.windup, to: backswingHeld ? 1 : 0, elapsed: 0 };
    }
    let windup = this.current.windup;
    if (this.tween) {
      const duration = this.held ? SWING_TIMING.backswing : SWING_TIMING.returnToAddress;
      this.tween.elapsed = Math.min(duration, this.tween.elapsed + dt);
      const t = clamp01(this.tween.elapsed / duration);
      windup = this.tween.from + (this.tween.to - this.tween.from) * smoothstep(t);
      if (this.tween.elapsed + 1e-9 >= duration) {
        windup = this.tween.to;
        this.tween = null;
      }
    }
    this.current = { windup, followThrough: 0, impact: false, finished: false,
      phase: this.held || windup > 0 ? 'backswing' : 'address', strokeElapsed: 0 };
    return this.current;
  }
}
