import pkg from '@distube/ytdl-core';

import fs from 'fs-extra';

import logger from "./logger.js";

const { validateURL } = pkg;

const isYoutubeUrl = (url) => {
    try{
        return validateURL(url)
    } catch{
        logger.error("Invalid YouTube URL.");
        return false;
    }
};

const isPlaylistUrl = (url) => {
    return /[?&]list=([a-zA-Z0-9_-]+)/.test(url);
};

const validateOptions = (options) => {
    let { type, format, quality, output } = options;
    const errors = [];

    const validTypes = ["video", "audio"];

    const videoFormats = ["mp4"];
    const audioFormats = ["mp3"];
    const videoQualities = ["144p", "360p", "480p", "720p", "1080p"];
    const audioQualities = ["low", "medium", "high"];

    if (!validTypes.includes(type)) {
        errors.push(`Invalid type: ${type}. Supported types: ${validTypes.join(", ")}`);
    }

    if (type === "video") {
        format = "mp4";
        if (!quality) quality = "360p";

        if (!videoFormats.includes(format)) {
            errors.push(`Invalid format for video: ${format}. Supported: ${videoFormats.join(", ")}`);
        }

        if (!videoQualities.includes(quality)) {
            errors.push(`Invalid quality for video: ${quality}. Supported: ${videoQualities.join(", ")}`);
        }
    }

    if (type === "audio") {
        if (!format) format = "mp3";

        if (!quality || /\d+p/.test(quality)) quality = "high";

        if (!audioFormats.includes(format)) {
            errors.push(`Invalid format for audio: ${format}. Supported: ${audioFormats.join(", ")}`);
        }

        if (!audioQualities.includes(quality)) {
            errors.push(`Invalid quality for audio: ${quality}. Supported: ${audioQualities.join(", ")}`);
        }
    }

    if (output && !fs.existsSync(output)) {
        errors.push(`Output directory does not exist: ${output}`);
    }

    if (errors.length > 0) {
        errors.forEach((err) => logger.error(err));
        return false;
    }

    options.format = format;
    options.quality = quality;

    return true;
};

export { isYoutubeUrl, isPlaylistUrl, validateOptions };
