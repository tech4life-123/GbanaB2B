/**
 * Explicit, typed state machines.
 *
 * Every lifecycle in GbanaB2B (orders, bids, escrow, verification, disputes)
 * is modelled as an allow-list of transitions. The server calls
 * `assertTransition` before persisting a change; the database enforces the
 * same rules with triggers/functions so a bypassed API still can't corrupt
 * state. Clients never send "set status = X" — they request an action.
 */

export type TransitionMap<S extends string> = Readonly<Record<S, readonly S[]>>;

export interface StateMachine<S extends string> {
  readonly name: string;
  readonly states: readonly S[];
  readonly initial: S;
  readonly terminal: readonly S[];
  can(from: S, to: S): boolean;
  next(from: S): readonly S[];
  assertTransition(from: S, to: S): void;
  isTerminal(state: S): boolean;
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly machine: string,
    readonly from: string,
    readonly to: string,
  ) {
    super(`${machine}: transition ${from} → ${to} is not allowed`);
    this.name = "InvalidTransitionError";
  }
}

export function defineStateMachine<S extends string>(config: {
  name: string;
  initial: S;
  transitions: TransitionMap<S>;
}): StateMachine<S> {
  const states = Object.keys(config.transitions) as S[];
  for (const [from, targets] of Object.entries(config.transitions) as [S, readonly S[]][]) {
    for (const to of targets) {
      if (!(to in config.transitions)) {
        throw new Error(`${config.name}: ${from} → ${to} targets an undeclared state`);
      }
    }
  }
  const terminal = states.filter((s) => config.transitions[s].length === 0);
  const can = (from: S, to: S) => config.transitions[from]?.includes(to) ?? false;

  return {
    name: config.name,
    states,
    initial: config.initial,
    terminal,
    can,
    next: (from) => config.transitions[from] ?? [],
    isTerminal: (state) => terminal.includes(state),
    assertTransition(from, to) {
      if (!can(from, to)) throw new InvalidTransitionError(config.name, from, to);
    },
  };
}
