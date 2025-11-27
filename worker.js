'use strict';

const OPT = {
    "user": "admin",
    "password": "admin",
    "siteDomain": "blog.oshekher.workers.dev",
    "siteName": "CF Workers Blog",
    "siteDescription": "A Blog Powered By Cloudflare Workers and KV",
    "keyWords": "cloudflare,KV,workers,blog",
    "pageSize": 10,
    "recentlySize": 6,
    "readMoreLength": 150,
    "cacheTime": 60 * 60 * 24 * 0.5,
    "themeURL": "https://raw.githubusercontent.com/OshekharO/CF-BLOG/main/themes/minimal/",
    "html404": ``,
    "codeBeforHead": ``,
    "codeBeforBody": ``,
    "commentCode": ``,
    "widgetOther": ``,
    "copyRight": `Powered by OshekharO`,
    "robots": `User-agent: *\nDisallow: /admin`,
    "draftPrefix": "DRAFT_"
};

/**
 * Generate URL-friendly slug from title
 * Converts the title to lowercase, removes special characters,
 * replaces spaces and underscores with hyphens, and removes leading/trailing hyphens.
 * 
 * @param {string} title - The title to convert to slug
 * @returns {string} - URL-friendly slug (lowercase, alphanumeric with hyphens)
 * @example
 * generateSlug("Hello World!") // Returns "hello-world"
 * generateSlug("My Article Title 2024") // Returns "my-article-title-2024"
 */
function generateSlug(title) {
    if (!title) return '';
    
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters except word chars, spaces, hyphens
        .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with single hyphen
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

class Blog {
    constructor() {
        this.kv = null;
        this.themeCache = new Map();
        this.articleCache = new Map();
        this.indexCache = null;
        this.indexCacheTime = 0;
        this.cacheTimeout = 60000; // 1 minute cache
    }

    setKV(kv) {
        this.kv = kv;
    }

    /**
     * Get value from KV with optional parsing and error handling
     * @param {string} key - KV key
     * @param {boolean} parse - Whether to parse JSON
     * @returns {Promise<any>} - Value or null
     */
    async get(key, parse = false) {
        try {
            const value = await this.kv.get(key);
            if (!parse) return value;
            if (!value) return null;
            return JSON.parse(value);
        } catch (error) {
            console.error(`Error getting key ${key}:`, error);
            return null;
        }
    }

    /**
     * Batch get multiple keys from KV (optimized)
     * @param {string[]} keys - Array of keys to fetch
     * @param {boolean} parse - Whether to parse JSON
     * @returns {Promise<Map<string, any>>} - Map of key-value pairs
     */
    async getMultiple(keys, parse = false) {
        const results = new Map();
        if (!keys || keys.length === 0) return results;

        try {
            // Fetch all keys in parallel for better performance
            const promises = keys.map(async (key) => {
                const value = await this.get(key, parse);
                return { key, value };
            });

            const resolved = await Promise.all(promises);
            resolved.forEach(({ key, value }) => {
                if (value !== null) {
                    results.set(key, value);
                }
            });
        } catch (error) {
            console.error('Error in batch get:', error);
        }

        return results;
    }

    /**
     * Put value to KV with error handling
     * @param {string} key - KV key
     * @param {any} value - Value to store
     */
    async put(key, value) {
        try {
            if (typeof value === 'object') {
                value = JSON.stringify(value);
            }
            await this.kv.put(key, value);
            // Invalidate cache when data changes
            this.invalidateCache(key);
        } catch (error) {
            console.error(`Error putting key ${key}:`, error);
            throw new Error(`Failed to save data: ${error.message}`);
        }
    }

    /**
     * Delete key from KV with error handling
     * @param {string} key - KV key
     */
    async delete(key) {
        try {
            await this.kv.delete(key);
            this.invalidateCache(key);
        } catch (error) {
            console.error(`Error deleting key ${key}:`, error);
            throw new Error(`Failed to delete data: ${error.message}`);
        }
    }

    /**
     * Invalidate cache for a specific key
     * @param {string} key - Key to invalidate
     */
    invalidateCache(key) {
        this.articleCache.delete(key);
        if (key === 'SYSTEM_INDEX_LIST') {
            this.indexCache = null;
        }
    }

    /**
     * Clear all caches
     */
    clearCache() {
        this.articleCache.clear();
        this.indexCache = null;
        this.indexCacheTime = 0;
    }

    // Admin Management Methods
    async getAdmins() {
        return await this.get('SYSTEM_ADMINS', true) || [];
    }

    async saveAdmin(adminData) {
        const admins = await this.getAdmins();
        const existingIndex = admins.findIndex(admin => admin.id === adminData.id);
        
        if (existingIndex >= 0) {
            admins[existingIndex] = adminData;
        } else {
            admins.push(adminData);
        }
        
        await this.put('SYSTEM_ADMINS', admins);
        return adminData.id;
    }

    async deleteAdmin(adminId) {
        const admins = await this.getAdmins();
        const filtered = admins.filter(admin => admin.id !== adminId);
        await this.put('SYSTEM_ADMINS', filtered);
    }

    async getAdminByUsername(username) {
        const admins = await this.getAdmins();
        return admins.find(admin => admin.username === username);
    }

    async getAdminById(id) {
        const admins = await this.getAdmins();
        return admins.find(admin => admin.id === id);
    }

    async verifyAdmin(username, password) {
        const admin = await this.getAdminByUsername(username);
        if (!admin) return null;
        
        // For simplicity, we're storing plain text (not recommended for production)
        if (admin.password === password && admin.status === 'active') {
            return admin;
        }
        return null;
    }

    async initializeDefaultAdmin() {
        const admins = await this.getAdmins();
        if (admins.length === 0) {
            const defaultAdmin = {
                id: this.generateId(),
                username: 'admin',
                password: 'admin',
                email: 'admin@example.com',
                role: 'superadmin',
                status: 'active',
                createdAt: new Date().toISOString(),
                lastLogin: null
            };
            await this.saveAdmin(defaultAdmin);
            console.log('Default admin created:', defaultAdmin.username);
        }
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // ... rest of your existing Blog methods (listArticles, getArticle, saveArticle, etc.)
    // Keep all your existing article methods here
    
    /**
     * List all articles with caching
     * @returns {Promise<Array>} - Array of articles
     */
    async listArticles() {
        try {
            // Check cache first
            const now = Date.now();
            if (this.indexCache && (now - this.indexCacheTime) < this.cacheTimeout) {
                return this.indexCache;
            }

            const articles = await this.get('SYSTEM_INDEX_LIST', true) || [];
            const result = articles.map(article => ({
                status: 'published',
                ...article
            }));

            // Update cache
            this.indexCache = result;
            this.indexCacheTime = now;

            return result;
        } catch (error) {
            console.error('Error listing articles:', error);
            return [];
        }
    }

    /**
     * List articles with pagination
     * @param {number} page - Page number (1-based)
     * @param {number} pageSize - Number of articles per page
     * @param {string} status - Filter by status ('published', 'draft', or 'all')
     * @returns {Promise<Object>} - Paginated result with articles and metadata
     */
    async listArticlesPaginated(page = 1, pageSize = OPT.pageSize, status = 'published') {
        try {
            let articles = await this.listArticles();

            // Filter by status
            if (status === 'published') {
                articles = articles.filter(a => a.status !== 'draft');
            } else if (status === 'draft') {
                articles = articles.filter(a => a.status === 'draft');
            }

            const totalArticles = articles.length;
            const totalPages = Math.ceil(totalArticles / pageSize);
            const validPage = Math.max(1, Math.min(page, totalPages || 1));
            const startIndex = (validPage - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const paginatedArticles = articles.slice(startIndex, endIndex);

            return {
                articles: paginatedArticles,
                pagination: {
                    page: validPage,
                    pageSize,
                    totalArticles,
                    totalPages,
                    hasNextPage: validPage < totalPages,
                    hasPrevPage: validPage > 1
                }
            };
        } catch (error) {
            console.error('Error in paginated listing:', error);
            return {
                articles: [],
                pagination: {
                    page: 1,
                    pageSize,
                    totalArticles: 0,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPrevPage: false
                }
            };
        }
    }

    /**
     * Get article with caching
     * @param {string} id - Article ID
     * @returns {Promise<Object|null>} - Article or null
     */
    async getArticle(id) {
        try {
            // Check cache first
            if (this.articleCache.has(id)) {
                return this.articleCache.get(id);
            }

            const article = await this.get(id, true);
            
            if (article) {
                this.articleCache.set(id, article);
            }

            return article;
        } catch (error) {
            console.error(`Error getting article ${id}:`, error);
            return null;
        }
    }

    /**
     * Get multiple articles by IDs (optimized batch fetch)
     * @param {string[]} ids - Array of article IDs
     * @returns {Promise<Array>} - Array of articles
     */
    async getArticlesBatch(ids) {
        try {
            const uncachedIds = ids.filter(id => !this.articleCache.has(id));
            
            if (uncachedIds.length > 0) {
                const fetched = await this.getMultiple(uncachedIds, true);
                fetched.forEach((article, id) => {
                    this.articleCache.set(id, article);
                });
            }

            return ids
                .map(id => this.articleCache.get(id))
                .filter(article => article !== undefined);
        } catch (error) {
            console.error('Error in batch fetch:', error);
            return [];
        }
    }

    async saveArticle(article) {
        try {
            if (!article.id) {
                const currentNum = parseInt(await this.get('SYSTEM_INDEX_NUM')) || 0;
                article.id = (currentNum + 1).toString().padStart(6, '0');
                await this.put('SYSTEM_INDEX_NUM', (currentNum + 1).toString());
            }

            // Auto-generate slug from title if permalink is empty
            if (!article.permalink && article.title) {
                article.permalink = generateSlug(article.title);
                // Ensure uniqueness by checking existing articles
                const existing = await this.listArticles();
                let basePermalink = article.permalink;
                let counter = 1;
                while (existing.some(a => a.permalink === article.permalink && a.id !== article.id)) {
                    article.permalink = `${basePermalink}-${counter}`;
                    counter++;
                }
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
        } catch (error) {
            console.error('Error saving article:', error);
            throw new Error(`Failed to save article: ${error.message}`);
        }
    }

    async deleteArticle(id) {
        try {
            await this.delete(id);
            const index = await this.listArticles();
            const filtered = index.filter(item => item.id !== id);
            await this.put('SYSTEM_INDEX_LIST', filtered);
        } catch (error) {
            console.error('Error deleting article:', error);
            throw new Error(`Failed to delete article: ${error.message}`);
        }
    }

    async listPublishedArticles() {
        try {
            const articles = await this.listArticles();
            return articles.filter(article => article.status !== 'draft');
        } catch (error) {
            console.error('Error listing published articles:', error);
            return [];
        }
    }

    async listDraftArticles() {
        try {
            const articles = await this.listArticles();
            return articles.filter(article => article.status === 'draft');
        } catch (error) {
            console.error('Error listing draft articles:', error);
            return [];
        }
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

    /**
     * Export all articles with optimized batch fetching
     * @returns {Promise<Array>} - Array of full articles
     */
    async exportArticles() {
        try {
            const articles = await this.listArticles();
            const ids = articles.map(a => a.id);
            return await this.getArticlesBatch(ids);
        } catch (error) {
            console.error('Error exporting articles:', error);
            return [];
        }
    }

    /**
     * Import articles from exported data
     * @param {Array} articlesData - Array of article data
     * @returns {Promise<Object>} - Import results
     */
    async importArticles(articlesData) {
        let imported = 0;
        let errors = [];
        
        for (const articleData of articlesData) {
            try {
                if (!articleData.id) {
                    const currentNum = parseInt(await this.get('SYSTEM_INDEX_NUM')) || 0;
                    articleData.id = (currentNum + 1).toString().padStart(6, '0');
                    await this.put('SYSTEM_INDEX_NUM', (currentNum + 1).toString());
                }
                
                await this.saveArticle(articleData);
                imported++;
            } catch (error) {
                errors.push({
                    title: articleData.title || 'Unknown',
                    error: error.message
                });
            }
        }
        
        return { imported, errors };
    }

    /**
     * Get all categories with counts
     * @returns {Promise<Object>} - Object with category names as keys and counts as values
     */
    async getCategories() {
        try {
            const articles = await this.listPublishedArticles();
            const categories = {};
            
            articles.forEach(article => {
                if (article.label) {
                    categories[article.label] = (categories[article.label] || 0) + 1;
                }
            });
            
            return categories;
        } catch (error) {
            console.error('Error getting categories:', error);
            return {};
        }
    }

    /**
     * Fetch theme template with caching and error handling
     * @param {string} templateName - Template name
     * @returns {Promise<string>} - Template HTML
     */
    async fetchThemeTemplate(templateName) {
        const cacheKey = `${OPT.themeURL}${templateName}`;
        
        if (this.themeCache.has(cacheKey)) {
            return this.themeCache.get(cacheKey);
        }

        try {
            const response = await fetch(`${OPT.themeURL}${templateName}.html`, {
                cf: {
                    cacheTtl: 300
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: Failed to fetch template`);
            }
            
            const template = await response.text();
            
            this.themeCache.set(cacheKey, template);
            
            return template;
        } catch (error) {
            console.error(`Error fetching template ${templateName}:`, error);
            throw new Error(`Failed to fetch template: ${templateName}`);
        }
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

// Simple authentication function
function authenticate(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Basic ')) {
        return null;
    }

    try {
        const base64 = authHeader.substring(6);
        const credentials = atob(base64).split(':');
        return credentials;
    } catch (error) {
        return null;
    }
}

// Check if user is authenticated
async function isAuthenticated(request) {
    const credentials = authenticate(request);
    if (!credentials) return false;
    
    const [username, password] = credentials;
    const admin = await blog.verifyAdmin(username, password);
    return !!admin;
}

// Check if user is superadmin
async function isSuperAdmin(request) {
    const credentials = authenticate(request);
    if (!credentials) return false;
    
    const [username, password] = credentials;
    const admin = await blog.verifyAdmin(username, password);
    return admin && admin.role === 'superadmin';
}

export default {
    async fetch(request, env, ctx) {
        blog.setKV(env.BLOG_STORE);
        
        // Initialize default admin if none exists
        await blog.initializeDefaultAdmin();
        
        const url = new URL(request.url);
        const path = url.pathname;

        const themeParam = url.searchParams.get('theme');
        if (themeParam) {
            OPT.themeURL = `https://raw.githubusercontent.com/OshekharO/CF-BLOG/main/themes/${themeParam}/`;
        }

        // Check authentication for admin routes
        if (path.startsWith('/admin') || path.startsWith('/api/admins')) {
            const authenticated = await isAuthenticated(request);
            if (!authenticated) {
                return new Response('Authentication required', {
                    status: 401,
                    headers: {
                        'WWW-Authenticate': 'Basic realm="Blog Admin", charset="UTF-8"',
                        'Content-Type': 'text/plain'
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

            case '/admin/users':
                return renderAdminUsers();

            case '/bookmarks':
                return renderBookmarks();

            case '/rss.xml':
                return generateRSSFeed();

            case '/sitemap.xml':
                return generateSitemap();

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
                // Admin Management API
                if (path === '/api/admins' && method === 'GET') {
                    const isSuper = await isSuperAdmin(request);
                    if (!isSuper) {
                        return jsonResponse({ error: 'Access denied. Superadmin required.' }, 403);
                    }
                    
                    const admins = await blog.getAdmins();
                    // Don't return passwords
                    const safeAdmins = admins.map(admin => ({
                        id: admin.id,
                        username: admin.username,
                        email: admin.email,
                        role: admin.role,
                        status: admin.status,
                        createdAt: admin.createdAt,
                        lastLogin: admin.lastLogin
                    }));
                    
                    return jsonResponse(safeAdmins);
                }

                if (path === '/api/admins' && method === 'POST') {
                    const isSuper = await isSuperAdmin(request);
                    if (!isSuper) {
                        return jsonResponse({ error: 'Access denied. Superadmin required.' }, 403);
                    }
                    
                    const adminData = await request.json();
                    
                    // Validate required fields
                    if (!adminData.username || !adminData.password || !adminData.email) {
                        return jsonResponse({ error: 'Username, password, and email are required' }, 400);
                    }
                    
                    // Check if username already exists
                    const existingAdmin = await blog.getAdminByUsername(adminData.username);
                    if (existingAdmin) {
                        return jsonResponse({ error: 'Username already exists' }, 400);
                    }
                    
                    const newAdmin = {
                        id: blog.generateId(),
                        username: adminData.username,
                        password: adminData.password,
                        email: adminData.email,
                        role: adminData.role || 'admin',
                        status: 'active',
                        createdAt: new Date().toISOString(),
                        lastLogin: null
                    };
                    
                    await blog.saveAdmin(newAdmin);
                    
                    // Return without password
                    const { password: _, ...safeAdmin } = newAdmin;
                    return jsonResponse({ success: true, admin: safeAdmin });
                }

                if (path.match(/^\/api\/admins\/[^\/]+$/) && method === 'PUT') {
                    const isSuper = await isSuperAdmin(request);
                    if (!isSuper) {
                        return jsonResponse({ error: 'Access denied. Superadmin required.' }, 403);
                    }
                    
                    const adminId = path.split('/').pop();
                    const updateData = await request.json();
                    
                    const existingAdmin = await blog.getAdminById(adminId);
                    if (!existingAdmin) {
                        return jsonResponse({ error: 'Admin not found' }, 404);
                    }
                    
                    const updatedAdmin = {
                        ...existingAdmin,
                        ...updateData,
                        id: existingAdmin.id
                    };
                    
                    await blog.saveAdmin(updatedAdmin);
                    
                    const { password: _, ...safeAdmin } = updatedAdmin;
                    return jsonResponse({ success: true, admin: safeAdmin });
                }

                if (path.match(/^\/api\/admins\/[^\/]+$/) && method === 'DELETE') {
                    const isSuper = await isSuperAdmin(request);
                    if (!isSuper) {
                        return jsonResponse({ error: 'Access denied. Superadmin required.' }, 403);
                    }
                    
                    const adminId = path.split('/').pop();
                    
                    const existingAdmin = await blog.getAdminById(adminId);
                    if (!existingAdmin) {
                        return jsonResponse({ error: 'Admin not found' }, 404);
                    }
                    
                    // Get current admin to prevent self-deletion
                    const credentials = authenticate(request);
                    if (credentials) {
                        const [username, password] = credentials;
                        const currentAdmin = await blog.verifyAdmin(username, password);
                        if (currentAdmin && currentAdmin.id === adminId) {
                            return jsonResponse({ error: 'Cannot delete your own account' }, 400);
                        }
                    }
                    
                    await blog.deleteAdmin(adminId);
                    return jsonResponse({ success: true });
                }

                // Articles API (existing endpoints)
                if (path === '/api/articles' && method === 'GET') {
                    const showDrafts = url.searchParams.get('drafts') === 'true';
                    const page = parseInt(url.searchParams.get('page')) || 1;
                    const pageSize = parseInt(url.searchParams.get('pageSize')) || OPT.pageSize;
                    const paginate = url.searchParams.get('paginate') === 'true';
                    
                    let result;
                    if (paginate) {
                        // Return paginated results
                        const status = showDrafts ? 'draft' : 'published';
                        result = await blog.listArticlesPaginated(page, pageSize, status);
                        return jsonResponse(result);
                    } else {
                        // Return all results (backward compatible)
                        if (showDrafts) {
                            result = await blog.listDraftArticles();
                        } else {
                            result = await blog.listPublishedArticles();
                        }
                        return jsonResponse(result);
                    }
                }

                // Generate slug API endpoint
                if (path === '/api/generate-slug' && method === 'POST') {
                    try {
                        const { title } = await request.json();
                        if (!title) {
                            return jsonResponse({ error: 'Title is required' }, 400);
                        }
                        const slug = generateSlug(title);
                        
                        // Check if slug already exists
                        const articles = await blog.listArticles();
                        let finalSlug = slug;
                        let counter = 1;
                        while (articles.some(a => a.permalink === finalSlug)) {
                            finalSlug = `${slug}-${counter}`;
                            counter++;
                        }
                        
                        return jsonResponse({ slug: finalSlug });
                    } catch (error) {
                        return jsonResponse({ error: 'Failed to generate slug' }, 500);
                    }
                }

                if (path === '/api/articles' && method === 'POST') {
                    const article = await request.json();
                    const id = await blog.saveArticle(article);
                    return jsonResponse({ success: true, id: id });
                }

                if (path.match(/^\/api\/articles\/[^\/]+$/) && method === 'GET') {
                    const permalink = path.split('/').pop();
                    const article = await blog.getArticleByPermalink(permalink);
                    
                    if (!article) {
                        return jsonResponse({ error: 'Article not found' }, 404);
                    }
                    
                    // Check if user is authenticated for draft access
                    const isAdmin = await isAuthenticated(request);
                    if (!isAdmin && article.status === 'draft') {
                        return jsonResponse({ error: 'Article not found' }, 404);
                    }
                    
                    return jsonResponse(article);
                }

                if (path.match(/^\/api\/articles\/[^\/]+$/) && method === 'PUT') {
                    const permalink = path.split('/').pop();
                    const articleData = await request.json();
                    
                    const existingArticle = await blog.getArticleByPermalink(permalink);
                    
                    if (!existingArticle) {
                        return jsonResponse({ error: 'Article not found' }, 404);
                    }
                    
                    const updatedArticle = {
                        ...existingArticle,
                        ...articleData,
                        id: existingArticle.id
                    };
                    
                    await blog.saveArticle(updatedArticle);
                    return jsonResponse({ success: true });
                }

                if (path.match(/^\/api\/articles\/[^\/]+$/) && method === 'DELETE') {
                    const permalink = path.split('/').pop();
                    const article = await blog.getArticleByPermalink(permalink);
                    
                    if (!article) {
                        return jsonResponse({ error: 'Article not found' }, 404);
                    }
                    
                    await blog.deleteArticle(article.id);
                    return jsonResponse({ success: true });
                }

                // Export/Import and other existing APIs...
                if (path === '/api/export' && method === 'GET') {
                    const articles = await blog.exportArticles();
                    const exportData = JSON.stringify(articles, null, 2);
                    return new Response(exportData, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Disposition': `attachment; filename="blog-export-${new Date().toISOString().split('T')[0]}.json"`
                        }
                    });
                }

                if (path === '/api/import' && method === 'POST') {
                    const articlesData = await request.json();
                    
                    if (!Array.isArray(articlesData)) {
                        return jsonResponse({ error: 'Invalid import data. Expected array of articles.' }, 400);
                    }
                    
                    const result = await blog.importArticles(articlesData);
                    
                    return jsonResponse({
                        success: true,
                        imported: result.imported,
                        errors: result.errors,
                        message: `Successfully imported ${result.imported} articles${result.errors.length > 0 ? ` with ${result.errors.length} errors` : ''}`
                    });
                }

                if (path === '/api/categories' && method === 'GET') {
                    const categories = await blog.getCategories();
                    return jsonResponse(categories);
                }

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

                return jsonResponse({ error: 'Not found' }, 404);
            } catch (error) {
                console.error('API Error:', error);
                return jsonResponse({ error: error.message }, 500);
            }
        }

        /**
         * Generate RSS feed with CDATA tags for better content handling
         * @returns {Promise<Response>} - RSS XML response
         */
        async function generateRSSFeed() {
            try {
                const articles = await blog.listPublishedArticles();
                const siteUrl = `https://${OPT.siteDomain}`;
                
                const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
     xmlns:atom="http://www.w3.org/2005/Atom" 
     xmlns:content="http://purl.org/rss/1.0/modules/content/" 
     xmlns:dc="http://purl.org/dc/elements/1.1/">
    <channel>
        <title><![CDATA[${OPT.siteName}]]></title>
        <description><![CDATA[${OPT.siteDescription}]]></description>
        <link>${siteUrl}</link>
        <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
        <language>en-us</language>
        <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
        <generator>CF Workers Blog</generator>
        <ttl>60</ttl>
        ${articles.map(article => `
        <item>
            <title><![CDATA[${article.title || ''}]]></title>
            <description><![CDATA[${article.excerpt || ''}]]></description>
            <content:encoded><![CDATA[${article.excerpt || ''}]]></content:encoded>
            <link>${siteUrl}/article/${escapeXml(article.permalink)}</link>
            <guid isPermaLink="true">${siteUrl}/article/${escapeXml(article.permalink)}</guid>
            <pubDate>${new Date(article.createDate).toUTCString()}</pubDate>
            <category><![CDATA[${article.label || ''}]]></category>
            <dc:creator><![CDATA[${OPT.siteName}]]></dc:creator>
            ${article.img ? `<enclosure url="${escapeXml(article.img)}" type="image/jpeg" />` : ''}
        </item>
        `).join('')}
    </channel>
</rss>`;
                
                return new Response(rss, {
                    headers: { 
                        'Content-Type': 'application/rss+xml; charset=utf-8',
                        'Cache-Control': 'public, max-age=3600'
                    }
                });
            } catch (error) {
                console.error('Error generating RSS feed:', error);
                return new Response('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Error</title><description>Error generating RSS feed</description></channel></rss>', { 
                    status: 500,
                    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' }
                });
            }
        }

        async function generateSitemap() {
            try {
                const articles = await blog.listPublishedArticles();
                const siteUrl = `https://${OPT.siteDomain}`;
                
                const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
    <url>
        <loc>${siteUrl}</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    ${articles.map(article => `
    <url>
        <loc>${siteUrl}/article/${article.permalink}</loc>
        <lastmod>${new Date(article.createDate).toISOString().split('T')[0]}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
        ${article.img ? `
        <image:image>
            <image:loc>${escapeXml(article.img)}</image:loc>
            <image:title>${escapeXml(article.title)}</image:title>
        </image:image>
        ` : ''}
    </url>
    `).join('')}
</urlset>`;
                
                return new Response(sitemap, {
                    headers: { 
                        'Content-Type': 'application/xml; charset=utf-8',
                        'Cache-Control': 'public, max-age=3600'
                    }
                });
            } catch (error) {
                console.error('Error generating sitemap:', error);
                return new Response('Error generating sitemap', { status: 500 });
            }
        }

        function escapeXml(unsafe) {
            if (!unsafe) return '';
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&apos;");
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

        async function renderAdminUsers() {
            try {
                const template = await blog.fetchThemeTemplate('admin-users');
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
                return new Response('Error loading admin users template', { status: 500 });
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
