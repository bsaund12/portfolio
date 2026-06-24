# portfolio

This repository contains a simple, static personal portfolio website for B.J. (Brian) Saunders. It is a lightweight dark-themed single-page site built with plain HTML, CSS, and a small JavaScript file for smooth scrolling and scroll-reveal effects.

## What this is

- A recruiter-friendly single-page portfolio that lists projects, experience, skills, and contact information.
- No frameworks or build process — just static files you can open locally or serve from GitHub Pages.

## Technologies used

- HTML5
- CSS3 (custom variables and responsive rules)
- Vanilla JavaScript (smooth scroll + IntersectionObserver reveal)

## Run locally

Easiest: open `index.html` in your browser.

From the command line (recommended so links and fetches behave like a web server):

```bash
# macOS / Linux - using Python 3
python3 -m http.server 8000

# then open http://localhost:8000 in your browser
```

## Deployment (GitHub Pages)

1. Commit and push this repository to GitHub (e.g. `main` branch).
2. In the repository settings on GitHub, open the "Pages" section.
3. Choose the branch `main` and the root `/` folder as the site source, then save.
4. GitHub will provide a URL like `https://<your-username>.github.io/<repo>/` where the site will be available.

Note: you can also use the `gh-pages` branch or GitHub Actions for more advanced deploy workflows, but for a static site the simple Pages configuration is sufficient.

## Notes and next steps

- The site is intentionally dependency-free. Consider adding per-project READMEs and links to live demos or GitHub repositories for stronger recruiter signal.
- The `script.js` file contains unobtrusive enhancements (smooth scroll, reveal). Ensure elements intended to animate have the `.reveal` class.

