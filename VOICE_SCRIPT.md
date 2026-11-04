# RAM Heist: voice script for ElevenLabs
Paste the **ElevenLabs text** (tags included) into the generator. Save each take as `<id>.mp3` and drop them in `public/audio/`.
Voices: **Sam** = Brian (Calm, Collected and Steady). **Ravi** = Brooks (Jovial, Energetic and Fun). The game shows the **Spoken text** as the subtitle, so keep the words exactly as written (only the tags in [brackets] are free to change).

## Priority A: plays during gameplay

| id | who | where | ElevenLabs text |
|---|---|---|---|
| `sam_slip_1` | sam | Sam slips on a coffee trap | [yelping, startled] Whoa! |
| `sam_slip_2` | sam | Sam slips | [indignant, from the floor] Who left coffee on the floor?! |
| `sam_slip_3` | sam | Sam slips | [groaning, pained] My roadmap! ... Oh. My back. |
| `sam_suspect_1` | sam | Sam saw you hide | [low, intrigued] I saw someone duck in there. |
| `sam_suspect_2` | sam | Sam saw you hide | [suspicious, quietly] That hiding spot looks suspicious. |
| `sam_suspect_3` | sam | Sam saw you hide | [thoughtful, deliberate] Nobody just vanishes. I will check there. |
| `sam_lost_1` | sam | Sam lost you in a chase | [puzzled] Where did they go? |
| `sam_lost_2` | sam | Sam lost you | [dry, amused] Huh. Gone, like a startup in a down round. |
| `sam_frustrated_1` | sam | Sam is frustrated after several misses | [tired, exasperated] I haven't slept in three days for this RAM. |
| `sam_frustrated_2` | sam | Sam is frustrated | [forced calm, strained smile] I'm not angry. I'm just aggressively optimistic. |
| `sam_found_1` | sam | Sam finds you hiding | [delighted, smug] Found you. [chuckles] Hello, Aj. |
| `sam_breaker_1` | sam | You cut the power | [irritated, shouting] Who turned off the lights?! |
| `sam_breaker_2` | sam | You cut the power | [calm, then suspicious] Power cut. [pause] Convenient. Very convenient. |
| `sam_cluster_1` | sam | Sam hears an upload | [curious, hushed] Wait... is that a cluster? [pause] In a hackerspace? |
| `ravi_upload_1` | ravi | First upload each night | [relieved, whispering] One chip online. Keep going! |
| `ravi_upload_last` | ravi | One upload left | [urgent whisper] One more chip. You are almost there! |
| `ravi_trap` | ravi | Sam slips | [laughing, whispering] Ha! He slipped! Go, go, go! |
| `ravi_breaker` | ravi | You cut the power | [excited whisper] Lights out. Move while he can't see! |
| `ravi_caught` | ravi | You get caught | [wincing, sympathetic] Ouch. Shake it off, Aj. |
| `ravi_win` | ravi | Night won | [overjoyed] The cluster is live! You did it! |
| `ravi_lose` | ravi | Night lost | [gentle, encouraging] That one is on Sam. Try again, Aj. |

## Priority B: tips, night intros, ending

| id | who | where | ElevenLabs text |
|---|---|---|---|
| `ravi_tip_1` | ravi | Tip, night 1 | [calm, helpful] Walk up to a locker, desk or crate and press E to hide a chip. |
| `ravi_tip_2` | ravi | Tip, night 1 | [whispers] Hold Shift to sprint, but it is loud. Press C to crouch and stay quiet. |
| `ravi_tip_3` | ravi | Tip, night 1 | [pointing it out] Watch the circle in the middle of the screen. When it fills up, Sam has spotted you. |
| `ravi_tip_4` | ravi | Tip, night 1 | [warm, quick] The terminal in the north-west corner is the People's Cluster. Hold E there to upload chips. |
| `ravi_tip_5` | ravi | Tip, night 1 | [conspiratorial] You can hide yourself too. Stand next to a locker or desk and press H. Just don't let him watch you do it. |
| `ravi_tip_6` | ravi | Tip, night 2 | [encouraging] Press G to throw a decoy mug. The noise pulls Sam away. |
| `ravi_tip_7` | ravi | Tip, night 1 | [mischievous] Press T to drop a coffee spill. Lure Sam over it. |
| `ravi_tip_8` | ravi | Tip, night 1 | [excited whisper] See the blue boxes on the walls? Press E at one and the whole room goes dark. |
| `ravi_tip_9` | ravi | Tip, night 3 | [anxious] Press F for your flashlight. But the light makes you easy to spot. |
| `ravi_tip_10` | ravi | Tip, night 4 | [serious, quiet] Sam has better ears tonight. Crouch with C, and think twice before you sprint. |
| `ravi_tip_11` | ravi | Tip, night 5 | [steady, proud] Last night. Keep going, Aj. You can do it. |
| `ravi_n2_2` | ravi | Night 2 intro | [conspiratorial] I got you some decoy mugs. Press G to throw one. The noise pulls him away from your hiding spots. |
| `sam_n2` | sam | Night 2 intro | [smooth, tight smile] I'm not angry about last night. I'm just very motivated. |
| `ravi_n2_3` | ravi | Night 2 intro | [dry, tired] Also the lights are flickering. Facilities says it is a feature. |
| `ravi_n3_2` | ravi | Night 3 intro | [anxious, whispering] Press F for your flashlight. But be careful. A light in the dark is a very loud thing. |
| `sam_n3` | sam | Night 3 intro | [confident, grand] Don't worry about the blackout, everyone. [smug] A true visionary can find RAM in the dark. |
| `ravi_n4_1` | ravi | Night 4 intro | [wary] Sam has been practising. He can hear a chip click from across the room now, Aj. |
| `ravi_n4_2` | ravi | Night 4 intro | [urgent, low] If he sees you duck into a hiding spot, he will check it first. |
| `sam_n4` | sam | Night 4 intro | [proud, deadly serious] I trained for this. [pause] Months of listening exercises. My roadmap depends on your RAM. |
| `ravi_n5_2` | ravi | Night 5 intro | [focused] Eight chips tonight. Use everything you have learned: decoys, traps, and the breakers. |
| `sam_n5` | sam | Night 5 intro | [intense, building] Tonight we ship. Tonight the datacenter gets its RAM. [pause] Tonight nobody sleeps. |
| `sam_end_1` | sam | Ending | [baffled, hoarse] Sunrise. Five nights. Not one stick. [pause] How is that even possible? |
| `sam_end_2` | sam | Ending | [slowly, conceding] You know... I did the math. A few more sticks would not have changed the roadmap. |
| `sam_end_3` | sam | Ending | [sighs] Fine. Keep your RAM. [reluctant] Maybe regular people can have a little, too. [pause] But not too much. |
| `sam_end_4` | sam | Ending | [brightening, scheming] Fine. I will just build more RAM. We have a very long runway. |
| `ravi_end_1` | ravi | Ending | [overjoyed, warm] You did it, Aj! The RAM stays with the people. [laughs] Thanks for playing RAM Heist. |
