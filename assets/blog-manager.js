(function(window, document) {
    'use strict';

    var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var DAYS = ['Mo','Tu','We','Th','Fr','Sa','Su'];

    var LOCALE = navigator.language || 'en-US';

    var PLACEHOLDER_IMG = '';

    // Translation helpers
    var T = {
        visible: function() { return window.PLUGIN_BLOG_MANAGER_VISIBLE || 'Visible'; },
        hidden: function() { return window.PLUGIN_BLOG_MANAGER_HIDDEN || 'Hidden'; },
        published: function() { return window.PLUGIN_BLOG_MANAGER_PUBLISHED || 'Published'; },
        unpublished: function() { return window.PLUGIN_BLOG_MANAGER_UNPUBLISHED || 'Unpublished'; },
        filterAll: function() { return window.PLUGIN_BLOG_MANAGER_FILTER_ALL || 'All'; },
        colTitle: function() { return window.PLUGIN_BLOG_MANAGER_COL_TITLE || 'Title'; },
        colLang: function() { return window.PLUGIN_BLOG_MANAGER_COL_LANG || 'Lang'; },
        colExcerpt: function() { return window.PLUGIN_BLOG_MANAGER_COL_EXCERPT || 'Excerpt'; },
        colDate: function() { return window.PLUGIN_BLOG_MANAGER_COL_DATE || 'Date'; },
        colCategory: function() { return window.PLUGIN_BLOG_MANAGER_COL_CATEGORY || 'Category'; },
        colPublished: function() { return window.PLUGIN_BLOG_MANAGER_COL_PUBLISHED || 'Publish'; },
        colVisible: function() { return window.PLUGIN_BLOG_MANAGER_COL_VISIBLE || 'Visible'; },
        colTags: function() { return window.PLUGIN_BLOG_MANAGER_COL_TAGS || 'Tags'; },
        colActions: function() { return window.PLUGIN_BLOG_MANAGER_COL_ACTIONS || 'Actions'; },
        btnEdit: function() { return window.PLUGIN_BLOG_MANAGER_BTN_EDIT || 'Edit'; },
        btnDuplicate: function() { return window.PLUGIN_BLOG_MANAGER_BTN_DUPLICATE || 'Duplicate'; },
        btnDelete: function() { return window.PLUGIN_BLOG_MANAGER_BTN_DELETE || 'Delete'; },
        btnPublish: function() { return window.PLUGIN_BLOG_MANAGER_BTN_PUBLISH || 'Publish'; },
        btnVisible: function() { return window.PLUGIN_BLOG_MANAGER_BTN_VISIBLE || 'Visible'; },
        btnClear: function() { return window.PLUGIN_BLOG_MANAGER_BTN_CLEAR || 'Clear'; },
        clickPublish: function() { return window.PLUGIN_BLOG_MANAGER_TOOLTIP_CLICK_PUBLISH || 'Click to publish'; },
        clickUnpublish: function() { return window.PLUGIN_BLOG_MANAGER_TOOLTIP_CLICK_UNPUBLISH || 'Click to unpublish'; },
        clickShow: function() { return window.PLUGIN_BLOG_MANAGER_TOOLTIP_CLICK_SHOW || 'Click to show'; },
        clickHide: function() { return window.PLUGIN_BLOG_MANAGER_TOOLTIP_CLICK_HIDE || 'Click to hide'; },
        calClickStart: function() { return window.PLUGIN_BLOG_MANAGER_CALENDAR_CLICK_START || 'Click to select start date'; },
        calClear: function() { return window.PLUGIN_BLOG_MANAGER_CALENDAR_CLEAR || 'clear'; },
        postCount: function(total) {
            var tpl = window.PLUGIN_BLOG_MANAGER_POST_COUNT || 'of {total} posts';
            return tpl.replace('{total}', total);
        },
        bulkSelected: function() { return window.PLUGIN_BLOG_MANAGER_BULK_SELECTED || 'selected'; },
        noPosts: function() { return window.PLUGIN_BLOG_MANAGER_NO_POSTS || 'No blog posts found'; },
        selectAll: function() { return window.PLUGIN_BLOG_MANAGER_SELECT_ALL || 'Select all'; },
        btnExport: function() { return window.PLUGIN_BLOG_MANAGER_BTN_EXPORT || 'Export'; },
        btnExportAll: function() { return window.PLUGIN_BLOG_MANAGER_BTN_EXPORT_ALL || 'Export All'; },
        btnImport: function() { return window.PLUGIN_BLOG_MANAGER_BTN_IMPORT || 'Import'; },
        importSuccess: function(n) {
            var tpl = window.PLUGIN_BLOG_MANAGER_IMPORT_SUCCESS || '{n} post(s) imported';
            return tpl.replace('{n}', n);
        }
    };

    /* ---- IndexedDB Image Cache ---- */
    var ImgCache = {
        db: null,
        ready: false,

        init: function(cb) {
            if (!window.indexedDB) { ImgCache.ready = true; cb(); return; }
            try {
                var req = indexedDB.open('bm-img-cache', 1);
                req.onupgradeneeded = function(e) {
                    var db = e.target.result;
                    if (!db.objectStoreNames.contains('blobs')) {
                        db.createObjectStore('blobs');
                    }
                };
                req.onsuccess = function(e) {
                    ImgCache.db = e.target.result;
                    ImgCache.ready = true;
                    cb();
                };
                req.onerror = function() {
                    ImgCache.ready = true;
                    cb();
                };
            } catch(e) {
                ImgCache.ready = true;
                cb();
            }
        },

        get: function(url, cb) {
            if (!this.db) { cb(null); return; }
            try {
                var tx = this.db.transaction('blobs', 'readonly');
                var store = tx.objectStore('blobs');
                var req = store.get(url);
                req.onsuccess = function() {
                    if (req.result) {
                        cb(URL.createObjectURL(req.result));
                    } else {
                        cb(null);
                    }
                };
                req.onerror = function() { cb(null); };
            } catch(e) { cb(null); }
        },

        put: function(url, blob) {
            if (!this.db) return;
            try {
                var tx = this.db.transaction('blobs', 'readwrite');
                tx.objectStore('blobs').put(blob, url);
            } catch(e) {}
        },

        fetchAndCache: function(url, cb) {
            var self = this;
            fetch(url).then(function(r) {
                if (!r.ok) throw new Error('fetch failed');
                return r.blob();
            }).then(function(blob) {
                self.put(url, blob);
                cb(URL.createObjectURL(blob));
            }).catch(function() {
                cb(url);
            });
        },

        resolve: function(url, cb) {
            if (!url || !this.ready) { cb(url); return; }
            var self = this;
            this.get(url, function(cached) {
                if (cached) {
                    cb(cached);
                } else {
                    self.fetchAndCache(url, cb);
                }
            });
        },

        resolveAll: function(posts, placeholderUrl, callback) {
            var self = this;
            var urls = [];
            var urlMap = {};
            for (var i = 0; i < posts.length; i++) {
                var u = posts[i].image_url;
                if (u && !urlMap[u]) { urlMap[u] = true; urls.push(u); }
            }
            if (placeholderUrl && !urlMap[placeholderUrl]) {
                urlMap[placeholderUrl] = true;
                urls.push(placeholderUrl);
            }
            var remaining = urls.length;
            if (remaining === 0) { callback(); return; }
            var results = {};
            for (var j = 0; j < urls.length; j++) {
                (function(url) {
                    self.resolve(url, function(resolved) {
                        results[url] = resolved;
                        remaining--;
                        if (remaining === 0) {
                            for (var k = 0; k < posts.length; k++) {
                                if (posts[k].image_url && results[posts[k].image_url]) {
                                    posts[k].image_url = results[posts[k].image_url];
                                }
                            }
                            if (placeholderUrl && results[placeholderUrl]) {
                                PLACEHOLDER_IMG = results[placeholderUrl];
                            }
                            callback();
                        }
                    });
                })(urls[j]);
            }
        }
    };

    var dateFmt = new Intl.DateTimeFormat(LOCALE, { year: '2-digit', month: 'numeric', day: 'numeric' });
    var dateFmtTime = new Intl.DateTimeFormat(LOCALE, { year: '2-digit', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    function normalizeDateToYMD(dateStr) {
        var d = parseDateStr(dateStr);
        if (!d) return '';
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    }

    function parseDateStr(dateStr) {
        if (!dateStr) return null;
        var s = dateStr.trim().replace(/['"]/g, '');
        var hasTime = false;
        var timePart = '00:00';
        var spaceIdx = s.indexOf(' ');
        if (spaceIdx !== -1) {
            timePart = s.substring(spaceIdx + 1).trim();
            s = s.substring(0, spaceIdx).trim();
            hasTime = true;
        }
        var parts;
        if (s.indexOf('-') !== -1) {
            parts = s.split('-');
        } else if (s.indexOf('/') !== -1) {
            parts = s.split('/');
        } else {
            return null;
        }
        if (parts.length !== 3) return null;
        var a = parseInt(parts[0], 10), b = parseInt(parts[1], 10), c = parseInt(parts[2], 10);
        var y, m, d;
        if (a > 1000) {
            y = a; m = b; d = c;
        } else {
            d = a; m = b; y = c;
        }
        if (y < 100) y += 2000;
        var h = 0, mn = 0;
        if (hasTime && timePart.indexOf(':') !== -1) {
            var tp = timePart.split(':');
            h = parseInt(tp[0], 10) || 0;
            mn = parseInt(tp[1], 10) || 0;
        }
        return new Date(y, m - 1, d, h, mn);
    }

    function formatLocaleDate(dateStr) {
        var d = parseDateStr(dateStr);
        if (!d) return '--';
        try { return dateFmt.format(d); } catch (e) { return dateStr; }
    }

    function formatLocaleDateCard(dateStr) {
        var d = parseDateStr(dateStr);
        if (!d) return '--';
        try { return dateFmtTime.format(d); } catch (e) { return dateStr; }
    }

    var BlogManager = {
        posts: [],
        filteredPosts: [],
        newPostUrl: '#',
        currentView: 'grid',
        categories: [],
        tags: [],
        languages: [],
        pendingDeleteFolder: null,
        rangeStart: null,
        rangeEnd: null,
        rangeCalYear: new Date().getFullYear(),
        rangeCalMonth: new Date().getMonth(),
        rangeStep: 0,
        selectedPosts: {},
        lastSelectedIndex: -1,

        init: function() {
            var self = this;
            var savedView = sessionStorage.getItem('blogManagerView');
            if (savedView && (savedView === 'grid' || savedView === 'smallgrid' || savedView === 'list')) {
                this.currentView = savedView;
                var container = document.getElementById('blog-manager-posts');
                if (container) container.className = 'blog-posts-list view-' + savedView;
                var btns = document.querySelectorAll('.view-btn');
                for (var i = 0; i < btns.length; i++) {
                    btns[i].classList.toggle('active', btns[i].getAttribute('data-view') === savedView);
                }
            }
            this.renderSkeletons();
            this.renderRangeCalendar();
            ImgCache.init(function() {
                self.loadPosts();
            });
        },

        renderSkeletons: function() {
            var container = document.getElementById('blog-manager-posts');
            if (!container) return;

            var cardsHtml = '';
            for (var c = 0; c < 12; c++) {
                cardsHtml += '<div class="skel-card"><div class="skel-card-inner">' +
                    '<div class="skel-thumb skel-block"></div>' +
                    '<div class="skel-card-body">' +
                    '<div class="skel-line title skel-block"></div>' +
                    '<div style="display:flex;gap:10px;margin-bottom:8px"><div class="skel-line short skel-block" style="margin:0"></div><div class="skel-line short skel-block" style="margin:0;width:30%"></div></div>' +
                    '<div style="margin-bottom:8px"><div class="skel-line badge skel-block"></div><div class="skel-line badge skel-block"></div></div>' +
                    '<div class="skel-line skel-block"></div>' +
                    '<div class="skel-line skel-block" style="width:75%"></div>' +
                    '<div class="skel-actions"><div class="skel-line btn skel-block"></div><div class="skel-line btn skel-block"></div><div class="skel-line btn skel-block"></div></div>' +
                    '</div></div></div>';
            }

            var listHtml = '<div class="list-header">' +
                '<div class="lh-select"></div>' +
                '<div class="lh-title">' + T.colTitle() + '</div>' +
                '<div class="lh-lang">' + T.colLang() + '</div>' +
                '<div class="lh-excerpt">' + T.colExcerpt() + '</div>' +
                '<div class="lh-date">' + T.colDate() + '</div>' +
                '<div class="lh-published">' + T.colPublished() + '</div>' +
                '<div class="lh-visible">' + T.colVisible() + '</div>' +
                '<div class="lh-category">' + T.colCategory() + '</div>' +
                '<div class="lh-tags">' + T.colTags() + '</div>' +
                '<div class="lh-actions">' + T.colActions() + '</div>' +
                '</div>';
            for (var r = 0; r < 16; r++) {
                listHtml += '<div class="skel-list-row">' +
                    '<div class="skel-sel"><div class="skel-block"></div></div>' +
                    '<div class="skel-title"><div class="skel-block" style="height:14px;width:85%"></div></div>' +
                    '<div class="skel-lang"><div class="skel-block" style="height:14px;width:30px;border-radius:3px"></div></div>' +
                    '<div class="skel-excerpt"><div class="skel-block" style="height:12px"></div></div>' +
                    '<div class="skel-date"><div class="skel-block" style="height:20px;border-radius:3px"></div></div>' +
                    '<div class="skel-pub"><div class="skel-block"></div></div>' +
                    '<div class="skel-vis"><div class="skel-block"></div></div>' +
                    '<div class="skel-cat"><div class="skel-block" style="height:12px;width:70%"></div></div>' +
                    '<div class="skel-tags"><div class="skel-block" style="height:18px;width:60%;border-radius:10px"></div></div>' +
                    '<div class="skel-acts"><div class="skel-block"></div><div class="skel-block"></div><div class="skel-block"></div></div>' +
                    '</div>';
            }

            container.innerHTML =
                '<div class="bm-cards-wrap">' + cardsHtml + '</div>' +
                '<div class="bm-list-wrap">' + listHtml + '</div>';
            container.className = 'blog-posts-list view-' + this.currentView;
        },

        loadPosts: function() {
            var self = this;
            var xhr = new XMLHttpRequest();
            var baseUrl = window.location.href.split('?')[0].replace(/\/$/, '');
            xhr.open('GET', baseUrl + '/task:blogManagerList');
            xhr.setRequestHeader('Content-Type', 'application/json');

            xhr.onload = function() {
                if (xhr.status === 200) {
                    var response = JSON.parse(xhr.responseText);
                    if (response.status === 'success') {
                        self.posts = response.posts || [];
                        self.newPostUrl = response.new_post_url || '#';
                        var phUrl = response.placeholder_url || '';
                        if (phUrl) PLACEHOLDER_IMG = phUrl;
                        self.selectedPosts = {};
                        self.lastSelectedIndex = -1;
                        var afterLoad = function() {
                            self.extractTaxonomies();
                            self.populateFilterDropdowns();
                            self.applyFilters();
                        };
                        if (window.BM_IMAGE_CACHE && ImgCache.ready) {
                            ImgCache.resolveAll(self.posts, phUrl, afterLoad);
                        } else {
                            afterLoad();
                        }
                    }
                }
            };
            xhr.send();
        },

        extractTaxonomies: function() {
            var cats = {};
            var tgs = {};
            var lngs = {};
            for (var i = 0; i < this.posts.length; i++) {
                var tax = this.posts[i].taxonomy;
                if (tax) {
                    if (tax.category) {
                        for (var c = 0; c < tax.category.length; c++) cats[tax.category[c]] = true;
                    }
                    if (tax.tag) {
                        for (var t = 0; t < tax.tag.length; t++) tgs[tax.tag[t]] = true;
                    }
                }
                if (this.posts[i].lang) lngs[this.posts[i].lang] = true;
            }
            this.categories = Object.keys(cats).sort();
            this.tags = Object.keys(tgs).sort();
            this.languages = Object.keys(lngs).sort();
        },

        populateFilterDropdowns: function() {
            var allText = T.filterAll();
            var catSelect = document.getElementById('filter-category');
            if (catSelect) {
                catSelect.innerHTML = '<option value="">' + allText + '</option>';
                for (var i = 0; i < this.categories.length; i++) {
                    catSelect.innerHTML += '<option value="' + this.escapeHtml(this.categories[i]) + '">' + this.escapeHtml(this.categories[i]) + '</option>';
                }
            }
            var tagSelect = document.getElementById('filter-tag');
            if (tagSelect) {
                tagSelect.innerHTML = '<option value="">' + allText + '</option>';
                for (var j = 0; j < this.tags.length; j++) {
                    tagSelect.innerHTML += '<option value="' + this.escapeHtml(this.tags[j]) + '">' + this.escapeHtml(this.tags[j]) + '</option>';
                }
            }
            var langSelect = document.getElementById('filter-language');
            if (langSelect && this.languages) {
                langSelect.innerHTML = '<option value="">' + allText + '</option>';
                for (var k = 0; k < this.languages.length; k++) {
                    langSelect.innerHTML += '<option value="' + this.escapeHtml(this.languages[k]) + '">' + this.escapeHtml(this.languages[k]) + '</option>';
                }
            }
        },

        applyFilters: function() {
            var text = (document.getElementById('filter-text').value || '').toLowerCase();
            var visible = document.getElementById('filter-visible').value;
            var published = document.getElementById('filter-published').value;
            var category = document.getElementById('filter-category').value;
            var tag = document.getElementById('filter-tag').value;
            var language = document.getElementById('filter-language').value;
            var dateBegin = document.getElementById('filter-date-begin').value || null;
            var dateEnd = document.getElementById('filter-date-end').value || null;

            this.filteredPosts = this.posts.filter(function(post) {
                if (text) {
                    var inTitle = (post.title || '').toLowerCase().indexOf(text) !== -1;
                    var inExcerpt = (post.excerpt || '').toLowerCase().indexOf(text) !== -1;
                    if (!inTitle && !inExcerpt) return false;
                }
                if (visible !== '') {
                    var vis = post.visible ? '1' : '0';
                    if (vis !== visible) return false;
                }
                if (published !== '') {
                    var pub = post.published ? '1' : '0';
                    if (pub !== published) return false;
                }
                if (language !== '' && post.lang !== language) return false;
                if (dateBegin) {
                    var postYMD = normalizeDateToYMD(post.date);
                    if (!postYMD || postYMD < dateBegin) return false;
                }
                if (dateEnd) {
                    var postYMD2 = normalizeDateToYMD(post.date);
                    if (!postYMD2 || postYMD2 > dateEnd) return false;
                }
                if (category) {
                    var cats = post.taxonomy && post.taxonomy.category ? post.taxonomy.category : [];
                    if (cats.indexOf(category) === -1) return false;
                }
                if (tag) {
                    var tags = post.taxonomy && post.taxonomy.tag ? post.taxonomy.tag : [];
                    if (tags.indexOf(tag) === -1) return false;
                }
                return true;
            });

            this.renderPosts();
        },

        clearFilters: function() {
            document.getElementById('filter-text').value = '';
            document.getElementById('filter-visible').value = '';
            document.getElementById('filter-published').value = '';
            document.getElementById('filter-category').value = '';
            document.getElementById('filter-tag').value = '';
            document.getElementById('filter-language').value = '';
            document.getElementById('filter-date-begin').value = '';
            document.getElementById('filter-date-end').value = '';
            this.applyFilters();
        },

        setView: function(view) {
            this.currentView = view;
            sessionStorage.setItem('blogManagerView', view);
            var container = document.getElementById('blog-manager-posts');
            container.className = 'blog-posts-list view-' + view;

            var btns = document.querySelectorAll('.view-btn');
            for (var i = 0; i < btns.length; i++) {
                btns[i].classList.toggle('active', btns[i].getAttribute('data-view') === view);
            }

            this.updateBulkBar();
        },

        renderPosts: function() {
            var container = document.getElementById('blog-manager-posts');
            if (!container) return;

            var countEl = document.getElementById('post-count');
            if (countEl) {
                countEl.textContent = this.filteredPosts.length + ' ' + T.postCount(this.posts.length);
            }

            if (this.filteredPosts.length === 0) {
                container.innerHTML = '<p class="no-posts">' + T.noPosts() + '</p>';
                container.className = 'blog-posts-list view-' + this.currentView;
                return;
            }

            var cardsHtml = '';
            var listHtml = this.renderListHeader();
            for (var i = 0; i < this.filteredPosts.length; i++) {
                cardsHtml += this.renderCard(this.filteredPosts[i]);
                listHtml += this.renderListRow(this.filteredPosts[i]);
            }

            container.innerHTML =
                '<div class="bm-cards-wrap">' + cardsHtml + '</div>' +
                '<div class="bm-list-wrap">' + listHtml + '</div>';
            container.className = 'blog-posts-list view-' + this.currentView;
            this.updateBulkBar();
        },

        renderListHeader: function() {
            return '<div class="list-header">' +
                '<div class="lh-select"><input type="checkbox" onchange="BlogManager.toggleSelectAll(this.checked)" title="' + T.selectAll() + '"></div>' +
                '<div class="lh-title">' + T.colTitle() + '</div>' +
                '<div class="lh-lang">' + T.colLang() + '</div>' +
                '<div class="lh-excerpt">' + T.colExcerpt() + '</div>' +
                '<div class="lh-date">' + T.colDate() + '</div>' +
                '<div class="lh-published">' + T.colPublished() + '</div>' +
                '<div class="lh-visible">' + T.colVisible() + '</div>' +
                '<div class="lh-category">' + T.colCategory() + '</div>' +
                '<div class="lh-tags">' + T.colTags() + '</div>' +
                '<div class="lh-actions">' + T.colActions() + '</div>' +
                '</div>';
        },

        renderListRow: function(post) {
            var editUrl = post.edit_url || '#';
            var category = post.taxonomy && post.taxonomy.category ? post.taxonomy.category.join(', ') : '';
            var tags = post.taxonomy && post.taxonomy.tag ? post.taxonomy.tag.join(', ') : '';
            var f = this.escapeHtml(post.folder);
            var isSelected = !!this.selectedPosts[post.folder];
            var selClass = isSelected ? ' selected' : '';

            var published = post.published
                ? '<span class="badge green toggle-badge" data-field="published" onclick="BlogManager.toggleField(\'' + f + '\',\'published\')" title="' + T.clickUnpublish() + '"><i class="fa fa-check-circle"></i></span>'
                : '<span class="badge toggle-badge" data-field="published" onclick="BlogManager.toggleField(\'' + f + '\',\'published\')" title="' + T.clickPublish() + '"><i class="fa fa-circle-o"></i></span>';
            var visible = post.visible
                ? '<span class="badge green toggle-badge" data-field="visible" onclick="BlogManager.toggleField(\'' + f + '\',\'visible\')" title="' + T.clickHide() + '"><i class="fa fa-eye"></i></span>'
                : '<span class="badge toggle-badge" data-field="visible" onclick="BlogManager.toggleField(\'' + f + '\',\'visible\')" title="' + T.clickShow() + '"><i class="fa fa-eye-slash"></i></span>';

            var html = '<div class="list-row' + selClass + '" data-folder="' + f + '">';
            html += '<div class="lr-select"><input type="checkbox"' + (isSelected ? ' checked' : '') + ' onchange="BlogManager.selectClick(event,\'' + f + '\')"></div>';
            html += '<div class="lr-title"><a href="' + editUrl + '">' + this.escapeHtml(post.title) + '</a></div>';
            html += '<div class="lr-lang">' + (post.lang ? '<span class="lang-pill">' + this.escapeHtml(post.lang.toUpperCase()) + '</span>' : '-') + '</div>';
            html += '<div class="lr-excerpt">' + (post.excerpt ? this.escapeHtml(post.excerpt) : '-') + '</div>';
            html += '<div class="lr-date">' + this.renderDateTag(post.date) + '</div>';
            html += '<div class="lr-published">' + published + '</div>';
            html += '<div class="lr-visible">' + visible + '</div>';
            html += '<div class="lr-category">' + (category ? this.escapeHtml(category) : '-') + '</div>';
            html += '<div class="lr-tags">' + (tags ? this.renderTagPills(post.taxonomy.tag) : '-') + '</div>';
            html += '<div class="lr-actions">';
            html += '<a class="button button-small" href="' + editUrl + '" title="' + T.btnEdit() + '"><i class="fa fa-pencil"></i></a> ';
            html += '<button class="button button-small" onclick="BlogManager.duplicatePost(\'' + f + '\')" title="' + T.btnDuplicate() + '"><i class="fa fa-clone"></i></button> ';
            html += '<button class="button button-small danger" onclick="BlogManager.confirmDelete(\'' + f + '\',\'' + this.escapeHtml(post.title) + '\')" title="' + T.btnDelete() + '"><i class="fa fa-trash"></i></button>';
            html += '</div></div>';
            return html;
        },

        renderCard: function(post) {
            var editUrl = post.edit_url || '#';
            var category = post.taxonomy && post.taxonomy.category ? post.taxonomy.category.join(', ') : '';
            var tags = post.taxonomy && post.taxonomy.tag ? post.taxonomy.tag.join(', ') : '';
            var f = this.escapeHtml(post.folder);
            var isSelected = !!this.selectedPosts[post.folder];
            var selClass = isSelected ? ' selected' : '';

            var published = post.published
                ? '<span class="badge green toggle-badge" data-field="published" onclick="BlogManager.toggleField(\'' + f + '\',\'published\')" title="' + T.clickUnpublish() + '"><i class="fa fa-check-circle"></i> <span class="badge-text">' + T.published() + '</span></span>'
                : '<span class="badge toggle-badge" data-field="published" onclick="BlogManager.toggleField(\'' + f + '\',\'published\')" title="' + T.clickPublish() + '"><i class="fa fa-circle-o"></i> <span class="badge-text">' + T.unpublished() + '</span></span>';
            var visible = post.visible
                ? '<span class="badge green toggle-badge" data-field="visible" onclick="BlogManager.toggleField(\'' + f + '\',\'visible\')" title="' + T.clickHide() + '"><i class="fa fa-eye"></i> <span class="badge-text">' + T.visible() + '</span></span>'
                : '<span class="badge toggle-badge" data-field="visible" onclick="BlogManager.toggleField(\'' + f + '\',\'visible\')" title="' + T.clickShow() + '"><i class="fa fa-eye-slash"></i> <span class="badge-text">' + T.hidden() + '</span></span>';

            var html = '<div class="blog-post-card' + selClass + '" data-folder="' + f + '"><div class="blog-post-card-inner">';
            html += '<div class="bm-select-overlay"><input type="checkbox"' + (isSelected ? ' checked' : '') + ' onclick="BlogManager.selectClick(event,\'' + f + '\')"></div>';
            var thumbSrc = post.image_url || PLACEHOLDER_IMG;
            var langBadge = post.lang ? '<span class="lang-badge">' + this.escapeHtml(post.lang.toUpperCase()) + '</span>' : '';
            html += '<a href="' + editUrl + '" class="blog-post-thumb">' + langBadge + '<img src="' + thumbSrc + '" alt=""></a>';
            html += '<div class="blog-post-body">';
            html += '<div class="blog-post-title"><a href="' + editUrl + '">' + this.escapeHtml(post.title) + '</a></div>';
            html += '<div class="blog-post-meta">';
            if (post.date) html += '<span title="' + this.escapeHtml(formatLocaleDateCard(post.date)) + '"><i class="fa fa-calendar"></i> ' + formatLocaleDate(post.date) + '</span>';
            if (category) html += '<span><i class="fa fa-folder"></i> ' + this.escapeHtml(category) + '</span>';
            html += '</div>';
            html += '<div class="blog-post-meta">' + published + visible + '</div>';
            if (post.excerpt) html += '<div class="blog-post-excerpt">' + this.escapeHtml(post.excerpt) + '</div>';
            if (post.taxonomy && post.taxonomy.tag && post.taxonomy.tag.length) html += '<div class="blog-post-tags"><i class="fa fa-tags"></i> ' + this.renderTagPills(post.taxonomy.tag) + '</div>';
            html += '<div class="blog-post-actions">';
            html += '<a class="button button-small" href="' + editUrl + '"><i class="fa fa-pencil"></i> ' + T.btnEdit() + '</a> ';
            html += '<button class="button button-small" onclick="BlogManager.duplicatePost(\'' + f + '\')"><i class="fa fa-clone"></i> ' + T.btnDuplicate() + '</button> ';
            html += '<button class="button button-small danger" onclick="BlogManager.confirmDelete(\'' + f + '\',\'' + this.escapeHtml(post.title) + '\')"><i class="fa fa-trash"></i> ' + T.btnDelete() + '</button>';
            html += '</div></div></div></div>';
            return html;
        },

        renderDateTag: function(dateStr) {
            return '<span class="date-tag" title="' + this.escapeHtml(formatLocaleDateCard(dateStr)) + '">' + formatLocaleDate(dateStr) + '</span>';
        },

        renderTagPills: function(tags) {
            if (!tags || !tags.length) return '-';
            var colors = ['#e8f0fe', '#fce8e6', '#e6f4ea', '#fef7e0', '#f3e8fd', '#e0f7fa', '#fff3e0', '#e8eaf6'];
            var textColors = ['#1a73e8', '#d93025', '#1e8e3e', '#f9ab00', '#7b1fa2', '#00838f', '#e65100', '#3949ab'];
            var html = '';
            for (var i = 0; i < tags.length; i++) {
                var hash = 0;
                var name = tags[i];
                for (var j = 0; j < name.length; j++) {
                    hash = name.charCodeAt(j) + ((hash << 5) - hash);
                }
                var idx = Math.abs(hash) % colors.length;
                html += '<span class="tag-pill" style="background:' + colors[idx] + ';color:' + textColors[idx] + '">' + this.escapeHtml(name) + '</span>';
            }
            return html;
        },

        /* ---- Range Calendar ---- */
        renderRangeCalendar: function() {
            var el = document.getElementById('range-calendar');
            if (!el) return;

            var year = this.rangeCalYear;
            var month = this.rangeCalMonth;
            var firstDay = new Date(year, month, 1).getDay();
            var daysInMonth = new Date(year, month + 1, 0).getDate();
            var today = new Date();
            var todayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');

            var startOffset = (firstDay === 0) ? 6 : firstDay - 1;

            var html = '<div class="rc-header">';
            html += '<button class="rc-nav" onclick="BlogManager.rangeNav(-1)"><i class="fa fa-chevron-left"></i></button>';
            html += '<span class="rc-label">' + MONTHS[month] + ' ' + year + '</span>';
            html += '<button class="rc-nav" onclick="BlogManager.rangeNav(1)"><i class="fa fa-chevron-right"></i></button>';
            html += '</div>';

            html += '<div class="rc-weekdays">';
            for (var d = 0; d < DAYS.length; d++) {
                html += '<span>' + DAYS[d] + '</span>';
            }
            html += '</div>';

            html += '<div class="rc-days">';
            for (var e = 0; e < startOffset; e++) {
                html += '<span class="rc-day empty"></span>';
            }
            for (var day = 1; day <= daysInMonth; day++) {
                var dateStr = year + '-' + String(month+1).padStart(2,'0') + '-' + String(day).padStart(2,'0');
                var cls = 'rc-day';
                if (dateStr === todayStr) cls += ' today';
                if (this.rangeStart && dateStr === this.rangeStart) cls += ' start';
                if (this.rangeEnd && dateStr === this.rangeEnd) cls += ' end';
                if (this.rangeStart && this.rangeEnd && dateStr > this.rangeStart && dateStr < this.rangeEnd) cls += ' in-range';
                html += '<span class="' + cls + '" onclick="BlogManager.rangeClick(\'' + dateStr + '\')">' + day + '</span>';
            }
            html += '</div>';

            html += '<div class="rc-summary">';
            if (this.rangeStart) {
                html += formatLocaleDate(this.rangeStart);
                if (this.rangeEnd) html += ' &rarr; ' + formatLocaleDate(this.rangeEnd);
                html += ' <button class="rc-clear" onclick="BlogManager.clearDateRange()">' + T.calClear() + '</button>';
            } else {
                html += T.calClickStart();
            }
            html += '</div>';

            el.innerHTML = html;
        },

        rangeNav: function(dir) {
            this.rangeCalMonth += dir;
            if (this.rangeCalMonth > 11) { this.rangeCalMonth = 0; this.rangeCalYear++; }
            if (this.rangeCalMonth < 0) { this.rangeCalMonth = 11; this.rangeCalYear--; }
            this.renderRangeCalendar();
        },

        rangeClick: function(dateStr) {
            if (this.rangeStep === 0 || (this.rangeStart && this.rangeEnd)) {
                this.rangeStart = dateStr;
                this.rangeEnd = null;
                this.rangeStep = 1;
            } else {
                if (dateStr < this.rangeStart) {
                    this.rangeEnd = this.rangeStart;
                    this.rangeStart = dateStr;
                } else {
                    this.rangeEnd = dateStr;
                }
                this.rangeStep = 0;
            }
            this.renderRangeCalendar();
            this.applyFilters();
        },

        clearDateRange: function() {
            this.rangeStart = null;
            this.rangeEnd = null;
            this.rangeStep = 0;
            this.renderRangeCalendar();
            this.applyFilters();
        },

        /* ---- Toggle / Delete ---- */
        toggleField: function(folder, field) {
            var self = this;
            var baseUrl = window.location.href.split('?')[0].replace(/\/$/, '');
            var url = baseUrl + '/task:blogManagerToggleField/folder:' + encodeURIComponent(folder) + '/field:' + field;

            var xhr = new XMLHttpRequest();
            xhr.open('POST', url);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.onload = function() {
                if (xhr.status === 200) {
                    var response = JSON.parse(xhr.responseText);
                    if (response.status === 'success') {
                        for (var i = 0; i < self.posts.length; i++) {
                            if (self.posts[i].folder === folder) {
                                self.posts[i][field] = response.value;
                                break;
                            }
                        }
                        self.patchBadge(folder, field, response.value);
                    }
                }
            };
            xhr.send();
        },

        patchBadge: function(folder, field, value) {
            var card = document.querySelector('[data-folder="' + folder + '"]');
            if (!card) return;
            var badge = card.querySelector('.toggle-badge[data-field="' + field + '"]');
            if (!badge) return;
            var icon = badge.querySelector('i');
            var txt = badge.querySelector('.badge-text');
            if (value) {
                badge.classList.add('green');
                if (field === 'published') {
                    if (icon) icon.className = 'fa fa-check-circle';
                    badge.setAttribute('title', T.clickUnpublish());
                    if (txt) txt.textContent = T.published();
                } else {
                    if (icon) icon.className = 'fa fa-eye';
                    badge.setAttribute('title', T.clickHide());
                    if (txt) txt.textContent = T.visible();
                }
            } else {
                badge.classList.remove('green');
                if (field === 'published') {
                    if (icon) icon.className = 'fa fa-circle-o';
                    badge.setAttribute('title', T.clickPublish());
                    if (txt) txt.textContent = T.unpublished();
                } else {
                    if (icon) icon.className = 'fa fa-eye-slash';
                    badge.setAttribute('title', T.clickShow());
                    if (txt) txt.textContent = T.hidden();
                }
            }
        },

        duplicatePost: function(folder) {
            var self = this;
            var baseUrl = window.location.href.split('?')[0].replace(/\/$/, '');
            var url = baseUrl + '/task:blogManagerDuplicate/folder:' + encodeURIComponent(folder);

            var xhr = new XMLHttpRequest();
            xhr.open('POST', url);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.onload = function() {
                if (xhr.status === 200) {
                    var response = JSON.parse(xhr.responseText);
                    if (response.status === 'success') {
                        self.loadPosts();
                    }
                }
            };
            xhr.send();
        },

        newPost: function() {
            var baseUrl = window.location.href.split('?')[0].replace(/\/$/, '');
            var url = baseUrl + '/task:blogManagerNewPost';

            var xhr = new XMLHttpRequest();
            xhr.open('POST', url);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.onload = function() {
                if (xhr.status === 200) {
                    var response = JSON.parse(xhr.responseText);
                    if (response.status === 'success' && response.edit_url) {
                        window.location.href = response.edit_url;
                    }
                }
            };
            xhr.send();
        },

        confirmDelete: function(folder, title) {
            this.pendingDeleteFolder = folder;
            var titleEl = document.getElementById('bm-delete-title');
            if (titleEl) titleEl.textContent = title || folder;
            var modal = document.getElementById('bm-delete-modal');
            if (modal) { modal.classList.add('active'); modal.style.display = 'flex'; }
        },

        cancelDelete: function() {
            this.pendingDeleteFolder = null;
            var modal = document.getElementById('bm-delete-modal');
            if (modal) { modal.classList.remove('active'); modal.style.display = 'none'; }
        },

        executeDelete: function() {
            var folder = this.pendingDeleteFolder;
            if (!folder) return;
            this.cancelDelete();

            var self = this;
            var baseUrl = window.location.href.split('?')[0].replace(/\/$/, '');
            var url = baseUrl + '/task:blogManagerDelete/folder:' + encodeURIComponent(folder);

            var xhr = new XMLHttpRequest();
            xhr.open('POST', url);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.onload = function() {
                if (xhr.status === 200) {
                    var response = JSON.parse(xhr.responseText);
                    if (response.status === 'success') self.loadPosts();
                }
            };
            xhr.send();
        },

        /* ---- Multi-Select ---- */
        selectClick: function(e, folder) {
            e = e || window.event;
            var ctrlKey = e.ctrlKey || e.metaKey;
            var shiftKey = e.shiftKey;

            // Find index in filteredPosts
            var idx = -1;
            for (var i = 0; i < this.filteredPosts.length; i++) {
                if (this.filteredPosts[i].folder === folder) { idx = i; break; }
            }

            if (shiftKey && this.lastSelectedIndex >= 0) {
                var start = Math.min(this.lastSelectedIndex, idx);
                var end = Math.max(this.lastSelectedIndex, idx);
                for (var j = start; j <= end; j++) {
                    this.selectedPosts[this.filteredPosts[j].folder] = true;
                }
            } else if (ctrlKey) {
                if (this.selectedPosts[folder]) {
                    delete this.selectedPosts[folder];
                } else {
                    this.selectedPosts[folder] = true;
                }
            } else {
                // Single click on checkbox: just toggle this one
                if (this.selectedPosts[folder]) {
                    delete this.selectedPosts[folder];
                } else {
                    this.selectedPosts[folder] = true;
                }
            }
            this.lastSelectedIndex = idx;
            this.patchSelection();
        },

        toggleSelectAll: function(checked) {
            if (checked) {
                for (var i = 0; i < this.filteredPosts.length; i++) {
                    this.selectedPosts[this.filteredPosts[i].folder] = true;
                }
            } else {
                this.selectedPosts = {};
            }
            this.patchSelection();
        },

        clearSelection: function() {
            this.selectedPosts = {};
            this.lastSelectedIndex = -1;
            this.patchSelection();
        },

        patchSelection: function() {
            var cards = document.querySelectorAll('[data-folder]');
            for (var i = 0; i < cards.length; i++) {
                var folder = cards[i].getAttribute('data-folder');
                var isSelected = !!this.selectedPosts[folder];
                cards[i].classList.toggle('selected', isSelected);
                var cb = cards[i].querySelector('input[type="checkbox"]');
                if (cb) cb.checked = isSelected;
            }
            var selectAllCb = document.querySelector('.lh-select input[type="checkbox"]');
            if (selectAllCb) {
                var allSelected = this.filteredPosts.length > 0 && this.filteredPosts.every(function(p) { return !!this.selectedPosts[p.folder]; }.bind(this));
                selectAllCb.checked = allSelected;
            }
            this.updateBulkBar();
        },

        updateBulkBar: function() {
            var bar = document.getElementById('bm-bulk-bar');
            var titlebar = document.querySelector('.bm-titlebar');
            if (!bar) return;
            var keys = Object.keys(this.selectedPosts);
            if (keys.length > 0) {
                bar.style.display = 'flex';
                bar.innerHTML = '<span class="bm-bulk-count">' + keys.length + ' ' + T.bulkSelected() + '</span>' +
                    '<span class="bm-bulk-group">' +
                    '<button class="button button-small" onclick="BlogManager.bulkToggleField(\'published\')"><i class="fa fa-check-circle"></i> <span class="button-text">' + T.btnPublish() + '</span></button>' +
                    '<button class="button button-small" onclick="BlogManager.bulkToggleField(\'visible\')"><i class="fa fa-eye"></i> <span class="button-text">' + T.btnVisible() + '</span></button>' +
                    '</span>' +
                    '<span class="bm-bulk-group">' +
                    '<button class="button button-small" onclick="BlogManager.confirmBulkDuplicate()"><i class="fa fa-clone"></i> <span class="button-text">' + T.btnDuplicate() + '</span></button>' +
                    '<button class="button button-small" onclick="BlogManager.exportSelectedPosts()"><i class="fa fa-download"></i> <span class="button-text">' + T.btnExport() + '</span></button>' +
                    '<button class="button button-small danger" onclick="BlogManager.confirmBulkDelete()"><i class="fa fa-trash"></i> <span class="button-text">' + T.btnDelete() + '</span></button>' +
                    '<button class="button button-small" onclick="BlogManager.clearSelection()"><i class="fa fa-times"></i> <span class="button-text">' + T.btnClear() + '</span></button>' +
                    '</span>';
                if (titlebar) titlebar.classList.add('bm-bulk-active');
            } else {
                bar.style.display = 'none';
                bar.innerHTML = '';
                if (titlebar) titlebar.classList.remove('bm-bulk-active');
            }
        },

        bulkToggleField: function(field) {
            var folders = Object.keys(this.selectedPosts);
            if (folders.length === 0) return;
            var self = this;
            var baseUrl = window.location.href.split('?')[0].replace(/\/$/, '');
            var completed = 0;
            for (var i = 0; i < folders.length; i++) {
                var url = baseUrl + '/task:blogManagerToggleField/folder:' + encodeURIComponent(folders[i]) + '/field:' + field;
                var xhr = new XMLHttpRequest();
                xhr.open('POST', url);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.onload = (function(folder) {
                    return function() {
                        completed++;
                        if (xhr.status === 200) {
                            var response = JSON.parse(xhr.responseText);
                            if (response.status === 'success') {
                                for (var j = 0; j < self.posts.length; j++) {
                                    if (self.posts[j].folder === folder) {
                                        self.posts[j][field] = response.value;
                                        break;
                                    }
                                }
                            }
                        }
                        if (completed === folders.length) {
                            self.selectedPosts = {};
                            self.applyFilters();
                        }
                    };
                })(folders[i]);
                xhr.send();
            }
        },

        confirmBulkDuplicate: function() {
            var keys = Object.keys(this.selectedPosts);
            if (keys.length === 0) return;
            var titleEl = document.getElementById('bm-bulk-title');
            if (titleEl) titleEl.textContent = keys.length + ' post' + (keys.length > 1 ? 's' : '');
            var modal = document.getElementById('bm-bulk-duplicate-modal');
            if (modal) { modal.classList.add('active'); modal.style.display = 'flex'; }
        },

        executeBulkDuplicate: function() {
            var modal = document.getElementById('bm-bulk-duplicate-modal');
            if (modal) { modal.classList.remove('active'); modal.style.display = 'none'; }
            var folders = Object.keys(this.selectedPosts);
            if (folders.length === 0) return;
            var self = this;
            var baseUrl = window.location.href.split('?')[0].replace(/\/$/, '');
            var completed = 0;
            for (var i = 0; i < folders.length; i++) {
                var url = baseUrl + '/task:blogManagerDuplicate/folder:' + encodeURIComponent(folders[i]);
                var xhr = new XMLHttpRequest();
                xhr.open('POST', url);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.onload = function() {
                    completed++;
                    if (completed === folders.length) {
                        self.selectedPosts = {};
                        self.loadPosts();
                    }
                };
                xhr.send();
            }
        },

        confirmBulkDelete: function() {
            var keys = Object.keys(this.selectedPosts);
            if (keys.length === 0) return;
            var titleEl = document.getElementById('bm-bulk-delete-title');
            if (titleEl) titleEl.textContent = keys.length + ' post' + (keys.length > 1 ? 's' : '');
            var modal = document.getElementById('bm-bulk-delete-modal');
            if (modal) { modal.classList.add('active'); modal.style.display = 'flex'; }
        },

        executeBulkDelete: function() {
            var modal = document.getElementById('bm-bulk-delete-modal');
            if (modal) { modal.classList.remove('active'); modal.style.display = 'none'; }
            var folders = Object.keys(this.selectedPosts);
            if (folders.length === 0) return;
            var self = this;
            var baseUrl = window.location.href.split('?')[0].replace(/\/$/, '');
            var completed = 0;
            for (var i = 0; i < folders.length; i++) {
                var url = baseUrl + '/task:blogManagerDelete/folder:' + encodeURIComponent(folders[i]);
                var xhr = new XMLHttpRequest();
                xhr.open('POST', url);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.onload = function() {
                    completed++;
                    if (completed === folders.length) {
                        self.selectedPosts = {};
                        self.loadPosts();
                    }
                };
                xhr.send();
            }
        },

        /* ---- Export / Import ---- */
        exportAllPosts: function() {
            this.exportPosts([]);
        },

        exportSelectedPosts: function() {
            var folders = Object.keys(this.selectedPosts);
            if (folders.length === 0) return;
            this.exportPosts(folders);
        },

        exportPosts: function(folders) {
            var baseUrl = window.location.href.split('?')[0].replace(/\/$/, '');
            var url = baseUrl + '/task:blogManagerExport';

            var form = document.createElement('form');
            form.method = 'POST';
            form.action = url;
            form.style.display = 'none';

            var input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'folders';
            input.value = folders.join(',');
            form.appendChild(input);

            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);
        },

        triggerImport: function() {
            var self = this;
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = '.zip';
            input.style.display = 'none';
            input.onchange = function(e) {
                if (e.target.files.length > 0) {
                    self.importPosts(e.target.files[0]);
                }
                document.body.removeChild(input);
            };
            document.body.appendChild(input);
            input.click();
        },

        importPosts: function(file) {
            var self = this;
            var baseUrl = window.location.href.split('?')[0].replace(/\/$/, '');
            var url = baseUrl + '/task:blogManagerImport';

            var formData = new FormData();
            formData.append('zipfile', file);

            var xhr = new XMLHttpRequest();
            xhr.open('POST', url);
            xhr.onload = function() {
                if (xhr.status === 200) {
                    var response = JSON.parse(xhr.responseText);
                    if (response.status === 'success') {
                        var msg = T.importSuccess(response.imported);
                        if (response.skipped > 0) {
                            msg += ' (' + response.skipped + ' skipped)';
                        }
                        alert(msg);
                        self.loadPosts();
                    } else {
                        alert('Import error: ' + (response.message || 'Unknown error'));
                    }
                }
            };
            xhr.send(formData);
        },

        cancelBulkModal: function(id) {
            var modal = document.getElementById(id);
            if (modal) { modal.classList.remove('active'); modal.style.display = 'none'; }
        },

        escapeHtml: function(text) {
            if (!text) return '';
            var div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    };

    window.BlogManager = BlogManager;

})(window, document);
