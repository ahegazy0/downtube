import ytdl from '@distube/ytdl-core';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import progress from "../utils/progress.js";
import logger from "../utils/logger.js";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function guessBundledFfmpeg() {
    try {
        
        const exeDir = path.dirname(process.execPath || process.argv[1] || '.');
        const candidate = path.join(exeDir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
        if (fs.existsSync(candidate)) return candidate;
    } catch (e) {
    }
    return ffmpegStatic || 'ffmpeg';
}

class Youtube {
    
    constructor(url, type = 'video', quality = '360', output = '.', opts = {}) {
        this.url = url;
        this.type = type;
        this.quality = quality;
        this.output = output;

        this.info = null;
        this.title = '';
        this.selectedVideoFormat = null;
        this.selectedAudioFormat = null;
        this.totalBytes = 0;
        this.externalFfmpeg = opts.ffmpegPath || process.env.DOWNTUBE_FFMPEG || guessBundledFfmpeg();

    }

    _safeTitle(title) {
        return (title || `untitled-${Date.now()}`).replace(/[<>:"/\\|?*]+/g, '').trim();
    }

    _resFromLabel(label) {
        if (!label) return 0;
        const m = ('' + label).match(/(\d+)\s*p/);
        if (m) return parseInt(m[1], 10);
        const n = parseInt(label, 10);
        return Number.isFinite(n) ? n : 0;
    }

    _sizeBytesFromFormat(f) {
        if (!f) return 0;
        const v = f.contentLength || f.content_length || f.contentlen || f.size || 0;
        const parsed = parseInt(v, 10);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    async _checkFfmpegAvailable() {
        return new Promise((resolve) => {
            const ff = this.externalFfmpeg || guessBundledFfmpeg();
            const p = spawn(ff, ['-version']);
            let ok = false;
            p.on('error', () => resolve(false));
            p.stdout?.on('data', () => { ok = true; });
            p.on('close', () => resolve(ok));
        });
    }

    async _runFfmpeg(args) {
        const ff = this.externalFfmpeg || guessBundledFfmpeg();
        return new Promise((resolve, reject) => {
            const proc = spawn(ff, args, { stdio: ['ignore', 'pipe', 'pipe'] });
            let stderr = '';
            proc.stderr.on('data', (c) => { stderr += c.toString(); });

            proc.on('error', (err) => reject(new Error(`Failed to start ffmpeg: ${err.message}`)));
            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`ffmpeg exited with code ${code}\n${stderr}`));
            });
        });
    }

    _mkTempPath(ext = '') {
        const t = `${Date.now()}-${process.pid}-${Math.round(Math.random() * 10000)}`;
        return path.join(this.output, `.__tmp_${t}${ext ? '.' + ext : ''}`);
    }

    async fetchInfo() {
        try {
            const info = await ytdl.getInfo(this.url);
            this.info = info;
            this.videoTitle = this._safeTitle(info.videoDetails.title || '')
            this._chooseFormats(info);
            const sizes = [this.selectedVideoFormat, this.selectedAudioFormat].map(f => this._sizeBytesFromFormat(f) || 0);
            this.totalBytes = sizes.reduce((a, b) => a + b, 0);
            return info;
            
        } catch (err) {
            logger.error(`Failed to fetch video info: ${err.message}`);
            throw err;
        }
    }

    _chooseFormats(info){
        const formats = info.formats || [];
        const audioOnly = formats.filter(f => f.hasAudio && !f.hasVideo);
        const videoOnly = formats.filter(f => f.hasVideo && !f.hasAudio);
        const muxed = formats.filter(f => f.hasVideo && f.hasAudio);

        const mp4Audio = audioOnly.filter(f => f.container === 'mp4' || f.container === 'm4a');

        if (mp4Audio.length > 0) {
            mp4Audio.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));
            this.selectedAudioFormat = mp4Audio[0];
        } 
        else if (audioOnly.length > 0) {
            const sortedAudio = audioOnly.slice().sort((a, b) =>
                (b.audioBitrate || 0) - (a.audioBitrate || 0) ||
                this._sizeBytesFromFormat(b) - this._sizeBytesFromFormat(a)
            );
            this.selectedAudioFormat = sortedAudio[0];
        } 
        else if (muxed.length > 0) {
            const sortedMuxedForAudio = muxed.slice().sort((a, b) =>
                (b.audioBitrate || 0) - (a.audioBitrate || 0) ||
                this._sizeBytesFromFormat(b) - this._sizeBytesFromFormat(a)
            );
            this.selectedAudioFormat = sortedMuxedForAudio[0];
        } 
        else {
            this.selectedAudioFormat = null;
        }

        const requestedRes = this._resFromLabel(this.quality);
        let candidateVideoFormats = videoOnly.slice();

        if (candidateVideoFormats.length === 0) candidateVideoFormats = muxed.slice();
        if (candidateVideoFormats.length === 0) {
            this.selectedVideoFormat = null;
            return;
        }

        const withRes = candidateVideoFormats.map(f => ({ f, res: this._resFromLabel(f.qualityLabel || f.quality) || 0 }));

        let chosen = null;

        if (requestedRes > 0) {
            chosen = withRes.find(item => item.res === requestedRes)?.f;

            if (!chosen) {
                const ge = withRes.filter(item => item.res >= requestedRes).sort((a, b) => a.res - b.res);
                if (ge.length) chosen = ge[0].f;
            }
        }

        if (!chosen) {
            withRes.sort((a, b) => b.res - a.res);
            chosen = withRes[0].f;
        }

        this.selectedVideoFormat = chosen;

    }

    async download(){
        this.output = this.output || path.join(os.homedir(), "Downloads");
        await fs.ensureDir(this.output);

        const title = this.videoTitle;
        const finalExt = this.type === 'video' ? 'mp4': 'mp3';
        const finalPath = path.join(this.output, `${title}.${finalExt}`);

        const ffmpegOk = await this._checkFfmpegAvailable();
        if (!ffmpegOk) {
            throw new Error('ffmpeg not found. Please install ffmpeg and ensure it is available. (sudo apt install ffmpeg)');
        }

        const videoExt = (this.selectedVideoFormat && this.selectedVideoFormat.container) ? this.selectedVideoFormat.container : 'mp4';
        const audioExt = (this.selectedAudioFormat && this.selectedAudioFormat.container) ? this.selectedAudioFormat.container : 'm4a';
        const tmpVideo = this._mkTempPath(videoExt);
        const tmpAudio = this._mkTempPath(audioExt);

        let downloadedVideo = 0;
        let downloadedAudio = 0;

        try{
            if(this.type === 'audio'){

                if(!this.selectedAudioFormat) throw new Error('No audio format found for this video.');

                progress.start(this._sizeBytesFromFormat(this.selectedAudioFormat), 'Downloading: ');

                await new Promise((resolve, reject) => {
                    const stream = ytdl(this.url, { quality: this.selectedAudioFormat.itag, filter: 'audioonly' });

                    stream.on('progress', (chunkLength, downloaded, total) => {
                        downloadedAudio = downloaded;
                        progress.update(downloadedAudio, { speed: `${(chunkLength / 1024).toFixed(2)} KB/s` });
                    });

                    stream.on('error', (err) => reject(err));
                    const out = fs.createWriteStream(tmpAudio);
                    out.on('error', reject);
                    out.on('finish', resolve);
                    stream.pipe(out);
                });
                progress.stop();

                try {
                    // const args = ['-y', '-i', tmpAudio, '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', finalPath];
                    // await this._runFfmpeg(args);
                    const modelPath = path.join(__dirname, 'models', 'mp.rnnn');

                    const args = [
                        '-y',
                        '-i', tmpAudio,
                        '-vn',
                        '-af', `arnndn=m=${modelPath}`, // noise filter model
                        '-c:a', 'libmp3lame',
                        '-q:a', '0',
                        finalPath
                    ];

                    await this._runFfmpeg(args);
                } catch (err) {
                    logger.error(`ffmpeg audio transcode failed: ${err.message}`);
                    throw err;
                } finally {
                    try { await fs.remove(tmpAudio); } catch (e) { /* ignore */ }
                }

                return finalPath;

            }

            if (!this.selectedVideoFormat) throw new Error('No video format found for this video.');

            if (!this.selectedAudioFormat) {
                const muxed = (this.info.formats || []).filter(f => f.hasVideo && f.hasAudio);
                if (muxed.length > 0) {
                    muxed.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0) || this._sizeBytesFromFormat(b) - this._sizeBytesFromFormat(a));
                    this.selectedAudioFormat = muxed[0];
                } else {
                    throw new Error('No audio stream available for this video.');
                }
            }

            progress.start(this.totalBytes || (this._sizeBytesFromFormat(this.selectedVideoFormat) + this._sizeBytesFromFormat(this.selectedAudioFormat)), 'Downloading: ');

            const videoPromise = new Promise((resolve, reject) => {
                const vStream = ytdl(this.url, { quality: this.selectedVideoFormat.itag, filter: 'videoonly' });
                vStream.on('progress', (chunkLength, downloaded, total) => {
                    downloadedVideo = downloaded;
                    progress.update(downloadedVideo + downloadedAudio, { speed: `${(chunkLength / 1024).toFixed(2)} KB/s` });
                });
                vStream.on('error', reject);
                const out = fs.createWriteStream(tmpVideo);
                out.on('error', reject);
                out.on('finish', resolve);
                vStream.pipe(out);
            });

            const audioPromise = new Promise((resolve, reject) => {
                const aStream = ytdl(this.url, { quality: this.selectedAudioFormat.itag, filter: 'audioonly' });
                aStream.on('progress', (chunkLength, downloaded, total) => {
                    downloadedAudio = downloaded;
                    progress.update(downloadedVideo + downloadedAudio, { speed: `${(chunkLength / 1024).toFixed(2)} KB/s` });
                });
                aStream.on('error', reject);
                const out = fs.createWriteStream(tmpAudio);
                out.on('error', reject);
                out.on('finish', resolve);
                aStream.pipe(out);
            });

            await Promise.all([videoPromise, audioPromise]);
            progress.stop();

            try {
                // const args = ['-y', '-i', tmpVideo, '-i', tmpAudio, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', finalPath];
                // await this._runFfmpeg(args);

                const modelPath = path.join(__dirname, 'models', 'mp.rnnn');

                const args = [
                    '-y',
                    '-i', tmpVideo,
                    '-i', tmpAudio,
                    '-c:v', 'copy',
                    '-af', `arnndn=m=${modelPath}`, // noise filter model
                    '-c:a', 'aac',
                    '-b:a', '192k',
                    '-movflags', '+faststart',
                    finalPath
                ];
                await this._runFfmpeg(args);
            } catch (err) {
                logger.error(`ffmpeg merge failed: ${err.message}`);
                throw err;
            } finally {
                try { await fs.remove(tmpVideo); } catch (e) { /* ignore */ }
                try { await fs.remove(tmpAudio); } catch (e) { /* ignore */ }
            }

            return finalPath;
        } catch (err) {
            progress.stop();
            try { await fs.remove(tmpVideo); } catch (e) { /* ignore */ }
            try { await fs.remove(tmpAudio); } catch (e) { /* ignore */ }
            logger.error(`Download failed: ${err.message}`);
            throw err;
        }
    }
}

export default Youtube;