/**
 * Settings types for NLJ activities and questions
 * Supports inheritance: Node settings override Activity settings override Defaults
 */

// Activity-level settings (applies to entire scenario)
export interface ActivitySettings {
  shuffleAnswerOrder?: boolean;
  reinforcementEligible?: boolean;
}

// Question/Node-level settings (overrides activity settings)
export interface NodeSettings {
  shuffleAnswerOrder?: boolean;
  reinforcementEligible?: boolean;
}

// Resolved settings with all values defined (no optionals)
export interface ResolvedSettings {
  shuffleAnswerOrder: boolean;
  reinforcementEligible: boolean;
}

// Default settings applied when no other settings are specified
export const DEFAULT_SETTINGS: ResolvedSettings = {
  shuffleAnswerOrder: false,
  reinforcementEligible: true,
};

/**
 * Resolves settings using inheritance hierarchy:
 * Node settings > Activity settings > Default settings
 */
export function resolveSettings(
  activitySettings?: ActivitySettings,
  nodeSettings?: NodeSettings
): ResolvedSettings {
  return {
    shuffleAnswerOrder: nodeSettings?.shuffleAnswerOrder ?? 
                       activitySettings?.shuffleAnswerOrder ?? 
                       DEFAULT_SETTINGS.shuffleAnswerOrder,
    reinforcementEligible: nodeSettings?.reinforcementEligible ?? 
                          activitySettings?.reinforcementEligible ?? 
                          DEFAULT_SETTINGS.reinforcementEligible,
  };
}

/**
 * Validates settings object for correctness
 */
export function validateActivitySettings(settings: ActivitySettings): boolean {
  if (typeof settings !== 'object' || settings === null) {
    return false;
  }

  if (settings.shuffleAnswerOrder !== undefined && typeof settings.shuffleAnswerOrder !== 'boolean') {
    return false;
  }

  if (settings.reinforcementEligible !== undefined && typeof settings.reinforcementEligible !== 'boolean') {
    return false;
  }

  return true;
}

/**
 * Validates node settings object for correctness
 */
export function validateNodeSettings(settings: NodeSettings): boolean {
  return validateActivitySettings(settings); // Same structure, same validation
}