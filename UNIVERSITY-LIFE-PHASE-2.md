# University Life — Campus Identity & Student Social Life Upgrade

## What changed

- Campus interiors now receive building-name-specific furniture and equipment: library stacks and reading tables; ICT computer stations; hostel bunk beds and wardrobes; cafeteria service counters; Law moot-court benches; Health Sciences clinic beds; Engineering workshop benches; Science lab equipment; Pharmacy dispensary shelving; Dentistry treatment chair; Agriculture planting benches; Communication/Media studio equipment; Arts display panels; Social Sciences seminar tables; Management Sciences records and meeting tables; Senate administration furniture; and Education teaching equipment.
- The upper-floor stair entry is aligned to the actual stair x-coordinate. The stair opening is made full-height where the stair crosses the lower-floor north wall, rather than leaving the staircase to terminate at a window. Stair treads and landings were corrected, and upper-floor collision levels now derive from the actual floor index (including three-storey hostels).
- Campus building activity anchors are now real 3D proximity interactions. Walk to the library, lecture faculties, labs, hostel, cafeteria, Senate/Student Affairs, moot court or student union and press the game's interaction control.
- Added a separate student social-life save: conversations, rapport, best friends, campus factions, mood, energy, reputation, discipline and a small student wallet.
- Social choices include Student Union, Sports Club, Technology Society, Campus Crew and a fictional Secret Cult. The secret-group route carries in-game discipline consequences; it is fictional gameplay, not an endorsement of real-world groups.
- NPC encounters call the existing NPC conversation/animation system and open a relationship panel. Repeated conversations and study invitations build rapport; bestie status requires time together.
- Campus activities affect energy, mood, money, academic progress and reputation. Study/lecture/practical interactions require admission before academic credit is recorded.

## Controls

- Desktop: WASD/arrow keys to move, drag the right side to look, E to interact, Shift to run, Space to jump.
- Android: use the on-screen left joystick to move, drag the right side to look, and tap the interaction button when near a student or activity marker.
- `CAMPUS LIFE` opens social choices; `STUDENT PORTAL` manages admission and academic progress.

## Save data

- Academic record: `university_life_save_v1`
- Social life: `university_life_social_v1`

Both are local to the browser/device. This is still a single-player offline-first game; cloud multiplayer and online NPC chat are not included in this phase.

## Phase 3 — Character creation and smarter conversations
- Added a Clinton Tech Presents splash/start screen with character name, age, life aim, course, IQ and JAMB score.
- Character profile persists locally and is prefilled for returning players; profile details appear in the Student Portal and inform NPC dialogue context.
- Added topic-based NPC conversation choices, follow-up topic transitions, local NPC topic memory and campus rumours.
- Rumours are marked unconfirmed and the dialogue offers verification through official notices or Student Affairs.
- A small IQ-based learning modifier is used as a fictional game stat for examination scoring; it is not a real-world IQ interpretation.
- Added a typed chat box with offline intent matching for ordinary student topics and common rumour/gist phrasing, alongside selectable follow-up prompts.

## Phase 3 — Clinton Tech splash and conversational NPC upgrade

- Added a branded Clinton Tech Presents student-creation splash before entering the campus.
- The player profile captures name, age, life aim, intended course, IQ score and JAMB score, and is stored locally for later sessions.
- The game carries the profile into the student portal, welcome mission and NPC conversations. IQ contributes to simulated examination scoring; course and life aim are used in NPC dialogue; JAMB appears in the welcome/admission profile; age remains part of the character record.
- Improved NPC conversation intent detection for campus slang and common topics, with more natural topic transitions and follow-up responses.
- NPCs retain a small local conversation memory, repeat fewer rumours, identify where a rumour supposedly came from, and direct the player to an appropriate office or noticeboard to verify it. Rumours remain explicitly unconfirmed until an in-game official confirmation system exists.
- Added more distinct NPC conversational styles and interests based on stable NPC identity.

This remains an offline, rule-based conversation system rather than a live AI service. It is designed to be coherent, context-aware and extensible without requiring an internet connection.
