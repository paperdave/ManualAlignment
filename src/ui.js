import { State, ensureNoNulls } from './State.js';

const c_grid_line = '#999999';
const c_now_line = '#ff0000';
const c_audio_background = '#440000';
const c_video_background = '#000044';
const c_mark_io = '#00ffff';
const c_mark_audio = '#ffff00';
const c_mark_video = '#ff00ff';
const thickness = 2;
const text_padding = 8;

class Ui {
    /** @type {State} */
    state;
    /** @type {HTMLElement} */
    owner;
    /** @type {HTMLVideoElement} */
    video;
    /** @type {AudioContext} */
    audio;
    /** @type {AudioBuffer} */
    audio_buffer;
    /** @type {AudioBufferSourceNode | null} */
    audio_src_node = null;
    /** @type {GainNode} */
    audio_gain;
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

        this.audio = new AudioContext();
        this.audio_gain = this.audio.createGain();

        this.audio_gain.connect(this.audio.destination);
        
        fetch(this.state.audio_path)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
                return res.arrayBuffer();
            })
            .then(buffer => this.audio.decodeAudioData(buffer))
            .then(this.onAudioLoad)
            .catch((e) => (console.error(e), alert("error")));

        ensureNoNulls(this, [
            "audio_buffer",
            "audio_src_node",
        ]);

        // Bind state to UI
        this.video.src = this.state.video_path;

        this.video.currentTime = this.state.videoTime();
        this.video.playbackRate = this.state.videoPlaybackRate();

        this.audio_gain.gain.value = this.state.audio_volume;
        this.video.volume = this.state.video_volume;

        parent.appendChild(owner);

        this.onResize();

        // Setup interactive listeners
        window.addEventListener('resize', this.onResize, { passive: false });
        window.addEventListener('keypress', this.onKey, { passive: false });

        owner.addEventListener('wheel', this.onWheel, { passive: false });

        this.video.addEventListener('loadedmetadata', this.timelineRender);
    }
    
    /** @param {AudioBuffer} buffer */
    onAudioLoad = (buffer) => {
        this.audio_buffer = buffer;
    }

    audioDuration() {
        return this.audio_buffer?.duration ?? 0;
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
        //c2d.fillRect(audio_x, h2 + thickness/2, pix_per_second * this.audioDuration(), h2 - thickness/2);

        if (this.audio_buffer) {
            const samples = this.audio_buffer.getChannelData(0);
            let n = samples.length;
            c2d.strokeStyle = 'yellow';
            c2d.fillStyle = '#303030';
            c2d.beginPath();
            c2d.moveTo(0,h2/2);
            for (let i=0; i<n; i+=100) {
                const x = ((i*w) / n);
                const y = ((samples[i]*h2/2)+h2/2);
                c2d.lineTo(x, y);
            }
            c2d.stroke();
            c2d.closePath();
            return;
        }

        // Video Track
        const video_x = audio_x + this.state.video_offset * pix_per_second;
        c2d.fillStyle = c_video_background;
        c2d.fillRect(video_x, 0, pix_per_second * this.video.duration, h2 - thickness/2);

        // Playhead
        c2d.fillStyle = c_now_line;
        c2d.fillRect(w2 - thickness, 0, thickness, h);

        // Marks
        this.drawMark(this.state.mark_in, 0, 0, h, c_mark_io, pix_per_second);
        this.drawMark(this.state.mark_out, 0, 0, h, c_mark_io, pix_per_second);
        this.drawMark(this.state.mark_audio, 0, h2 + thickness/2, h2 - thickness/2, c_mark_audio, pix_per_second);
        this.drawMark(this.state.mark_video, this.state.video_offset, 0, h2 - thickness/2, c_mark_video, pix_per_second);

        // Current Frame
        c2d.fillStyle = c_now_line;
        c2d.textAlign = 'left';
        c2d.textRendering = 'optimizeLegibility';
        c2d.textBaseline = 'top';
        c2d.font = '24px "Recursive", sans-serif';
        c2d.fillText(`${Math.floor(this.state.cursor * this.state.fps)}`, w2 + thickness + text_padding, text_padding);
    }

    drawMark(value, base_time, y, height, color, pix_per_second) {
        if (value < 0) return;
        const x = this.canvas.width / 2 + (value - this.state.cursor + base_time) * pix_per_second;
        this.c2d.fillStyle = color;
        this.c2d.fillRect(x, y, thickness, height);
    }

    /** @param {WheelEvent} ev  */
    onWheel = (ev) => {
        ev.preventDefault();

        if (this.playing) this.pause();

        const d = (ev.deltaX == 0 ? ev.deltaY : ev.deltaX)
            / (120 * (ev.shiftKey ? this.state.fps : 1));

        if (ev.ctrlKey) {
            this.state.video_offset += d;
        } else {
            this.state.cursor += d;
        }

        this.sync(); // TODO: debounce
        this.fixPlaybackTimes();
        this.timelineRender();
    }

    /** @param {KeyboardEvent} ev  */
    onKey = (ev) => {
        if (ev.code === 'Space') {
            if (this.playing) this.pause();
            else this.play();
        } else if (ev.key === 'a')
            this.setMark('in')
        else if (ev.key === 'A')
            this.jumpMark('in')
        else if (ev.key === 'd')
            this.setMark('out')
        else if (ev.key === 'D')
            this.jumpMark('out')
        else if (ev.key === 'q')
            this.setMark('audio')
        else if (ev.key === 'Q')
            this.jumpMark('audio')
        else if (ev.key === 'w')
            this.setMark('video', this.state.videoTime())
        else if (ev.key === 'W')
            this.jumpMark('video')
        else if (ev.key === 'f')
            this.alignMarks();
        else if (ev.key === 'c')
            this.clearAllMarks();
    }

    async play() {
        if (this.playing) return;
        if (!this.audio_buffer) return; // not loaded in
        this.playing = true;

        if (this.state.cursor < this.audioDuration()) {
            this.audio_src_node = this.audio.createBufferSource();
            this.audio_src_node.buffer = this.audio_buffer;
            this.audio_src_node.connect(this.audio_gain);
            if (this.state.cursor < 0) {
                this.audio_src_node.start(this.audio.currentTime - this.state.cursor);
            } else {
                this.audio_src_node.start(0, this.state.cursor);
            }
        }

        await Promise.all([
            this.state.videoTime() < this.video.duration ? this.video.play() : null,
        ]);

        const now = performance.now();
        const cursor = this.state.cursor;
        const frame = () => {
            this.state.cursor = cursor + (performance.now() - now) / 1000;
            this.timelineRender();

            if (this.playing)
                requestAnimationFrame(frame);
        }
        frame();
    }

    pause() {
        if (!this.playing) return;
        this.playing = false;

        this.video.pause();
        this.audio_src_node?.stop(0);
        this.audio_src_node.disconnect();
        this.audio_src_node = null;
        
        this.fixPlaybackTimes();
        this.sync();
    }

    setMark(mark_id, value = null) {
        const k = `mark_${mark_id}`;
        if (!(k in this.state))
            throw new Error(`Invalid Mark ID: ${mark_id}`);
        value ??= this.state.cursor;
        if (value < 0) value = -1;
        this.state[k] = value;
        this.timelineRender();
        this.sync();
    }

    jumpMark(mark_id) {
        const k = `mark_${mark_id}`;
        if (!(k in this.state))
            throw new Error(`Invalid Mark ID: ${mark_id}`);
        this.state.cursor = this.state[k];
        if (this.state.cursor == -1)
            this.state.cursor = 0;
        if (mark_id === 'video')
            this.state.cursor += this.state.video_offset;
        this.sync();
        this.fixPlaybackTimes();
        this.timelineRender();
    }

    alignMarks() {
        if (this.state.mark_audio < 0 || this.state.mark_video < 0)
            return;

        this.state.video_offset = this.state.mark_audio - this.state.mark_video;

        this.sync();
        this.fixPlaybackTimes();
        this.timelineRender();
    }

    clearAllMarks() {
        for (const k in this.state) {
            if (k.startsWith('mark_')) {
                this.state[k] = -1;
            }
        }

        this.sync();
        this.timelineRender();
    }

    fixPlaybackTimes() {
        this.video.currentTime = this.state.videoTime();
    }

    remove() {
        window.removeEventListener('resize', this.onResize);
        window.removeEventListener('keypress', this.onKey);
        this.video.removeEventListener('loadedmetadata', this.timelineRender);
        this.owner.remove();
        this.audio.close();
    }

    sync() {
        // TODO: add undo-redo system
    }
}

document.addEventListener("DOMContentLoaded", async() => {
    const state = new State(await IPC.getState());
    globalThis.ui = new Ui(state, document.querySelector("#main"));
    globalThis.ui.sync = function() { IPC.sync(this.state.toJSON()); };
});

