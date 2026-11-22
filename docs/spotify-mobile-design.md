# Spotify mobile design reference

A reference for making Song Game look and feel like Spotify on a phone. It records what was
measured, what Spotify officially requires, and where this app differs today.

Date of measurements: 20 November 2026.

## How to read this document

Every value is tagged with where it came from, so you can tell fact from guess.

| Tag | Meaning |
| --- | --- |
| **[M]** | Measured from Spotify's phone layout at `open.spotify.com` (375 x 812 viewport, mobile user agent), using computed CSS values. |
| **[O]** | Stated in Spotify's official design guidelines (`developer.spotify.com/documentation/design`). |
| **[R]** | Recalled from the native iOS/Android app. Not verified, so treat as a hypothesis. |
| **[?]** | Not known. Needs a screenshot or measurement of the native app. |

**Limits of this reference.** The measurements come from Spotify's mobile *web* player, which is
close to the native app but not identical. Signed-in screens (Home, Library, Now Playing, menus,
filter chips) are not available without an account, so anything about them is **[R]** or **[?]**.
If something in the app looks wrong next to the real Spotify app, a screenshot of that screen is
the fastest way to correct this document.

## 1. Principles

1. **Content first, chrome last.** Spotify's phone screens have almost no boxes or borders.
   Lists sit directly on the black background. There are no card backgrounds around rows. **[M]**
2. **Left-aligned.** Titles, section headings and list text start at the left gutter. **[M]**
3. **Two kinds of rounding.** Buttons, icon buttons and chips are fully round (pills or circles).
   Everything else (artwork, inputs, tiles) has small corners of 4 to 6px. **[M]**
4. **Big, bold, simple type.** One typeface, two weights in practice (400 and 700), few sizes. **[M]**
5. **Thumb-sized controls.** Icon buttons are 48px; the main play button is 56px. **[M]**
6. **Colour is restrained.** Greys on black, white text, and green only for the main media action. **[M][O]**

## 2. Colour

| Token | Value | Use | Source |
| --- | --- | --- | --- |
| `background` | `#121212` | Page background | [M][O] |
| `surface` | `#1f1f1f` | Raised surfaces (library cards, secondary buttons on dark) | [M] |
| `surface-art` | `#282828` | Placeholder behind artwork before it loads | [M] |
| `text` | `#ffffff` | Titles, primary text | [M] |
| `text-subdued` | `#b3b3b3` | Artist names, subtitles, inactive icons and tab labels | [M] |
| `accent` (Spotify Green) | `#1ed760` | Play button, primary media actions | [M][O] |
| `on-accent` | `#000000` | Icons and text on green | [M] |
| `search-bar` | `#ffffff` on `#000000` text | Search field | [M] |
| `link-blue` | `#9e9eff` | Inline text links | [M] |
| `fallback-playback` | `#191414` | Background for playback views when artwork colour can't be extracted | [O] |
| `grey-brand` | `#7f7f7f` | Grey used in the brand palette graphic | [O] |

Rules:

- Use only the brand palette and do not introduce new colours. Use high-contrast pairings. **[O]**
- The screen header takes a gradient tinted from the playlist's artwork colour, fading to
  `#121212`. **[M]** (We have no artwork colour extraction, so a plain `#121212` header is fine.)
- The bottom tab bar background is a vertical gradient from about 70% to 90% black, so content
  scrolls underneath it. **[M]**

## 3. Typography

| Role | Size / weight | Colour | Where | Source |
| --- | --- | --- | --- | --- |
| Screen title (h1) | 24px / 700 | white | "Search", playlist title | [M] |
| Section heading (h2) | 16px / 700 | white | "Browse all" | [M] |
| Row title | 16px / 400 | white | Track name | [M] |
| Secondary text | 13px / 400 | `#b3b3b3` | Artist, playlist description | [M] |
| Large button label | 16px / 700 | black or white | "Log in", "Sign up for free" | [M] |
| Small button label | 13px / 700 | black or white | "Open App", "Create playlist" | [M] |
| Tab bar label | 11px / 400 | `#b3b3b3` (active: white) | Home, Search, Your Library | [M] |

- Line height is the browser default (`normal`). **[M]**
- Spotify's own pages use their custom typeface (`SpotifyMixUI`). The official guidelines tell
  third-party apps to use the platform's default sans-serif, falling back to Helvetica Neue,
  Helvetica, then Arial. **[M][O]**
- Titles and metadata must not be altered. Truncating is only allowed if the full text can still be
  read. Layouts should fit at least 23 characters of track name, 18 of artist name and 25 of
  playlist or album name. **[O]**

## 4. Spacing and sizing

| Thing | Value | Source |
| --- | --- | --- |
| Page gutter (left and right) | 16px | [M] |
| Base unit | 4px, mostly multiples of 8 | [M] |
| Track row artwork | 48 x 48px | [M] |
| Gap between artwork and text | 12px | [M] |
| Gap between the title line and the artist line | 2px | [M] |
| Row height | 64px (one-line artist) to 70px (two-line artist) | [M] |
| Icon button | 48 x 48px, 24px icon | [M] |
| Play button | 56 x 56px circle | [M] |
| Search bar height | 44px | [M] |
| Bottom tab bar height | 70px | [M] |
| Grid tile | 164 x 92px, 8px padding | [M] |
| Gap between grid tiles | 16px | [M] |
| Hero artwork on a playlist page | 150 x 150px, centred | [M] |

## 5. Shape

| Element | Radius | Source |
| --- | --- | --- |
| Buttons, icon buttons, chips | fully round (`9999px`) | [M] |
| Play button | circle | [M] |
| Search bar | 4px | [M] |
| Grid tiles | 6px | [M] |
| Track artwork | 4px | [M][O] |
| Playlist hero artwork | 0px (square) | [M] |
| Dialogs and bottom sheets | [?] larger top corners, about 12px or more | [R] |

Official artwork rules **[O]**:

- 4px corners on small and medium devices, 8px on large devices.
- Do not crop, blur, distort, animate, overlay or place controls or logos on artwork.
- Artwork may be left out when space is tight.

## 6. Components

### 6.1 Buttons

| Kind | Look | Source |
| --- | --- | --- |
| Primary media action ("Play") | 56px green circle (`#1ed760`), black 24px icon | [M] |
| Text call to action, large | White pill, black bold 16px text, 48px high, padding `8px 32px` | [M] |
| Text call to action, small | White pill, black bold 13px text, 32px high, padding `4px 16px` | [M] |
| Outlined / quiet pill | Transparent, 1px grey border (`#7c7c7c`), white bold 13px text, 32px high | [M] |
| Icon button | Transparent, 48px circle, 24px `#b3b3b3` icon | [M] |
| Icon button on a surface | 48px circle, `#1f1f1f` background | [M] |

Takeaway: on Spotify's phone layout, the green fill is reserved for playing music. Ordinary text
buttons are **white pills**, not green ones. **[M]**

### 6.2 Search bar

White background, black text, 44px high, 4px corners, 16px horizontal padding, magnifier icon at
the left inside the bar, placeholder "What do you want to listen to?". Tapping it opens the search
screen. **[M]** The placeholder grey is **[?]**.

### 6.3 Track row

```
[ 48px art, 4px ] 12px [ Title         16px white ] [ ⋮ 24px icon ]
                       [ Artist, Artist 13px grey ]
```

- No background, no border, no divider. The row sits directly on the page. **[M]**
- Art on the left, title above artist, a three-dot "more" icon on the right. **[M]**
- Explicit tracks show a small grey "E" badge before the artist line. **[M][R]**

### 6.4 Grid tiles ("Browse all")

Two columns, 16px gutters and gap, 6px corners, a solid category colour, the label in bold white at
the top left, and rotated artwork tucked into the bottom right corner. **[M]**

### 6.5 Bottom tab bar

Four equal tabs (Home, Search, Your Library, Premium), each with a 24px icon above an 11px label.
Active tab is white; inactive is `#b3b3b3`. The bar is 70px tall with the gradient described above,
and the page has 70px of bottom padding so nothing hides behind it. **[M]**

### 6.6 Filter chips

**[?]** They only appear when signed in. From memory of the native app **[R]**: a row of pills,
32px high, dark grey (`#2a2a2a`) when off and green with black text when on, scrolling sideways.

### 6.7 Dialogs and menus

**[R]** In the native app, menus and confirmations rise from the bottom as a sheet with rounded top
corners, a dark grey surface, a drag handle and large tappable rows. Destructive confirmations use
a centred dialog with two stacked pill buttons. **[?]** exact radius, colours and heights.

## 7. Spotify's required rules for apps like this one **[O]**

These come from the official guidelines and apply to a game that shows Spotify search results.

- **Attribution.** Spotify metadata (track, artist and album names, artwork) must be accompanied by
  the Spotify logo. In partner integrations that means the full logo (icon plus wordmark), at least
  70px wide digitally, with an exclusion zone of half the icon's height. The icon alone must be at
  least 21px. Never place the logo on artwork or on a busy or low-contrast background.
- **Links back.** Link with the text "OPEN SPOTIFY", "PLAY ON SPOTIFY" or "LISTEN ON SPOTIFY" when the
  app is installed, or "GET SPOTIFY FREE" when it is not.
- **Naming and branding.** The app's name must not include "Spotify" or look or sound similar to it,
  and its logo must not resemble Spotify's logo, its green, its circle or its sound waves.
- **Artwork.** Use only the artwork Spotify supplies, uncropped and unmodified, with the corners above.
- **Lists.** Show no more than 20 items in a content set, and link to the Spotify app at the end of
  each set.
- **Colours.** Use the brand palette only.

## 8. Where this app differs today

State of the app at the time of writing, compared with the measurements above.

| Area | Spotify (phone) | Song Game now | Gap |
| --- | --- | --- | --- |
| Lists | Flat rows on the page, 48px art, 64px+ rows | Rows sit on `#2a2a2a` bars inside a `#1f1f1f` card | Large |
| Row actions | Three-dot icon on the right | Round white "X" remove button | Medium |
| Screen titles | 24px bold, left, no box | No title; a header card with logo and "The host is ..." | Large |
| Section headings | 16px bold, left | Bold 16px, left, inside cards | Small |
| Main buttons | White pills (large 48px, small 32px) | Green pills 44px, and white pills for secondary | Medium |
| Play / primary media | 56px green circle | No equivalent | n/a |
| Search field | White, 44px, 4px, magnifier inside, no extra button | White, 44px, 4px, separate round green search button | Medium |
| Filter chips | 32px pills, green when on [R] | 44px pills, green when on | Small |
| Dialogs | Bottom sheets [R] | Centred dialogs | Large (previously rejected) |
| Navigation | Bottom tab bar | None | n/a for a two-screen game |
| Artwork | 4px, never cropped | 4px but `object-fit: cover` crops it | Small, and against the rules |
| Logo and links | Spotify logo near Spotify content; "Open Spotify" links | No Spotify logo; "Link to Spotify" button | Compliance gap |
| App logo | Must not resemble Spotify's | Green circle with glassware icons | Needs a review |
| Page gutter | 16px | 16px | None |

## 9. Suggested order of work

1. **Lists.** Remove card and row backgrounds on the game screen and the search results, use 48px
   art, a 12px gap, a two-line title and artist block, and a three-dot (or remove) icon button.
2. **Titles.** Give each screen a 24px bold left-aligned title; drop the header card.
3. **Buttons.** Make text buttons white pills with black bold labels, sized 48px (large) and 32px
   (small). Keep green for one primary media-style action per screen.
4. **Search field.** Put the magnifier inside the field and remove the separate green button.
5. **Artwork.** Stop cropping album art, and keep it at 4px corners.
6. **Compliance.** Add the Spotify logo with attribution, change the playlist link text to
   "Open Spotify" or "Play on Spotify", and have the app logo reviewed against the branding rules.
7. **Dialogs.** Decide whether to move to bottom sheets (a layout change) once the rest is done.

## 10. Reference values as SCSS

```scss
$background: #121212;
$surface: #1f1f1f;
$text: #ffffff;
$text-subdued: #b3b3b3;
$accent: #1ed760;
$on-accent: #000000;

$gutter: 16px;
$art-size: 48px;
$icon-button: 48px;
$play-button: 56px;
$search-height: 44px;

$radius-art: 4px;
$radius-search: 4px;
$radius-tile: 6px;
$radius-pill: 9999px;
```

## 11. Sources

- Spotify, Design guidelines for developers: <https://developer.spotify.com/documentation/design>
- Spotify's palette graphic linked from that page: <https://developer-assets.spotifycdn.com/images/guidelines/design/colors.svg>
- Measurements: computed styles read from `open.spotify.com` search and a public playlist page at a
  375 x 812 mobile viewport (logged out), 20 November 2026.
