# Sprint 19 - Admin UI Modernization

- Project: `SONA_SPACE-Server` (EJS admin at `http://localhost:3501`)
- Sprint type: UI/UX upgrade of the admin dashboard
- Current status: Implemented locally, waiting for owner review (not committed)
- Source docs:
  - `views/layouts/dashboard.ejs`, `views/layouts/main.ejs`
  - `views/dashboard/**` (49 page views)
  - `public/scss/style.scss` and `public/scss/imports/**` (compiled to `public/scss/style.css`)
  - Client Sprint 06: `../SONA_SPACE-Client/docs/sprints/sprint-06-ui-modernization-motion-depth.md` (owner feedback on colors and logo)
- Mockup page (local only, not committed): `public/__mockups/admin-concepts.html`

## 1. Sprint Goal

Make the admin consistent, usable on laptop and phone widths, and visually in line with the client
without changing the existing palette: one page shell, one table pattern, one form pattern, one set of
buttons and status badges, and no fake controls.

## 2. Current Baseline (measured 2026-10-14)

Playwright, logged in with the local review admin, 21 routes at 1440x900 (DPR 1.5) and 390x844 (DPR 2).
Raw data: session scratchpad `admin/admin_audit.json` and screenshots.

| Area | Finding | Evidence |
|---|---|---|
| Shell | Brand is the text "sona space", not the logo | sidebar screenshot |
| Shell | Header shows the template text "Dashboards / Default" on every page | all 21 routes |
| Shell | Sun and history icons in the header have no handler (`div.theme-toggle`, `div.history-button`) | `views/layouts/dashboard.ejs:227-232` |
| Shell | Sidebar has 9 sections, 6 of them with one or two items; 20 links in one long list | layout |
| Mobile | Every route overflows horizontally at 390px (240 to 1.390px); the sidebar stays a 220px icon column | `overX` for all `m` rows |
| Tables | Page-level horizontal scroll at 1440px on orders (183px), products (340), material (163), users (104), comment (108); the header's account menu is pushed off screen | `overX` for `d` rows |
| Tables | Material descriptions are clipped mid-word | `clipped` on `/dashboard/material` |
| Tables | Empty voucher table shows only its header row | voucher screenshot |
| Consistency | Primary action is green on lists ("Thêm ..."), yellow on the product form, blue on login | screenshots |
| Consistency | KPI cards: white on overview, grey with shadow on orders; numbers colored green and yellow without meaning | overview vs orders |
| Consistency | English data labels next to Vietnamese ("pending", "cod", "Search", "Email Address") | orders, products, login |
| Headings | Only `/dashboard/orders` has an `<h1>`; other page titles are not headings | `h1` column |
| Errors | `/dashboard/orders`: `Cannot read properties of undefined (reading 'createContext')`; `/dashboard/colors`: `Cannot read properties of null (reading 'addEventListener')` | page errors |
| Data | Broken images: category/room/event Cloudinary URLs return 404; news categories render `src="null"` | `broken` column |
| Fonts | Be Vietnam (`Be-*`) for text; Montserrat (`M-*`) only on login; Bootstrap's system font leaks into some controls | font census |

Palette in `public/scss/imports/core/_variables.scss` (kept as is): `$white-cl`, `$snow-white-cl #FCFCFC`,
`$dark-cl #221D00`, `$yellow-cl #F0A00A`, `$success-cl #3AA655`, `$error-cl #D83B01`, `$warning-cl #F5B400`,
`$info-cl #0078D7`, grays.

## 3. In Scope (pending concept choice)

- [ ] A1 Shell: logo, sidebar grouping, real page title and breadcrumb, header actions, mobile drawer.
- [ ] A2 Overview: KPI cards, revenue chart area, recent orders.
- [ ] A3 List pages: one table pattern (toolbar, search, filters, sticky header, horizontal scroll inside the card, row actions, status badges, empty state, pagination) applied to every list view.
- [ ] A4 Forms: one form pattern (sections, labels, help text, upload zone, sticky save bar) applied to add/edit views.
- [ ] A5 Login: align with the palette and the client typography.
- [ ] A6 Buttons and badges: one primary color, one destructive color, Vietnamese status labels.
- [ ] Fix the two page errors and the `src="null"` image; report Cloudinary 404s as a data issue.

## 4. Out of Scope

- Route, API or database changes beyond what a page needs to render.
- Changing palette colors or the white surfaces of sidebar and header (offered only as an option in the mockup).
- Replacing Bootstrap or the EJS stack.

## 5. Owner Decisions (2026-10-14)

| Item | Decision |
|---|---|
| A1 Shell | S1 light grouped sidebar |
| A2 Overview | O2 compact KPI strip + "to handle" list |
| A3 Lists | T1 card table with toolbar |
| A4 Forms | F1 two columns with a sticky save bar |
| A5 Login | L1 interior photo + form |
| A6 Buttons and badges | Shared kit; primary color not named, P1 yellow used (the color already used most) |

Not built from the mockup: the global "Tìm đơn hàng, sản phẩm" box needs a search API that does not exist; it is left out.

### Phases

- [x] P1 Shell: `views/layouts/dashboard.ejs`, `public/javascripts/dashboard.js`, `core/_dashboard.scss`
- [x] P2 Shared kit: `core/_adminKit.scss` (page header, buttons, badges, cards, tables, toolbar, empty state, pagination, forms, save bar); page titles become `<h1>`
- [x] P3 Overview (O2): `views/dashboard/index.ejs`
- [x] P4 Forms (F1): add/edit views, sticky save bar
- [x] P5 Login (L1): `views/layouts/main.ejs`, `pages/_login.scss`
- [x] P6 Bugs: orders `createContext`, colors `addEventListener` on `null`, news category `src="null"`, `profile.ejs` and `settings.ejs` saved as ISO-8859
- [x] P7 Verification: 21-route audit at 1440/390, screenshots, one CRUD click-through per touched entity

## 6. Verification Plan

- Re-run the 21-route audit at 1440 and 390: zero page-level horizontal overflow, one `<h1>` per page, no page errors.
- Screenshot every changed view at 1440, 1024 and 390; logo checked at DPR 1, 1.5 and 2.
- Click through one create, edit, hide and delete flow per entity type touched.

## 7. Blockers

| Date | Blocker | Owner |
|---|---|---|
| 2026-10-14 | Cloudinary images for some categories, rooms and events return 404 | Data / Cloudinary |

## 8. Implementation Evidence (2026-10-14)

What changed:

- Shell: logo, 4 menu groups (Bán hàng, Sản phẩm, Nội dung, Hệ thống), pending-order count from `GET /api/orders/status/count`, breadcrumb and tab title built from the active menu item (`public/javascripts/dashboard.js`), account menu in the sidebar footer with initials instead of a third-party stock photo, drawer below 992px. Removed the decorative sun and history icons.
- Shared kit `public/scss/imports/core/_adminKit.scss`, imported last: page header, buttons (yellow primary, ghost, red destructive), toolbar, table card that scrolls inside itself, status badges, row actions, pagination, empty/loading table state (driven by a fetch counter in `dashboard.js`), phone tables stacked into labelled cards, form sections, sticky save bar, two-column forms that stack below 992px, error page.
- 43 page titles are `<h1>`; wrong titles fixed (kiểu thông báo, danh mục tin, yêu cầu thiết kế).
- Overview (O2): KPI strip, "Cần xử lý" list (pending orders, orders in shipping, new design requests via `GET /api/contact-form-design?status=NEW`), charts in palette colors and full width.
- Login (L1): portrait interior photo (`public/images/login-hero.jpg`, 1122x1402, shown at 0.87 source px per device px at DPR 1.5), labelled fields, scoped styles. The old login CSS styled `.container-fluid` globally and stretched the orders page; it is now scoped to `.login-page`.
- Orders: removed `antd.min.js` (loaded without React, threw `createContext`; every use already had a fallback), removed a fake date range, a fake "6 of 500" count and a fake static pager (the endpoint returns all orders); payment status and method labels normalized, which also fixes the payment-method filter that never matched lowercase `cod`.
- Colors: `#statusFilter` did not exist, so the page script stopped at load and the search box threw on every key; search works again.
- Fake date ranges removed from banners, news, news categories, design requests; English placeholders and upload hints translated; users list shows its real count.
- `profile.ejs` and `settings.ejs` were ISO-8859 with letters already lost to "?"; rewritten in UTF-8, profile shows the signed-in account.
- `error.ejs` rendered inside the login layout (no body slot); it now has `views/layouts/error.ejs`.
- `npm run build:css` (sass 1.89.1, devDependency) rebuilds `public/scss/style.css`; the committed CSS matched a fresh compile except autoprefixer output.

Verification on the final tree:

- Playwright, admin review account, 33 routes (21 lists/pages + 12 add forms) at 1440x900 DPR 1.5 and 390x844 DPR 2: 0 page-level horizontal overflow, exactly one `<h1>` each, 0 page errors, 0 clipped cells. Remaining 404s are missing images in data (categories, rooms, events, one local product image).
- Click-through: login; create color "Màu kiểm thử UI" -> listed as "Hiển thị" -> hide -> "Ẩn" -> delete -> gone (test data removed); account menu -> profile shows email and role -> sign out; phone drawer -> "Sản phẩm" navigates and closes. No page errors, no native dialogs.
- `node --check public/javascripts/dashboard.js`, `require('./app')` loads, `GET /health` 200.

Open:

- Cloudinary 404 images are data, not UI.
- `views/dashboard/comment/add.ejs` and `edit.ejs` are copies of the material form (they post to `/api/materials`) and nothing links to them.
- The global search box from the mockup needs a search API; not built.
- The confirm popup uses the same yellow button for hide and delete; a red delete button needs the page scripts to say which action it is.

