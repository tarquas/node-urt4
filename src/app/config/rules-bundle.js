const generalRules = [[
  '^21. Behave',
  '^7   This is not a kindergarten.',
  '^7   Unsportsmanlike and abusive behavior is not welcome.',
], [
  '^22. Respect players',
  '^7   This is not self-affirmation platform.',
  '^7   Cheating, egoism, and disrespect to team-play are not welcome.',
], [
  '^23. No spam',
  '^7   This is not a pigsty. Chat and radio garbage and flooding, unwanted',
  '^7   distraction from gameplay, and bringing extreme attention are not welcome.',
], [
  '^24. Respect admins',
  '^7   Respect the service of our administration',
  '^7   and their game-related management.',
], [
  '^25. Respect gameplay',
  '^7   Respect tactical timings, strive to keep them by avoiding chaotic or',
  '^7   irrational actions. Avoid breaking the timings of your teammates by',
  '^7   blocking their movements and projectiles, by team-attacking / team-killing.',
]];

const ctfRules = [[
  '^26. Understand your respawn timing',
  '^7   Complaints about too long respawn are not constructive:',
  '^7   players are respawning in 15-second waves; the duration of your respawn',
  '^7   mostly depends on your teammates and your respect of timings.',
], [
  '^27. Quick medic your team mates',
  '^7   Teamkilling of low-health players in moments before wave timer reset',
  '^7   are treated as fast curing and must be preferred above standard curing',
  '^7   (with some tactical exceptions). This is not the case of rule #^25',
  '^7   and complaints about TK in this case are not welcome.',
  '^7   Killing your enemies for their long respawn is recommended and welcome',
  '^7   but not strictly required by this rule.'
], [
  '^28. Spawnkilling is allowed',
  '^7   Players have 2 seconds of immunity after respawn to get ready for it',
  '^7   Complaints about spawnkilling are not welcome:',
  '^7   in most cases, constant SK is a display of imbalance',
  '^7   and shall be administered properly (ping admins about this).',
], [
  '^29. No fragging',
  '^7   K/D fragging above the teamplay is not welcome. Your personal rate',
  '^7   consists of the score of your team in compound with number of your',
  '^7   flag captures, returns, assists and protects in your stats.',
], [
  '^210.No camp',
  '^7   Nontactical camping is not welcome. This includes constant camping far',
  '^7   away from direct trace to enemy respawn area; in worst cases:',
  '^7   between own flag and own respawn area.',
]];

const jumpRules = [[
  '^21. Behave',
  '^7   This is not a kindergarten.',
  '^7   Unsportsmanlike and abusive behavior is not welcome.',
], [
  '^22. Enjoy',
  '^7   This server is for personal trainings, thus is not limiting anyone from free',
  '^7   movements over the map, and furthermore is providing features for this.',
  '^7   Please avoid complaints about cheating/skipping jumps etc. of other players',
  '^7   as this is expected manner of the gameplay. For you own comfort, use ^5!prefs^7.'
], [
  '^23. No spam',
  '^7   This is not a pigsty. Chat and radio garbage and flooding, unwanted',
  '^7   distraction from gameplay, and bringing extreme attention are not welcome.',
], [
  '^24. Respect admins',
  '^7   Respect the service of our administration',
  '^7   and their game-related management.',
]];

const head = [
  '^7Welcome to this ^3Node^5Urt4^7-based server.',
  '^7We respect democracy. Players are free to use ^5!vote^7, vote menu or chat requests',
  '^7to administration to keep the game fair and fun.',
  '',
  '^7Please strive to respect the rules below;',
  '^7if something is not clear or looks ambiguous to you,',
  '^7feel free to ask our administration -- we\'ll gladly reply.'
];

const tail = [
  '',
  '^3Use ^5!rule #^3 to view details of rule with corresponding ^2#^3.',
  '',
  '^6Have fun!'
];

const general = [
  '',
  '^2General rules for players:',
  '',
  ...generalRules.map(rule => rule[0])
];

const ctf = [
  '',
  '^2CTF rules:',
  '',
  ...ctfRules.map(rule => rule[0])
];

const jump = [
  '',
  '^2JUMP rules:',
  '',
  ...jumpRules.map(rule => rule[0])
];

module.exports = {
  other: {rules: [...generalRules], desc: [...head, ...general, ...tail]},
  ctf: {rules: [...generalRules, ...ctfRules], desc: [...head, ...general, ...ctf, ...tail]},
  jump: {rules: [...jumpRules], desc: [...head, ...jump, ...tail]}
};
