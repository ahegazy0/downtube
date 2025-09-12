import { Command } from 'commander';
import { createRequire } from 'module';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import ora from 'ora';
import path from 'path';

import Youtube from './services/youtube.js';
import YoutubePlaylist from './services/playlist.js';
import logger from './utils/logger.js';
import { validateOptions, isYoutubeUrl, isPlaylistUrl } from './utils/validate.js';
import progress from './utils/progress.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const program = new Command();

program
    .name(pkg.name)
    .description(pkg.description)
    .version(pkg.version)
    .argument('[url]', 'YouTube video URL (positional or use --url)')
    .option('-u, --url <url>', 'YouTube video URL')
    .option('-t, --type <type>', "Download type: 'video' or 'audio'")
    .option('-q, --quality <quality>', "Quality: '144p','360p','480p','720p','1080p' or 'highest'")
    .option('-o, --output <path>', 'Output directory for the downloaded file')
    .option('-v, --verbose', 'Verbose logging', false)
    .addHelpText(
  'after',
    `
Examples:
  $ downtube https://youtube.com/watch?v=abc123
  $ downtube --url https://youtu.be/xyz456 --type audio --quality high -o ./downloads
  $ downtube https://youtu.be/xyz456 --list-formats
`   
    );

export async function main(argv = process.argv) {
    await program.parseAsync(argv);
    const argUrl = program.args[0];
    const opts = program.opts();

    let url = argUrl || opts.url;

    try {
        if (!url) {
        const answer = await inquirer.prompt([
            {
                type: 'input',
                name: 'enteredUrl',
                message: 'Enter YouTube URL (video or playlist): ',
                validate: (input) => {
                    if (isYoutubeUrl(input) || isPlaylistUrl(input)) return true;
                    return 'Please enter a valid YouTube video or playlist URL.';
                }
            }
        ]);
        url = answer.enteredUrl;
        }

        if (!opts.type || !opts.quality || !opts.output) {
        const answers = await inquirer.prompt([
            {
                type: 'list',
                name: 'type',
                message: 'What do you want to download?',
                choices: ['video', 'audio'],
                default: 'video'
            },
            {
                type: 'list',
                name: 'quality',
                message: 'Select quality:',
                choices: (answers) => (answers.type === 'audio' ? ['low', 'medium', 'high'] : ['144p', '360p', '480p', '720p', '1080p', 'highest']),
                default: (answers) => (answers.type === 'audio' ? 'high' : '360p')
            },
            {
                type: 'input',
                name: 'output',
                message: 'Output directory:',
                default: '.',
                validate: (input) => (fs.existsSync(path.resolve(input)) ? true : 'Directory does not exist')
            }
        ]);

        opts.type = opts.type || answers.type;
        opts.quality = opts.quality || answers.quality;
        opts.output = opts.output || answers.output;
        }

        const finalOptions = {
            type: opts.type || 'video',
            quality: opts.quality || 'highest',
            output: path.resolve(opts.output || '.'),
            listFormats: !!opts.listFormats,
            verbose: !!opts.verbose
        };

        if (!validateOptions(finalOptions)) {
            process.exit(1);
        }

        await fs.ensureDir(finalOptions.output);

        // Down Playlist logic
        if (isPlaylistUrl(url)) {
            const pl = new YoutubePlaylist(url, finalOptions.type, finalOptions.quality, finalOptions.output);

            const infoSpinner = ora("Fetching playlist info...").start();
            try {
                await pl.fetchInfo();
                infoSpinner.succeed(`Playlist info fetched`);
            } catch (err) {
                infoSpinner.fail("Failed to fetch playlist info");
                logger.error(err.message || err);
                process.exit(1);
            }

            const total = pl.items.length || 0;
            const modeAnswer = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'mode',
                    message: `Playlist detected: "${pl.metadata?.title || pl.playlistId}" — choose an action (total ${total} videos):`,
                    choices: [
                        { name: 'Download all videos', value: 'all' },
                        { name: 'Select specific videos (interactive)', value: 'select' },
                        { name: 'Download a range (from N to M)', value: 'range' }
                    ],
                    default: 'all'
                }
            ]);

            if (modeAnswer.mode === 'select') {
                const choices = pl.items.map((it, idx) => ({
                    name: `${String(idx + 1).padStart(3, '0')}. ${it.title}`,
                    value: idx
                }));
                const { selected } = await inquirer.prompt([{
                    type: 'checkbox',
                    name: 'selected',
                    message: 'Select videos to download (space to toggle, Enter to confirm):',
                    choices,
                    pageSize: 20
                }]);

                if (!selected || selected.length === 0) {
                    logger.info('No videos selected, aborting.');
                    return;
                }

                try {
                    await pl.downloadRange(Math.min(...selected), Math.max(...selected));
                    console.log(`✔ Selected videos saved to: ${path.join(finalOptions.output, pl.metadata?.title)}`);
                } catch (err) {
                    logger.error(`✖ Failed to download selected videos: ${err.message}`);
                    process.exit(1);
                }
            } 
            else if (modeAnswer.mode === 'range') {
                const rangeAns = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'start',
                        message: `Start index (1..${total}):`,
                        default: '1',
                        validate: (v) => {
                            const n = parseInt(v, 10);
                            if (!Number.isInteger(n) || n < 1 || n > total) return `Enter a number between 1 and ${total}`;
                            return true;
                        }
                    },
                    {
                        type: 'input',
                        name: 'end',
                        message: `End index (1..${total}):`,
                        default: String(total),
                        validate: (v, answers) => {
                            const n = parseInt(v, 10);
                            const startN = parseInt(answers.start, 10);
                            if (!Number.isInteger(n) || n < 1 || n > total) return `Enter a number between 1 and ${total}`;
                            if (n < startN) return 'End must be >= Start';
                            return true;
                        }
                    }
                ]);

                const startIdx = parseInt(rangeAns.start, 10) - 1; 
                const endIdx = parseInt(rangeAns.end, 10) - 1;

                try {
                    await pl.downloadRange(startIdx, endIdx);
                    console.log(`✔ Playlist saved to: ${path.join(finalOptions.output, pl.metadata?.title)}`);
                } catch (err) {
                    logger.error(`✖ Playlist range download failed: ${err.message}`);
                    process.exit(1);
                }
            } 
            else {
                try {
                    await pl.downloadAll();
                    console.log(`✔ Playlist saved to: ${path.join(finalOptions.output, pl.metadata?.title)}`);
                } catch (err) {
                    logger.error(`✖ Playlist download failed: ${err.message}`);
                    process.exit(1);
                }
            }

            return; 
        }

        // Down Video logic
        const yt = new Youtube(url, finalOptions.type, finalOptions.quality, finalOptions.output);

        // Fetch info
        const infoSpinner = ora('Fetching video info...').start();
        try {
            await yt.fetchInfo();
            infoSpinner.succeed('Video info fetched');
        } catch (err) {
            infoSpinner.fail('Failed to fetch video info');
            logger.error(err.message || err);
            process.exit(1);
        }

        // Start down
        try {
            await yt.download();
            progress.stop(true);
            console.log(`✔ Saved to: ${path.join(finalOptions.output, yt.videoTitle + (finalOptions.type === 'audio' ? '.mp3' : '.mp4'))}`);
        } catch (err) {
            progress.stop(false);
            logger.error(`✖ Download failed: ${err.message}`);
            process.exit(1);
        }

    } catch (err) {
        logger.error('Unexpected error: ' + (err.message || err));
        process.exit(1);
    }
}

if (process.argv[1] && process.argv[1].endsWith('index.js')) {
    main(process.argv);
}