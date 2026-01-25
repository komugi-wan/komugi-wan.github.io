/**
 * COLLECTION ARCHIVE v1.0 - IndexedDB Migrated Version
 */

// =========================================
// 0. IndexedDB Manager (Native API Wrapper)
// =========================================
const IDB = {
    dbName: "CollectionArchiveDB",
    storeName: "appData",
    db: null,

    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };
            request.onerror = (e) => reject(e.target.error);
        });
    },

    async set(key, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], "readwrite");
            const store = transaction.objectStore(this.storeName);
            const request = store.put(value, key);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    },

    async get(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], "readonly");
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }
};

// =========================================
// 1. Constants & Configuration
// =========================================
const CONSTANTS = {
    KEYS: {
        DB: 'gap_db',
        ORDER: 'gap_order',
        SETS: 'gap_char_sets',
        TEMPLATES: 'gap_temps',
        PRESETS: 'gap_presets',
        TRADE: 'gap_trade_config',
        SORT: 'gap_sort_mode',
        LAST_ITEM: 'gap_last_item'
    },
    DEFAULT_CHARS: ["北門", "是国", "金城", "阿修", "愛染", "増長", "音済", "王茶利", "野目", "釈村", "唯月", "遙日", "不動", "殿"],
    DEFAULT_TEMPLATES: ["缶バッジ", "アクスタ", "ブロマイド"],
};

// =========================================
// 2. State Management (Store)
// =========================================
const Store = {
    db: {},
    order: [],
    charSets: {},
    templates: [],
    presets: [],
    tradeConfig: { prefix: "", suffix: "", showInf: true },
    sortMode: 'new',
    lastItem: null,

    // Temp State
    currentSeriesId: null,
    currentItemIdx: null,
    activeCharList: [],
    tempStocks: {},
    editorFromMissing: false,

    async init() {
        await IDB.init();
        this.db = await IDB.get(CONSTANTS.KEYS.DB) || {};
        this.order = await IDB.get(CONSTANTS.KEYS.ORDER) || [];
        this.charSets = await IDB.get(CONSTANTS.KEYS.SETS) || { "デフォルト": CONSTANTS.DEFAULT_CHARS };
        this.templates = await IDB.get(CONSTANTS.KEYS.TEMPLATES) || CONSTANTS.DEFAULT_TEMPLATES;
        this.presets = await IDB.get(CONSTANTS.KEYS.PRESETS) || [];
        this.tradeConfig = await IDB.get(CONSTANTS.KEYS.TRADE) || { prefix: "", suffix: "", showInf: true };
        this.sortMode = await IDB.get(CONSTANTS.KEYS.SORT) || 'new';
        this.lastItem = await IDB.get(CONSTANTS.KEYS.LAST_ITEM) || null;
    },

    async save() {
        await IDB.set(CONSTANTS.KEYS.DB, this.db);
        await IDB.set(CONSTANTS.KEYS.ORDER, this.order);
        await IDB.set(CONSTANTS.KEYS.SETS, this.charSets);
        await IDB.set(CONSTANTS.KEYS.TRADE, this.tradeConfig);
        await IDB.set(CONSTANTS.KEYS.SORT, this.sortMode);
        await IDB.set(CONSTANTS.KEYS.PRESETS, this.presets);
    },

    async saveLastItem() {
        await IDB.set(CONSTANTS.KEYS.LAST_ITEM, this.lastItem);
    }
};

// =========================================
// 3. Utilities
// =========================================
const Utils = {
    showToast(msg) {
        const t = document.getElementById('toast');
        t.textContent = msg; t.style.display = 'block';
        setTimeout(() => t.style.display = 'none', 2000);
    },
    
    autoDetermineStatus(item) {
        if (item.status === "none") return "none";
        const targets = item.targets || [];
        if (targets.length === 0) return item.status;
        const isAllCollected = targets.every(char => {
            const s = item.stocks[char] || { own: 0, trade: 0, infinite: false };
            if (s.infinite) return false;
            return (s.own + s.trade) >= 1;
        });
        return isAllCollected ? "comp" : "not";
    },

    attachSwipe(element, actionCallback, isCustomSort) {
        let startX = 0, isSwiping = false, isTicking = false;
        element.addEventListener('touchstart', (e) => {
            if (Store.sortMode === 'custom' && isCustomSort) return;
            const rect = element.getBoundingClientRect();
            const touchX = e.touches[0].clientX;
            if (touchX < rect.right - (rect.width * 0.25)) { isSwiping = false; return; }
            startX = touchX;
            isSwiping = true;
            element.classList.add('swiping');
        }, {passive: true});

        element.addEventListener('touchmove', (e) => {
            if (!isSwiping || (Store.sortMode === 'custom' && isCustomSort)) return;
            let currentX = e.touches[0].clientX - startX;
            if (currentX < 0) {
                if (currentX < -120) currentX = -120;
                if (!isTicking) {
                    window.requestAnimationFrame(() => {
                        element.style.transform = `translateX(${currentX}px)`;
                        isTicking = false;
                    });
                    isTicking = true;
                }
            }
        }, {passive: true});

        element.addEventListener('touchend', (e) => {
            if (!isSwiping || (Store.sortMode === 'custom' && isCustomSort)) return;
            isSwiping = false;
            element.classList.remove('swiping');
            const finalX = e.changedTouches[0].clientX - startX;
            if (finalX < -50) {
                element.style.transform = 'translateX(-100px)';
            } else {
                element.style.transform = 'translateX(0)';
            }
        }, {passive: true});

        const originalOnClick = element.onclick;
        element.onclick = (e) => {
            if (element.style.transform === 'translateX(-100px)') {
                element.style.transform = 'translateX(0)';
                e.stopPropagation();
            } else if (originalOnClick) { originalOnClick(e); }
        };
    }
};

// =========================================
// 4. Rendering Logic (View)
// =========================================
const Render = {
    seriesList() {
        const container = document.getElementById('seriesListContainer');
        container.innerHTML = "";
        const term = document.getElementById('searchBar').value.toLowerCase();
        const start = document.getElementById('filterStart').value;
        const end = document.getElementById('filterEnd').value;
        container.className = Store.sortMode === 'custom' ? 'sort-custom' : '';
        let displayOrder = [...Store.order];

        if (Store.sortMode === 'date') {
            displayOrder.sort((a, b) => (Store.db[b].date || "").localeCompare(Store.db[a].date || ""));
        }
        displayOrder.sort((a, b) => (Store.db[b].fav ? 1 : 0) - (Store.db[a].fav ? 1 : 0));

        displayOrder.forEach((id) => {
            const s = Store.db[id];
            if (!s) return;
            
            const titleMatch = s.title.toLowerCase().includes(term);
            const tagsMatch = s.tags ? s.tags.toLowerCase().includes(term) : false;
            let dateMatch = true;
            if (start || end) {
                if (!s.date) dateMatch = false;
                else {
                    if (start && s.date < start) dateMatch = false;
                    if (end && s.date > end) dateMatch = false;
                }
            }

            if ((titleMatch || tagsMatch) && dateMatch) {
                const items = s.items || [];
                const isSeriesComp = items.length > 0 && items.every(it => it.status === 'comp' || it.status === 'none');
                const compMark = isSeriesComp ? '<span class="series-comp-mark">✦</span>' : '';
                const favActive = s.fav ? 'active' : '';

                const swipeWrapper = document.createElement('div');
                swipeWrapper.className = 'swipe-container';
                if (Store.sortMode === 'custom') {
                    swipeWrapper.draggable = true;
                    swipeWrapper.ondragstart = (e) => Actions.handleDragStart(e, id);
                    swipeWrapper.ondragover = Actions.handleDragOver;
                    swipeWrapper.ondrop = (e) => Actions.handleDrop(e, id);
                }

                const deleteBtn = document.createElement('div');
                deleteBtn.className = 'delete-btn-overlay';
                deleteBtn.textContent = '削除';
                deleteBtn.onclick = (e) => { e.stopPropagation(); Actions.deleteSeries(id); };

                const card = document.createElement('div');
                card.className = 'card';
                
                const tagsHtml = s.tags ? s.tags.split(/[、, ]/).filter(t => t).map(t => 
                    `<span onclick="event.stopPropagation(); App.filterByTag('${t.trim()}')" class="tag-chip">#${t.trim()}</span>`
                ).join('') : '';

                card.innerHTML = `
                    <div style="display:flex; align-items:flex-start;">
                        <div class="handle">⋮⋮</div>
                        <div style="flex:1;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                <b style="color:var(--text-main); font-size:1rem; flex:1;">${s.title}${compMark}</b>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span style="font-size:0.75rem; color:var(--gold); font-weight:bold;">${s.date || ''}</span>
                                    <button class="fav-btn ${favActive}" onclick="Actions.toggleFavorite('${id}', event)">★</button>
                                </div>
                            </div>
                            <div style="margin-top:12px; display:flex; flex-wrap:wrap; gap:4px;">${tagsHtml}</div>
                        </div>
                    </div>`;
                card.onclick = (e) => {
                    if (e.target.tagName !== 'SPAN' && e.target.tagName !== 'BUTTON') App.openDetail(id);
                };

                Utils.attachSwipe(card, null, true);
                swipeWrapper.appendChild(deleteBtn);
                swipeWrapper.appendChild(card);
                container.appendChild(swipeWrapper);
            }
        });
    },

    itemList() {
        const container = document.getElementById('itemListContainer');
        container.innerHTML = "";
        const items = Store.db[Store.currentSeriesId].items || [];
        const seriesTitle = Store.db[Store.currentSeriesId].title;
        items.forEach((item, idx) => {
            const swipeWrapper = document.createElement('div');
            swipeWrapper.className = 'swipe-container';
            swipeWrapper.style.marginBottom = "15px";

            const deleteBtn = document.createElement('div');
            deleteBtn.className = 'delete-btn-overlay';
            deleteBtn.textContent = '削除';
            deleteBtn.onclick = (e) => { e.stopPropagation(); Actions.deleteItem(idx); };

            const card = document.createElement('div');
            card.className = 'card item-card';
            Utils.attachSwipe(card, null, false);

            const statusLabel = { "comp": "COMP", "not": "INCOMP", "none": "NONE" }[item.status || "not"];
            
            let ownChips = [], tradeTextArr = [], tradeNamesArr = [], targetNamesArr = [], infiniteStatusChips = [];
            let totalOwn = 0, totalTrade = 0;
            const list = Store.charSets[item.charSetName || "デフォルト"] || CONSTANTS.DEFAULT_CHARS;

            list.forEach(c => {
                const s = (item.stocks && item.stocks[c]) ? item.stocks[c] : {own:0, trade:0, infinite:false};
                const isTarget = (item.targets || list).includes(c);
                totalOwn += s.own;
                totalTrade += s.trade;

                if (s.own > 0) ownChips.push(`<span class="char-chip c-${c.trim()}">${c}</span>`);
                if (s.trade > 0) {
                    tradeTextArr.push(`${c}${s.trade}`);
                    tradeNamesArr.push(`${c}${s.trade > 1 ? s.trade : ''}`);
                }
                if (s.infinite) {
                    infiniteStatusChips.push(`<span class="inf-status-chip c-${c.trim()}">${c}<span>:${s.own}</span></span>`);
                }
                if (isTarget) {
                    const isMissing = (s.own === 0 && s.trade === 0);
                    if (isMissing || s.infinite) {
                        const displayInf = s.infinite && Store.tradeConfig.showInf;
                        targetNamesArr.push(`${c}${displayInf ? '(∞)' : ''}`);
                    }
                }
            });

            const prefix = Store.tradeConfig.prefix ? Store.tradeConfig.prefix + "\n" : "";
            const suffix = Store.tradeConfig.suffix ? "\n" + Store.tradeConfig.suffix : "";
            const copyStr = `${prefix}${seriesTitle} ${item.type}\n譲：${tradeNamesArr.join('、') || 'なし'}\n求：${targetNamesArr.join('、') || '完遂'}${suffix}`;

            const missingChips = list.filter(c => 
                (item.targets || list).includes(c) && 
                ((item.stocks[c]?.own || 0) + (item.stocks[c]?.trade || 0) === 0 || item.stocks[c]?.infinite)
            ).map(c => {
                const isInf = item.stocks[c]?.infinite;
                const isMissing = !item.stocks[c] || (item.stocks[c].own + item.stocks[c].trade === 0);
                return `<span class="char-chip c-${c.trim()} ${isMissing ? '' : 'is-infinite-collected'}">${c}</span>`;
            }).join('') || '<span style="color:#ccc; font-size:0.6rem;">－</span>';

            card.innerHTML = `
                <span class="status-tag st-${item.status || 'not'}">${statusLabel}</span>
                <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; padding-right:60px;">
                    <div><b style="color:var(--text-main); font-size:1rem;">${item.type}</b></div>
                    <div style="display:flex; gap:5px;">
                        <button onclick="Actions.duplicateItem(${idx}, event)" style="background:#f0f0f0; border:none; color:var(--text-main); font-size:0.6rem; padding:4px 8px; border-radius:6px; font-weight:bold;">複製</button>
                        <button onclick="event.stopPropagation(); Actions.copyTradeText(\`${copyStr}\`)" style="background:var(--trade-bg); border:none; color:var(--trade-text); font-size:0.6rem; padding:4px 8px; border-radius:6px; font-weight:bold;">コピー</button>
                    </div>
                </div>
                <div class="inventory-grid" onclick="App.openItemEditor(${idx})">
                    <div class="inv-box"><span class="inv-label">保管</span><div class="inv-content">${ownChips.join('') || '<span style="color:#ccc; font-size:0.6rem;">－</span>'}</div></div>
                    <div class="inv-box"><span class="inv-label">譲渡</span><div class="inv-content"><span class="trade-text-small">${tradeTextArr.join('<br>') || '<span style="color:#ccc;">－</span>'}</span></div></div>
                    <div class="inv-box"><span class="inv-label">不足</span><div class="inv-content">${missingChips}</div></div>
                </div>
                <div class="inv-summary-row">
                    <div class="summary-item">保管合計<span>${totalOwn}</span></div>
                    <div class="summary-item">譲渡合計<span>${totalTrade}</span></div>
                    <div class="summary-item">総所有数<span>${totalOwn + totalTrade}</span></div>
                </div>
                <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center;">
                    <div class="inf-status-container">${infiniteStatusChips.join('')}</div>
                    <span onclick="event.stopPropagation(); App.openUnboxing(${idx})" style="color:var(--dark-pink); font-size:0.7rem; font-weight:bold; background:#fff0f5; padding:6px 12px; border-radius:10px; white-space:nowrap;">✨ 開封モード</span>
                </div>`;
            swipeWrapper.appendChild(deleteBtn);
            swipeWrapper.appendChild(card);
            container.appendChild(swipeWrapper);
        });
    },

    editorGrid(targets) {
        const grid = document.getElementById('editorGrid');
        grid.innerHTML = "";
        Store.activeCharList.forEach(c => {
            if (!Store.tempStocks[c]) Store.tempStocks[c] = { own: 0, trade: 0, infinite: false };
            const isTarget = targets.includes(c);
            const { own, trade, infinite } = Store.tempStocks[c];
            const ownClass = own > 0 ? 'qty-has' : 'qty-zero';
            const tradeClass = trade > 0 ? 'qty-has' : 'qty-zero';

            const row = document.createElement('div');
            row.className = 'editor-row';
            row.style.opacity = isTarget ? "1" : "0.5";
            row.innerHTML = `
                <div class="c-${c.trim()} char-chip-cell" style="padding:10px; border-radius:10px; text-align:center; font-weight:bold; font-size:0.75rem; position:relative;">
                    <input type="checkbox" ${isTarget ? 'checked' : ''} onchange="Actions.refreshEditorTargets()" style="width:20px; height:20px; margin-bottom:5px;"><br>${c}
                    <button class="inf-btn ${infinite ? 'active' : ''}" onclick="Actions.toggleInfinite('${c}')" style="display:block; margin:5px auto 0;">∞</button>
                </div>
                <div style="display:flex; justify-content:space-around;">
                    <div style="text-align:center;">
                        <span style="font-size:0.6rem; color:var(--text-sub);">保管</span>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <button class="btn-qty" onclick="Actions.updateQty('${c}','own',-1)">-</button>
                            <input type="number" inputmode="numeric" class="qty-display ${ownClass}" value="${own}" onchange="Actions.directInputQty('${c}','own',this.value)" onclick="this.select()">
                            <button class="btn-qty" onclick="Actions.updateQty('${c}','own',1)">+</button>
                        </div>
                    </div>
                    <div style="text-align:center;">
                        <span style="font-size:0.6rem; color:var(--text-sub);">譲渡</span>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <button class="btn-qty" onclick="Actions.updateQty('${c}','trade',-1)">-</button>
                            <input type="number" inputmode="numeric" class="qty-display ${tradeClass}" value="${trade}" onchange="Actions.directInputQty('${c}','trade',this.value)" onclick="this.select()">
                            <button class="btn-qty" onclick="Actions.updateQty('${c}','trade',1)">+</button>
                        </div>
                    </div>
                </div>`;
            grid.appendChild(row);
        });
    },

    missingList() {
        const container = document.getElementById('missingListContainer');
        container.innerHTML = "";
        let found = false;
        let allChars = new Set();
        Object.values(Store.charSets).forEach(list => list.forEach(c => allChars.add(c)));

        Array.from(allChars).forEach(char => {
            let list = [];
            Store.order.forEach(sId => {
                (Store.db[sId].items || []).forEach((item, itemIdx) => {
                    const charList = Store.charSets[item.charSetName || "デフォルト"] || CONSTANTS.DEFAULT_CHARS;
                    if (!charList.includes(char)) return;
                    if (!(item.targets || charList).includes(char)) return;

                    const s = item.stocks[char] || { own: 0, trade: 0, infinite: false };
                    const isMissing = (s.own === 0 && s.trade === 0);
                    if (item.status === 'not' && (isMissing || s.infinite)) {
                        list.push({
                            series: Store.db[sId].title,
                            seriesId: sId,
                            type: item.type,
                            itemIdx: itemIdx,
                            isInf: s.infinite,
                            isOwn: !isMissing
                        });
                    }
                });
            });

            if (list.length > 0) {
                found = true;
                const group = document.createElement('div');
                group.className = 'card';
                group.style.marginBottom = "15px";
                group.innerHTML = `
                    <div onclick="const n=this.nextElementSibling; n.style.display=n.style.display==='none'?'block':'none'" style="display:flex; justify-content:space-between; align-items:center;">
                        <div><span class="char-chip c-${char.trim()}">${char}</span> <span style="font-size:0.8rem; color:var(--text-sub);">Missing: ${list.length}</span></div>
                        <span style="color:var(--gold-light);">▼</span>
                    </div>
                    <div style="display:none; margin-top:10px;">
                        ${list.map(li => `
                            <div onclick="App.jumpToEditorFromMissing('${li.seriesId}', ${li.itemIdx}, '${char}')" style="font-size:0.75rem; padding:12px 0; border-top:1px solid #eee; ${li.isOwn ? 'opacity:0.5;' : ''} cursor:pointer;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span><span style="color:var(--gold); font-weight:bold;">${li.series}</span> / ${li.type} ${li.isInf ? '<span style="color:var(--gold); font-size:0.6rem;">(∞)</span>' : ''}</span>
                                    <span style="color:var(--gold-light); font-size:0.8rem;">✎</span>
                                </div>
                            </div>`).join('')}
                    </div>`;
                container.appendChild(group);
            }
        });
        if (!found) container.innerHTML = `<div style="text-align:center; color:var(--text-sub); margin-top:50px;">不足はありません。</div>`;
    },

    unboxingGrid() {
        const grid = document.getElementById('unboxingGrid');
        grid.innerHTML = "";
        const item = Store.db[Store.currentSeriesId].items[Store.currentItemIdx];
        const list = Store.charSets[item.charSetName || "デフォルト"] || CONSTANTS.DEFAULT_CHARS;
        let tOwn = 0, tTrade = 0;

        list.forEach(c => {
            const s = item.stocks[c] || { own: 0, trade: 0, infinite: false };
            tOwn += s.own; tTrade += s.trade;
            const panel = document.createElement('div');
            panel.className = `unboxing-panel c-${c.trim()}`;
            panel.innerHTML = `
                <div class="ub-char-label">${c}</div>
                <div class="ub-area ub-area-left"><span class="unboxing-count-badge ${s.own>0?'has-count':'is-zero'}">${s.own}</span></div>
                <div class="ub-area ub-area-right"><span class="unboxing-count-badge ${s.trade>0?'has-count':'is-zero'}">${s.trade}</span></div>`;

            const attachHandler = (area, type) => {
                let timer;
                area.onpointerdown = (e) => { e.preventDefault(); timer = setTimeout(() => { Actions.updateUnboxingCount(c, type, -1); timer = null; }, 500); };
                area.onpointerup = (e) => { e.preventDefault(); if(timer) { clearTimeout(timer); Actions.updateUnboxingCount(c, type, 1); } };
                area.oncontextmenu = (e) => e.preventDefault();
            };
            attachHandler(panel.querySelector('.ub-area-left'), 'own');
            attachHandler(panel.querySelector('.ub-area-right'), 'trade');
            grid.appendChild(panel);
        });
        document.getElementById('unboxingTotalCount').innerHTML = `保管: ${tOwn} / 譲渡: ${tTrade} / 合計: ${tOwn+tTrade}`;
    }
};

// =========================================
// 5. App Actions (Logic)
// =========================================
const Actions = {
    async saveSeriesModal() {
        const title = document.getElementById('msTitle').value.trim();
        if(!title) return;
        const id = "s" + Date.now();
        const useTemp = document.getElementById('msUseTemplate').checked;
        let items = [];
        if(useTemp) Store.templates.forEach(t => items.push({ type: t, stocks: {}, targets: [...CONSTANTS.DEFAULT_CHARS], status: "not", charSetName: "デフォルト" }));
        Store.db[id] = { 
            title, 
            date: document.getElementById('msDate').value, 
            tags: document.getElementById('msTags').value, 
            items: items, 
            fav: false 
        };
        Store.order.unshift(id);
        await Store.save();
        App.closeSeriesModal();
        App.openDetail(id);
    },

    async deleteSeries(id) {
        if(confirm("削除しますか？")) {
            delete Store.db[id];
            Store.order = Store.order.filter(oid => oid !== id);
            await Store.save();
            Render.seriesList();
        }
    },

    async toggleFavorite(id, e) {
        e.stopPropagation();
        Store.db[id].fav = !Store.db[id].fav;
        await Store.save();
        Render.seriesList();
    },

    async saveItem() {
        const type = document.getElementById('editItemType').value.trim();
        if (!type) return alert("名前を入力してください");
        
        let data = {
            type,
            stocks: Store.tempStocks,
            targets: Actions.getSelectedTargets(),
            status: document.getElementById('editItemStatus').value,
            charSetName: document.getElementById('editCharSetName').value
        };
        data.status = Utils.autoDetermineStatus(data);
        Store.lastItem = { type: data.type, charSetName: data.charSetName, targets: data.targets };
        await Store.saveLastItem();

        if (Store.currentItemIdx === null) Store.db[Store.currentSeriesId].items.push(data);
        else Store.db[Store.currentSeriesId].items[Store.currentItemIdx] = data;

        await Store.save();
        Utils.showToast("保存しました");
        history.back();
        document.getElementById('editorView').style.display = 'none';
        
        if (!Store.editorFromMissing) Render.itemList();
        else { Store.editorFromMissing = false; Render.missingList(); }
    },

    async deleteItem(idx) {
        if(confirm("削除しますか？")) {
            Store.db[Store.currentSeriesId].items.splice(idx,1);
            await Store.save();
            Render.itemList();
        }
    },

    async deleteAllItems() {
        if(confirm("全削除しますか？")) {
            Store.db[Store.currentSeriesId].items = [];
            await Store.save();
            Render.itemList();
        }
    },

    async duplicateItem(idx, e) {
        e.stopPropagation();
        const base = Store.db[Store.currentSeriesId].items[idx];
        const newItem = {
            type: base.type,
            charSetName: base.charSetName || "デフォルト",
            targets: JSON.parse(JSON.stringify(base.targets)),
            stocks: {},
            status: "not"
        };
        Store.db[Store.currentSeriesId].items.push(newItem);
        await Store.save();
        Render.itemList();
        Utils.showToast("複製しました");
    },

    updateQty(char, key, delta) {
        Store.tempStocks[char][key] = Math.max(0, Store.tempStocks[char][key] + delta);
        Render.editorGrid(Actions.getSelectedTargets());
    },

    directInputQty(char, key, val) {
        let n = parseInt(val);
        if(isNaN(n) || n < 0) n = 0;
        Store.tempStocks[char][key] = n;
        Render.editorGrid(Actions.getSelectedTargets());
    },

    toggleInfinite(char) {
        Store.tempStocks[char].infinite = !Store.tempStocks[char].infinite;
        Render.editorGrid(Actions.getSelectedTargets());
    },

    getSelectedTargets() {
        const cbs = document.querySelectorAll('#editorGrid input[type="checkbox"]');
        let selected = [];
        cbs.forEach((cb, i) => { if(cb.checked) selected.push(Store.activeCharList[i]); });
        return selected;
    },

    refreshEditorTargets() { Render.editorGrid(Actions.getSelectedTargets()); },
    bulkToggleTargets(s) { Render.editorGrid(s ? [...Store.activeCharList] : []); },

    bulkIncrementOwn() {
        Store.activeCharList.forEach(c => {
            if(!Store.tempStocks[c]) Store.tempStocks[c] = { own: 0, trade: 0, infinite: false };
            Store.tempStocks[c].own += 1;
        });
        Render.editorGrid(Actions.getSelectedTargets());
        Utils.showToast("保管を+1しました");
    },

    bulkResetCounts() {
        if(confirm("カウントをすべて削除しますがよろしいですか？")) {
            Object.keys(Store.tempStocks).forEach(c => { Store.tempStocks[c].own = 0; Store.tempStocks[c].trade = 0; Store.tempStocks[c].infinite = false; });
            Render.editorGrid(Actions.getSelectedTargets());
            Utils.showToast("リセットしました");
        }
    },

    async updateUnboxingCount(char, type, delta) {
        const item = Store.db[Store.currentSeriesId].items[Store.currentItemIdx];
        if(!item.stocks[char]) item.stocks[char] = { own: 0, trade: 0, infinite: false };
        item.stocks[char][type] = Math.max(0, item.stocks[char][type] + delta);
        const oldStatus = item.status;
        item.status = Utils.autoDetermineStatus(item);
        if (oldStatus !== item.status) Utils.showToast(item.status === 'comp' ? "コンプリート！" : "未コンプに戻りました");
        
        await Store.save();
        Render.unboxingGrid();
    },

    dragSrcId: null,
    handleDragStart(e, id) {
        if(Store.sortMode !== 'custom') return;
        Actions.dragSrcId = id;
        e.target.classList.add('dragging');
    },

    handleDragOver(e) { e.preventDefault(); },

    async handleDrop(e, targetId) {
        e.preventDefault();
        if(!Actions.dragSrcId || Actions.dragSrcId === targetId) return;
        let newOrder = [...Store.order];
        const srcIdx = newOrder.indexOf(Actions.dragSrcId);
        const targetIdx = newOrder.indexOf(targetId);
        newOrder.splice(srcIdx, 1);
        newOrder.splice(targetIdx, 0, Actions.dragSrcId);
        Store.order = newOrder;
        await Store.save();
        Render.seriesList();
    },

    async saveSettings() {
        const lines = document.getElementById('charSettingsInput').value.split('\n');
        let newSets = {};
        lines.forEach(line => {
            const p = line.split(':');
            if(p.length >= 2) newSets[p[0].trim()] = p[1].split(',').map(c => c.trim()).filter(c => c);
        });
        Store.charSets = Object.keys(newSets).length ? newSets : { "デフォルト": CONSTANTS.DEFAULT_CHARS };
        Store.templates = document.getElementById('tempSettingsInput').value.split('\n').map(n=>n.trim()).filter(n=>n);
        const pLines = document.getElementById('presetSettingsInput').value.split('\n');
        let newPresets = [];
        pLines.forEach(l => {
            const p = l.split(',');
            if(p.length >= 3) newPresets.push({ name: p[0].trim(), charSet: p[1].trim(), targets: p[2].split('|').map(c => c.trim()) });
        });
        Store.presets = newPresets;
        Store.tradeConfig = {
            prefix: document.getElementById('tradePrefixInput').value,
            suffix: document.getElementById('tradeSuffixInput').value,
            showInf: document.getElementById('tradeShowInfMark').checked
        };
        await Store.save();
        location.reload();
    },

    exportBackup() {
        const data = {
            [CONSTANTS.KEYS.DB]: Store.db,
            [CONSTANTS.KEYS.ORDER]: Store.order,
            [CONSTANTS.KEYS.SETS]: Store.charSets,
            [CONSTANTS.KEYS.TEMPLATES]: Store.templates,
            [CONSTANTS.KEYS.SORT]: Store.sortMode,
            [CONSTANTS.KEYS.TRADE]: Store.tradeConfig,
            [CONSTANTS.KEYS.PRESETS]: Store.presets
        };
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], {type:'application/json'}));
        a.download=`backup.json`;
        a.click();
    },

    async importBackup(e) {
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if(confirm("上書きしますか？")) {
                    await IDB.set(CONSTANTS.KEYS.DB, data[CONSTANTS.KEYS.DB]);
                    await IDB.set(CONSTANTS.KEYS.ORDER, data[CONSTANTS.KEYS.ORDER]);
                    await IDB.set(CONSTANTS.KEYS.SETS, data[CONSTANTS.KEYS.SETS] || { "デフォルト": CONSTANTS.DEFAULT_CHARS });
                    await IDB.set(CONSTANTS.KEYS.TRADE, data[CONSTANTS.KEYS.TRADE] || { prefix: "", suffix: "", showInf: true });
                    await IDB.set(CONSTANTS.KEYS.SORT, data[CONSTANTS.KEYS.SORT] || 'new');
                    await IDB.set(CONSTANTS.KEYS.PRESETS, data[CONSTANTS.KEYS.PRESETS] || []);
                    location.reload();
                }
            } catch(e) { alert("無効なファイルです"); }
        };
        reader.readAsText(e.target.files[0]);
    },

    copyTradeText(text) {
        navigator.clipboard.writeText(text).then(() => Utils.showToast("コピーしました"));
    }
};

// =========================================
// 6. Main App Controller
// =========================================
const App = {
    async init() {
        await Store.init();
        Render.seriesList();
        
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(err => console.log('SW fail', err));
        }

        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            if (splash) {
                splash.style.opacity = '0';
                setTimeout(() => splash.remove(), 500);
            }
        }, 600);
    },

    switchMainTab(tab) {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');
        document.getElementById('seriesView').style.display = tab === 'list' ? 'block' : 'none';
        document.getElementById('missingView').style.display = tab === 'missing' ? 'block' : 'none';
        document.getElementById('mainFab').style.display = tab === 'list' ? 'flex' : 'none';
        if (tab === 'missing') Render.missingList();
    },

    openDetail(id) {
        Store.currentSeriesId = id;
        document.getElementById('detailHeaderTitle').textContent = Store.db[id].title;
        document.getElementById('detailView').style.display = 'block';
        history.pushState({view: 'detail', seriesId: id}, '');
        Render.itemList();
    },

    closeDetail() {
        document.getElementById('detailView').style.display = 'none';
        if (history.state && history.state.view === 'detail') history.back();
        Render.seriesList();
    },

    openItemEditor(idx = null, fromMissing = false) {
        Store.currentItemIdx = idx;
        Store.editorFromMissing = fromMissing;
        
        const presetArea = document.getElementById('presetArea');
        const historyBanner = document.getElementById('historyBanner');
        
        historyBanner.style.display = (idx === null && Store.lastItem) ? 'flex' : 'none';
        if (idx === null && Store.presets.length > 0) {
            presetArea.style.display = 'block';
            document.getElementById('presetChips').innerHTML = Store.presets.map((p, i) => 
                `<span class="preset-chip" onclick="App.applyPreset(${i})">${p.name}</span>`
            ).join('');
        } else {
            presetArea.style.display = 'none';
        }

        const setSelect = document.getElementById('editCharSetName');
        setSelect.innerHTML = Object.keys(Store.charSets).map(n => `<option value="${n}">${n}</option>`).join('');
        
        const item = idx !== null ? Store.db[Store.currentSeriesId].items[idx] : 
            { type: "", stocks: {}, targets: [], status: "not", charSetName: "デフォルト" };
        
        document.getElementById('editItemType').value = item.type;
        document.getElementById('editItemStatus').value = item.status || "not";
        document.getElementById('editCharSetName').value = item.charSetName || "デフォルト";
        
        Store.tempStocks = JSON.parse(JSON.stringify(item.stocks || {}));
        Store.activeCharList = Store.charSets[document.getElementById('editCharSetName').value] || CONSTANTS.DEFAULT_CHARS;
        
        Render.editorGrid(item.targets && item.targets.length > 0 ? item.targets : [...Store.activeCharList]);
        
        document.getElementById('editorView').style.display = 'block';
        history.pushState({view: 'editor'}, '');
    },

    closeEditor() {
        document.getElementById('editorView').style.display = 'none';
        if (history.state && history.state.view === 'editor') history.back();
        if (Store.editorFromMissing) { Store.editorFromMissing = false; Render.missingList(); }
    },

    applyHistory() {
        if (!Store.lastItem) return;
        document.getElementById('editItemType').value = Store.lastItem.type;
        document.getElementById('editCharSetName').value = Store.lastItem.charSetName;
        Store.activeCharList = Store.charSets[Store.lastItem.charSetName] || CONSTANTS.DEFAULT_CHARS;
        Store.tempStocks = {};
        Render.editorGrid(Store.lastItem.targets);
        Utils.showToast("履歴を適用しました");
    },

    applyPreset(idx) {
        const p = Store.presets[idx];
        document.getElementById('editItemType').value = p.name;
        document.getElementById('editCharSetName').value = p.charSet;
        Store.activeCharList = Store.charSets[p.charSet] || CONSTANTS.DEFAULT_CHARS;
        Store.tempStocks = {};
        Render.editorGrid(p.targets);
        Utils.showToast(`プリセット: ${p.name} を適用`);
    },

    changeCharSet(setName) {
        Store.activeCharList = Store.charSets[setName] || CONSTANTS.DEFAULT_CHARS;
        Render.editorGrid([...Store.activeCharList]);
    },
    
    openSeriesModal() {
        document.getElementById('msTitle').value = "";
        document.getElementById('seriesModal').style.display = 'flex';
    },

    closeSeriesModal() { document.getElementById('seriesModal').style.display = 'none'; },
    
    openUnboxing(idx) {
        Store.currentItemIdx = idx;
        document.getElementById('unboxingTitle').textContent = Store.db[Store.currentSeriesId].items[idx].type;
        Render.unboxingGrid();
        document.getElementById('unboxingModal').style.display = 'flex';
    },

    closeUnboxing() {
        document.getElementById('unboxingModal').style.display = 'none';
        Render.itemList();
    },

    toggleSettings(s) {
        const panel = document.getElementById('settingsPanel');
        const overlay = document.getElementById('settingsOverlay');
        overlay.style.display = s ? 'block' : 'none';
        panel.style.right = s ? '0' : '-85%';
        if(s) {
            document.getElementById('charSettingsInput').value = Object.keys(Store.charSets).map(n => `${n}:${Store.charSets[n].join(',')}`).join('\n');
            document.getElementById('tempSettingsInput').value = Store.templates.join('\n');
            document.getElementById('tradePrefixInput').value = Store.tradeConfig.prefix || "";
            document.getElementById('tradeSuffixInput').value = Store.tradeConfig.suffix || "";
            document.getElementById('tradeShowInfMark').checked = Store.tradeConfig.showInf !== false;
            document.getElementById('presetSettingsInput').value = Store.presets.map(p => `${p.name},${p.charSet},${p.targets.join('|')}`).join('\n');
        }
    },

    async setSortMode(mode) {
        Store.sortMode = mode;
        document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`sort-${mode}`).classList.add('active');
        await Store.save();
        Render.seriesList();
    },

    toggleDateFilter() {
        const p = document.getElementById('dateFilterPanel');
        p.style.display = p.style.display === 'none' ? 'block' : 'none';
    },

    clearDateFilter() {
        document.getElementById('filterStart').value = "";
        document.getElementById('filterEnd').value = "";
        Render.seriesList();
    },

    filterByTag(t) {
        document.getElementById('searchBar').value = t;
        Render.seriesList();
        window.scrollTo({top:0, behavior:'smooth'});
    },

    jumpToEditorFromMissing(sId, itemIdx, charName) {
        Store.currentSeriesId = sId;
        App.openItemEditor(itemIdx, true);
        setTimeout(() => {
            const rows = document.querySelectorAll('.editor-row');
            for(let row of rows) {
                if(row.innerText.includes(charName)) {
                    row.scrollIntoView({behavior: 'smooth', block: 'center'});
                    row.style.outline = "2px solid var(--gold)";
                    setTimeout(() => row.style.outline = "none", 2000);
                    break;
                }
            }
        }, 300);
    }
};

// Browser History Handling
window.onpopstate = function(e) {
    const state = e.state || {};
    const editor = document.getElementById('editorView');
    const detail = document.getElementById('detailView');

    if (editor.style.display === 'block') {
        editor.style.display = 'none';
        if (Store.editorFromMissing) {
            Store.editorFromMissing = false;
            Render.missingList();
        }
    } else if (detail.style.display === 'block' && state.view !== 'detail') {
        detail.style.display = 'none';
        Render.seriesList();
    }
};
