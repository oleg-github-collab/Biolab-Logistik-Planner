# NATIVE APP DESIGN STANDARDS

## iOS HUMAN INTERFACE GUIDELINES (HIG):

### Touch Targets:
- **Minimum:** 44x44pt (132x132px @3x)
- **Recommended:** 48x48pt for primary actions
- **Spacing:** 8pt minimum between targets

### Typography:
- **Large Title:** 34pt (iOS 11+)
- **Title 1:** 28pt
- **Title 2:** 22pt
- **Title 3:** 20pt
- **Headline:** 17pt semibold
- **Body:** 17pt regular
- **Callout:** 16pt
- **Subhead:** 15pt
- **Footnote:** 13pt
- **Caption 1:** 12pt
- **Caption 2:** 11pt

### Spacing:
- **Large:** 32pt
- **Medium:** 16pt
- **Small:** 8pt
- **Extra Small:** 4pt

### Animations:
- **Quick:** 0.2s
- **Standard:** 0.3s
- **Slow:** 0.4s
- **Spring:** mass 1, stiffness 300, damping 30

### Gestures:
- **Tap:** Primary action
- **Swipe Left:** Delete/Remove
- **Swipe Right:** Archive/Complete
- **Long Press:** Context menu
- **Pull Down:** Refresh or dismiss
- **Pinch:** Zoom

### Haptics:
- **Light:** Selection changed
- **Medium:** Action completed
- **Heavy:** Error or warning
- **Success:** Task completed
- **Warning:** Careful attention needed
- **Error:** Something wrong

---

## MATERIAL DESIGN 3 (Android):

### Touch Targets:
- **Minimum:** 48x48dp
- **Icon buttons:** 48x48dp
- **FAB:** 56x56dp (regular), 40x40dp (small)

### Typography:
- **Display Large:** 57sp
- **Display Medium:** 45sp
- **Display Small:** 36sp
- **Headline Large:** 32sp
- **Headline Medium:** 28sp
- **Headline Small:** 24sp
- **Title Large:** 22sp
- **Title Medium:** 16sp
- **Title Small:** 14sp
- **Body Large:** 16sp
- **Body Medium:** 14sp
- **Body Small:** 12sp
- **Label Large:** 14sp
- **Label Medium:** 12sp
- **Label Small:** 11sp

### Spacing:
- **4dp grid system**
- Common: 4, 8, 12, 16, 24, 32, 40, 48

### Animations:
- **Quick:** 100ms
- **Standard:** 300ms
- **Complex:** 500ms
- **Easing:** cubic-bezier(0.4, 0.0, 0.2, 1)

### Elevation:
- **Level 0:** 0dp (surface)
- **Level 1:** 1dp (cards)
- **Level 2:** 3dp (elevated cards)
- **Level 3:** 6dp (dialogs, menus)
- **Level 4:** 8dp (nav drawer)
- **Level 5:** 12dp (FAB)

---

## BEST PRACTICES З NATIVE APPS:

### Telegram:
- ✅ Instant feedback на кожну дію
- ✅ Swipe-to-reply в чатах
- ✅ Long-press context menu
- ✅ Pull-to-refresh всюди
- ✅ Skeleton screens при завантаженні
- ✅ Smooth 60fps scrolling
- ✅ Bottom sheets для опцій
- ✅ Native-style animations

### WhatsApp:
- ✅ Swipe-to-archive messages
- ✅ Haptic feedback на actions
- ✅ Loading states з spinners
- ✅ Optimistic UI updates
- ✅ Toast notifications
- ✅ Pull-down-to-refresh
- ✅ Smooth transitions

### Instagram:
- ✅ Story-style horizontal scrolls
- ✅ Double-tap interactions
- ✅ Pull-to-refresh з animation
- ✅ Bottom sheet filters
- ✅ Skeleton loading
- ✅ Progressive image loading
- ✅ Gesture-based navigation

### Apple Notes:
- ✅ Natural scrolling
- ✅ Swipe actions on items
- ✅ Context menus
- ✅ Keyboard handling
- ✅ Search suggestions
- ✅ Quick actions

---

## ЩО ПОТРІБНО РЕАЛІЗУВАТИ:

### 1. GESTURES (КРИТИЧНО):
```javascript
// Swipe to delete
- Swipe left на notification → delete
- Swipe left на message → delete
- Swipe right на task → complete

// Swipe to navigate
- Swipe right → back (iOS style)
- Swipe down modal → close

// Pull to refresh
- Pull down на lists → refresh

// Long press
- Long press на item → context menu
```

### 2. HAPTIC FEEDBACK:
```javascript
// На кожну дію
- Button tap → light haptic
- Item selected → medium haptic
- Action completed → success haptic
- Error → error haptic
- Delete → warning haptic
```

### 3. LOADING STATES:
```javascript
// Skeleton screens
- List loading → skeleton items
- Card loading → skeleton card
- Image loading → shimmer effect

// Spinners
- Inline spinner для buttons
- Full-screen spinner для page load
- Pull-to-refresh spinner

// Progress bars
- Upload progress
- Download progress
```

### 4. ANIMATIONS:
```javascript
// Spring animations (iOS)
- Modal appear: spring(300, 30, 1)
- Card tap: scale(0.95) + spring back
- List item delete: slide + fade

// Shared element transitions
- Image expand
- Card to detail
```

### 5. BOTTOM SHEETS:
```javascript
// Native-style
- Detents: [.medium, .large]
- Grabber indicator
- Swipe to dismiss
- Backdrop tap to close
- Keyboard avoiding
```

### 6. SCROLL OPTIMIZATION:
```javascript
// 60fpsScrolling
- transform instead of top/left
- will-change: transform
- Passive event listeners
- Virtual scrolling для довгих списків
- Intersection Observer для lazy load
```

### 7. KEYBOARD HANDLING:
```javascript
// iOS Keyboard
- visualViewport API
- Scroll to focused input
- Resize content area
- Dismiss on scroll
- Accessory bar (Done button)
```

### 8. NATIVE COMPONENTS:
```javascript
// Action Sheet (iOS)
- List of actions
- Cancel button
- Destructive option

// Alert Dialog
- Title + Message
- 1-3 buttons
- Preferred action

// Context Menu
- Long press → menu
- Haptic on appear
- Icons + text
```

### 9. MICRO-INTERACTIONS:
```javascript
// Feedback на кожну дію
- Button press → scale down
- Toggle switch → haptic + animation
- Checkbox → checkmark animation
- Like → heart animation
- Send → paper plane animation
```

### 10. PERFORMANCE:
```javascript
// Optimization
- Debounce search input
- Throttle scroll events
- Memoize expensive calculations
- Virtualize long lists
- Lazy load images
- Code splitting
```
