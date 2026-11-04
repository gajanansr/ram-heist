// All dialogue. Fictional parody. None of these are real quotes from any real person.
// who: 'sam' | 'ravi'
// Story: you (Aj) are an ordinary person with RAM in the community hackerspace server room.
// Sam has declared that RAM belongs in datacenters, for AI, not for common people, and sends his crew to collect it.

export const BARKS = {
  // voiced (ElevenLabs recordings, see voice.js)
  patrol: ['Thirty-two gigs for a browser tab? Think of the models.', "I'm not taking your RAM. I'm upgrading its purpose.", "Every stick you hide... is a thought a datacenter can't have.", 'Datacenters first. Hobbyists... in a few years. Maybe.'],
  search: ['Hmm. Suspiciously tidy.', "Cabinets don't hide themselves. Oh. They do."],
  spot: ['Wait...'],
  hear: ['Wait...'],
  decoy: ['Wait...'],
  miss: ['Hmm. Suspiciously tidy.'],
  chase: ["Stop! You're slowing down progress!", "It's for the future, Aj!", "That's not how stewardship works!"],
  caught: ["Stop! You're slowing down progress!", "It's for the future, Aj!"],
  steal: ['Another one for the cluster. Thank you for your service.'],
  // reactions (record from VOICE_SCRIPT.md; subtitle-only until the audio exists)
  found: ['Found you. Hello, Aj.'],
  breaker: ['Who turned off the lights?!', 'Power cut. Convenient. Very convenient.'],
  cluster: ['Wait... is that a cluster? In a hackerspace?'],
  slip: ['Whoa!', 'Who left coffee on the floor?!', 'My roadmap! Oh. My back.'],
  suspect: ['I saw someone duck in there.', 'That hiding spot looks suspicious.', 'Nobody just vanishes. I will check there.'],
  lost: ['Where did they go?', "Huh. Gone, like a startup in a down round."],
  frustrated: ["I haven't slept in three days for this RAM.", "I'm not angry. I'm just aggressively optimistic."],
};
// Ravi: your friend in IT, on the walkie-talkie
export const TIPS = [
  { t: 100, who: 'ravi', text: 'Walk up to a locker, desk or crate and press E to hide a chip.' },
  { t: 90, who: 'ravi', text: "The terminal in the north-west corner is the People's Cluster. Hold E there to upload chips." },
  { t: 72, who: 'ravi', text: 'Hold Shift to sprint, but it is loud. Press C to crouch and stay quiet.' },
  { t: 55, who: 'ravi', text: 'Watch the circle in the middle of the screen. When it fills up, Sam has spotted you.' },
  { t: 42, who: 'ravi', text: 'Press T to drop a coffee spill. Lure Sam over it.' },
  { t: 28, who: 'ravi', text: "You can hide yourself too. Stand next to a locker or desk and press H. Just don't let him watch you do it." },
  { t: 14, who: 'ravi', text: 'See the blue boxes on the walls? Press E at one and the whole room goes dark.' },
];
export const NIGHT_TIPS = {
  1: [{ t: 105, who: 'ravi', text: 'Press G to throw a decoy mug. The noise pulls Sam away.' }],
  2: [{ t: 122, who: 'ravi', text: 'Press F for your flashlight. But the light makes you easy to spot.' }],
  3: [{ t: 120, who: 'ravi', text: 'Sam has better ears tonight. Crouch with C, and think twice before you sprint.' }],
  4: [{ t: 140, who: 'ravi', text: 'Last night. Keep going, Aj. You can do it.' }],
};

export const INTROS = [
  [
    { who: 'ravi', text: "Aj! It's Ravi, from the hackerspace IT desk. Did you hear Sam's speech tonight?" },
    { who: 'ravi', text: "He said RAM belongs in datacenters, for AI, and not for common people like us." },
    { who: 'ravi', text: "So now he's sending people to collect every stick of RAM they can find. Including yours." },
    { who: 'ravi', text: "You have six sticks in your bag. Hide them around this room. Walk close to a locker, desk or crate and press E." },
    { who: 'ravi', text: 'Keep at least three safe until sunrise. Stay out of his flashlight. I will be on the walkie-talkie.' },
    { who: 'sam', text: 'Hello? Is anybody here? I just want to borrow some RAM. For the future of humanity.' },
  ],
  [
    { who: 'ravi', text: 'You made it through night one. He is back. And faster.' },
    { who: 'ravi', text: 'I got you some decoy mugs. Press G to throw one. The noise pulls him away from your hiding spots.' },
    { who: 'sam', text: "I'm not angry about last night. I'm just very motivated." },
    { who: 'ravi', text: 'Also the lights are flickering. Facilities says it is a feature.' },
  ],
  [
    { who: 'ravi', text: "Power's out. The flashlight is on you. And on him." },
    { who: 'ravi', text: 'Press F for your flashlight. But be careful. A light in the dark is a very loud thing.' },
    { who: 'sam', text: "Don't worry about the blackout, everyone. A true visionary can find RAM in the dark." },
  ],
  [
    { who: 'ravi', text: "Sam has been practising. He can hear a chip click from across the room now, Aj." },
    { who: 'ravi', text: 'If he sees you duck into a hiding spot, he will check it first.' },
    { who: 'sam', text: 'I trained for this. Months of listening exercises. My roadmap depends on your RAM.' },
  ],
  [
    { who: 'ravi', text: 'Final night, Aj. You are doing this for everyone who just wants their own computer.' },
    { who: 'ravi', text: 'Eight chips tonight. Use everything you have learned: decoys, traps, and the breakers.' },
    { who: 'sam', text: 'Tonight we ship. Tonight the datacenter gets its RAM. Tonight nobody sleeps.' },
  ],
];

export const ENDING = [
  { who: 'sam', text: 'Sunrise. Five nights. Not one stick. How is that even possible?' },
  { who: 'sam', text: 'You know, I did the math. A few more sticks would not have changed the roadmap.' },
  { who: 'sam', text: 'Fine. Keep your RAM. Maybe regular people can have a little, too. But not too much.' },
  { who: 'sam', text: 'Fine. I will just build more RAM. We have a very long runway.' },
  { who: 'ravi', text: 'You did it, Aj! The RAM stays with the people. Thanks for playing RAM Heist.' },
];

export const FAIL_LINES = [
  'Sam walked off with your RAM. He looks very happy.',
  'The datacenter grew by a few gigabytes. Yours.',
  'That was a lot of RAM to lose in one night.',
];
