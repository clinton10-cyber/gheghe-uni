# v7 audit: UI comparison with Everyday-game and loopholes fixed

Compared against `clinton10-cyber/Everyday-game` (read only, not modified).

## UI comparison

| Area | Everyday-game | Ghegeh Uni before | Ghegeh Uni now |
|---|---|---|---|
| Always-visible player status | HUD player panel (HP, sanity, rep, cash) | Only inside the Campus Life panel | Status strip: energy, mood, wallet, rep; low values pulse |
| Load failure | Error overlay with reload and copy | Raw error text, no action; blank page if WebGL missing | Error screen with RELOAD; explicit WebGL message |
| Slow first load | Progress percentage | Spinner only | Spinner plus a "still building" message after 12 s |
| Safe areas and landscape | Dedicated landscape HUD CSS | Mission card ignored notch; no landscape rules | Safe-area offsets, dvh heights, landscape rules, phone layout |
| Menus vs the world | Menus own input | World kept running behind open panels | World freezes while a menu is open or the tab is hidden |
| Keyboard | n/a | Hint always said "joystick" | Hint adapts to touch or desktop; Esc closes menus |
| PWA install | Icons and manifest | `icons: []`, so not installable | 192/512/maskable icons, Apple touch icon, favicon |
| Offline page | `offline.html`, `404.html` | None | `404.html`, safe navigation fallback |
| Accessibility | n/a | No focus styles | Focus rings, reduced-motion support, live regions |

## Loopholes fixed

**Progression (`src/progress.js`)**
1. Exams could be spammed with no study or lectures; study was never consumed. Exams now consume 2 study + 1 lecture.
2. Every exam gave +4 credits whatever the score. Added a 50% pass mark; failures give no credits.
3. Study and lecture buttons in the portal worked anywhere, with no energy cost. They now only point you to the library or faculty; credit is earned on campus.
4. Graduation needed 3 exam *attempts*, not passes. It now needs 3 passes and 12 credits.
5. JAMB score had no effect on admission. Programmes now have cut-offs.
6. Scholarship had no reward and no grade requirement. It pays ₦50,000 and needs a 60% average.
7. Graduation left no record. Graduations are now stored and shown.
8. Tampered or corrupted saves (NaN, strings, huge numbers) are clamped and sanitised; v1 saves migrate.

**Campus life (`src/life.js`)**
9. Infinite money: "Take a student job" could be spammed. Added cooldowns and energy costs, so work stops when you are exhausted.
10. Energy never blocked anything. Activities now need enough energy.
11. Instant besties: repeated chat raised friendship +12 each time. Chats have a gap, with diminishing returns.
12. Reputation farming: join a group, leave, repeat. Leaving now removes the join bonus.
13. Discipline had no consequence. At 20 or below you are suspended from academic activity, which gives the Secret Cult warning real weight.
14. Conduct meeting, hostel rest and meals were free infinite loops. Added cooldowns and full-bar guards.
15. "Invite to study" never counted toward your degree. It now records a study session.
16. History log and NPC memory grew without bound. They are capped.
17. Profile accepted NaN or whitespace names. Inputs are validated and normalised.

**App shell**
18. Service worker cached `index.html` forever (cache-first, fixed cache name), so deploys never reached players, and failed `.js` requests returned HTML. Now versioned and network-first with a navigation-only fallback.
19. Jekyll on GitHub Pages silently drops files and folders starting with `_`. The game has many (`_polish.js`, `rooms/_index.js`, ...). Added `.nojekyll`.
20. Loader error text was injected as HTML. It now uses text nodes; topic labels and programme data are escaped.
21. Buying clothing popped open the 3D wardrobe sheet each time. It now applies the outfit directly.
22. No way to start over. Added "Start a new student" in the portal.
23. Tab-hidden and bfcache handling: dispose only on real unload.

## Not changed
Everyday-game was only read. The 3D campus, NPC, vehicle and character code under `game-assets/` is untouched except the one `equipClothing` fix.
