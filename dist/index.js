"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = require("path");
const { google } = require('googleapis');
const moment = require('moment');
const fs = require('fs');
const youtube = google.youtube('v3');
let api_key = "";
let channels = [];
let tray;
let mainWindow;
const createWindow = () => {
    // Create the browser window.
    mainWindow = new electron_1.BrowserWindow({
        height: 300,
        width: 400,
        frame: false,
        transparent: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });
    // and load the index.html of the app.
    mainWindow.loadFile(path.join(__dirname, '../src/index.html'));
    mainWindow.setResizable(true);
    // Open the DevTools.
    mainWindow.webContents.openDevTools({ mode: 'detach' });
};
const attach_ipc = function () {
    electron_1.ipcMain.on('asynchronous-message', (event, arg) => {
        console.log(arg);
        event.reply('asynchronous-reply', 'pong');
    });
    electron_1.ipcMain.on('synchronous-message', (event, arg) => {
        console.log(arg);
        event.returnValue = 'pong';
    });
};
const init_tray = function () {
    tray = new electron_1.Tray(path.join(__dirname, '../src/images/youtube_social_circle_dark.png'));
    const contextMenu = electron_1.Menu.buildFromTemplate([
        { role: "quit" }
    ]);
    tray.setToolTip('Youtube Streams Widget');
    tray.setContextMenu(contextMenu);
};
const load_settings = function () {
    let config = fs.readFileSync(path.join(__dirname, '../src/config.json'), 'utf-8');
    if (!config) {
        console.log(`Missing config.json file, exiting.`);
        return process.exit(1);
    }
    if (typeof config == 'string') {
        config = JSON.parse(config);
    }
    api_key = config.api_key;
    channels = config.channels;
};
electron_1.app.on('ready', async function () {
    load_settings();
    init_tray();
    attach_ipc();
    createWindow();
    const api = new youtube_api({
        api_key: api_key,
        channels: channels
    });
    mainWindow.webContents.on('did-finish-load', () => {
        api.init();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
class youtube_api {
    constructor(options) {
        this.timer = 1000 * 60 * 30;
        this.api_key = options.api_key || "";
        this.channels = options.channels || [];
    }
    init() {
        this.sendChannelData();
        this.sendLiveStreamData();
        setInterval(() => {
            this.sendLiveStreamData();
        }, this.timer);
    }
    async sendChannelData() {
        const data = await this.getChannelMeta(this.channels);
        mainWindow.webContents.send('message', {
            type: "channel_data",
            data: data
        });
    }
    async sendLiveStreamData() {
        let data = [];
        for (const channel of this.channels) {
            const live_streams = await this.getUpcomingLiveStreams(channel);
            data = data.concat(live_streams);
        }
        for (let i = 0; i < data.length; i++) {
            const stream = data[i];
            if (moment(stream.liveStreamingDetails.scheduledStartTime).isBefore(moment())) {
                data.splice(i, 1);
                i--;
            }
        }
        data.sort(function (a, b) {
            if (moment(a.liveStreamingDetails.scheduledStartTime).isBefore(moment(b.liveStreamingDetails.scheduledStartTime)))
                return -1;
            return 1;
        });
        mainWindow.webContents.send('message', {
            type: "upcoming_streams",
            data: data
        });
    }
    async getChannelMeta(channelId) {
        const res = await youtube.channels.list({
            id: channelId.join(','),
            part: `snippet,id`,
            auth: this.api_key
        });
        if (!res || !res.data || !res.data.items)
            return {};
        const channels = {};
        for (const item of res.data.items) {
            channels[item.id] = item;
        }
        return channels;
    }
    async getUpcomingLiveStreams(channelId) {
        const res = await youtube.search.list({
            channelId: channelId,
            part: `snippet`,
            auth: this.api_key,
            maxResults: 5,
            eventType: "upcoming",
            type: "video"
        });
        const ids = [];
        for (const item of res.data.items) {
            ids.push(item.id.videoId);
        }
        const response = await youtube.videos.list({
            part: `liveStreamingDetails,snippet,id`,
            auth: this.api_key,
            id: ids.join(",")
        });
        return response.data.items;
    }
}
//# sourceMappingURL=index.js.map