# University Life — Architecture & Development Roadmap

## Product boundary
University Life is a separate single-player game, not a mode inside Everyday Game. It has its own entry point, visual identity, academic progression and browser storage namespace. Reused source modules are kept under `game-assets/` so they can be upgraded without mixing the two games' app shells.

## Runtime layers
1. **Presentation** — `index.html`, `css/game.css`; HUD, student portal, responsive mobile/desktop layout.
2. **Application orchestration** — `src/main.js`; renderer lifecycle, campus scene boot, animation loop, pause, portal actions, resize and PWA registration.
3. **Game progression** — `src/progress.js`; admissions, programme catalogue, study, attendance, exams, credits, scholarship and graduation. Uses `university_life_save_v1` in localStorage.
4. **3D world adapter** — imports the original `buildInterior()` campus builder and supplies a small router/renderer contract expected by the original scene.
5. **Reusable game foundation** — original Three.js runtime, UNIPORT campus geometry, third-person controller, NPC system, character models, animations and vehicle builders.

## Planned gameplay domains
- Student identity and admission: name, department, level, registration number generated locally.
- Academic calendar: semesters, weekly timetable, lecture halls, attendance windows, continuous assessment and exams.
- Campus navigation: all 17 existing campus buildings, signs, map, waypoints and building-specific entry points.
- Student social life: friendship levels, conversations, roommates, clubs, events, sports and campus relationships.
- Accommodation: hostel allocation, room furnishing, rent and roommate routines.
- Campus economy: cafeteria, printing/photocopy, bookshop, transport, part-time jobs and student budget.
- Progression: GPA, carryovers, scholarships, discipline, internships, final-year project and graduation ceremony.
- Platform: PWA installability, offline shell, responsive touch/keyboard controls and future Android APK wrapper.

## Development phases
- **Foundation (current):** original campus scene, player controller, NPC population, student portal and local academic progression.
- **Phase 2:** admission identity, timetable, lecture hall interaction, attendance windows, course registration and semester dashboard.
- **Phase 3:** hostel rooms, cafeteria, library study interactions, bookshop and campus transport.
- **Phase 4:** NPC conversations, friendships, roommates, clubs, events and relationship routines.
- **Phase 5:** assessments, exams, GPA calculation, scholarships, carryovers, internships and graduation ceremony.
- **Phase 6:** save migration/versioning, accessibility, low-end Android performance pass, installable APK packaging and release testing.

## Reuse policy
Keep source changes in this project unless a shared upstream improvement is deliberately ported back. Do not edit the user's original Everyday Game project as part of University Life work. When updating shared assets, compare upstream file versions and test the campus entry path before replacing local copies.
