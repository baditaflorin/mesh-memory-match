import { useEffect, useMemo } from "react";
import {
  MeshButton,
  MeshNameInput,
  MeshStatusPill,
  MeshSurface,
  useNamedPeer,
  useSharedCollection,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

const CARD_IDS = ["aurora", "orbit", "ember", "leaf", "wave", "spark"] as const;
type CardId = (typeof CARD_IDS)[number];

const CARDS: ReadonlyArray<{ id: CardId; label: string }> = [
  { id: "aurora", label: "star" },
  { id: "orbit", label: "orbit" },
  { id: "ember", label: "diamond" },
  { id: "leaf", label: "leaf" },
  { id: "wave", label: "wave" },
  { id: "spark", label: "spark" },
];

// A fixed, duplicated deck keeps every peer's board identical without sharing
// personal data. The CRDT only stores compact, validated game state.
const DECK: ReadonlyArray<CardId> = [
  "aurora",
  "leaf",
  "orbit",
  "spark",
  "ember",
  "wave",
  "spark",
  "orbit",
  "leaf",
  "aurora",
  "wave",
  "ember",
];

type MatchState = {
  id: "game";
  turn: number;
  revealed: number[];
  matched: number[];
  revealedAt: number | null;
  updatedAt: number;
};

const INITIAL_STATE: MatchState = {
  id: "game",
  turn: 1,
  revealed: [],
  matched: [],
  revealedAt: null,
  updatedAt: 0,
};

function validIndexes(indexes: unknown, limit: number): indexes is number[] {
  return (
    Array.isArray(indexes) &&
    indexes.length <= limit &&
    indexes.every((index) => Number.isInteger(index) && index >= 0 && index < DECK.length) &&
    new Set(indexes).size === indexes.length
  );
}

/** Reject malformed peer data before it can enter the shared game document. */
export function isValidMatchState(value: MatchState): boolean {
  return (
    value?.id === "game" &&
    Number.isInteger(value.turn) &&
    value.turn >= 1 &&
    validIndexes(value.revealed, 2) &&
    validIndexes(value.matched, DECK.length) &&
    value.revealed.every((index) => !value.matched.includes(index)) &&
    (value.revealed.length === 2 ? Number.isFinite(value.revealedAt) : value.revealedAt === null) &&
    Number.isFinite(value.updatedAt)
  );
}

function cardFor(index: number) {
  return CARDS.find((card) => card.id === DECK[index])!;
}

export function Feature({ room, config }: Props) {
  const { name, setName, myName } = useNamedPeer(config, room);
  const game = useSharedCollection<MatchState>(room, "mesh-memory-match:game", {
    validate: isValidMatchState,
  });
  const state = game.byId("game");

  useEffect(() => {
    if (room && !state) game.add(INITIAL_STATE);
  }, [room, state, game]);

  // The second reveal stays visible long enough to be understood. Any peer can
  // settle it; applying the same valid next state makes coordination safe.
  useEffect(() => {
    if (!state || state.revealed.length !== 2 || !state.revealedAt) return;
    const delay = Math.max(0, 900 - (Date.now() - state.revealedAt));
    const timeout = window.setTimeout(() => {
      const [first, second] = state.revealed;
      if (first === undefined || second === undefined) return;
      const isMatch = DECK[first] === DECK[second];
      game.update("game", {
        revealed: [],
        matched: isMatch ? [...state.matched, first, second] : state.matched,
        revealedAt: null,
        turn: state.turn + 1,
        updatedAt: Date.now(),
      });
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [state, game]);

  const isComplete = state?.matched.length === DECK.length;
  const pairCount = (state?.matched.length ?? 0) / 2;
  const status = useMemo(() => {
    if (!room) return "Connecting to the shared board…";
    if (!state) return "Preparing a shared deck…";
    if (isComplete)
      return `Complete in ${state.turn - 1} turns. Start a fresh shared round when you are ready.`;
    if (state.revealed.length === 2) return "Checking this pair…";
    return `Shared turn ${state.turn}. Choose a face-down card.`;
  }, [room, state, isComplete]);
  const roundLabel = useMemo(() => {
    if (!room) return "Joining the table";
    if (!state) return "Preparing the deck";
    if (isComplete) return "Round complete";
    if (state.revealed.length === 2) return "Checking the pair";
    return `Turn ${state.turn}`;
  }, [room, state, isComplete]);
  const statusTone = !room || !state ? "warning" : isComplete ? "success" : "live";

  const flip = (index: number) => {
    if (
      !state ||
      state.matched.includes(index) ||
      state.revealed.includes(index) ||
      state.revealed.length >= 2
    )
      return;
    const revealed = [...state.revealed, index];
    game.update("game", {
      revealed,
      revealedAt: revealed.length === 2 ? Date.now() : null,
      updatedAt: Date.now(),
    });
  };
  const reset = () => state && game.update("game", { ...INITIAL_STATE, updatedAt: Date.now() });

  return (
    <main className="memory-match" aria-labelledby="game-title">
      <div className="memory-match__layout">
        <section className="memory-match__workspace" aria-label="Shared memory game">
          <header className="memory-match__header">
            <p className="eyebrow">Live shared table</p>
            <h1 id="game-title">Memory Match</h1>
            <p className="lede">Find all six pairs together. Each move is shared with the room.</p>
          </header>

          <MeshSurface
            as="section"
            className="game-panel"
            tone="raised"
            padding="none"
            aria-labelledby="game-board-title"
          >
            <header className="game-panel__bar">
              <div>
                <p className="turn-kicker">Shared round</p>
                <h2 id="game-board-title">{roundLabel}</h2>
              </div>
              <div className="game-panel__actions">
                <MeshStatusPill tone={statusTone} dot announce="polite">
                  {isComplete ? "Complete" : `Pairs ${pairCount}/${CARDS.length}`}
                </MeshStatusPill>
                <MeshButton
                  className="reset-button"
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={reset}
                  disabled={!state}
                >
                  New round
                </MeshButton>
              </div>
            </header>

            <div className="game-panel__status-row">
              <p className="turn-status" aria-live="polite">
                {status}
              </p>
              <p className="match-count" aria-live="polite">
                {pairCount} of {CARDS.length} pairs found
              </p>
            </div>

            <div className="game-panel__board">
              <p className="game-help" id="game-help">
                Choose two cards. Matching pairs stay face up; every card works with a keyboard.
              </p>
              <div className="card-grid" role="group" aria-describedby="game-help">
                {DECK.map((cardId, index) => {
                  const card = cardFor(index);
                  const matched = state?.matched.includes(index) ?? false;
                  const revealed = matched || (state?.revealed.includes(index) ?? false);
                  const unavailable =
                    !state || matched || (state.revealed.length === 2 && !revealed);
                  return (
                    <button
                      key={`${cardId}-${index}`}
                      type="button"
                      className={`memory-card ${revealed ? "memory-card--revealed" : ""} ${matched ? "memory-card--matched" : ""}`}
                      aria-label={
                        revealed
                          ? `Card ${index + 1}, ${card.label}${matched ? ", matched" : ""}`
                          : `Card ${index + 1}, face down`
                      }
                      aria-pressed={revealed}
                      disabled={unavailable}
                      onClick={() => flip(index)}
                    >
                      <span
                        className={`memory-card__mark memory-card__mark--${card.id}`}
                        aria-hidden="true"
                      >
                        <span className="memory-card__mark-core" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </MeshSurface>
        </section>

        <aside className="memory-match__side" aria-label="Player and privacy details">
          <MeshSurface as="section" className="player-panel" tone="quiet" padding="md">
            <p className="eyebrow">Play profile</p>
            <h2>{myName ? `Playing as ${myName}` : "Choose a display name"}</h2>
            <p className="player-note">
              Your name stays on this device and lets co-players recognize your moves.
            </p>
            <MeshNameInput
              value={name}
              onChange={setName}
              ariaLabel="Your display name"
              placeholder="Your name"
              maxLength={32}
            />
          </MeshSurface>
          <p className="privacy-note">
            Direct browser-to-browser play. No accounts, tracking, or server-stored scores.
          </p>
        </aside>
      </div>
    </main>
  );
}
