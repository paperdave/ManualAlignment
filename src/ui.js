import { State, ensureNoNulls } from './State.js';

class Ui {
    /** @type {State} */
    state;
    /** @type {HTMLElement} */
    owner;
    /** @type {HTMLVideoElement} */
    video;
    /** @type {HTMLVideoElement} */
    audio;

    constructor(state, parent) {
        this.state = state;

        const owner = this.owner = document.createElement("div");
        parent.appendChild(owner);
        owner.innerHTML = /* html */ `
            <video data-element="video"></video>
            <audio data-element="audio" controls></audio>
        `;

        owner.querySelectorAll("[data-element]").forEach(elem => {
            this[elem.getAttribute("data-element")] = elem;
        });
        
        ensureNoNulls(this);

        this.video.src = this.state.video_path;
        this.audio.src = this.state.audio_path;

        this.video.currentTime = this.state.videoTime();
        this.video.playbackRate = this.state.videoPlaybackRate();
        this.audio.currentTime = this.state.cursor;

        this.audio.volume = this.state.mute_audio ? 0 : 1;
        this.video.volume = this.state.mute_video ? 0 : 1;
    }
}

document.addEventListener("DOMContentLoaded", async() => {
    const state = new State(await IPC.getState());
    new Ui(state, document.querySelector("#main"));
});
