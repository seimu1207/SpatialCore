/** Fixed names of Moodwalk (design.md "Fixed names"). These words live only in apps/moodwalk/. */

export const NODE_TYPE_IMAGE = "image" as const;

export const ATTR_BRIGHTNESS = "brightness" as const;
export const ATTR_TEMPERATURE = "temperature" as const;
/** Series_Result attribute only; no Node holds it. */
export const ATTR_SAME_MOOD = "sameMood" as const;

export const FLAG_SUDDEN_BRIGHTENING = "sudden-brightening" as const;
export const FLAG_SAME_MOOD_TOO_LONG = "same-mood-too-long" as const;

export const EFFECT_SUDDEN_BRIGHTENING = "sudden-brightening-fog" as const;
export const EFFECT_SAME_MOOD = "same-mood-fog" as const;

export const RULE_MARK_SUDDEN_BRIGHTENING = "mark-sudden-brightening" as const;
export const RULE_MARK_SAME_MOOD = "mark-same-mood" as const;

export const PRESET_OVERVIEW = "overview" as const;
export const PRESET_VISITOR = "visitor" as const;

export const PATH_ROUTE = "route" as const;

/** Visitor eye level above the Zone elevation. */
export const EYE_HEIGHT = 1.5 as const;

export const SAMPLE_PREFIX = "sample:" as const;
export const UPLOAD_PREFIX = "upload:" as const;
