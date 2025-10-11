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
    "html404": ``,
    "codeBeforHead": ``,
    "codeBeforBody": ``,
    "commentCode": ``,
    "widgetOther": ``,
    "copyRight": `Powered by CF Workers`,
    "robots": `User-agent: *\nDisallow: /admin`,
    "draftPrefix": "DRAFT_"
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
            return value ? JSON.parse(value) : null;
        } catch {
            return null;
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
        const articles = await this.get('SYSTEM_INDEX_LIST', true) || [];
        return articles.map(article => ({
            status: 'published',
            ...article
        }));
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

        if (!article.status) {
            article.status = 'published';
        }
        
        article.contentMarkdown = article.contentMarkdown || article.content || '';
        
        const plainText = this.stripMarkdown(article.contentMarkdown);
        article.excerpt = plainText.substring(0, OPT.readMoreLength) + (plainText.length > OPT.readMoreLength ? '...' : '');

        await this.put(article.id, article);

        const index = await this.listArticles();
        const existingIndex = index.findIndex(item => item.id === article.id);
        
        const indexItem = {
            id: article.id,
            title: article.title,
            img: article.img || '',
            permalink: article.permalink,
            createDate: article.createDate,
            label: article.label,
            excerpt: article.excerpt,
            status: article.status
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

    async listPublishedArticles() {
        const articles = await this.listArticles();
        return articles.filter(article => article.status !== 'draft');
    }

    async listDraftArticles() {
        const articles = await this.listArticles();
        return articles.filter(article => article.status === 'draft');
    }

    async getArticleByPermalink(permalink) {
        try {
            const articles = await this.listArticles();
            const articleIndex = articles.find(a => a.permalink === permalink);
            
            if (!articleIndex) {
                return null;
            }
            
            const fullArticle = await this.getArticle(articleIndex.id);
            if (!fullArticle) {
                return null;
            }
            
            return {
                ...fullArticle,
                status: articleIndex.status || fullArticle.status || 'published'
            };
        } catch (error) {
            console.error('Error getting article by permalink:', error);
            return null;
        }
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
        
        for (const [key, value] of Object.entries(data)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            const replacement = key === 'content' ? value : this.escapeHtml(value.toString());
            html = html.replace(regex, replacement || '');
        }
        
        if (data.img) {
            html = html.replace(/{{#img}}([\s\S]*?){{\/img}}/g, '$1');
        } else {
            html = html.replace(/{{#img}}[\s\S]*?{{\/img}}/g, '');
        }
        
        html = html.replace(/{{[^}]*}}/g, '');
        
        return html;
    }
}

const blog = new Blog();

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

// Helper function to check if request is from admin
function isAdminRequest(request) {
    const url = new URL(request.url);
    
    // Check if the request has admin authentication
    if (authenticate(request)) {
        return true;
    }
    
    // Check if the request is coming from admin pages
    const referer = request.headers.get('Referer');
    if (referer && referer.includes('/admin')) {
        return true;
    }
    
    // Check if the path itself is an admin path
    if (url.pathname.startsWith('/admin')) {
        return true;
    }
    
    return false;
}

export default {
    async fetch(request, env, ctx) {
        blog.setKV(env.BLOG_STORE);
        
        const url = new URL(request.url);
        const path = url.pathname;

        const themeParam = url.searchParams.get('theme');
        if (themeParam) {
            OPT.themeURL = `https://raw.githubusercontent.com/OshekharO/CF-BLOG/main/themes/${themeParam}/`;
        }

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

        if (path.startsWith('/api/')) {
            return handleAPI(request, path);
        }

        switch (path) {
            case '/':
                return renderIndex();
            
            case '/admin/':
                return renderAdmin();
            
            case '/admin/edit':
                return renderEdit(url);

            case '/bookmarks':
                return renderBookmarks();

            case '/robots.txt':
                return new Response(OPT.robots, {
                    headers: { 'Content-Type': 'text/plain' }
                });

            default:
                if (path.startsWith('/article/')) {
                    return renderArticle(path);
                }
                return render404();
        }

        async function handleAPI(request, path) {
            const method = request.method;

            try {
                if (path === '/api/articles' && method === 'GET') {
                    const showDrafts = url.searchParams.get('drafts') === 'true';
                    
                    let articles;
                    if (showDrafts) {
                        articles = await blog.listDraftArticles();
                    } else {
                        articles = await blog.listPublishedArticles();
                    }
                    
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
                    
                    console.log('🔍 API GET ARTICLE:', permalink);
                    
                    const article = await blog.getArticleByPermalink(permalink);
                    
                    if (!article) {
                        console.log('❌ Article not found:', permalink);
                        return jsonResponse({ error: 'Article not found' }, 404);
                    }
                    
                    console.log('✅ Found article:', article.title, 'Status:', article.status);
                    
                    // Use the improved admin detection
                    const isAdmin = isAdminRequest(request);
                    console.log('🔐 Is admin request:', isAdmin);
                    
                    if (!isAdmin && article.status === 'draft') {
                        console.log('🚫 Blocking draft article access for public');
                        return jsonResponse({ error: 'Article not found' }, 404);
                    }
                    
                    console.log('✅ Serving article to requestor');
                    return jsonResponse(article);
                }

                if (path.match(/^\/api\/articles\/[^\/]+$/) && method === 'PUT') {
                    if (!authenticate(request)) {
                        return new Response('Authentication required', { status: 401 });
                    }
                    
                    const permalink = path.split('/').pop();
                    const articleData = await request.json();
                    
                    console.log('✏️ API UPDATE ARTICLE:', permalink);
                    
                    const existingArticle = await blog.getArticleByPermalink(permalink);
                    
                    if (!existingArticle) {
                        console.log('❌ Article not found for update:', permalink);
                        return jsonResponse({ error: 'Article not found' }, 404);
                    }
                    
                    console.log('✅ Found existing article for update:', existingArticle.title);
                    
                    const updatedArticle = {
                        ...existingArticle,
                        ...articleData,
                        id: existingArticle.id
                    };
                    
                    await blog.saveArticle(updatedArticle);
                    console.log('✅ Article updated successfully');
                    return jsonResponse({ success: true });
                }

                if (path.match(/^\/api\/articles\/[^\/]+$/) && method === 'DELETE') {
                    if (!authenticate(request)) {
                        return new Response('Authentication required', { status: 401 });
                    }
                    
                    const permalink = path.split('/').pop();
                    const article = await blog.getArticleByPermalink(permalink);
                    
                    if (!article) {
                        return jsonResponse({ error: 'Article not found' }, 404);
                    }
                    
                    await blog.deleteArticle(article.id);
                    return jsonResponse({ success: true });
                }

                // Add debug endpoint
                if (path === '/api/debug' && method === 'GET') {
                    const index = await blog.listArticles();
                    const allArticles = [];
                    
                    for (const item of index) {
                        const fullArticle = await blog.getArticle(item.id);
                        allArticles.push({
                            index: item,
                            full: fullArticle,
                            exists: !!fullArticle
                        });
                    }
                    
                    return jsonResponse({
                        index: index,
                        allArticles: allArticles,
                        total: index.length,
                        systemIndexNum: await blog.get('SYSTEM_INDEX_NUM')
                    });
                }

                // Add fix endpoint to recreate missing articles
                if (path === '/api/fix-missing-articles' && method === 'POST') {
                    if (!authenticate(request)) {
                        return new Response('Authentication required', { status: 401 });
                    }
                    
                    const index = await blog.listArticles();
                    let fixedCount = 0;
                    
                    for (const item of index) {
                        const fullArticle = await blog.getArticle(item.id);
                        if (!fullArticle) {
                            console.log('🔄 Fixing missing article:', item.id, item.title);
                            const recreatedArticle = {
                                id: item.id,
                                title: item.title,
                                img: item.img || '',
                                permalink: item.permalink,
                                createDate: item.createDate,
                                label: item.label,
                                content: '[Content was lost, please edit this article to restore content]',
                                contentMarkdown: '[Content was lost, please edit this article to restore content]',
                                excerpt: item.excerpt || 'Content was lost',
                                status: item.status || 'draft'
                            };
                            await blog.put(item.id, recreatedArticle);
                            fixedCount++;
                        }
                    }
                    
                    return jsonResponse({ 
                        success: true, 
                        fixedCount: fixedCount,
                        message: `Fixed ${fixedCount} missing articles` 
                    });
                }

                return jsonResponse({ error: 'Not found' }, 404);
            } catch (error) {
                console.error('❌ API Error:', error);
                return jsonResponse({ error: error.message }, 500);
            }
        }

        // ... rest of the render functions remain the same
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

        async function renderBookmarks() {
            try {
                const template = await blog.fetchThemeTemplate('bookmarks');
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
                return new Response('Error loading bookmarks page', { status: 500 });
            }
        }

        async function renderArticle(path) {
            try {
                const template = await blog.fetchThemeTemplate('article');
                const permalink = path.split('/').pop();
                const articles = await blog.listPublishedArticles();
                const article = articles.find(a => a.permalink === permalink);
                
                if (!article) {
                    return render404();
                }
                
                const fullArticle = await blog.getArticle(article.id);
                
                const data = {
                    title: fullArticle.title,
                    siteName: OPT.siteName,
                    createDate: new Date(fullArticle.createDate).toLocaleDateString(),
                    label: fullArticle.label,
                    img: fullArticle.img || '',
                    content: fullArticle.contentMarkdown || fullArticle.content,
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

        async function render404() {
            try {
                const template = await blog.fetchThemeTemplate('404');
                const data = {
                    siteName: OPT.siteName,
                    copyRight: OPT.copyRight,
                    codeBeforHead: OPT.codeBeforHead || '',
                    codeBeforBody: OPT.codeBeforBody || ''
                };
                
                const html = blog.renderTemplate(template, data);
                return new Response(html, {
                    status: 404,
                    headers: { 'Content-Type': 'text/html' }
                });
            } catch (error) {
                return new Response('404 - Page Not Found', {
                    status: 404,
                    headers: { 'Content-Type': 'text/plain' }
                });
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
