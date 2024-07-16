import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { once } from 'node:events';
import { mkdirSync } from 'node:fs';

export async function ensurePlayableInBrowser(path) {
    const { mtime }  = await stat(path);

    const key = createHash('sha1').update(`proxy-video:${path}:${mtime}`).digest('hex')

    const output = join(homedir(), ".cache", "videotools", "proxy", key + '.mp4');

    try {
        await stat(output);
        return output;
    } catch { }

    mkdirSync(dirname(output), { recursive: true });

    const args = [
        "-i", path, "-c:v", "h264_nvenc", "-tune:v", "hq", "-rc:v", "vbr", "-cq:v",
        "20", "-b:v", "0", "-profile:v", "high", "-c:a", "aac",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-y",
        output
    ];

    console.log(args.join(' '));

    const proc = spawn('ffmpeg', args, {
        stdio: ['ignore', 'inherit', 'inherit']
    });
    await once(proc, 'exit');

    try {
        await stat(output);
    } catch {
        throw new Error(`FFmpeg did not create file: ${output}`)
    }

    return output;
}

