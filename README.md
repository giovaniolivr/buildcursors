# buildcursors

**Your page builds itself.** Coloured cursor "agents" drag selection boxes, type your text line by line and carry your images in, right as visitors scroll. One script tag, zero dependencies, no build step.

**[Live demo →](https://giovaniolivr.github.io/buildcursors/)** · Also running on [giovaniolivr.github.io](https://giovaniolivr.github.io/)

<p align="center">
  <img src="demo/buildcursors.gif" width="600" alt="Coloured cursors building a web page: drawing selection boxes around panels, typing text line by line and lining up on the right when done">
</p>

## Quick start

Add this to the `<head>` of any HTML page:

```html
<script src="https://cdn.jsdelivr.net/gh/giovaniolivr/buildcursors@1/buildcursors.min.js"></script>
```

Load it in the `<head>`, without `defer` or `async`, so the parts that haven't been built are hidden before the first paint. Loaded later, it still works, but visitors may see the page for a moment before it starts.

`@1` follows the latest 1.x release, but browsers may keep a cached copy for up to 7 days. To have an update reach every visitor right away, pin an exact version (for example `@1.1.0`) and change it when you upgrade.

Prefer to self-host? Download [`buildcursors.js`](buildcursors.js) and point the `src` at your copy.

## How it works

Your real page is rendered as usual. While the intro runs, parts that haven't been built yet are invisible but keep their space, so the layout never jumps. As each one scrolls into view, a crew of cursors builds it:

| Agent | Job |
|---|---|
| **Layout**, **Grid** | Drag a selection box with live width × height and alignment guides, then drop the panel in |
| **Copy**, **Type**, **Editor** | Type the text out line by line, following its real line breaks |
| **Media** | Fly off-screen, grab the image and carry it into its frame |
| **QA** | Help wherever there's a backlog |

Each agent prefers its own kind of work and helps with the rest when it's free. Cursors never stand still over your content: an agent with nothing to do glides off the right edge straight away, and turns around mid-flight when new work appears. When the whole page is built, the crew lines up on the right, gives a little hop and leaves.

When a panel is built, the text inside it is handed to the typing agents and its images to Media, so they arrive one by one.

## Choosing what gets built

By default: headings, paragraphs, list items, blockquotes, `pre`, figures, images, videos, tables, articles, forms and anything marked with `data-build`. Only the outermost match is built, and whatever is nested inside it comes along.

Pick your own with a CSS selector:

```html
<script src=".../buildcursors.min.js" data-targets="h1, p, .card, .hero > *"></script>
```

Or mark elements in your HTML:

```html
<div class="pricing" data-build="block">…</div>  <!-- selection box -->
<div class="quote" data-build="text">…</div>     <!-- typed out -->
<nav data-build="skip">…</nav>                   <!-- never hidden, never built -->
```

## Options

Set options as `data-*` attributes on the script tag:

```html
<script src=".../buildcursors.min.js"
        data-cooldown="1h"
        data-speed="2"
        data-replay-link="footer p"></script>
```

Or define `window.buildcursorsConfig` **before** the script. You need this form for `agents`, `onStart` and `onDone`:

```html
<script>
  window.buildcursorsConfig = {
    targets: "h1, h2, p, .card",
    cooldown: "30m",
    onDone: () => console.log("built!"),
  };
</script>
<script src=".../buildcursors.min.js"></script>
```

| Option | Attribute | Default | Description |
|---|---|---|---|
| `targets` | `data-targets` | headings, `p`, `li`, `img`, `figure`… | CSS selector of what gets built |
| `text` | `data-text` | headings, `p`, `li`, `blockquote`, `pre`… | Which elements are typed out instead of boxed |
| `keep` | `data-keep` | `button, .btn, [role=button]` | Text inside these arrives with its panel instead of being typed |
| `ignore` | `data-ignore` | none | Never hidden, never built (same as `data-build="skip"`) |
| `cooldown` | `data-cooldown` | `"10m"` | Play at most once per period per browser: ms, `"30s"`, `"10m"`, `"2h"`, `"1d"`. `0` plays on every visit |
| `storageKey` | `data-storage-key` | `"buildcursors:lastRun"` | `localStorage` key for the cooldown |
| `param` | `data-param` | `"build"` | URL parameter: `?build=1` forces a run, `?build=0` turns it off |
| `speed` | `data-speed` | `1.7` | Animation speed (it also speeds up when the visitor scrolls fast) |
| `names` | `data-names` | `true` | Show name labels next to the cursors |
| `finale` | `data-finale` | `true` | Line up, hop and leave when everything is built |
| `escToSkip` | `data-esc-to-skip` | `true` | Esc builds everything at once |
| `skipBots` | `data-skip-bots` | `true` | Automated browsers (`navigator.webdriver`) get the plain page |
| `mobileAgents` | `data-mobile-agents` | `Layout,Copy,Media,QA` | Smaller crew on narrow screens (`all` for everyone) |
| `mobileBreakpoint` | `data-mobile-breakpoint` | `640` | Width in px below which `mobileAgents` is used |
| `zIndex` | `data-z-index` | `9990` | Stacking order of the cursor layer |
| `replayLink` | `data-replay-link` | none | Selector of an element to append a "watch it build" button to |
| `replayText` | `data-replay-text` | `"Watch it build"` | Text of that button |
| `agents` | – | 7 agents | Array of `{ name, color, role }`; `role` is `"block"`, `"text"`, `"img"` or `null` |
| `onStart` | – | – | Called when a run starts (at `DOMContentLoaded`) |
| `onDone` | – | – | Called when a run ends (finished or skipped) |

## JavaScript API

```js
buildcursors.replay();   // clear the cooldown and reload with ?build=1
buildcursors.skip();     // build everything now
buildcursors.running;    // true while the intro is playing
buildcursors.version;    // "1.1.0"
```

## Polite by default

- **Only what's on screen gets built.** Anything the visitor scrolls past just appears.
- **Reduced motion is respected.** Visitors with `prefers-reduced-motion: reduce` always get the plain page.
- **Keyboard friendly.** Focused elements appear instantly, and Esc builds everything.
- **Not on every visit.** A 10-minute cooldown per browser by default, so it stays a nice surprise.
- **Never in your way.** The cursor layer ignores clicks, and if the script fails to load, your page simply shows as normal.

## Using it with animation libraries

If your page also uses a scroll-animation library such as [AOS](https://github.com/michalsnik/aos), let buildcursors handle the entrance on the visits where it runs:

```html
<script>
  window.buildcursorsConfig = {
    onStart: () => document.querySelectorAll("[data-aos]").forEach((el) => el.removeAttribute("data-aos")),
  };
</script>
```

## Browser support

Current Chrome, Edge, Firefox and Safari (it uses `:is()`, `IntersectionObserver` and `clip-path`: Chrome 88+, Firefox 78+, Safari 14+). Older browsers show the page normally.

## License

[MIT](LICENSE) © Giovani Oliveira
