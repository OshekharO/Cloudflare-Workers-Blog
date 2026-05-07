# CF Workers Blog

> A serverless blog platform built entirely on Cloudflare Workers and KV storage — no servers, no databases, no maintenance.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange?logo=cloudflare)](https://workers.cloudflare.com/)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3.3-purple?logo=bootstrap)](https://getbootstrap.com/)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Screenshots](#screenshots)
- [Available Themes](#available-themes)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Create KV Namespace](#create-kv-namespace)
  - [Configure Wrangler](#configure-wrangler)
  - [Deploy](#deploy)
  - [Configure the Worker](#configure-the-worker)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Theme System](#theme-system)
  - [Template Variables](#template-variables)
- [Admin Guide](#admin-guide)
  - [Roles & Permissions](#roles--permissions)
  - [Managing Articles](#managing-articles)
  - [Export & Import](#export--import)
- [SEO & Feeds](#seo--feeds)
- [Security](#security)
- [Credits](#credits)
- [License](#license)

---

## Overview

CF Workers Blog runs entirely at the edge. Every request is handled by a Cloudflare Worker — articles are stored in KV, themes are loaded from a remote GitHub repository, and there is nothing to provision or scale. It is designed to be deployed in minutes and customized without touching infrastructure.

---

## Features

| Category | Details |
|---|---|
| **Runtime** | Cloudflare Workers (edge computing, global CDN) |
| **Storage** | Cloudflare KV — persistent key-value store |
| **Editor** | EasyMDE — full Markdown editing experience |
| **Themes** | 1 built-in theme (nova); remote theme loading from any GitHub repository |
| **Admin** | Role-based multi-admin system (superadmin / admin) |
| **Content** | Published articles and drafts, category labels, featured images |
| **SEO** | RSS 2.0 feed, XML sitemap with image support, configurable robots.txt |
| **UI** | Dark/light mode toggle with system-preference detection |
| **Sharing** | Twitter/X, Facebook, LinkedIn, copy-link buttons |
| **Bookmarks** | Client-side bookmarking via `localStorage` |
| **Backup** | JSON export and import for full content portability |
| **Styling** | Bootstrap 5.3.3, Font Awesome 6.5.1, Inter typography |

---

## Screenshots

| Home | Article | Admin Dashboard | Editor |
|------|---------|-----------------|--------|
| ![Home](https://github.com/user-attachments/assets/82fe91bf-2a51-41d3-a876-ead0725244f7) | ![Article](https://github.com/user-attachments/assets/5260718c-bba7-4bc5-b79c-a96b24a47be9) | ![Admin](https://github.com/user-attachments/assets/a612caef-40f9-423a-9e1d-0b0dcf5594d4) | ![Editor](https://github.com/user-attachments/assets/22707b8e-a11b-4757-8217-a2dd5b6d92e0) |

---

## Available Themes

| Theme | Description |
|-------|-------------|
| `nova` | Modern, responsive theme with shimmer skeletons, dark/light mode, animated cards, and a magazine-style layout |
| `hong` | Chinese-inspired red and gold theme with warm paper tones, decorative hero panels, and festive high-contrast accents |

The theme is loaded remotely from the URL set in `OPT.themeURL`. You can switch to any self-hosted theme by appending `?theme=<theme-name>` to any URL (the worker will load it from `OPT.themeURL` with the theme name substituted):

```
https://your-blog.workers.dev/?theme=nova
```

> **Note:** The `?theme=` switcher resolves to a separate hosted repository. Set `OPT.themeURL` to point at your own theme repository for custom themes.

---

## Getting Started

### Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) with Workers access
- [Node.js](https://nodejs.org/) (LTS recommended)
- Wrangler CLI

```bash
npm install -g wrangler
```

---

### Create KV Namespace

```bash
# Production namespace
wrangler kv:namespace create "BLOG_STORE"

# Preview namespace for local development
wrangler kv:namespace create "BLOG_STORE" --preview
```

Both commands print a namespace ID. Copy them — you will need them in the next step.

---

### Configure Wrangler

Create a `wrangler.toml` file in the project root:

```toml
name            = "cf-blog"
main            = "worker.js"
compatibility_date = "2024-04-01"

[[kv_namespaces]]
binding    = "BLOG_STORE"
id         = "your-production-namespace-id"
preview_id = "your-preview-namespace-id"
```

---

### Deploy

```bash
# Authenticate with Cloudflare
wrangler login

# Publish the worker
wrangler deploy
```

---

### Configure the Worker

Open `worker.js` and update the `OPT` object near the top of the file:

```javascript
const OPT = {
    "user":            "admin",                          // Default superadmin username
    "password":        "your-secure-password",           // Default superadmin password
    "siteDomain":      "your-blog.workers.dev",          // Your worker domain
    "siteName":        "My Blog",                        // Blog title
    "siteDescription": "My personal blog on the edge",   // Meta description
    "keyWords":        "cloudflare,workers,blog",        // Meta keywords
    "pageSize":        10,                               // Articles per page
    "recentlySize":    6,                                // Recent posts in sidebar
    "readMoreLength":  150,                              // Excerpt length (characters)
    "cacheTime":       43200,                            // HTTP cache TTL in seconds
    "themeURL":        "https://raw.githubusercontent.com/OshekharO/Cloudflare-Workers-Blog/main/themes/nova/",
    "html404":         ``,                               // Custom 404 HTML (leave empty to use theme template)
    "copyRight":       "Powered by CF Workers Blog",
    "robots":          "User-agent: *\nDisallow: /admin",
    "codeBeforHead":   "",                               // Custom HTML injected into <head>
    "codeBeforBody":   "",                               // Custom HTML injected before </body>
    "commentCode":     "",                               // Comment system embed code
    "widgetOther":     "",                               // Extra sidebar widget HTML
    "draftPrefix":     "DRAFT_"                          // KV prefix for draft articles
};
```

> **Security note:** Change the default `password` before deploying to production. The default credentials (`admin` / `admin`) are intentionally simple for first-run setup only.

---

## Project Structure

```
Cloudflare-Workers-Blog/
├── themes/
│   └── nova/
│       ├── index.html        # Homepage template
│       ├── article.html      # Article page template
│       ├── admin.html        # Admin dashboard template
│       ├── edit.html         # Article editor template
│       ├── admin-users.html  # Admin user management template
│       ├── bookmarks.html    # Bookmarks page template
│       └── 404.html          # 404 error page template
├── Screenshot/               # Repository screenshots
├── worker.js                 # Single-file Cloudflare Worker (all backend logic)
└── LICENSE
```

The entire backend is contained in `worker.js`. Themes are HTML templates loaded remotely at runtime from the URL configured in `OPT.themeURL`.

---

## API Reference

All API endpoints require HTTP Basic Authentication unless otherwise noted.

### Pages (public)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Blog homepage |
| `GET` | `/article/{permalink}` | Single article page |
| `GET` | `/bookmarks` | Saved bookmarks page |
| `GET` | `/rss.xml` | RSS 2.0 feed |
| `GET` | `/sitemap.xml` | XML sitemap |
| `GET` | `/robots.txt` | Robots file |

### Admin Pages (auth required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/` | Admin dashboard |
| `GET` | `/admin/edit` | Article editor (create / update) |
| `GET` | `/admin/users` | Admin user management *(superadmin only)* |

### Articles API (auth required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/articles` | List all published articles |
| `GET` | `/api/articles?drafts=true` | List draft articles |
| `GET` | `/api/articles?paginate=true&page=1` | Paginated published articles |
| `GET` | `/api/articles/{permalink}` | Get a single article by permalink |
| `POST` | `/api/articles` | Create a new article |
| `PUT` | `/api/articles/{permalink}` | Update an existing article |
| `DELETE` | `/api/articles/{permalink}` | Delete an article |

### Admin Management API *(superadmin only)*

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admins` | List all admin accounts |
| `POST` | `/api/admins` | Create a new admin account |
| `PUT` | `/api/admins/{id}` | Update an admin account |
| `DELETE` | `/api/admins/{id}` | Delete an admin account |

### Utilities

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/categories` | Article counts per category |
| `POST` | `/api/generate-slug` | Generate a URL-safe slug from a title |
| `GET` | `/api/export` | Export all articles as JSON *(auth required)* |
| `POST` | `/api/import` | Import articles from JSON *(auth required)* |
| `GET` | `/api/debug` | Runtime debug information *(auth required)* |
| `POST` | `/api/fix-missing-articles` | Remove orphaned index entries whose article data no longer exists *(auth required)* |

---

## Theme System

Themes are plain HTML files hosted in a public GitHub repository. The worker fetches them on demand via the raw URL set in `OPT.themeURL`. You can host your own themes by forking this repository or creating a new one, then pointing `OPT.themeURL` at your fork.

### Required Template Files

Each theme directory must contain:

```
themes/<theme-name>/
├── index.html        # Homepage
├── article.html      # Article view
├── admin.html        # Admin dashboard
├── edit.html         # Article editor
├── admin-users.html  # Admin user management
├── bookmarks.html    # Bookmarks page
└── 404.html          # Not-found page
```

### Template Variables

The worker replaces the following placeholders before serving a page:

| Variable | Description |
|----------|-------------|
| `{{siteName}}` | Blog name |
| `{{siteDescription}}` | Blog meta description |
| `{{title}}` | Article title |
| `{{excerpt}}` | Plain-text article excerpt (used for meta descriptions) |
| `{{content}}` | Raw Markdown source (rendered client-side via Marked.js) |
| `{{createDate}}` | Article publish date |
| `{{label}}` | Article category / label |
| `{{img}}` | Featured image URL |
| `{{copyRight}}` | Copyright text |
| `{{commentCode}}` | Comment system embed code (raw HTML) |
| `{{widgetOther}}` | Extra sidebar widget HTML (raw HTML) |
| `{{codeBeforHead}}` | Custom HTML injected into `<head>` (raw HTML) |
| `{{codeBeforBody}}` | Custom HTML injected before `</body>` (raw HTML) |
| `{{action}}` | Editor context — `"New"` or `"Edit"` |
| `{{#img}}…{{/img}}` | Conditional block — rendered only when a featured image exists |

---

## Admin Guide

### Roles & Permissions

| Role | Permissions |
|------|-------------|
| `superadmin` | Full access: articles, drafts, admin user management |
| `admin` | Content access only: create, edit, and delete articles |

**Default credentials (change before going live):**

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin` |
| Role | `superadmin` |

To add more admins:
1. Log in as `superadmin` at `/admin/`
2. Navigate to `/admin/users`
3. Click **Add Admin**, fill in the form, and assign a role

---

### Managing Articles

**Create a new article:**
1. Go to `/admin/` and authenticate
2. Click **New Article**
3. Write content using the Markdown editor
4. Fill in the permalink, title, category label, and publish date
5. Set the status to **Published** or **Draft**
6. Click **Save**

**Drafts:**
- Drafts are only visible inside the admin dashboard
- Drafts do not appear in the public site, RSS feed, or sitemap
- Click **Publish** on a draft to make it public

---

### Export & Import

Export all articles to a JSON file:

```bash
curl -u admin:password https://your-blog.workers.dev/api/export > backup.json
```

Import articles from a previously exported file:

```bash
curl -X POST \
  -u admin:password \
  -H "Content-Type: application/json" \
  -d @backup.json \
  https://your-blog.workers.dev/api/import
```

---

## SEO & Feeds

| Feature | URL | Notes |
|---------|-----|-------|
| RSS Feed | `/rss.xml` | RSS 2.0, published articles only, with media enclosures |
| XML Sitemap | `/sitemap.xml` | Includes homepage, all published articles, and featured images |
| Robots.txt | `/robots.txt` | Configured via `OPT.robots` in `worker.js` |

---

## Security

- Admin routes are protected with HTTP Basic Authentication
- Superadmin-only routes enforce role checks on every request
- An admin account cannot delete its own account
- Draft articles are never exposed to unauthenticated requests
- All user input is sanitized before storage

---

## Credits

CF Workers Blog is a heavily extended fork of [gdtool/cloudflare-workers-blog](https://github.com/gdtool/cloudflare-workers-blog).

| Dependency | Purpose |
|-----------|---------|
| [Cloudflare Workers & KV](https://workers.cloudflare.com/) | Edge runtime and persistent storage |
| [Bootstrap 5.3.3](https://getbootstrap.com/) | UI framework |
| [Font Awesome 6.5.1](https://fontawesome.com/) | Icon library |
| [Marked.js](https://marked.js.org/) | Markdown-to-HTML rendering |
| [EasyMDE](https://github.com/Ionaru/easy-markdown-editor) | In-browser Markdown editor |
| [Highlight.js](https://highlightjs.org/) | Syntax highlighting for code blocks |

---

## License

This project is released under the [MIT License](LICENSE). You are free to use, modify, and distribute it for any purpose.
