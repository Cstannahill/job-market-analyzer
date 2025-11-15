## Screenshot Responsiveness Audit

Below are issues observed while reviewing the automated screenshots for each page across the captured breakpoints. Each section calls out the breakpoint where the problem shows up and a fix that should only affect that narrow range (usually through targeted media queries or layout tweaks).

### Home (`/home`)

- **Breakpoint:** `360px` – the CTA buttons wrap into two rows and feel cramped, and the hero cards nearly touch the viewport edges.  
  **Fix:** add horizontal padding via a `@media (max-width: 400px)` rule and stack CTA buttons vertically with `gap` so tap targets remain large without affecting tablets/desktops.

### About (`/about`)

- **Breakpoint:** `360–412px` – large info sections (pipeline diagram + stack cards) shrink to unreadable widths; the vertical layout also becomes very long.  
  **Fix:** collapse each card’s two-column grids to single-column stacks below `480px`, increase internal padding, and consider accordions for “Stack” / “Data Principles” so content stays readable without impacting wider viewports.

### Top Tech (`/top-tech`)

- **Breakpoint:** `360px` – the leaderboard is full-width, but the outer gold border leaves little breathing room and the header nav overlaps the section title.  
  **Fix:** reduce border thickness/margins at `max-width: 400px`, and drop the nav shadow/height slightly in that range so it no longer collides with the card.

### Trends (`/trends`)

- **Breakpoint:** `360–412px` – the layout becomes a single extremely tall column; filter controls (region/period) push the first cards far down, and the “Top Co-occurring” chart text is tiny.  
  **Fix:** introduce collapsible sections for cards below `480px` (e.g., hide insights behind accordions), keep filter controls in a horizontal scrollable row, and bump chart font sizes with a mobile-specific style.

### Job Postings (`/postings`)

- **Breakpoint:** `360–412px` – every card renders full-width but with excessive vertical spacing; pagination controls stay fixed width causing horizontal scroll when locale strings grow.  
  **Fix:** tighten card padding and typography for mobile-only, convert the pagination controls into a full-width button group with `flex-wrap: wrap` below `480px`.

### Resumes Upload/Manage (`/resumes/upload`, `/resumes/manage`)

- **Breakpoint:** `360px` – the auth form fills the screen, but the top nav/logo bar takes ~25% of the viewport height.  
  **Fix:** collapse the nav into a compact icon-only header or hide secondary nav items below `420px` so the form remains above the fold; no changes needed for larger screens.

### Login / Register (`/login`, `/register`)

- **Breakpoint:** `360px` – same nav height issue as resumes pages plus the “Forgot password” / “Already have an account” links hug the edges.  
  **Fix:** reuse the compact nav treatment and add `padding-inline` on helper links inside a `@media (max-width: 400px)` block; desktop/tablet stay the same.

