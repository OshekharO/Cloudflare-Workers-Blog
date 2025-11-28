# CF Workers Blog

A modern, serverless blog platform built with Cloudflare Workers and KV storage. Features remote theme support, Markdown editing, multi-admin support, and a clean responsive interface with **dark/light mode toggle**.

## ✨ New in Latest Update

- 🌓 **Dark/Light Mode Toggle** - System preference detection with manual toggle
- 🎨 **Font Awesome 6.5.1 Icons** - Modern, scalable vector icons
- 📱 **Enhanced Responsive Design** - Perfectly aligned components across all devices
- ✨ **Smooth Animations** - CSS transitions and keyframe animations
- 🎭 **Professional Color Scheme** - Modern gradient-based design language
- 🔧 **Bootstrap 5.3.3** - Latest Bootstrap version with improved components
- 💅 **Custom CSS Improvements** - Glass-morphism effects and modern styling

## Features

- 🚀 **Serverless** - Built on Cloudflare Workers edge computing
- 💾 **KV Storage** - Articles stored in Cloudflare KV
- 🎨 **Beautiful Themes** - Default, Minimal, Modern, Journal, Lux, MDB Pro, Chinese
- 📝 **Markdown Support** - Easy content creation with EasyMDE editor
- 🔐 **Multi-Admin Support** - Role-based admin management (superadmin/admin)
- 📱 **Responsive Design** - Mobile-first, perfectly aligned interface
- ⚡ **Fast** - Edge computing with global CDN
- 📊 **Export/Import** - Backup and migrate your content easily
- 📡 **RSS Feed** - Automatic RSS 2.0 feed generation
- 🗺️ **Sitemap** - SEO-friendly XML sitemap with image support
- 📚 **Draft Posts** - Save articles as drafts before publishing
- 🔖 **Bookmarks** - Client-side article bookmarking with localStorage
- 📤 **Social Sharing** - Share articles on Twitter/X, Facebook, LinkedIn
- 🌓 **Dark/Light Mode** - Theme toggle with system preference detection

## 🎨 UI/UX Improvements

### Theme Toggle
The blog now includes a beautiful dark/light mode toggle that:
- Detects system preference on first visit
- Remembers user preference in localStorage
- Features smooth 180° rotation animation on hover
- Persists across all pages

### Modern Design Elements
- **Glass-morphism cards** with backdrop blur effects
- **Gradient backgrounds** for visual depth
- **Smooth hover animations** on interactive elements
- **Professional typography** with Inter font family
- **Consistent spacing and alignment** across components

### Admin Dashboard
- **Modern sidebar navigation** with gradient background
- **Stats cards** with hover lift effects
- **Tabbed interface** for articles and drafts
- **Tool cards** with icon wrappers
- **Responsive table layouts** for user management

## Available Themes

| Theme | Description | Inspiration |
|-------|-------------|-------------|
| **default** | Modern Bootstrap-based theme with glass-morphism effects | Original design |
| **minimal** | Clean, lightweight Tailwind theme with subtle animations | Minimalist design |
| **modern** | Professional Bootstrap theme with Playfair Display typography | Magazine layouts |
| **journal** | Newspaper-style theme with clean serif typography | [Bootswatch Journal](https://bootswatch.com/journal/) |
| **lux** | Elegant, premium theme with uppercase headings and dark accents | [Bootswatch Lux](https://bootswatch.com/lux/) |
| **mdbpro** | Material Design theme using MDB UI Kit with gradient cards and modern dashboard | [MDB UI Kit](https://mdbootstrap.com/) |
| **chinese** | Traditional Chinese aesthetic with Bulma CSS, calligraphy fonts, and red/gold color scheme | Chinese calligraphy & traditional art |

Switch themes using URL parameter: `?theme=theme-name`

## Screenshot

![Screenshot_2025-10-12-21-58-19-42_40deb401b9ffe8e1df2f1cc5ba480b12](https://github.com/user-attachments/assets/82fe91bf-2a51-41d3-a876-ead0725244f7)
![Screenshot_2025-10-12-21-58-35-03_40deb401b9ffe8e1df2f1cc5ba480b12](https://github.com/user-attachments/assets/5260718c-bba7-4bc5-b79c-a96b24a47be9)
![Screenshot_2025-10-12-21-59-00-15_40deb401b9ffe8e1df2f1cc5ba480b12](https://github.com/user-attachments/assets/a612caef-40f9-423a-9e1d-0b0dcf5594d4)
![Screenshot_2025-10-12-21-59-29-20_40deb401b9ffe8e1df2f1cc5ba480b12](https://github.com/user-attachments/assets/22707b8e-a11b-4757-8217-a2dd5b6d92e0)

## Setup Instructions

### 1. Prerequisites

- Cloudflare account with Workers access
- Wrangler CLI installed (`npm install -g wrangler`)

### 2. Create KV Namespace

```bash
# Create production namespace
wrangler kv:namespace create "BLOG_STORE"

# Create preview namespace for development
wrangler kv:namespace create "BLOG_STORE" --preview
```

### 3. Configure Wrangler

Update `wrangler.toml` with your KV namespace IDs:

```toml
name = "cf-blog"
compatibility_date = "2024-04-01"

[[kv_namespaces]]
binding = "BLOG_STORE"
id = "your-production-namespace-id"
preview_id = "your-preview-namespace-id"
```

### 4. Deploy

```bash
# Login to Cloudflare
wrangler login

# Deploy to production
wrangler deploy
```

### 5. Configuration

Update the `OPT` object in `worker.js` with your settings:

```javascript
const OPT = {
    "user": "admin",                    // Default admin username
    "password": "admin",                // Default admin password
    "siteDomain": "your-domain.workers.dev",
    "siteName": "Your Blog Name",
    "siteDescription": "Your blog description",
    "themeURL": "https://raw.githubusercontent.com/yourusername/your-repo/main/themes/default/",
    // ... other options
};
```

## Project Structure

```
your-repo/
├── themes/
│   ├── default/
│   │   ├── index.html          # Homepage template
│   │   ├── article.html        # Article page template
│   │   ├── admin.html          # Admin dashboard template
│   │   ├── edit.html           # Article editor template
│   │   ├── admin-users.html    # Admin management template
│   │   ├── bookmarks.html      # Bookmarks page template
│   │   └── 404.html            # 404 error page template
│   └── theme1/                 # Additional themes
├── worker.js                   # Main worker script
└── wrangler.toml              # Wrangler configuration
```

## API Endpoints

### Article Management
- `GET /` - Blog homepage
- `GET /article/{permalink}` - Individual article page
- `GET /admin/` - Admin dashboard
- `GET /admin/edit` - Article editor
- `GET /admin/users` - Admin user management (superadmin only)
- `GET /api/articles` - Get all articles (JSON)
- `GET /api/articles?drafts=true` - Get draft articles
- `POST /api/articles` - Create new article
- `PUT /api/articles/{permalink}` - Update article
- `DELETE /api/articles/{permalink}` - Delete article

### Export/Import
- `GET /api/export` - Export all articles as JSON (admin only)
- `POST /api/import` - Import articles from JSON (admin only)

### Admin Management
- `GET /api/admins` - List all admins (superadmin only)
- `POST /api/admins` - Create new admin (superadmin only)
- `PUT /api/admins/{id}` - Update admin (superadmin only)
- `DELETE /api/admins/{id}` - Delete admin (superadmin only)

### SEO & Syndication
- `GET /rss.xml` - RSS feed for subscribers
- `GET /sitemap.xml` - XML sitemap for search engines
- `GET /api/categories` - Get all categories with counts

### Utilities
- `GET /bookmarks` - User bookmarks page
- `GET /api/debug` - Debug information
- `POST /api/fix-missing-articles` - Fix corrupted articles (admin only)

## Theme System

The blog supports remote themes from GitHub repositories. Create theme folders with these template files:

- `index.html` - Homepage
- `article.html` - Article page  
- `admin.html` - Admin dashboard
- `edit.html` - Article editor
- `admin-users.html` - Admin management
- `bookmarks.html` - Bookmarks page
- `404.html` - Error page

Switch themes using URL parameter: `?theme=theme-name`

## Template Variables

Available variables for theme templates:

- `{{siteName}}` - Blog name
- `{{siteDescription}}` - Blog description
- `{{title}}` - Article title
- `{{content}}` - Article content (Markdown)
- `{{createDate}}` - Article publish date
- `{{label}}` - Article category/label
- `{{img}}` - Featured image URL
- `{{copyRight}}` - Copyright text
- `{{codeBeforHead}}` - Custom head code
- `{{codeBeforBody}}` - Custom body code
- `{{action}}` - Editor action ("New" or "Edit")

## Multi-Admin System

### Admin Roles
- **Super Admin**: Full access including user management
- **Admin**: Content management only (create, edit, delete articles)

### Default Admin Account
- **Username**: `admin`
- **Password**: `admin`
- **Role**: `superadmin`

### Managing Admins
1. Log in as a superadmin
2. Visit `/admin/users`
3. Click "Add Admin" to create new admin accounts
4. Set appropriate roles and permissions

## Managing Articles

### Creating Articles
1. Visit `/admin/` and enter credentials
2. Click "New Article" to create content
3. Use the Markdown editor for content
4. Set permalink, title, label, and publish date
5. Choose status: "Published" or "Draft"
6. Save to publish or save as draft

### Draft Management
- Drafts are only visible in admin area
- Use the publish button to convert drafts to published articles
- Drafts are excluded from public site and RSS feeds

## Export/Import Features

### Export Articles
```bash
curl -u admin:password https://your-blog.com/api/export > backup.json
```

### Import Articles
```bash
curl -X POST -u admin:password -H "Content-Type: application/json" -d @backup.json https://your-blog.com/api/import
```

## SEO Features

### RSS Feed
- Available at `/rss.xml`
- Includes all published articles
- Proper RSS 2.0 format with enclosures

### Sitemap
- Available at `/sitemap.xml`
- Includes homepage and all published articles
- Image sitemap support for featured images

## User Features

### Bookmarks
- Client-side bookmarking using localStorage
- Access bookmarks at `/bookmarks`
- Bookmarks persist across browser sessions

### Social Sharing
- Share buttons on article pages
- Support for Twitter, Facebook, LinkedIn
- Copy link functionality

## Security Features

- Basic authentication for admin areas
- Role-based access control
- Safe admin operations (cannot delete self)
- Draft article protection
- Input sanitization and validation

## Browser Support

- Modern browsers with ES6+ support
- LocalStorage for bookmark functionality
- Clipboard API for social sharing

## Credits

This project is based on initial code from [gdtool/cloudflare-workers-blog](https://github.com/gdtool/cloudflare-workers-blog).

Special thanks to:
- [gdtool](https://github.com/gdtool) for the original implementation
- [Cloudflare](https://cloudflare.com) for Workers and KV storage
- [Bootstrap](https://getbootstrap.com) for UI framework (v5.3.3)
- [Font Awesome](https://fontawesome.com) for icons (v6.5.1)
- [Marked.js](https://marked.js.org) for Markdown parsing
- [EasyMDE](https://github.com/Ionaru/easy-markdown-editor) for Markdown editor
- [Highlight.js](https://highlightjs.org) for syntax highlighting

## 💡 Suggestions for Future Improvements

### Performance Enhancements
- [ ] Implement image lazy loading with blur placeholders
- [ ] Add service worker for offline support
- [ ] Implement article content caching with cache API
- [ ] Add prefetching for faster navigation

### Features to Consider
- [ ] Comment system integration (Disqus, Utterances, or custom)
- [ ] Search functionality with full-text search
- [ ] Tags/categories with tag cloud visualization
- [ ] Related articles suggestions
- [ ] Reading time estimation
- [ ] Table of contents for long articles
- [ ] Newsletter subscription integration
- [ ] Analytics dashboard for article views
- [ ] Scheduled publishing for articles
- [ ] Multi-language support (i18n)

### Admin Dashboard Improvements
- [ ] Drag-and-drop article reordering
- [ ] Bulk actions for articles (publish, delete, export)
- [ ] Media library for image management
- [ ] Article revision history
- [ ] Real-time collaboration (WebSocket-based)
- [ ] Dashboard analytics with charts
- [ ] Custom field support for articles

### Security Enhancements
- [ ] Two-factor authentication (2FA)
- [ ] Rate limiting for API endpoints
- [ ] CSRF token protection
- [ ] Content Security Policy headers
- [ ] Audit logging for admin actions

### SEO Improvements
- [ ] Open Graph meta tags for social sharing
- [ ] Twitter Cards support
- [ ] Structured data (JSON-LD) for articles
- [ ] Canonical URL management
- [ ] Breadcrumb navigation

### Developer Experience
- [ ] TypeScript migration for type safety
- [ ] Unit and integration tests
- [ ] CI/CD pipeline with GitHub Actions
- [ ] Documentation site with examples
- [ ] Theme customization GUI

## License

MIT License - feel free to use and modify for your projects.

## Support

For issues and questions:
1. Check the [original repository](https://github.com/gdtool/cloudflare-workers-blog)
2. Create an issue in this repository
3. Check Cloudflare Workers documentation

---

**Happy Blogging!** 🚀
