/** Fixed Identifiers of Ghost Mansion (design.md "Fixed names"). App words: they live only in apps/ghost-mansion/. */

export const NODE_TYPES = {
  robot: "robot",
  room: "room",
  text: "text",
  answer: "answer",
  source: "source",
  helper: "helper",
} as const;

export const EDGE_TYPES = {
  plainKey: "plain-key",
  bellKey: "bell-key",
  reads: "reads",
  noRead: "no-read",
  chain: "chain",
  cites: "cites",
  consult: "consult",
} as const;

export const EFFECT_KINDS = {
  unsourcedFog: "unsourced-fog",
  damage: "damage",
  highlight: "highlight",
  bellStop: "bell-stop",
  couldStop: "could-stop",
  jobFocus: "job-focus",
} as const;

export const ATTRIBUTES = {
  importance: "importance",
  stopped: "stopped",
} as const;

export const ROBOT_ID = "robot" as const;

export const CHECK_SET_IDS = {
  jobs: "jobs",
  attack: "attack",
  response: "response",
} as const;

export const RESPONSE_OPS = {
  stopRobot: "stop-robot",
  cutKey: "cut-key",
  consult: "consult",
} as const;

/** The Edge types that give the robot a key. */
export const KEY_EDGE_TYPES = [EDGE_TYPES.plainKey, EDGE_TYPES.bellKey] as const;
