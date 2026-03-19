✦ Magic Cursor
The visual prompt builder for vibe coders.
Stop describing UI changes in words. Just drag, resize, and recolor elements directly on your app preview — Magic Cursor converts every change into a precise AI prompt automatically.


The Problem
You built your app with Bolt, Lovable, v0, or Claude. It's 80% right. Now you need to fix the UI.
So you take a screenshot, upload it, type something like "make the button bigger and move it to the right" — and the AI gives you something completely wrong. You try again. Wrong again. 10 attempts, hundreds of tokens, still not right.
Magic Cursor fixes this.

How It Works

Activate Magic Cursor on any website or app preview
Click any element to select it
Drag to move · Pull corners to resize · Pick colors · Adjust font, padding, radius
Hit ⚡ Copy — get a precise, framework-aware AI prompt
Paste into Claude, ChatGPT, Cursor, or whatever AI you use
Done in one shot


Install
Chrome / Edge / Brave / Arc

Download or clone this repo
Go to chrome://extensions
Enable Developer mode (top right toggle)
Click Load unpacked
Select the magic-cursor folder

Activate

Click the ✦ icon in your toolbar
Or double-tap the ` (backtick) key on any page


Features
FeatureDescriptionDrag to moveDrag any element anywhere on the pageResizePull corner handles to resizeFont sizeSlider from 8px to 96pxPaddingControl top/right/bottom/left individuallyBorder radiusSlider for roundingOpacityFade any elementColorsBackground + text color pickersMulti-selectShift+click multiple elements, change all at onceDuplicateAdd a copy of any element after or before itResponsive previewToggle between mobile (375px), tablet (768px), and full widthFramework detectionAuto-detects React, Tailwind, Vue, Next.js — prompts use the right syntaxArrow key nudgePrecise 1px moves (Shift = 10px)

Works With

Lovable — open Preview tab, activate Magic Cursor
Bolt — open preview in new tab, activate
v0 — works directly on preview
Any localhost — works on localhost:3000, localhost:8080, anywhere
Any live website — use it for inspiration or debugging


Keyboard Shortcuts
KeyAction`` (double tap)Toggle Magic Cursor on/offEscDeselect element / exitArrow keysNudge selected element 1pxShift + ArrowNudge 10pxShift + ClickMulti-select elements

Example Prompt Output
You are helping me edit my Lovable + React + Tailwind CSS app.
Built with Lovable. Edit source files, not rendered HTML.
Make ONLY these changes:

1. Moved right 48px, down 16px
   Element: .hero-section .cta-button | classes: "px-6 py-3 rounded-lg bg-blue-500"
   → ml-12 mt-4 (remove conflicting margin classes)

2. Font size → 24px
   Element: h1.hero-title | text: "Welcome to Roomyfy"
   → text-2xl

3. BG → #6366f1
   Element: button.primary-btn
   → bg-indigo-500

Only return changed code. JSX component. No explanations.

Roadmap

 Firefox support
 Magic Cursor for Expo / React Native (mobile apps)
 AI-powered suggestions
 Prompt history


Contributing
PRs welcome. If you find a bug or have a feature request, open an issue.

License
MIT
