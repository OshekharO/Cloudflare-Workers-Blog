'use strict';

const OPT = {
    "user": "admin",
    "password": "admin",
    "siteDomain": "blog.oshekher.workers.dev",
    "siteName": "CF Workers Blog",
    "siteDescription": "A Blog Powered By Cloudflare Workers and KV",
    "keyWords": "cloudflare,KV,workers,blog",
    "pageSize": 5,
    "recentlySize": 6,
    "readMoreLength": 150,
    "cacheTime": 60 * 60 * 24 * 0.5,
    "themeURL": "https://raw.githubusercontent.com/OshekharO/CF-BLOG/main/themes/default/",
    "html404": `<div class="container text-center mt-5"><h1>404</h1><p>Page not found</p></div>`,
    "codeBeforHead": ``,
    "codeBeforBody": ``,
    "commentCode": ``,
    "widgetOther": ``,
    "copyRight": `Powered by CF Workers`,
    "robots": `User-agent: *\nDisallow: /admin`
};

class Blog {
    constructor() {
        this.kv = null;
        this.themeCache = new Map();
    }

    setKV(kv) {
        this.kv = kv;
    }

    async get(key, parse = false) {
        const value = await this.kv.get(key);
        if (!parse) return value;
        try {
            return value ? JSON.parse(value) : [];
        } catch {
            return [];
        }
    }

    async put(key, value) {
        if (typeof value === 'object') {
            value = JSON.stringify(value);
        }
        await this.kv.put(key, value);
    }

    async delete(key) {
        await this.kv.delete(key);
    }

    async listArticles() {
        return await this.get('SYSTEM_INDEX_LIST', true);
    }

    async getArticle(id) {
        return await this.get(id, true);
    }

    async saveArticle(article) {
        if (!article.id) {
            const currentNum = parseInt(await this.get('SYSTEM_INDEX_NUM')) || 0;
            article.id = (currentNum + 1).toString().padStart(6, '0');
            await this.put('SYSTEM_INDEX_NUM', (currentNum + 1).toString());
        }

        article.contentMarkdown = article.content;
        const plainText = this.stripMarkdown(article.content);
        article.excerpt = plainText.substring(0, OPT.readMoreLength) + (plainText.length > OPT.readMoreLength ? '...' : '');
        await this.put(article.id, article);
        const index = await this.listArticles();
        const existingIndex = index.findIndex(item => item.id === article.id);
        
        const indexItem = {
            id: article.id,
            title: article.title,
            img: article.img,
            permalink: article.permalink,
            createDate: article.createDate,
            label: article.label,
            excerpt: article.excerpt
        };

        if (existingIndex >= 0) {
            index[existingIndex] = indexItem;
        } else {
            index.unshift(indexItem);
        }

        index.sort((a, b) => new Date(b.createDate) - new Date(a.createDate));
        await this.put('SYSTEM_INDEX_LIST', index);

        return article.id;
    }

    async deleteArticle(id) {
        await this.delete(id);
        const index = await this.listArticles();
        const filtered = index.filter(item => item.id !== id);
        await this.put('SYSTEM_INDEX_LIST', filtered);
    }

    async fetchThemeTemplate(templateName) {
        const cacheKey = `${OPT.themeURL}${templateName}`;
        
        if (this.themeCache.has(cacheKey)) {
            return this.themeCache.get(cacheKey);
        }

        const response = await fetch(`${OPT.themeURL}${templateName}.html`, {
            cf: {
                cacheTtl: 300
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch template: ${templateName}`);
        }
        
        const template = await response.text();
        this.themeCache.set(cacheKey, template);
        return template;
    }

    stripMarkdown(markdown) {
        if (!markdown) return '';
        let plainText = markdown;
        plainText = plainText.replace(/```[\s\S]*?```/g, '');
        plainText = plainText.replace(/`([^`]+)`/g, '$1');
        plainText = plainText.replace(/^#{1,6}\s+/gm, '');
        plainText = plainText.replace(/^[-*_]{3,}\s*$/gm, '');
        plainText = plainText.replace(/^\s*>+/gm, '');
        plainText = plainText.replace(/(\*\*|__)(.*?)\1/g, '$2');
        plainText = plainText.replace(/(\*|_)(.*?)\1/g, '$2');
        plainText = plainText.replace(/~~(.*?)~~/g, '$1');
        plainText = plainText.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
        plainText = plainText.replace(/!\[([^\]]+)\]\([^)]+\)/g, '$1');
        plainText = plainText.replace(/\[([^\]]+)\]\[.*?\]/g, '$1');
        plainText = plainText.replace(/^\s*[-*+]\s+/gm, '');
        plainText = plainText.replace(/^\s*\d+\.\s+/gm, '');
        plainText = plainText.replace(/\|.*?\|/g, '');
        plainText = plainText.replace(/[-:|]+/g, '');
        plainText = plainText.replace(/\n+/g, ' ');
        plainText = plainText.replace(/\s+/g, ' ');
        plainText = plainText.trim();
        plainText = plainText.replace(/^[\s#>*\-+]*/, '');
        return plainText;
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    renderTemplate(template, data) {
        let html = template;
        
        // Replace all template variables
        for (const [key, value] of Object.entries(data)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            // Don't escape content - let the frontend handle it properly
            const replacement = key === 'content' ? value : this.escapeHtml(value.toString());
            html = html.replace(regex, replacement || '');
        }
        
        // Handle conditional image display
        if (data.img) {
            html = html.replace(/{{#img}}([\s\S]*?){{\/img}}/g, '$1');
        } else {
            html = html.replace(/{{#img}}[\s\S]*?{{\/img}}/g, '');
        }
        
        // Clean up any remaining template tags
        html = html.replace(/{{[^}]*}}/g, '');
        
        return html;
    }
}

const blog = new Blog();

// Authentication helper
function authenticate(request) {
    const url = new URL(request.url);
    
    if (url.pathname.startsWith('/admin')) {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Basic ')) {
            return false;
        }

        const base64 = authHeader.substring(6);
        const credentials = atob(base64).split(':');
        
        return credentials[0] === OPT.user && credentials[1] === OPT.password;
    }
    
    return true;
}

// Main worker
export default {
    async fetch(request, env, ctx) {
        blog.setKV(env.BLOG_STORE);
        
        const url = new URL(request.url);
        const path = url.pathname;

        // Handle theme switching via query parameter
        const themeParam = url.searchParams.get('theme');
        if (themeParam) {
            OPT.themeURL = `https://raw.githubusercontent.com/OshekharO/CF-BLOG/main/themes/${themeParam}/`;
        }

        // Handle authentication for admin routes ONLY
        if (path.startsWith('/admin')) {
            if (!authenticate(request)) {
                return new Response('Authentication required', {
                    status: 401,
                    headers: {
                        'WWW-Authenticate': 'Basic realm="Blog Admin", charset="UTF-8"'
                    }
                });
            }
        }

        // API Routes - PUBLIC ACCESS
        if (path.startsWith('/api/')) {
            return handleAPI(request, path);
        }

        // Static Routes
        switch (path) {
            case '/':
                return renderIndex();
            
            case '/admin/':
                return renderAdmin();
            
            case '/admin/edit':
                return renderEdit(url);

            case '/robots.txt':
                return new Response(OPT.robots, {
                    headers: { 'Content-Type': 'text/plain' }
                });

            default:
                if (path.startsWith('/article/')) {
                    return renderArticle(path);
                }
                return new Response(OPT.html404, {
                    status: 404,
                    headers: { 'Content-Type': 'text/html' }
                });
        }

        async function handleAPI(request, path) {
            const method = request.method;

            try {
                if (path === '/api/articles' && method === 'GET') {
                    const articles = await blog.listArticles();
                    return jsonResponse(articles);
                }

                if (path === '/api/articles' && method === 'POST') {
                    if (!authenticate(request)) {
                        return new Response('Authentication required', { status: 401 });
                    }
                    
                    const article = await request.json();
                    const id = await blog.saveArticle(article);
                    return jsonResponse({ success: true, id: id });
                }

                if (path.match(/^\/api\/articles\/[^\/]+$/) && method === 'GET') {
                    const permalink = path.split('/').pop();
                    const articles = await blog.listArticles();
                    const article = articles.find(a => a.permalink === permalink);
                    
                    if (!article) {
                        return jsonResponse({ error: 'Article not found' }, 404);
                    }
                    
                    const fullArticle = await blog.getArticle(article.id);
                    return jsonResponse(fullArticle);
                }

                if (path.match(/^\/api\/articles\/[^\/]+$/) && method === 'PUT') {
                    if (!authenticate(request)) {
                        return new Response('Authentication required', { status: 401 });
                    }
                    
                    const permalink = path.split('/').pop();
                    const article = await request.json();
                    
                    const articles = await blog.listArticles();
                    const existing = articles.find(a => a.permalink === permalink);
                    if (!existing) {
                        return jsonResponse({ error: 'Article not found' }, 404);
                    }
                    
                    article.id = existing.id;
                    await blog.saveArticle(article);
                    return jsonResponse({ success: true });
                }

                if (path.match(/^\/api\/articles\/[^\/]+$/) && method === 'DELETE') {
                    if (!authenticate(request)) {
                        return new Response('Authentication required', { status: 401 });
                    }
                    
                    const permalink = path.split('/').pop();
                    const articles = await blog.listArticles();
                    const article = articles.find(a => a.permalink === permalink);
                    
                    if (!article) {
                        return jsonResponse({ error: 'Article not found' }, 404);
                    }
                    
                    await blog.deleteArticle(article.id);
                    return jsonResponse({ success: true });
                }

                return jsonResponse({ error: 'Not found' }, 404);
            } catch (error) {
                console.error('API Error:', error);
                return jsonResponse({ error: error.message }, 500);
            }
        }

        async function renderIndex() {
            try {
                const template = await blog.fetchThemeTemplate('index');
                const data = {
                    siteName: OPT.siteName,
                    siteDescription: OPT.siteDescription,
                    keyWords: OPT.keyWords,
                    copyRight: OPT.copyRight,
                    codeBeforHead: OPT.codeBeforHead || '',
                    codeBeforBody: OPT.codeBeforBody || ''
                };
                
                const html = blog.renderTemplate(template, data);
                return new Response(html, {
                    headers: { 'Content-Type': 'text/html' }
                });
            } catch (error) {
                return new Response('Error loading template: ' + error.message, { status: 500 });
            }
        }

        async function renderAdmin() {
            try {
                const template = await blog.fetchThemeTemplate('admin');
                const data = {
                    siteName: OPT.siteName,
                    copyRight: OPT.copyRight,
                    codeBeforHead: OPT.codeBeforHead || '',
                    codeBeforBody: OPT.codeBeforBody || ''
                };
                
                const html = blog.renderTemplate(template, data);
                return new Response(html, {
                    headers: { 'Content-Type': 'text/html' }
                });
            } catch (error) {
                return new Response('Error loading template: ' + error.message, { status: 500 });
            }
        }

        async function renderEdit(url) {
            try {
                const template = await blog.fetchThemeTemplate('edit');
                const urlParams = new URLSearchParams(url.search);
                const permalink = urlParams.get('permalink');
                const action = permalink ? 'Edit' : 'New';
                
                const data = {
                    action: action,
                    siteName: OPT.siteName,
                    copyRight: OPT.copyRight,
                    codeBeforHead: OPT.codeBeforHead || '',
                    codeBeforBody: OPT.codeBeforBody || ''
                };
                
                const html = blog.renderTemplate(template, data);
                return new Response(html, {
                    headers: { 'Content-Type': 'text/html' }
                });
            } catch (error) {
                return new Response('Error loading template: ' + error.message, { status: 500 });
            }
        }

        async function renderArticle(path) {
            try {
                const template = await blog.fetchThemeTemplate('article');
                const permalink = path.split('/').pop();
                const articles = await blog.listArticles();
                const article = articles.find(a => a.permalink === permalink);
                
                if (!article) {
                    return new Response(OPT.html404, {
                        status: 404,
                        headers: { 'Content-Type': 'text/html' }
                    });
                }
                
                const fullArticle = await blog.getArticle(article.id);
                
                const data = {
                    title: fullArticle.title,
                    siteName: OPT.siteName,
                    createDate: new Date(fullArticle.createDate).toLocaleDateString(),
                    label: fullArticle.label,
                    img: fullArticle.img || '',
                    content: fullArticle.contentMarkdown || fullArticle.content, // Use markdown content
                    copyRight: OPT.copyRight,
                    codeBeforHead: OPT.codeBeforHead || '',
                    codeBeforBody: OPT.codeBeforBody || ''
                };
                
                const html = blog.renderTemplate(template, data);
                return new Response(html, {
                    headers: { 'Content-Type': 'text/html' }
                });
            } catch (error) {
                return new Response('Error loading template: ' + error.message, { status: 500 });
            }
        }

        function jsonResponse(data, status = 200) {
            return new Response(JSON.stringify(data), {
                status: status,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
    }
};
