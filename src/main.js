import { BrowserWindow, app, ipcMain } from 'electron';
import { ensurePlayableInBrowser } from './ffmpeg.js';
import path from 'path';

import { State } from './State.js';

const video_path = '/home/dave/Videos/cant-sing/IMG_2381.MOV';
let state = new State({
    root: '/home/dave/Videos/cant-sing',
    audio_path: '/home/dave/Videos/cant-sing/cant-sing.wav',
    original_video_path: video_path,
    video_path: await ensurePlayableInBrowser(video_path),
});

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.cjs')
    }
  })

  win.loadFile(path.join(import.meta.dirname, 'index.html'))
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
});

ipcMain.handle("getState", () => state.toJSON());
ipcMain.on("sync", (_, data) => {
    state = new State(data.state);
});

