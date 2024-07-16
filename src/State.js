export class State {
    /** @type {string} */
    root;
    /** @type {string} */
    video_path;
    /** @type {string} */
    audio_path;

    fps = 30;
    video_offset = 0;
    video_rate = 1;
    cursor = 0;

    mute_audio = false;
    mute_video = false;

    constructor(assignments) {
        Object.assign(this, assignments ?? {});
        ensureNoNulls(this);
    }

    toJSON() {
        const obj = {};
        Object.keys(this).forEach(k => obj[k] = this[k]);
        return obj;
    }

    videoTime() {
        return this.cursor * this.video_rate - this.video_offset;
    }

    videoPlaybackRate() {
        return this.video_rate;
    }
}

export function ensureNoNulls(obj) {
    for(const k of Object.keys(obj))
        if(obj[k] == null)
            throw new Error(`Missing ${k} in construction`);
}

