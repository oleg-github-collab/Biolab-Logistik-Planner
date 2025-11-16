# Mobile Native Classes - Usage Guide

Complete native app-level CSS classes following iOS HIG and Material Design 3 standards.

## 📱 Typography (iOS Style)

```jsx
<h1 className="text-large-title">Large Title (34px)</h1>
<h2 className="text-title-1">Title 1 (28px)</h2>
<h3 className="text-title-2">Title 2 (22px)</h3>
<h4 className="text-title-3">Title 3 (20px)</h4>
<p className="text-headline">Headline (17px)</p>
<p className="text-body">Body (17px)</p>
<p className="text-callout">Callout (16px)</p>
<p className="text-subhead">Subhead (15px)</p>
<p className="text-footnote">Footnote (13px)</p>
<p className="text-caption-1">Caption 1 (12px)</p>
<p className="text-caption-2">Caption 2 (11px)</p>
```

## 🔘 Native Buttons

```jsx
{/* Primary Button */}
<button className="btn-native btn-primary-native">
  Save Changes
</button>

{/* Secondary Button */}
<button className="btn-native btn-secondary-native">
  Cancel
</button>

{/* Destructive Button */}
<button className="btn-native btn-destructive-native">
  Delete
</button>

{/* Icon Button (48x48px touch target) */}
<button className="btn-icon-native">
  <Icon />
</button>
```

## 📋 Native Cards & Lists

```jsx
{/* Native Card */}
<div className="card-native">
  <div className="card-native-header">
    <h3>Card Title</h3>
  </div>
  <div className="card-native-body">
    Card content here
  </div>
  <div className="card-native-footer">
    Footer actions
  </div>
</div>

{/* Native List */}
<div className="list-native">
  <div className="list-item-native">
    <span>List Item 1</span>
  </div>
  <div className="list-item-native">
    <span>List Item 2</span>
  </div>
</div>

{/* Swipeable List Item */}
<div className="list-item-swipeable">
  <div className="list-item-swipeable-content">
    Main content
  </div>
  <div className="list-item-swipeable-actions">
    <button className="list-item-action list-item-action-delete">
      Delete
    </button>
  </div>
</div>
```

## 📄 Bottom Sheet (iOS Style)

```jsx
<div className={`bottom-sheet-native ${isOpen ? 'is-open' : ''}`}>
  <div className="bottom-sheet-grabber"></div>
  <div className="bottom-sheet-header">
    <h3>Sheet Title</h3>
  </div>
  <div className="bottom-sheet-body">
    Sheet content with scrolling
  </div>
</div>

{/* Backdrop */}
<div className={`modal-backdrop-native ${isOpen ? 'is-active' : ''}`} />
```

## 🔔 Toast Notifications (iOS Style - from top)

```jsx
<div className={`toast-native toast-native-success ${isVisible ? 'is-visible' : ''}`}>
  <div className="toast-native-content">
    <div className="toast-native-icon">✓</div>
    <div className="toast-native-text">Success message!</div>
  </div>
</div>

{/* Error Toast */}
<div className="toast-native toast-native-error is-visible">...</div>

{/* Warning Toast */}
<div className="toast-native toast-native-warning is-visible">...</div>
```

## ⚠️ Alert Dialog (iOS Style)

```jsx
<div className={`alert-native ${isVisible ? 'is-visible' : ''}`}>
  <div className="alert-native-header">
    <div className="alert-native-title">Delete Item?</div>
    <div className="alert-native-message">
      This action cannot be undone.
    </div>
  </div>
  <div className="alert-native-actions">
    <button className="alert-native-action">Cancel</button>
    <button className="alert-native-action is-primary is-destructive">
      Delete
    </button>
  </div>
</div>
```

## 📋 Action Sheet (iOS Style)

```jsx
<div className={`action-sheet-native ${isVisible ? 'is-visible' : ''}`}>
  <div className="action-sheet-native-actions">
    <button className="action-sheet-native-action">Share</button>
    <button className="action-sheet-native-action">Duplicate</button>
    <button className="action-sheet-native-action is-destructive">
      Delete
    </button>
  </div>
  <button className="action-sheet-native-action action-sheet-native-cancel">
    Cancel
  </button>
</div>
```

## 📝 Context Menu (Long Press)

```jsx
<div className={`context-menu-native ${isVisible ? 'is-visible' : ''}`}>
  <button className="context-menu-native-item">
    <Icon /> Edit
  </button>
  <button className="context-menu-native-item">
    <Icon /> Share
  </button>
  <button className="context-menu-native-item is-destructive">
    <Icon /> Delete
  </button>
</div>
```

## 🎛️ Segmented Control (iOS Style)

```jsx
<div
  className="segmented-control-native"
  style={{'--segment-count': 3, '--active-index': 0}}
>
  <button className="segmented-control-native-option is-active">
    Day
  </button>
  <button className="segmented-control-native-option">
    Week
  </button>
  <button className="segmented-control-native-option">
    Month
  </button>
</div>
```

## 🔍 Search Bar (iOS Style)

```jsx
<div className="search-bar-native">
  <input
    type="text"
    className="search-bar-native-input"
    placeholder="Search..."
  />
  <div className="search-bar-native-icon">
    <SearchIcon />
  </div>
  <button className="search-bar-native-clear">
    <XIcon />
  </button>
</div>
```

## 📊 Progress Indicators

```jsx
{/* Progress Bar */}
<div className="progress-bar-native">
  <div className="progress-bar-native-fill" style={{width: '60%'}}></div>
</div>

{/* Activity Indicator (Spinner) */}
<div className="activity-indicator-native"></div>
<div className="activity-indicator-native activity-indicator-native-large"></div>
```

## 🏷️ Badges & Dots

```jsx
{/* Badge with number */}
<span className="badge-native">5</span>

{/* Notification dot */}
<span className="badge-native-dot"></span>
```

## ➖ Dividers

```jsx
<hr className="divider-native" />
<hr className="divider-native divider-native-inset" />
```

## 📑 Tabs (Material Design 3)

```jsx
<div className="tabs-native">
  <button className="tab-native is-active">Tab 1</button>
  <button className="tab-native">Tab 2</button>
  <button className="tab-native">Tab 3</button>
</div>
```

## ➕ Floating Action Button (Material Design)

```jsx
{/* Standard FAB */}
<button className="fab-native">
  <PlusIcon />
</button>

{/* Extended FAB */}
<button className="fab-native fab-native-extended">
  <PlusIcon />
  <span>Create New</span>
</button>
```

## 🏷️ Chips (Material Design 3)

```jsx
{/* Standard Chip */}
<div className="chip-native">
  <span className="chip-native-icon">🏷️</span>
  Label
  <button className="chip-native-close">×</button>
</div>

{/* Selected Chip */}
<div className="chip-native is-selected">Selected</div>
```

## 📬 Snackbar (Material Design 3)

```jsx
<div className={`snackbar-native ${isVisible ? 'is-visible' : ''}`}>
  <div className="snackbar-native-text">Message sent successfully</div>
  <button className="snackbar-native-action">Undo</button>
</div>
```

## 🎨 Input & Toggle

```jsx
{/* Native Input */}
<input
  type="text"
  className="input-native"
  placeholder="Enter text..."
/>

{/* Native Toggle (iOS Style) */}
<label className="toggle-native">
  <input type="checkbox" />
  <span className="toggle-native-track"></span>
</label>
```

## 🔄 Loading States

```jsx
{/* Skeleton Loader */}
<div className="skeleton-native" style={{width: '100%', height: '20px'}}></div>

{/* Spinner */}
<div className="spinner-native"></div>
<div className="spinner-native spinner-native-large"></div>
```

## 🤚 Gestures & Interactions

```jsx
{/* Add haptic feedback visual */}
<button
  className="haptic-feedback"
  onClick={handleClick}
>
  Tap me
</button>

{/* Pull to refresh */}
<div className={`pull-to-refresh ${isVisible ? 'is-visible' : ''}`}>
  <div className="spinner-native"></div>
</div>
```

## 📱 Scroll Utilities

```jsx
{/* Smooth native scrolling */}
<div className="scroll-native">
  Scrollable content
</div>
```

## 🔒 Safe Areas

```jsx
<div className="safe-area-top">Content with top safe area</div>
<div className="safe-area-bottom">Content with bottom safe area</div>
<div className="safe-area-all">Content with all safe areas</div>
```

## 🎨 CSS Variables Available

```css
/* Typography */
--font-large-title: 34px
--font-title-1: 28px
--font-body: 17px
--font-footnote: 13px
/* etc... */

/* Spacing (iOS 8pt grid) */
--space-xs: 4px
--space-sm: 8px
--space-md: 16px
--space-lg: 24px

/* Touch Targets */
--touch-target-min: 44px
--touch-target-recommended: 48px

/* Animations */
--duration-quick: 0.15s
--duration-standard: 0.25s
--duration-complex: 0.35s
--easing-ios: cubic-bezier(0.25, 0.1, 0.25, 1)
--easing-android: cubic-bezier(0.4, 0, 0.2, 1)
--easing-spring: cubic-bezier(0.5, 1.5, 0.5, 1)

/* Colors (iOS System) */
--color-primary: #007AFF
--color-success: #34C759
--color-warning: #FF9500
--color-danger: #FF3B30
--color-gray: #8E8E93

/* Shadows (Material Design) */
--shadow-1 to --shadow-5

/* Z-Index Scale */
--z-navigation: 1000
--z-modal: 9500
--z-toast: 10000
```

## 📝 Usage Tips

1. **Touch Targets**: All interactive elements have minimum 44px touch targets (Apple HIG)
2. **Typography**: Uses iOS system font stack with proper letter spacing
3. **Animations**: Spring animations for natural iOS feel
4. **Safe Areas**: Use safe-area classes for notched devices
5. **GPU Acceleration**: All animations use transform/opacity for 60fps
6. **Backdrop Filters**: Frosted glass effects on modals and sheets
7. **Scroll Performance**: Uses -webkit-overflow-scrolling: touch

## ✨ Best Practices

- Always use `btn-native` classes instead of generic buttons on mobile
- Use `bottom-sheet-native` instead of modals on mobile
- Apply `is-visible` or `is-open` classes to trigger animations
- Use CSS variables for consistent theming
- Combine with existing Tailwind classes when needed
- Test on actual iOS/Android devices for best results
