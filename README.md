# Monitor Visualizer

A small website for answering the question *"how big is that monitor, really?"*

Type in a monitor's diagonal, aspect ratio and curvature and it appears at true scale
in a 3D scene: a plain desk, a blank seated figure for reference, and the screen itself.
Put up to three of them side by side, pivot the outer ones to portrait, stack one above —
then drop into the seat and see what the whole arrangement actually covers from there.

![overview](docs/preview-orbit.png)

From the seat, with two 34″ 21:9 curved panels — rendered at a 114° horizontal field
of view, so they cover the same share of the frame as they would of your vision:

![eye level](docs/preview-eye.png)

## Running it

The site lives in `public/`. Everything in it is static — HTML, CSS and ES modules,
with three.js vendored alongside. There is no build step and no network access at
runtime, but ES modules need to be served over HTTP (opening `index.html` from the
filesystem will not work):

```bash
python3 -m http.server 8000 -d public
# then open http://localhost:8000
```

## Deploying

Any static host works. Serve `public/` as the site root — the repository root holds
the README screenshots and licence, which do not belong on the CDN.

On **Cloudflare Pages**: framework preset *None*, build command empty, build output
directory `public`. `public/_headers` then applies the caching policy: the versioned
`vendor/three-0.160.1/` path is immutable for a year, while the app's own files
revalidate on every load so a deploy never leaves stale code in a browser cache.

## What you can change

| Control | Notes |
| --- | --- |
| Size from | diagonal + aspect ratio, or an exact width × height |
| Diagonal | 13″–65″, the usual flat-panel measurement |
| Aspect ratio | 4:3 through 32:9 |
| Width × height | the active image area in mm or inches, straight off a spec sheet |
| Curvature | flat, or a radius from 500R (extreme) to 4000R (gentle) |
| Resolution | drives the pixel-density readout |
| Bezel | 0–25 mm frame around the image area (the panel itself is modelled 1″ thick) |
| Placement | height above the desk, tilt |
| Desk | width 80–300 cm, height 55–110 cm, depth 45–100 cm |
| Person | standing height 140–210 cm, eye-to-screen distance |
| Monitors across | 1, 2 or 3, turned in towards each other by 0–60° |
| Outer monitors | landscape, or pivoted 90° to portrait |
| Monitor above | none, landscape or portrait, on a pole behind the row |
| Gap | 0–60 mm between panel bodies, horizontally and vertically |
| View | orbit, eye level, front, side, top |
| Guides | draws the field-of-view cone and the screen's arc |

Presets cover the common sizes (24″ 16:9 through 57″ 32:9) and the usual
arrangements — dual 34″ ultrawides, triple 27″, portrait wings, a stacked pair, and a
three-wide with one above. Settings live in the URL
hash, so **Copy shareable link** produces a link that restores the exact setup.

## The numbers it reports

* **Image area** — a diagonal *d* at aspect *w:h* gives width `d·w/√(w²+h²)` and
  height `d·h/√(w²+h²)`. A curved panel is quoted the same way, flattened, so that
  width is also the arc length of the curve. Entering a width and height directly
  skips that step and drives the same geometry, which is how you model a panel
  whose aspect ratio isn't in the list. Either way the figure is the *active image
  area*, and the bezel is added around it — type 598 mm and you get 598 mm of
  picture. Switching between the two modes carries the current size across, so
  the monitor on screen doesn't jump.
* **Curve depth (sagitta)** — for radius *R* the panel wraps through `θ = width/R`
  radians and its edges sit `R(1 − cos(θ/2))` closer to you than its centre.
* **Array span** — how wide the whole arrangement is, measured straight across the
  outermost image corners. Turning the panels in makes an array physically narrower
  while it covers *more* of your vision, because the edges come closer to you.
* **Field of view** — the angle the panels subtend from the seated eye position,
  measured to every panel's real edge position, so both a curve's forward wrap and a
  turned-in side panel are included.
  It is also reported as a share of the ~114° both eyes take in at once, which is
  the field the eye-level view renders: the camera stays at the eye, so a panel
  that overflows the frame is one that genuinely overflows your vision.
* **Pixel density** — pixels per inch across the flat diagonal, plus the dot pitch.
* **Eye vs. screen top** — how far the seated eye line falls above or below the top
  edge, the number that usually decides whether a monitor is mounted too low.
* **Desk clearance** — how much desk is left either side of the monitor, or how far
  it overhangs. A curved panel is measured across its chord, since that is the space
  it actually occupies, plus the bezel.

Seated proportions come from the usual anthropometric fractions of standing height
(seat height ≈ 0.25·H, seated eye height ≈ 0.455·H above the seat), so the figure's
eye line moves sensibly with the height slider.

## Layout

```
public/                     everything that gets deployed
  index.html                markup, control panel, import map
  styles.css                UI styling
  _headers                  Cloudflare Pages caching and security headers
  src/config.js             state, presets, screen maths, URL encoding
  src/rig.js                where each panel sits: the arrangement maths
  src/main.js               scene assembly, layout, camera views, render loop
  src/monitor.js            chassis / bezel / screen geometry, stands and poles
  src/person.js             seated mannequin and chair
  src/room.js               floor, walls and desk
  src/guides.js             field-of-view overlay lines
  src/screenTexture.js      procedurally drawn screen contents
  src/geometry.js           rounded-box helper
  vendor/three-0.160.1/     three.js r160 (MIT), vendored so the page needs no CDN
docs/                       README screenshots, not deployed
```

## Licence

Project code is MIT. Vendored three.js keeps its own MIT licence in
`public/vendor/three-0.160.1/LICENSE`.
