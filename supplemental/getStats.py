import os
from pathlib import Path
from datetime import datetime
import shutil
import json

# Valid media file extensions to scan for
VALID_EXTENSIONS = ('.mp4', '.mkv', '.mp3', '.flac', '.jpg', '.png')

class MediaFile:
    """Represents a media file with its metadata."""
    def __init__(self, location, name, media_dir, size_gb, media_type):
        """Initialize a MediaFile object.

        Args:
            location (str): Full path to the file.
            name (str): File name without extension.
            media_dir (str): Name of the Media directory containing the file.
            size_gb (float): File size in gigabytes.
            media_type (str): Type of media ('Movie', 'TV Show', 'Music', 'Photo', or 'Unknown').
        """
        self.location = location
        self.name = name
        self.media_dir = media_dir
        self.size_gb = size_gb
        self.media_type = media_type

def get_file_size_gb(file_path):
    """Calculate file size in gigabytes.

    Args:
        file_path (str): Path to the file.

    Returns:
        float: File size in gigabytes.
    """
    size_bytes = os.path.getsize(file_path)
    return size_bytes / (1024 * 1024 * 1024)

def find_media_files():
    """Scan current directory for media files in 'Media' directories.

    Returns:
        list or None: List of MediaFile objects or None if no Media directories found.
    """
    root_dir = os.getcwd()
    media_files = []
    has_media_dirs = False

    for dirpath, _, filenames in os.walk(root_dir):
        path_parts = Path(dirpath).parts
        media_dir = None
        for part in path_parts:
            if part.startswith('Media'):
                media_dir = part
                has_media_dirs = True
                break

        if not media_dir:
            continue

        for filename in filenames:
            if filename.lower().endswith(VALID_EXTENSIONS):
                full_path = os.path.join(dirpath, filename)
                name_without_ext = os.path.splitext(filename)[0]
                size_gb = get_file_size_gb(full_path)

                # Determine media type based on folder or extension
                media_type = "Unknown"
                if "Movies" in dirpath or filename.lower().endswith(('.mp4', '.mkv')):
                    media_type = "Movie"
                elif "TV Shows" in dirpath or "TV" in dirpath:
                    media_type = "TV Show"
                elif "Music" in dirpath or filename.lower().endswith(('.mp3', '.flac')):
                    media_type = "Music"
                elif "Photos" in dirpath or filename.lower().endswith(('.jpg', '.png')):
                    media_type = "Photo"

                media_file = MediaFile(
                    location=full_path,
                    name=name_without_ext,
                    media_dir=media_dir,
                    size_gb=size_gb,
                    media_type=media_type
                )
                media_files.append(media_file)

    if not has_media_dirs:
        print("No Media directories found in the current directory!")
        return None
    return media_files

def find_duplicates(media_files):
    """Identify media files with duplicate names.

    Args:
        media_files (list): List of MediaFile objects.

    Returns:
        list: List of tuples (name, first_file, duplicate_file).
    """
    name_dict = {}
    duplicates = []
    for media in media_files:
        if media.name in name_dict:
            duplicates.append((media.name, name_dict[media.name], media))
        else:
            name_dict[media.name] = media
    return duplicates

def get_media_stats(media_files):
    """Calculate storage statistics for each Media directory.

    Args:
        media_files (list): List of MediaFile objects.

    Returns:
        dict: Statistics per media directory (counts and sizes for movies, tv_shows, music, photos,
              total_size, drive_capacity, free_space).
    """
    stats = {}
    drive_paths = {}

    for media in media_files:
        if media.media_dir not in stats:
            stats[media.media_dir] = {
                'movies': 0,
                'tv_shows': 0,
                'music': 0,
                'photos': 0,
                'movies_size': 0.0,
                'tv_shows_size': 0.0,
                'music_size': 0.0,
                'photos_size': 0.0,
                'total_size': 0.0
            }
            media_path = os.path.dirname(media.location)
            while not os.path.basename(media_path).startswith('Media'):
                media_path = os.path.dirname(media_path)
            drive_paths[media.media_dir] = media_path

        if media.media_type == "Movie":
            stats[media.media_dir]['movies'] += 1
            stats[media.media_dir]['movies_size'] += media.size_gb
        elif media.media_type == "TV Show":
            stats[media.media_dir]['tv_shows'] += 1
            stats[media.media_dir]['tv_shows_size'] += media.size_gb
        elif media.media_type == "Music":
            stats[media.media_dir]['music'] += 1
            stats[media.media_dir]['music_size'] += media.size_gb
        elif media.media_type == "Photo":
            stats[media.media_dir]['photos'] += 1
            stats[media.media_dir]['photos_size'] += media.size_gb
        stats[media.media_dir]['total_size'] += media.size_gb

    for media_dir, path in drive_paths.items():
        total, used, free = shutil.disk_usage(path)
        stats[media_dir]['drive_capacity'] = total / (1024 * 1024 * 1024)
        stats[media_dir]['free_space'] = free / (1024 * 1024 * 1024)

    return stats

def write_media_stats(media_files, duplicates, output_file="nas-stats.json"):
    """Write media statistics to a JSON file.

    Args:
        media_files (list): List of MediaFile objects.
        duplicates (list): List of duplicate file tuples.
        output_file (str): Output JSON file path (default: 'nas-stats.json').
    """
    # Prepare JSON data
    json_data = {
        "duplicates": [
            {
                "name": name,
                "locations": [file1.location, file2.location]
            } for name, file1, file2 in duplicates
        ],
        "storage_breakdown": get_media_stats(media_files),
        "total_files": len(media_files),
        "generated_on": datetime.now().isoformat()
    }

    # Write to JSON file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, indent=2)

def main():
    """Main function to scan media files and generate JSON report."""
    print("Scanning for media files...")
    media_files = find_media_files()
    if media_files is None:
        return
    if not media_files:
        print("No media files found in Media directories!")
        return
    duplicates = find_duplicates(media_files)
    print("Writing media stats to nas-stats.json...")
    write_media_stats(media_files, duplicates)
    print(f"Media stats written to 'nas-stats.json' with {len(media_files)} files found")
    if duplicates:
        print(f"Found {len(duplicates)} duplicate file names")

if __name__ == "__main__":
    main()