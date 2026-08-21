import { useEffect, useMemo } from "react";
import {
  MeshNameInput,
  useNamedPeer,
  useSharedCollection,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

const CARD_IDS = ["aurora", "orbit", "ember", "leaf", "wave", "spark"] as const;
type CardId = (typeof CARD_IDS)[number];

const CARDS: ReadonlyArray<{ id: CardId; glyph: string; label: string }> = [
  { id: "aurora", glyph: "✦", label: "star" },
  { id: "orbit", glyph: "◉", label: "orbit" },
  { id: "ember", glyph: "◆", label: "diamond" },
  { id: "leaf", glyph: "♣", label: "leaf" },
  { id: "wave", glyph: "≈", label: "wave" },
  { id: "spark", glyph: "✹", label: "spark" },
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
  const status = useMemo(() => {
    if (!room) return "Connecting to the shared board…";
    if (!state) return "Preparing a shared deck…";
    if (isComplete)
      return `Complete in ${state.turn - 1} turns. Start a fresh shared round when you are ready.`;
    if (state.revealed.length === 2) return "Checking this pair…";
    return `Shared turn ${state.turn}. Choose a face-down card.`;
  }, [room, state, isComplete]);

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
      <header className="memory-match__hero">
        <p className="eyebrow">Shared, browser-local game</p>
        <h1 id="game-title">Memory match</h1>
        <p className="lede">Turn over pairs together. Nothing leaves the room you share.</p>
      </header>
      <section className="game-panel" aria-label="Shared memory game">
        <div className="game-panel__bar">
          <p className="turn-status" aria-live="polite">
            {status}
          </p>
          <button className="reset-button" type="button" onClick={reset} disabled={!state}>
            New round
          </button>
        </div>
        <p className="game-help" id="game-help">
          Choose two cards. Matching pairs stay face up; all controls work with a keyboard.
        </p>
        <div className="card-grid" role="group" aria-describedby="game-help">
          {DECK.map((cardId, index) => {
            const card = cardFor(index);
            const matched = state?.matched.includes(index) ?? false;
            const revealed = matched || (state?.revealed.includes(index) ?? false);
            const unavailable = !state || matched || (state.revealed.length === 2 && !revealed);
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
                <span aria-hidden="true">{revealed ? card.glyph : "?"}</span>
              </button>
            );
          })}
        </div>
        <p className="match-count" aria-live="polite">
          {(state?.matched.length ?? 0) / 2} of {CARDS.length} pairs found
        </p>
      </section>
      <section className="player-panel" aria-label="Player identity">
        <div>
          <p className="eyebrow">Your local display name</p>
          <p className="player-note">
            {myName
              ? `${myName} is ready to play.`
              : "Add a name so your co-players can recognize you."}
          </p>
        </div>
        <MeshNameInput
          value={name}
          onChange={setName}
          ariaLabel="Your display name"
          placeholder="Your name"
          maxLength={32}
        />
      </section>
      <footer className="privacy-note">
        No accounts, tracking, or server-stored scores. This shared board syncs directly between
        browsers in the room.
      </footer>
    </main>
  );
}
