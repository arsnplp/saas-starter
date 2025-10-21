export function estimateLeadCollectionCredits(config: {
  maxReactions: number;
  maxComments: number;
}): number {
  const reactionCredits = Math.ceil(config.maxReactions / 10);
  const commentCredits = Math.ceil(config.maxComments / 10);
  
  return reactionCredits + commentCredits;
}
