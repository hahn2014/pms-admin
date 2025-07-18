<h1 style="text-align: center">getStats Python Script</h1>
<a name="getStats-Python-Script"></a>

<center>The `getStats.py` file is a supplemental script for pms-admin. If placed in the root directory of the NAS drive mounting points (and each drive is named Media0, Media1, Media2, etc...), the script will scan all available mounted drives for any media file (.mp4, .mkv. .mp3, etc..) and collect 4 points of data to output into a formatted JSON file.</center> 

### Data Collected

The `getStats.py` file collects 4 points of data:
1. **Duplicates**: the script will keep track of duplicate file names in the nas-stats.json output file:
   ```bash
   "duplicates": [
   {
      "name": "The Avengers (2012)",
      "locations": [
         "/usb/Media0/Movies/The Avengers (2012).mkv",
         "/usb/Media1/Movies/The Avengers (2012).mkv"
      ]
   }],
   ```
2. **Storage Breakdown**: the script will keep track of all mounted drives within the working directory. For each drive found it will keep track of the number files for each media type, the used space for each type of media, total capacity and available free space.
   ```bash
   "storage_breakdown": {
      "Media0": {
          "movies": 1303,
          "tv_shows": 0,
          "music": 2,
          "photos": 0,
          "movies_size": 2538.4583651507273,
          "tv_shows_size": 0.0,
          "music_size": 0.011535431258380413,
          "photos_size": 0.0,
          "total_size": 2538.4699005819857,
          "drive_capacity": 16696.290493011475,
          "free_space": 13269.100887298584
      },
      "Media1": {
          "movies": 344,
          "tv_shows": 0,
          "music": 0,
          "photos": 0,
          "movies_size": 1739.290512260981,
          "tv_shows_size": 0.0,
          "music_size": 0.0,
          "photos_size": 0.0,
          "total_size": 1739.290512260981,
          "drive_capacity": 1832.6994857788086,
          "free_space": 0.23627853393554688
      },
      "Media2": {
          "movies": 223,
          "tv_shows": 0,
          "music": 0,
          "photos": 0,
          "movies_size": 866.147991255857,
          "tv_shows_size": 0.0,
          "music_size": 0.0,
          "photos_size": 0.0,
          "total_size": 866.147991255857,
          "drive_capacity": 915.8171157836914,
          "free_space": 3.076496124267578
      },
      "Media3": {
          "movies": 228,
          "tv_shows": 0,
          "music": 0,
          "photos": 0,
          "movies_size": 848.6728907432407,
          "tv_shows_size": 0.0,
          "music_size": 0.0,
          "photos_size": 0.0,
          "total_size": 848.6728907432407,
          "drive_capacity": 915.8171157836914,
          "free_space": 20.55152130126953
      }
   },
   ```
3. **Total Files**: the total file count found during the drive crawl.
   ```bash
   "total_files": 2100,
   ```
4. **Date Generated**: the file generation timestamp in ISO 8601
   ```bash
   "generated_on": "2025-07-18T02:56:33.374636"
   ```
   
### Running the Script

Running the script is simple! Be sure to have Python3 installed then just run the file from the root directory of the NAS storage drive mounting points
   ```bash
     python getStats.py
   ```
this results in `nas-stats.json` file as output. Place this file in the root directory of pms-admin server (same directory as `server.js`)

---

<center>*Developed by HahnSolo. 1.0 update July 2025*</center>

[<center>Back to Top</center>](#getStats-Python-Script)