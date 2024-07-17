import { State, ensureNoNulls } from './State.js';

const c_grid_line = '#999999';
const c_now_line = '#ff0000';
const c_audio_background = '#440000';
const c_video_background = '#000044';
const thickness = 2;
const text_padding = 8;

class Ui {
    /** @type {State} */
    state;
    /** @type {HTMLElement} */
    owner;
    /** @type {HTMLVideoElement} */
    video;
    /** @type {HTMLAudioElement} */
    audio;
    /** @type {HTMLCanvasElement} */
    canvas;
    /** @type {HTMLDivElement} */
    canvas_container;
    /** @type {CanvasRenderingContext2D} */
    c2d;
    
    playing = false;

    constructor(state, parent) {
        this.state = state;

        // Template
        const owner = this.owner = document.createElement("div");
        owner.innerHTML = /* html */ `
            <audio data-element="audio"></audio>

            <div class='video-container'>
                <video data-element="video"></video>
            </div>
            <div data-element="canvas_container" class='timeline'>
                <canvas data-element="canvas"></canvas>
            </div>
        `;
        owner.className = `ManualAlignment-Ui`;

        // Bind element references
        owner.querySelectorAll("[data-element]").forEach(elem => {
            this[elem.getAttribute("data-element")] = elem;
            elem.removeAttribute("data-element");
        });

        this.c2d = this.canvas.getContext("2d");
        if (!this.c2d) throw new Error("Canvas Context 2d Not Supported");

        ensureNoNulls(this);

        // Bind state to UI
        this.video.src = this.state.video_path;
        this.audio.src = this.state.audio_path;

        this.video.currentTime = this.state.videoTime();
        this.video.playbackRate = this.state.videoPlaybackRate();
        this.audio.currentTime = this.state.cursor;

        this.audio.volume = this.state.mute_audio ? 0 : 1;
        this.video.volume = this.state.mute_video ? 0 : 1;

        parent.appendChild(owner);

        this.onResize();

        // Setup interactive listeners
        window.addEventListener('resize', this.onResize, { passive: false });
        window.addEventListener('keypress', this.onKey, { passive: false });

        owner.addEventListener('wheel', this.onWheel, { passive: false });

        this.audio.addEventListener('loadedmetadata', this.timelineRender);
        this.video.addEventListener('loadedmetadata', this.timelineRender);
    }

    onResize = () => {
        const { canvas, canvas_container } = this;
        canvas.width = canvas_container.offsetWidth * devicePixelRatio;
        canvas.height = canvas_container.offsetHeight * devicePixelRatio;

        this.timelineRender();
    }

    timelineRender = () => {
        const { c2d, canvas: { width: w, height: h } } = this;

        const w2 = w/2;
        const h2 = h/2;
        const pix_per_second = 50;

        c2d.clearRect(0, 0, w, h);
        c2d.fillStyle = c_grid_line;
        c2d.fillRect(0, h2 - thickness/2, w, thickness);

        // Audio Track
        const audio_x = w2 - pix_per_second * this.state.cursor;
        c2d.fillStyle = c_audio_background;
        c2d.fillRect(audio_x, h2 + thickness/2, pix_per_second * this.audio.duration, h2 - thickness/2);

        // Video Track
        const video_x = audio_x + this.state.video_offset * pix_per_second;
        c2d.fillStyle = c_video_background;
        c2d.fillRect(video_x, 0, pix_per_second * this.video.duration, h2 - thickness/2);

        // Playhead
        c2d.fillStyle = c_now_line;
        c2d.fillRect(w2 - thickness, 0, thickness, h);

        c2d.textAlign = 'left';
        c2d.textRendering = 'optimizeLegibility';
        c2d.textBaseline = 'top';
        c2d.font = '24px "Recursive", sans-serif';
        c2d.fillText(`${Math.floor(this.state.cursor * this.state.fps)}`, w2 + thickness + text_padding, text_padding);
    }

    /** @param {WheelEvent} ev  */
    onWheel = (ev) => {
        if (this.playing) this.pause();

        const d = (ev.deltaX == 0 ? ev.deltaY : ev.deltaX) / 120;
        this.state.cursor += d;

        this.audio.currentTime = this.state.cursor;
        this.video.currentTime = this.state.videoTime();

        this.sync();
        
        this.timelineRender();
    }

    /** @param {KeyboardEvent} ev  */
    onKey = (ev) => {
        console.log(ev);
    }

    remove() {
        window.removeEventListener('resize', this.onResize);
        window.removeEventListener('keypress', this.onKey);
        this.audio.removeEventListener('loadedmetadata', this.timelineRender);
        this.video.removeEventListener('loadedmetadata', this.timelineRender);
        this.owner.remove();
    }

    sync() { }
}

document.addEventListener("DOMContentLoaded", async() => {
    const state = new State(await IPC.getState());
    globalThis.ui = new Ui(state, document.querySelector("#main"));
    globalThis.ui.sync = function() { IPC.sync(this.state.toJSON()); };
});

