import chalk from "chalk";
import pkg from "cli-progress";

const cliProgress = pkg;

class ProgressBar {
    constructor() {
        this.bar = null;
        this.startTime = null;
        this.total = 0;
        this.downloaded = 0;
    }

    start(total, label = "> Downloading") {
        this.total = total;
        this.startTime = Date.now();

        this.bar = new cliProgress.SingleBar(
        {
            format:
            `${chalk.yellow(label)}: ` +
            chalk.cyan("{bar}") +
            ` | {percentage}% || {value}/{total} MB || Speed: {speed}MB/s || ETA: {eta_formatted}`,
            barCompleteChar: "\u2588",
            barIncompleteChar: "\u2591",
            hideCursor: true,
        },
        cliProgress.Presets.shades_grey
        );

        this.bar.start(Math.round(total / 1024 / 1024), 0, {
            speed: "N/A",
        });
    }

    update(downloaded) {
        this.downloaded = downloaded;

        const elapsed = (Date.now() - this.startTime) / 1000; 
        const mbDownloaded = downloaded / 1024 / 1024;
        // const mbTotal = this.total / 1024 / 1024;

        const speed = elapsed > 0 ? (mbDownloaded / elapsed).toFixed(2) : "N/A";

        if (this.bar) {
            this.bar.update(Math.round(mbDownloaded), {
                speed,
            });
        }
    }

    stop() {
        if (this.bar) {
            this.bar.stop();
        }
    }

}

export default new ProgressBar();
