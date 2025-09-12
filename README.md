# Downtube — Fast YouTube Downloader CLI

> A lightning-fast, cross-platform command line tool to download YouTube videos and audio with smart format selection, playlist support, and bundled ffmpeg.


## ✨ Features

* **Video & Audio Downloads**: Download as MP4 video or MP3 audio
* **Smart Format Selection**: Automatically selects the best available quality
* **Playlist Support**: Download entire playlists or select specific videos
* **Interactive Interface**: User-friendly prompts and progress indicators
* **Bundled FFmpeg**: No external dependencies required
* **Cross-Platform**: Works on Windows, macOS, and Linux

## 🚀 Quick Install

<details>
<summary>Click to expand installation instructions</summary>

### From npm (Recommended)

```bash
npm install -g downtube-cli
downtube
```

### From Source

```bash
git clone https://github.com/ahegazy/downtube-cli.git
cd downtube
npm install
npm run build
npm link  # makes 'downtube' available globally
```

### Prerequisites

Make sure you have Node.js (v14 or higher) installed on your system:

```bash
node --version
```

If you don't have Node.js installed, download it from [nodejs.org](https://nodejs.org/en/download).

</details>

## 📖 Usage

<details>
<summary>Click to expand usage instructions</summary>

### Interactive Mode

```bash
downtube
```

Follow the prompts to enter URL, select format, quality, and output directory.

### Direct Command Mode

```bash
downtube --url "https://www.youtube.com/watch?v=VIDEO_ID" --type audio --quality high
```

### Options

```
-u, --url <url>        YouTube video or playlist URL
-t, --type <type>      Download type: 'video' or 'audio' (default: video)
-q, --quality <q>      Quality: '144p','360p','480p','720p','1080p','highest'
                       For audio: 'low','medium','high','highest'
-o, --output <path>    Output directory (default: current directory)
--playlist-range <n-m> Download specific range from playlist (e.g., "1-5")
-v, --verbose          Verbose logging
```

</details>

## 🎯 Examples

<details>
<summary>Click to view usage examples</summary>

```bash
# Download a single video (interactive)
downtube

# Download audio from a specific video
downtube -u "https://youtube.com/watch?v=ABCD1234" -t audio -q high

# Download videos 5-10 from a playlist
downtube -u "https://youtube.com/playlist?list=XYZ567" --playlist-range "5-10"

# Download to specific directory
downtube -u "https://youtube.com/watch?v=ABCD1234" -o ~/Downloads/videos

# Download with verbose logging
downtube -u "https://youtube.com/watch?v=ABCD1234" -v

# Show help
downtube --help
```

</details>

## 🔧 Troubleshooting

<details>
<summary>Click to expand troubleshooting guide</summary>

**Installation Issues**

* Ensure you have Node.js version 14 or higher installed
* On Linux/Mac, you may need to use `sudo` with npm install: `sudo npm install -g downtube-cli`
* If you encounter permission errors, try resetting npm permissions: `npm repair` or `npm cache clean --force`

**Download Issues**

* Check your internet connection
* Verify the YouTube URL is correct and accessible
* Some videos may be restricted by the uploader

**Playlist Issues**

* Ensure playlist URLs contain the correct `list=` parameter
* Large playlists may take time to process

**Performance Issues**

* Lower quality settings will download faster
* Consider using `--no-progress` for slightly faster performance

**Other Issues**

* Try running with `--verbose` flag to see detailed error messages
* Check if there are any available updates: `npm outdated -g downtube-cli`

</details>

## 🛠 Development

<details>
<summary>Click to expand development instructions</summary>

### Setting Up Development Environment

```bash
# Clone the repository
git clone https://github.com/yourusername/downtube-cli.git
cd downtube

# Install dependencies
npm install

# Run in development mode
npm run start

# Run tests (if available)
npm test
```


### Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

</details>

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This tool is intended for personal use only. Please respect copyright laws and YouTube's Terms of Service. Downloading content may violate YouTube's terms in some cases.

---

## Support

If you find this tool useful, please:

* ⭐ Star the repository on GitHub
* 🐛 Report bugs and issues
* 💡 Suggest new features
* 🔄 Share with others

**Happy downloading!**