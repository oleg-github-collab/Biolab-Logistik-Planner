# Mobile Messenger Revamp Notes

## What changed
- Rebuilt the mobile messenger UI styles from scratch in `client/src/styles/mobile-complete.css`.
- Ensured the mobile CSS loads after messenger component styles by importing it in `client/src/components/DirectMessenger.js`.
- Removed the global import from `client/src/index.js` to prevent ordering conflicts.
- Softened conflicts from `client/src/styles/messenger-clarity.css` by removing `!important` in mobile bubble rules.
- Updated tokens and mobile container rules in `client/src/styles/messenger-unified-input.css` to match the new palette and safe-area layout.

## Design targets implemented
- PWA-like dark atmosphere with layered gradients, soft shadows, and high-contrast text.
- Compact, readable list view with story row, action pills, and strong avatar focus.
- Chat view with tight header actions, bubble geometry, and clean input dock.
- Safe-area aware paddings and fixed composer that never overlaps the keyboard.

## File-by-file notes
- `client/src/styles/mobile-complete.css`
  - New mobile tokens in `body.messenger-page`.
  - Full redesign of list view, story row, contact cards, and chat view.
  - Composer, quick replies, recording state, and upload progress all restyled.
- `client/src/components/DirectMessenger.js`
  - Added `import '../styles/mobile-complete.css';` after `messenger-unified-dark.css`.
- `client/src/index.js`
  - Removed the global `./styles/mobile-complete.css` import to keep ordering predictable.
- `client/src/styles/messenger-clarity.css`
  - Removed `!important` from mobile bubble rules so the new mobile skin can override cleanly.
- `client/src/styles/messenger-unified-input.css`
  - Updated palette tokens and adjusted the mobile container rules to the new safe-area layout.

## How to adjust quickly
- Primary accent: `--m-accent` and `--m-accent-2` in `client/src/styles/mobile-complete.css`.
- Header spacing: `.messenger-mobile-header-enhanced` padding and `padding-right`.
- Bubble size: `.messenger-mobile-messages .message-bubble` max-width and padding.
- Composer height: `--messenger-input-height` is calculated automatically in `DirectMessenger`.

## Verification checklist
- Open `/messages` on a phone-sized viewport (360-430px).
- List mode: header, actions, stories, and contact cards should be fully visible and scroll smoothly.
- Chat mode: header actions stay in the top-right, bubbles look dark and consistent, input dock is fixed.
- Quick replies, voice recording, and upload progress are readable in dark mode.
