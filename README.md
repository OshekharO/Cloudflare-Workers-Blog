# CF Workers Blog

A modern, serverless blog platform built with Cloudflare Workers and KV storage. Features remote theme support, Markdown editing, and a clean admin interface.

## Features

- 🚀 **Serverless** - Built on Cloudflare Workers
- 💾 **KV Storage** - Articles stored in Cloudflare KV
- 🎨 **Remote Themes** - Fetch themes from GitHub repositories
- 📝 **Markdown Support** - Easy content creation with Markdown
- 🔐 **Admin Panel** - Secure content management
- 📱 **Responsive** - Modern Bootstrap 5 design
- ⚡ **Fast** - Edge computing with global CDN

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
    "user": "admin",                    // Admin username
    "password": "your-secure-password", // Admin password
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
│   │   ├── index.html      # Homepage template
│   │   ├── article.html    # Article page template
│   │   ├── admin.html      # Admin dashboard template
│   │   ├── edit.html       # Article editor template
│   │   └── 404.html        # 404 error page template
│   └── theme1/             # Additional themes
├── worker.js               # Main worker script
└── wrangler.toml          # Wrangler configuration
```

## API Endpoints

- `GET /` - Blog homepage
- `GET /article/{permalink}` - Individual article page
- `GET /admin/` - Admin dashboard (password protected)
- `GET /admin/edit` - Article editor
- `GET /api/articles` - Get all articles (JSON)
- `POST /api/articles` - Create new article
- `PUT /api/articles/{permalink}` - Update article
- `DELETE /api/articles/{permalink}` - Delete article

## Theme System

The blog supports remote themes from GitHub repositories. Create theme folders with these template files:

- `index.html` - Homepage
- `article.html` - Article page  
- `admin.html` - Admin dashboard
- `edit.html` - Article editor
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

## Managing Articles

1. Visit `/admin/` and enter credentials
2. Click "New Article" to create content
3. Use the Markdown editor for content
4. Set permalink, title, label, and publish date
5. Save to publish immediately

## Credits

This project is based on initial code from [gdtool/cloudflare-workers-blog](https://github.com/gdtool/cloudflare-workers-blog).

Special thanks to:
- [gdtool](https://github.com/gdtool) for the original implementation
- [Cloudflare](https://cloudflare.com) for Workers and KV storage
- [Bootstrap](https://getbootstrap.com) for UI components
- [Marked.js](https://marked.js.org) for Markdown parsing

## License

MIT License - feel free to use and modify for your projects.

## Support

For issues and questions:
1. Check the [original repository](https://github.com/gdtool/cloudflare-workers-blog)
2. Create an issue in this repository
3. Check Cloudflare Workers documentation

---

**Happy Blogging!** 🚀
