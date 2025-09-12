import fs from "fs-extra";
import path from "path";
import Youtube from "./youtube.js";
import youtubesearchapi from "youtube-search-api";
import logger from "../utils/logger.js";

class YoutubePlaylist {
    constructor(url, type = "video", quality = "360", output = ".") {
        this.url = url;
        this.type = type;
        this.quality = quality;
        this.output = output;

        this.playlistId = null;
        this.metadata = null;
        this.items = [];
    }

    _extractPlaylistId(url) {
        const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
    }

    async fetchInfo(limit = 100) {
        this.playlistId = this._extractPlaylistId(this.url);
        if (!this.playlistId) throw new Error("Invalid playlist URL");

        try {
            const data = await youtubesearchapi.GetPlaylistData(this.playlistId, limit);
            this.metadata = data.metadata;
            if (!this.metadata.title || typeof this.metadata.title !== "string") {
                this.metadata.title = `playlist-${this.playlistId}`;
            }
            this.items = data.items || [];
            return data;
        } catch (err) {
            logger.error(`Failed to fetch playlist info: ${err.message}`);
            throw err;
        }
    }

    async downloadRange(startIndex = 0, endIndex = null) {
        if (!this.items || this.items.length === 0) throw new Error("No videos found in playlist.");
        const total = this.items.length;
        if (endIndex === null) endIndex = total - 1;

        startIndex = Math.max(0, Math.min(startIndex, total - 1));
        endIndex = Math.max(0, Math.min(endIndex, total - 1));

        if (startIndex > endIndex) throw new Error("Invalid range: start must be <= end.");

        const folderName = (this.metadata?.title || `playlist-${Date.now()}`).replace(/[<>:"/\\|?*]+/g, "").trim();
        const playlistDir = path.join(this.output, folderName);
        await fs.ensureDir(playlistDir);

        for (let i = startIndex; i <= endIndex; i++) {
            const video = this.items[i];
            if (!video || !video.id) {
                logger.error(`Skipping item ${i + 1}: invalid video id`);
                continue;
            }

            const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
            const indexPrefix = String(i + 1).padStart(3, "0");

            try {
                const yt = new Youtube(videoUrl, this.type, this.quality, playlistDir);
                await yt.fetchInfo();
                yt.videoTitle = `${indexPrefix} - ${yt.videoTitle}`;
                await yt.download();
            } catch (err) {
                logger.error(`Failed to download (${i + 1}) ${video.title}: ${err.message}`);
            }
        }

        console.log("Playlist download completed.");
        return playlistDir;
    }

    async downloadAll() {
        return this.downloadRange(0, this.items.length - 1);
    }
}

export default YoutubePlaylist;
