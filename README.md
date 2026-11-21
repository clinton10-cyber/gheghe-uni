# Ghegeh University

A standalone, offline-first 3D third-person campus-life game for modern browsers and Android Chrome/PWA. It reuses the original Everyday Game Ghegeh University campus, 3D player controller, NPC system, character models, animations and campus building geometry while keeping its own entry point and save keys.

## Play online

GitHub Pages: https://clinton10-cyber.github.io/gheghe-uni/

See `AUDIT.md` for the v7 UI comparison and the list of loopholes fixed.

## Run locally

Serve this folder over HTTP (ES modules and the service worker need an HTTP origin):

```bash
python -m http.server 8080
```

Open `http://127.0.0.1:8080` in Chrome.

## Gameplay

- Explore the 3D campus with keyboard or mobile touch controls.
- Visit named faculties and facilities; each has a distinct interior dressing and its own proximity activity.
- Apply to a degree programme, attend lectures, study, complete practical sessions, take exams and graduate.
- Talk to NPC students, build rapport, invite them to study and become besties.
- Choose a campus group: Student Union, Sports Club, Technology Society, Campus Crew or the fictional Secret Cult route. Choices affect reputation and discipline.
- Manage energy, mood, student money, social activity and academic progress.

## Platform

- Web: serve the folder from any static HTTP host.
- Android: open the hosted game in Chrome and use Add to Home screen. The PWA shell and service worker are included. A signed APK wrapper can be added as a separate packaging step.

## Project structure

- `index.html`, `css/`: game shell and responsive HUD.
- `src/main.js`: renderer, world boot, interaction routing and panels.
- `src/progress.js`: admissions and academic progression.
- `src/life.js`: social life, factions, friendships, wallet, mood and energy.
- `game-assets/js/places/university/interior.js`: reusable campus builder and named building interiors.
- `game-assets/js/core/thirdperson.js`: player controller, movement, interaction and stair traversal.

See `ARCHITECTURE.md` and `UNIVERSITY-LIFE-PHASE-2.md` for the technical design and latest changes.

## Clinton Tech start screen and student conversations

The opening screen is branded **Clinton Tech Presents**. A new player enters a character name, age, life aim, course, IQ score and JAMB score before entering the 3D campus. The profile is stored locally and prefilled on the next visit so it can be updated. It is shown in the Student Portal and used in NPC conversation context; the IQ score also gives a small fictional learning-aptitude modifier to examination scores. It is a game mechanic, not a real assessment of intelligence or academic ability.

Student conversations now offer topic choices (course, campus life, rumours, academics, events and friendship). NPCs retain a local record of topics and rumours discussed. Rumours are explicitly unconfirmed until checked; NPC responses encourage checking official notices or Student Affairs rather than treating gossip as fact.

NPCs also accept short typed messages in the conversation panel. A lightweight intent matcher recognises common phrasing around rumours/gist, courses, exams, events, friendship, goals and campus locations, then continues with a relevant reply and follow-up choices. This is an offline scripted conversation system rather than a live online AI chatbot; its topic and rumour memory is saved locally per NPC.

### Clinton Tech start screen and student profile

The game opens with a **CLINTON TECH PRESENTS — UNIVERSITY LIFE** splash screen. Enter the character's name, age, life aim, course, IQ and JAMB score. The profile is stored locally and carried into the welcome mission, student portal, examination simulation and student conversations. Returning players can continue with their saved profile.

### Smarter campus conversations

NPCs support typed chat and topic choices. They recognise common campus language and subjects, move between related topics, remember recent conversations, and share fictional campus rumours with a source and a suggested way to verify them. Rumours are not presented as confirmed facts. Conversation logic is offline and rule-based; it is not a cloud AI chatbot.


## Quality, loading and student vehicles (Phase 3)
- `src/quality.js` detects device capability, applies Low/Medium/High render presets, and stores the selected preset locally.
- Low quality reduces pixel ratio, disables shadows and reduces selected campus detail/texture work.
- Campus generation yields between major build stages so the loading screen can remain responsive.
- Wealthier student arrivals use low-poly cars that follow the paved entrance lane into the marked open-air student parking court. Arriving students appear beside parked cars.


### Original Everyday-game vehicle models
Campus student arrivals now use the original detailed BMW, Mercedes-Benz, Range Rover, G-Wagon, Bugatti Chiron and Cybertruck procedural 3D builders from the supplied Everyday-game archive. They drive along the paved campus access lane and park in the marked student parking court.


## Phase 4 — cars, landscape, clothing and character actions

- Student arrival cars now include animated hinged side doors: they open after parking, a student exits/spawns beside the car, and the doors close.
- Campus landscaping adds planted flower beds, ornamental planting, and seating around the quad. Existing campus tree and grass systems remain in place.
- NPC students use the original randomized wardrobe configuration system; staff roles retain their role-specific clothing.
- Added a physical campus clothing pavilion with display rails, changing cubicles, mirror and a fitting-studio interaction. The player remains in third-person view while using the wardrobe.
- Added a clothing market with purchasable tops, trousers, shoes and complete outfits. Purchases deduct from the local campus wallet and owned items persist in localStorage.
- Added a compact action HUD, emote panel, dance gestures and a paired handshake action with the nearest student.

All purchases and ownership remain local to this device in this offline-first build. The wardrobe catalogue is a prototype stock list; no online store or real-money payment is connected.
