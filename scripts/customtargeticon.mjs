const MODULE_ID = 'customtargeticon';

// Хранилище для активных токенов с их параметрами анимации
const activeTokens = new Map();

// Таймер для отправки синхронизации
let syncInterval = null;

// Хранилище иконок для каждого игрока
let playerIcons = new Map();

Hooks.once('init', function() {
    // Сообщение о поддержке автора
    game.settings.register(MODULE_ID, 'supportMessage', {
        name: "customtargeticon.Settings.supportMessage.Name",
        hint: "customtargeticon.Settings.supportMessage.Hint",
        scope: 'world',
        config: true,
        default: "https://boosty.to/kraivo",
        type: String,
        onChange: (value) => {
            if (value !== "https://boosty.to/kraivo") {
                game.settings.set(MODULE_ID, 'supportMessage', "https://boosty.to/kraivo");
            }
        }
    });
    
    // Симулятор снайпера (движение по дуге через случайные точки)
    game.settings.register(MODULE_ID, 'sniperMode', {
        name: game.i18n.localize("customtargeticon.Settings.SniperMode.Name"),
        hint: game.i18n.localize("customtargeticon.Settings.SniperMode.Hint"),
        scope: "world",
        config: true,
        default: false,
        type: Boolean,
        onChange: () => {
            if (game.user.isGM) {
                syncSniperModeToClients();
            }
            if (!game.settings.get(MODULE_ID, 'sniperMode')) {
                stopAllSniperAnimations();
            }
        },
    });
    
    // Настройка скорости движения
    game.settings.register(MODULE_ID, 'sniperSpeed', {
        name: game.i18n.localize("customtargeticon.Settings.SniperSpeed.Name"),
        hint: game.i18n.localize("customtargeticon.Settings.SniperSpeed.Hint"),
        scope: "world",
        config: true,
        default: 0.015,
        type: Number,
        range: {
            min: 0.005,
            max: 0.04,
            step: 0.001
        },
        onChange: () => {
            if (game.user.isGM) {
                syncSniperSpeedToClients();
            }
        },
    });
    
    // Настройка максимального смещения от центра
    game.settings.register(MODULE_ID, 'sniperOffset', {
        name: game.i18n.localize("customtargeticon.Settings.SniperOffset.Name"),
        hint: game.i18n.localize("customtargeticon.Settings.SniperOffset.Hint"),
        scope: "world",
        config: true,
        default: 0.6,
        type: Number,
        range: {
            min: 0.3,
            max: 1.2,
            step: 0.05
        },
        onChange: () => {
            if (game.user.isGM) {
                syncSniperOffsetToClients();
            }
        },
    });
    
    // Иконка по умолчанию (общая для всех)
    game.settings.register(MODULE_ID, 'defaultIcon', {
        name: game.i18n.localize("customtargeticon.Settings.DefaultIcon.Name"),
        hint: game.i18n.localize("customtargeticon.Settings.DefaultIcon.Hint"),
        scope: 'world',
        config: true,
        default: 'icons/svg/clockwork.svg',
        type: String,
        onChange: () => {
            updateDefaultIcon();
            if (game.user.isGM) {
                syncDefaultIconToClients();
            }
        },
        filePicker: 'image',
    });
    
    // Хранилище иконок для игроков
    game.settings.register(MODULE_ID, 'playerIcons', {
        name: game.i18n.localize("customtargeticon.Settings.PlayerIcons.Name"),
        hint: game.i18n.localize("customtargeticon.Settings.PlayerIcons.Hint"),
        scope: 'world',
        config: false,
        default: {},
        type: Object,
    });
    
    // Настройка: включение/отключение персональных иконок игроков
    game.settings.register(MODULE_ID, 'enablePlayerIcons', {
        name: game.i18n.localize("customtargeticon.Settings.EnablePlayerIcons.Name"),
        hint: game.i18n.localize("customtargeticon.Settings.EnablePlayerIcons.Hint"),
        scope: "world",
        config: true,
        default: true,
        type: Boolean,
        onChange: () => {
            if (game.user.isGM) {
                syncEnablePlayerIconsToClients();
            }
            refreshAllIcons();
        },
    });
    
    // Настройки анимации - общие для всех (world)
    game.settings.register(MODULE_ID, "rotationSpeed", {
        name: game.i18n.localize("customtargeticon.Settings.RotationSpeed.Name"),
        hint: game.i18n.localize("customtargeticon.Settings.RotationSpeed.Hint"),
        scope: "world",
        config: true,
        default: 0.05,
        type: Number,
        range: {
            min: -0.2,
            max: 0.2,
            step: 0.01
        },
    });

    game.settings.register(MODULE_ID, "scaleAnimationSpeed", {
        name: game.i18n.localize("customtargeticon.Settings.ScaleAnimationSpeed.Name"),
        hint: game.i18n.localize("customtargeticon.Settings.ScaleAnimationSpeed.Hint"),
        scope: "world",
        config: true,
        default: 0.02,
        type: Number,
        range: {
            min: 0,
            max: 0.1,
            step: 0.001
        },
    });
    
    game.settings.register(MODULE_ID, "rotateOnMove", {
        name: game.i18n.localize("customtargeticon.Settings.RotateOnMove.Name"),
        hint: game.i18n.localize("customtargeticon.Settings.RotateOnMove.Hint"),
        scope: "world",
        config: true,
        default: false,
        type: Boolean,
    });
    
    // Настройка: масштаб контейнера иконки
    game.settings.register(MODULE_ID, "iconScale", {
        name: game.i18n.localize("customtargeticon.Settings.IconScale.Name"),
        hint: game.i18n.localize("customtargeticon.Settings.IconScale.Hint"),
        scope: "world",
        config: true,
        default: 1.2,
        type: Number,
        range: {
            min: 0.5,
            max: 2.0,
            step: 0.05
        },
        onChange: () => {
            if (game.user.isGM) {
                syncIconScaleToClients();
            }
            updateAllIconsScale();
        },
    });
	
    // Настройка цвета
    game.settings.register(MODULE_ID, 'iconColor', {
        name: game.i18n.localize("customtargeticon.Settings.IconColor.Name"),
        hint: game.i18n.localize("customtargeticon.Settings.IconColor.Hint"),
        scope: "world",
        config: true,
        default: '#ffffff',
        type: String,
        onChange: () => {
            updateAllIconsColor();
            if (game.user.isGM) {
                syncColorToClients();
            }
        },
    });
    
    // Настройка: использовать цвет игрока для тинта
    game.settings.register(MODULE_ID, 'usePlayerColor', {
        name: game.i18n.localize("customtargeticon.Settings.UsePlayerColor.Name"),
        hint: game.i18n.localize("customtargeticon.Settings.UsePlayerColor.Hint"),
        scope: "world",
        config: true,
        default: false,
        type: Boolean,
        onChange: () => {
            updateAllIconsColor();
            if (game.user.isGM) {
                syncColorToClients();
            }
        },
    });
    
    // Клавиша для очистки всех целей
    const { ALT } = foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS;
    
    game.keybindings.register(MODULE_ID, "clearAllTargets", {
        name: game.i18n.localize("customtargeticon.keybindings.clearAllTargets.Name"),
        hint: game.i18n.localize("customtargeticon.keybindings.clearAllTargets.Hint"),
        editable: [
            { key: "KeyC", modifiers: [ALT] }
        ],
        onDown: () => {
            game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
        },
    });
});

Hooks.once('ready', function() {
    loadPlayerIcons();
    
    if (game.user.isGM) {
        createPlayerIconSettings();
        createGMInterface();
    }
    
    updateDefaultIcon();
    
    game.socket.on(`module.${MODULE_ID}`, handleSocketMessage);
    
    startAnimation();
    startRotationSync();
    syncExistingTargets();
    startSniperAnimation();
});

// Сохраняем путь к иконке по умолчанию
let defaultIconPath = '';

function updateDefaultIcon() {
    defaultIconPath = game.settings.get(MODULE_ID, 'defaultIcon');
}

function syncSniperModeToClients() {
    const sniperMode = game.settings.get(MODULE_ID, 'sniperMode');
    game.socket.emit(`module.${MODULE_ID}`, {
        action: 'updateSniperMode',
        sniperMode: sniperMode
    });
}

function syncSniperSpeedToClients() {
    const sniperSpeed = game.settings.get(MODULE_ID, 'sniperSpeed');
    game.socket.emit(`module.${MODULE_ID}`, {
        action: 'updateSniperSpeed',
        sniperSpeed: sniperSpeed
    });
}

function syncSniperOffsetToClients() {
    const sniperOffset = game.settings.get(MODULE_ID, 'sniperOffset');
    game.socket.emit(`module.${MODULE_ID}`, {
        action: 'updateSniperOffset',
        sniperOffset: sniperOffset
    });
}

function syncEnablePlayerIconsToClients() {
    const enablePlayerIcons = game.settings.get(MODULE_ID, 'enablePlayerIcons');
    game.socket.emit(`module.${MODULE_ID}`, {
        action: 'updateEnablePlayerIcons',
        enablePlayerIcons: enablePlayerIcons
    });
}

function syncDefaultIconToClients() {
    game.socket.emit(`module.${MODULE_ID}`, {
        action: 'updateDefaultIcon',
        iconPath: defaultIconPath
    });
}

function syncColorToClients() {
    const usePlayerColor = game.settings.get(MODULE_ID, 'usePlayerColor');
    const iconColor = game.settings.get(MODULE_ID, 'iconColor');
    
    game.socket.emit(`module.${MODULE_ID}`, {
        action: 'updateColorSettings',
        usePlayerColor: usePlayerColor,
        iconColor: iconColor
    });
}

function syncIconScaleToClients() {
    const iconScale = game.settings.get(MODULE_ID, 'iconScale');
    game.socket.emit(`module.${MODULE_ID}`, {
        action: 'updateIconScale',
        iconScale: iconScale
    });
}

function loadPlayerIcons() {
    const savedIcons = game.settings.get(MODULE_ID, 'playerIcons');
    playerIcons = new Map(Object.entries(savedIcons));
}

function savePlayerIcons() {
    const iconsObject = Object.fromEntries(playerIcons);
    game.settings.set(MODULE_ID, 'playerIcons', iconsObject);
}

function getPlayerTintColor(userId) {
    const usePlayerColor = game.settings.get(MODULE_ID, 'usePlayerColor');
    
    if (usePlayerColor) {
        const user = game.users.get(userId);
        if (user && user.color) {
            try {
                return Color.from(user.color);
            } catch(e) {
                return 0xffffff;
            }
        }
        return 0xffffff;
    } else {
        const iconColor = game.settings.get(MODULE_ID, 'iconColor');
        if (iconColor && iconColor !== '#ffffff') {
            try {
                return Color.from(iconColor);
            } catch(e) {
                return 0xffffff;
            }
        }
        return 0xffffff;
    }
}

function getPlayerIcon(userId, viewerIsGM = false) {
    const enablePlayerIcons = game.settings.get(MODULE_ID, 'enablePlayerIcons');
    
    if (!enablePlayerIcons) {
        return defaultIconPath;
    }
    
    if (viewerIsGM && playerIcons.has(userId)) {
        const playerIcon = playerIcons.get(userId);
        if (playerIcon && playerIcon !== '') {
            return playerIcon;
        }
        return defaultIconPath;
    }
    
    if (!viewerIsGM && userId === game.user.id) {
        if (playerIcons.has(game.user.id)) {
            const playerIcon = playerIcons.get(game.user.id);
            if (playerIcon && playerIcon !== '') {
                return playerIcon;
            }
        }
        return defaultIconPath;
    }
    
    if (!viewerIsGM && userId !== game.user.id) {
        return defaultIconPath;
    }
    return defaultIconPath;
}

function refreshAllIcons() {
    for (const [id, data] of activeTokens) {
        const token = data.token;
        if (token && token.flagContainer && data.ownerId) {
            const isGM = game.user.isGM;
            const iconToShow = getPlayerIcon(data.ownerId, isGM);
            const texture = PIXI.Texture.from(iconToShow);
            const flagSprite = token.flagContainer.children[0];
            if (flagSprite) {
                flagSprite.texture = texture;
                flagSprite.tint = getPlayerTintColor(data.ownerId);
            }
        }
    }
}

function createPlayerIconSettings() {
    const users = game.users.filter(u => !u.isGM);
    
    for (const user of users) {
        const settingKey = `playerIcon_${user.id}`;
        const currentIcon = playerIcons.get(user.id) || defaultIconPath;
        
        if (!game.settings.settings.get(`${MODULE_ID}.${settingKey}`)) {
            game.settings.register(MODULE_ID, settingKey, {
                name: `${game.i18n.localize("customtargeticon.Settings.PlayerIcon.Name")} - ${user.name}`,
                hint: game.i18n.localize("customtargeticon.Settings.PlayerIcon.Hint"),
                scope: "world",
                config: true,
                default: currentIcon,
                type: String,
                filePicker: 'image',
                onChange: (value) => {
                    if (!value || value === '') {
                        value = defaultIconPath;
                    }
                    playerIcons.set(user.id, value);
                    savePlayerIcons();
                    updatePlayerIcons(user.id);
                    syncPlayerIconToClients(user.id, value);
                }
            });
        }
    }
}

function syncPlayerIconToClients(userId, iconPath) {
    game.socket.emit(`module.${MODULE_ID}`, {
        action: 'updatePlayerIcon',
        userId: userId,
        iconPath: iconPath
    });
}

function createGMInterface() {
    Hooks.on("renderSettings", (app, html, data) => {
        const button = $(`<button id="custom-target-icon-manage-icons" style="margin-top: 10px;">
            <i class="fas fa-images"></i> ${game.i18n.localize("customtargeticon.ManageIcons.Button")}
        </button>`);
        
        button.on("click", () => {
            openIconManagementWindow();
        });
        
        html.find("#game-details").append(button);
    });
}

function getPlayerColorHex(user) {
    if (!user || !user.color) return '#ffffff';
    try {
        return Color.from(user.color);
    } catch(e) {
        return '#ffffff';
    }
}

function openIconManagementWindow() {
    const users = game.users.filter(u => !u.isGM);
    let content = `<div style="padding: 10px; max-height: 500px; overflow-y: auto;">
        <h2>${game.i18n.localize("customtargeticon.ManageIcons.Title")}</h2>
        <p>${game.i18n.localize("customtargeticon.ManageIcons.Description")}</p>
        <hr>`;
    
    for (const user of users) {
        let currentIcon = playerIcons.get(user.id);
        if (!currentIcon || currentIcon === '') {
            currentIcon = defaultIconPath;
        }
        const playerColor = getPlayerColorHex(user);
        content += `
            <div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${currentIcon}" style="width: 48px; height: 48px; object-fit: contain; border: 1px solid #ddd; border-radius: 4px;">
                    <div style="flex: 1;">
                        <strong style="font-size: 16px; color: ${playerColor};">${user.name}</strong>
                        <div style="margin-top: 8px;">
                            <button class="custom-target-icon-set-icon" data-user-id="${user.id}" data-user-name="${user.name}" style="margin-right: 5px;">
                                <i class="fas fa-edit"></i> ${game.i18n.localize("customtargeticon.ManageIcons.SetIcon")}
                            </button>
                            <button class="custom-target-icon-reset-icon" data-user-id="${user.id}">
                                <i class="fas fa-undo"></i> ${game.i18n.localize("customtargeticon.ManageIcons.ResetIcon")}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    content += `<hr><p><small>${game.i18n.localize("customtargeticon.ManageIcons.Note")}</small></p></div>`;
    
    new Dialog({
        title: game.i18n.localize("customtargeticon.ManageIcons.Title"),
        content: content,
        buttons: {
            close: {
                icon: '<i class="fas fa-times"></i>',
                label: "Close"
            }
        },
        render: (html) => {
            html.find('.custom-target-icon-set-icon').click((event) => {
                const userId = $(event.currentTarget).data('user-id');
                const userName = $(event.currentTarget).data('user-name');
                openFilePicker(userId, userName);
            });
            
            html.find('.custom-target-icon-reset-icon').click((event) => {
                const userId = $(event.currentTarget).data('user-id');
                playerIcons.delete(userId);
                savePlayerIcons();
                updatePlayerIcons(userId);
                syncPlayerIconToClients(userId, defaultIconPath);
                openIconManagementWindow();
            });
        }
    }).render(true);
}

function openFilePicker(userId, userName) {
    const currentIcon = playerIcons.get(userId) || defaultIconPath;
    new FilePicker({
        type: "image",
        current: currentIcon,
        callback: (path) => {
            const finalPath = (path && path !== '') ? path : defaultIconPath;
            playerIcons.set(userId, finalPath);
            savePlayerIcons();
            updatePlayerIcons(userId);
            syncPlayerIconToClients(userId, finalPath);
            openIconManagementWindow();
        }
    }).render(true);
}

function updatePlayerIcons(userId) {
    const user = game.users.get(userId);
    if (!user) return;
    
    for (const tokenDocument of user.targets) {
        const token = canvas.tokens?.get(tokenDocument.id);
        if (token && token.flagContainer) {
            const isGM = game.user.isGM;
            const iconToShow = getPlayerIcon(userId, isGM);
            const texture = PIXI.Texture.from(iconToShow);
            const flagSprite = token.flagContainer.children[0];
            if (flagSprite) {
                flagSprite.texture = texture;
                flagSprite.tint = getPlayerTintColor(userId);
            }
        }
    }
}

function updateAllIconsScale() {
    const iconScale = game.settings.get(MODULE_ID, 'iconScale');
    
    for (const [id, data] of activeTokens) {
        const token = data.token;
        if (token && token.flagContainer) {
            const flagSprite = token.flagContainer.children[0];
            if (flagSprite) {
                const size = Math.max(token.w, token.h) * iconScale;
                flagSprite.width = size;
                flagSprite.height = size;
            }
        }
    }
}

function updateAllIconsColor() {
    const usePlayerColor = game.settings.get(MODULE_ID, 'usePlayerColor');
    const globalColor = game.settings.get(MODULE_ID, 'iconColor');
    const globalTint = (globalColor && globalColor !== '#ffffff') ? Color.from(globalColor) : 0xffffff;
    
    for (const [id, data] of activeTokens) {
        const token = data.token;
        if (token && token.flagContainer) {
            const flagSprite = token.flagContainer.children[0];
            if (flagSprite) {
                const ownerId = data.ownerId;
                if (usePlayerColor && ownerId) {
                    flagSprite.tint = getPlayerTintColor(ownerId);
                } else {
                    flagSprite.tint = globalTint;
                }
            }
        }
    }
}

Token.prototype._drawTargetArrows = function() {
    return;
};

function isTokenMoving(token) {
    if (!token || !token.document) return false;
    const speed = token.document.speed;
    const rotateOnMove = game.settings.get(MODULE_ID, "rotateOnMove");
    
    if (rotateOnMove) {
        return speed && speed > 0;
    }
    return true;
}

function getRandomPoint(token, offsetFactor) {
    const maxOffset = Math.min(token.w, token.h) * offsetFactor;
    const angle = Math.random() * Math.PI * 2;
    const distance = 5 + Math.random() * (maxOffset - 5);
    return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance
    };
}

function addIconAboveToken(token, iconSrc) {
    if (!token || !iconSrc || token.destroyed) return;

    removeIconAboveToken(token);
    
    if (token.targetArrows) {
        token.targetArrows.clear();
    }
    if (token.targetPips) {
        token.targetPips.clear();
    }

    const container = new PIXI.Container();
    const texture = PIXI.Texture.from(iconSrc);
    const flagSprite = new PIXI.Sprite(texture);

    const iconScale = game.settings.get(MODULE_ID, 'iconScale');
    const size = Math.max(token.w, token.h) * iconScale;
    flagSprite.width = size;
    flagSprite.height = size;
    flagSprite.anchor.set(0.5, 0.5);

    container.x = token.w / 2;
    container.y = token.h / 2;
    container.addChild(flagSprite);
    container.zIndex = 9999;
    
    token.flagContainer = container;
    token.addChild(container);
    token.sortableChildren = true;
    
    const syncedData = activeTokens.get(token.id);
    const startRotation = syncedData ? syncedData.rotationAngle : 0;
    
    const offsetFactor = game.settings.get(MODULE_ID, 'sniperOffset');
    const point1 = getRandomPoint(token, offsetFactor);
    const point2 = getRandomPoint(token, offsetFactor);
    
    activeTokens.set(token.id, {
        token: token,
        rotation: 0,
        scale: 1,
        scalingUp: false,
        lastSpeed: token.document?.speed || 0,
        rotationAngle: startRotation,
        lastSyncTime: Date.now(),
        ownerId: null,
        points: [point1, point2],
        currentPointIndex: 0,
        progress: 0
    });
    
    token.flagContainer.rotation = startRotation;
}

function removeIconAboveToken(token) {
    if (!token) return;
    
    if (token.flagContainer) {
        token.flagContainer.destroy();
        token.flagContainer = null;
    }
    
    activeTokens.delete(token.id);
}

function updateIconPosition(token, data) {
    if (!token || !token.flagContainer || token.destroyed) return;
    
    const baseX = token.w / 2;
    const baseY = token.h / 2;
    
    token.flagContainer.x = baseX + data.currentX;
    token.flagContainer.y = baseY + data.currentY;
}

function getBezierPoint(t, p0, p1, p2) {
    // Квадратичная кривая Безье: B(t) = (1-t)²*P0 + 2(1-t)t*P1 + t²*P2
    const mt = 1 - t;
    const x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
    const y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;
    return { x, y };
}

function animateIconRotation(token, data) {
    if (!token.flagContainer) return;
    
    const rotationSpeed = game.settings.get(MODULE_ID, "rotationSpeed");
    const shouldRotate = isTokenMoving(token);
    
    if (shouldRotate && rotationSpeed !== 0) {
        data.rotationAngle += rotationSpeed;
        token.flagContainer.rotation = data.rotationAngle;
    } else if (!shouldRotate && data.rotationAngle !== 0) {
        token.flagContainer.rotation = 0;
        data.rotationAngle = 0;
    }
}

function animateIconScale(token, data) {
    if (!token.flagContainer) return;
    
    const scaleSpeed = game.settings.get(MODULE_ID, "scaleAnimationSpeed");
    if (scaleSpeed === 0) return;
    
    const minScale = 1;
    const maxScale = 1.2;
    
    if (!data.scalingUp && token.flagContainer.scale.x < maxScale) {
        token.flagContainer.scale.x += scaleSpeed;
        token.flagContainer.scale.y += scaleSpeed;
        if (token.flagContainer.scale.x >= maxScale) {
            data.scalingUp = true;
        }
    } else if (data.scalingUp && token.flagContainer.scale.x > minScale) {
        token.flagContainer.scale.x -= scaleSpeed;
        token.flagContainer.scale.y -= scaleSpeed;
        if (token.flagContainer.scale.x <= minScale) {
            data.scalingUp = false;
        }
    }
}

function startSniperAnimation() {
    if (!canvas?.app?.ticker) {
        setTimeout(startSniperAnimation, 1000);
        return;
    }
    
    canvas.app.ticker.add(() => {
        const sniperMode = game.settings.get(MODULE_ID, 'sniperMode');
        const speed = game.settings.get(MODULE_ID, 'sniperSpeed');
        
        if (!sniperMode) return;
        
        for (const [id, data] of activeTokens) {
            const token = data.token;
            if (!token || token.destroyed || !token.flagContainer) continue;
            
            if (data.progress < 1) {
                // Движение по текущему сегменту
                data.progress += speed;
                if (data.progress >= 1) {
                    data.progress = 1;
                }
                
                const t = easeInOutCubic(data.progress);
                let pos;
                
                if (data.currentPointIndex === 0) {
                    // От центра к первой точке
                    const center = { x: 0, y: 0 };
                    pos = getBezierPoint(t, center, center, data.points[0]);
                } else if (data.currentPointIndex === 1) {
                    // От первой точки ко второй
                    pos = getBezierPoint(t, data.points[0], data.points[0], data.points[1]);
                } else {
                    // От второй точки обратно в центр
                    const center = { x: 0, y: 0 };
                    pos = getBezierPoint(t, data.points[1], data.points[1], center);
                }
                
                data.currentX = pos.x;
                data.currentY = pos.y;
                updateIconPosition(token, data);
                
                if (data.progress >= 1) {
                    // Переход к следующему сегменту
                    data.currentPointIndex++;
                    data.progress = 0;
                    
                    // Если прошли все три сегмента, генерируем новые точки
                    if (data.currentPointIndex > 2) {
                        const offsetFactor = game.settings.get(MODULE_ID, 'sniperOffset');
                        data.points[0] = getRandomPoint(token, offsetFactor);
                        data.points[1] = getRandomPoint(token, offsetFactor);
                        data.currentPointIndex = 0;
                    }
                }
            }
        }
    });
}

function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function stopAllSniperAnimations() {
    for (const [id, data] of activeTokens) {
        const token = data.token;
        if (token && token.flagContainer) {
            data.currentX = 0;
            data.currentY = 0;
            data.progress = 0;
            data.currentPointIndex = 0;
            updateIconPosition(token, data);
        }
    }
}

function startAnimation() {
    if (!canvas?.app?.ticker) {
        setTimeout(startAnimation, 1000);
        return;
    }
    
    canvas.app.ticker.add(() => {
        for (const [id, data] of activeTokens) {
            const token = data.token;
            
            if (!token || token.destroyed || !token.flagContainer) {
                activeTokens.delete(id);
                continue;
            }
            
            const currentSpeed = token.document?.speed || 0;
            if (data.lastSpeed !== currentSpeed) {
                data.lastSpeed = currentSpeed;
                if (currentSpeed === 0 && game.settings.get(MODULE_ID, "rotateOnMove")) {
                    if (token.flagContainer) {
                        token.flagContainer.rotation = 0;
                        data.rotationAngle = 0;
                    }
                }
            }
            
            animateIconRotation(token, data);
            animateIconScale(token, data);
        }
    });
}

function startRotationSync() {
    if (syncInterval) clearInterval(syncInterval);
    
    syncInterval = setInterval(() => {
        if (!game.user.isGM) return;
        
        const syncData = [];
        
        for (const [id, data] of activeTokens) {
            const token = data.token;
            if (token && token.flagContainer && isTokenMoving(token)) {
                syncData.push({
                    tokenId: id,
                    rotationAngle: data.rotationAngle
                });
            }
        }
        
        if (syncData.length > 0) {
            game.socket.emit(`module.${MODULE_ID}`, {
                action: 'syncRotation',
                data: syncData
            });
        }
    }, 100);
}

function handleSocketMessage(data) {
    if (!data || !data.action) return;
    
    switch (data.action) {
        case 'addIcon':
            const token = canvas.tokens?.get(data.tokenId);
            if (token) {
                const isGM = game.user.isGM;
                const iconSrc = getPlayerIcon(data.userId, isGM);
                addIconAboveToken(token, iconSrc);
                const tokenData = activeTokens.get(token.id);
                if (tokenData) {
                    tokenData.ownerId = data.userId;
                    const flagSprite = token.flagContainer?.children[0];
                    if (flagSprite) {
                        flagSprite.tint = getPlayerTintColor(data.userId);
                    }
                }
            }
            break;
            
        case 'removeIcon':
            const targetToken = canvas.tokens?.get(data.tokenId);
            if (targetToken) {
                removeIconAboveToken(targetToken);
            }
            break;
            
        case 'syncRotation':
            if (data.data && Array.isArray(data.data)) {
                for (const sync of data.data) {
                    const tokenData = activeTokens.get(sync.tokenId);
                    if (tokenData && tokenData.token && tokenData.token.flagContainer) {
                        tokenData.rotationAngle = sync.rotationAngle;
                        tokenData.token.flagContainer.rotation = sync.rotationAngle;
                    }
                }
            }
            break;
            
        case 'syncTargets':
            syncExistingTargets();
            break;
            
        case 'updatePlayerIcon':
            if (data.userId && data.iconPath) {
                const finalPath = (data.iconPath && data.iconPath !== '') ? data.iconPath : defaultIconPath;
                playerIcons.set(data.userId, finalPath);
                updatePlayerIcons(data.userId);
            }
            break;
            
        case 'updateDefaultIcon':
            if (data.iconPath) {
                defaultIconPath = data.iconPath;
                for (const [id, tokenData] of activeTokens) {
                    const token = tokenData.token;
                    if (token && token.flagContainer && tokenData.ownerId) {
                        const ownerIcon = playerIcons.get(tokenData.ownerId);
                        if (!ownerIcon || ownerIcon === '') {
                            const texture = PIXI.Texture.from(defaultIconPath);
                            const flagSprite = token.flagContainer.children[0];
                            if (flagSprite) {
                                flagSprite.texture = texture;
                            }
                        }
                    }
                }
            }
            break;
            
        case 'updateColorSettings':
            if (data.usePlayerColor !== undefined) {
                game.settings.set(MODULE_ID, 'usePlayerColor', data.usePlayerColor);
            }
            if (data.iconColor !== undefined) {
                game.settings.set(MODULE_ID, 'iconColor', data.iconColor);
            }
            updateAllIconsColor();
            break;
            
        case 'updateIconScale':
            if (data.iconScale !== undefined) {
                game.settings.set(MODULE_ID, 'iconScale', data.iconScale);
                updateAllIconsScale();
            }
            break;
            
        case 'updateEnablePlayerIcons':
            if (data.enablePlayerIcons !== undefined) {
                game.settings.set(MODULE_ID, 'enablePlayerIcons', data.enablePlayerIcons);
                refreshAllIcons();
            }
            break;
            
        case 'updateSniperMode':
            if (data.sniperMode !== undefined) {
                game.settings.set(MODULE_ID, 'sniperMode', data.sniperMode);
                if (!data.sniperMode) {
                    stopAllSniperAnimations();
                }
            }
            break;
            
        case 'updateSniperSpeed':
            if (data.sniperSpeed !== undefined) {
                game.settings.set(MODULE_ID, 'sniperSpeed', data.sniperSpeed);
            }
            break;
            
        case 'updateSniperOffset':
            if (data.sniperOffset !== undefined) {
                game.settings.set(MODULE_ID, 'sniperOffset', data.sniperOffset);
            }
            break;
    }
}

function syncExistingTargets() {
    if (!game.user.isGM) return;
    
    for (const tokenDocument of game.user.targets) {
        const token = canvas.tokens?.get(tokenDocument.id);
        if (token) {
            game.socket.emit(`module.${MODULE_ID}`, {
                action: 'addIcon',
                tokenId: token.id,
                userId: game.user.id
            });
        }
    }
    
    for (const user of game.users) {
        if (user.isGM) continue;
        for (const tokenDocument of user.targets) {
            const token = canvas.tokens?.get(tokenDocument.id);
            if (token) {
                game.socket.emit(`module.${MODULE_ID}`, {
                    action: 'addIcon',
                    tokenId: token.id,
                    userId: user.id
                });
            }
        }
    }
}

Hooks.on("targetToken", (user, tokenDocument, targeted) => {
    const token = canvas.tokens?.get(tokenDocument.id);
    if (!token) return;
    
    if (targeted) {
        const isGM = game.user.isGM;
        const iconSrc = getPlayerIcon(user.id, isGM);
        addIconAboveToken(token, iconSrc);
        
        const tokenData = activeTokens.get(token.id);
        if (tokenData) {
            tokenData.ownerId = user.id;
            const flagSprite = token.flagContainer?.children[0];
            if (flagSprite) {
                flagSprite.tint = getPlayerTintColor(user.id);
            }
        }
        
        if (game.user.isGM) {
            game.socket.emit(`module.${MODULE_ID}`, {
                action: 'addIcon',
                tokenId: token.id,
                userId: user.id
            });
        }
        
        if (token._refreshTarget) {
            token._refreshTarget();
        }
    } else {
        removeIconAboveToken(token);
        
        if (game.user.isGM) {
            game.socket.emit(`module.${MODULE_ID}`, {
                action: 'removeIcon',
                tokenId: token.id
            });
        }
        
        if (token._refreshTarget) {
            token._refreshTarget();
        }
    }
});

Hooks.on("updateToken", (tokenDocument, updateData) => {
    const token = canvas.tokens?.get(tokenDocument.id);
    if (!token || !token.flagContainer) return;
    
    if (updateData.x !== undefined || updateData.y !== undefined) {
        const tokenData = activeTokens.get(token.id);
        updateIconPosition(token, tokenData);
    }
});

Hooks.on("settingsChanged", (module, settings) => {
    if (module === MODULE_ID && game.user.isGM) {
        if (settings.defaultIcon !== undefined) {
            defaultIconPath = settings.defaultIcon;
            for (const [id, data] of activeTokens) {
                const token = data.token;
                if (token && token.flagContainer) {
                    const iconSrc = getPlayerIcon(data.ownerId || game.user.id, true);
                    const texture = PIXI.Texture.from(iconSrc);
                    const flagSprite = token.flagContainer.children[0];
                    if (flagSprite) {
                        flagSprite.texture = texture;
                    }
                }
            }
        }
        
        if (settings.iconScale !== undefined) {
            updateAllIconsScale();
        }
        
        if (settings.usePlayerColor !== undefined || settings.iconColor !== undefined) {
            updateAllIconsColor();
        }
        
        if (settings.enablePlayerIcons !== undefined) {
            refreshAllIcons();
        }
        
        if (settings.sniperMode !== undefined && !settings.sniperMode) {
            stopAllSniperAnimations();
        }
    }
});

Hooks.on("canvasReady", () => {
    activeTokens.clear();
});

Hooks.on("closeCanvas", () => {
    activeTokens.clear();
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
});