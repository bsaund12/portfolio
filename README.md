# portfolio

**Live:** https://bjsaunders.com

An implementation of the [Cloud Resume Challenge](https://cloudresumechallenge.dev/):
a static personal portfolio site for B.J. (Brian) Saunders, backed by a serverless
visitor counter. Dark-themed single-page site built with plain HTML, CSS, and a
small JavaScript file for smooth scrolling, scroll-reveal effects, and the counter.

## What this is

- A recruiter-friendly single-page portfolio that lists projects, experience, skills, and contact information.
- The homepage footer shows a live visitor count, served by a small AWS backend.
- No frontend frameworks or build process, just static files.

## Architecture

- **Frontend:** static site in S3, served through CloudFront, with Route 53 for DNS
  and ACM for TLS. Provisioned manually in the console, before Terraform was
  introduced.
- **Visitor counter:** API Gateway (HTTP API) → Lambda → DynamoDB, incrementing an
  atomic counter on each page load.
- **Backend infrastructure is fully Terraform-managed** : see
  [backend/README.md](backend/README.md) for the architecture detail, IAM model,
  deploy commands, and Terraform variables.
- **Deploys are automated** via GitHub Actions on push to `main` — see
  [terraform/README.md](terraform/README.md) for what's automated vs. manual.

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

Note: the visitor counter will not work locally, the API's CORS allowlist only
permits the live domain, so requests from `localhost` or a `file://` origin are
rejected. Everything else on the page works fine locally.

## Notes and next steps

- The site is intentionally dependency-free on the frontend. Consider adding
  per-project READMEs and links to live demos or GitHub repositories for stronger
  recruiter signal.
- The `script.js` file contains unobtrusive enhancements (smooth scroll, reveal).
  Ensure elements intended to animate have the `.reveal` class.

For backend architecture, infrastructure-as-code, and deployment, see
[backend/README.md](backend/README.md).
