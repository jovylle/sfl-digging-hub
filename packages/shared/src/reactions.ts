export const REACTION_EMOJI = ["🔥", "❤️", "🎉", "💎", "🤣"] as const;

export type ReactionEmoji = (typeof REACTION_EMOJI)[number];

export function isReactionEmoji(value: unknown): value is ReactionEmoji {
  return typeof value === "string" && (REACTION_EMOJI as readonly string[]).includes(value);
}

export type ReactionState = {
  counts: Record<string, number>;
  userEmoji: ReactionEmoji | null;
};
