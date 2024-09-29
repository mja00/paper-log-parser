import os
from flask import Flask, render_template, jsonify, request, url_for, redirect
from .parser import LogFile
from PIL import Image, ImageDraw, ImageFont
from hashlib import sha256
import requests
import json
from datetime import datetime as dt
from datetime import timezone
import random

app = Flask(__name__)

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', "CHANGEME")
LAST_MANIFEST_UPDATE = None
MANIFEST_INFO = {}
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ",
    "Content-Type": "application/json",
}


def make_rectangle_to_fit_text(text, color, backgound_color=(48, 49, 54)):
    W, H = (350, 50)
    im = Image.new("RGBA", (W, H), backgound_color)
    draw = ImageDraw.Draw(im)
    font = ImageFont.truetype("project/static/fonts/Roboto-Regular.ttf", 40)
    # Draw a rounded rectangle in the middle of the image
    draw.rounded_rectangle((0, 0, W, H), fill=color, radius=10)
    w, h = draw.textsize(text, font=font)
    # This'll center the text, for strings without Ys and Qs it'll be too low, we need to fix that
    # This shit is jank but I suck at Pillow so it works
    if "y" in text.lower() or "q" in text.lower():
        draw.text(((W - w) / 2, (H - h) / 2), text, fill="white", font=font)
    else:
        draw.text(((W - w) / 2, ((H - h) / 2) - 5), text, fill="white", font=font)
    return im


def generate_output_image(log_data, url):
    # Hash the url
    url_hash = sha256(url.encode()).hexdigest()
    # Check if the image already exists
    if os.path.exists(f"project/static/parses/{url_hash}.png"):
        return f"parses/{url_hash}.png"
    img = Image.new("RGBA", (1200, 320), (48, 49, 54))

    drawer = ImageDraw.Draw(img)
    # Create a sub title with the url
    subtitle_font = ImageFont.truetype("project/static/fonts/Roboto-Regular.ttf", 30)
    drawer.text((40, 0), url.replace("https://", ""), (200, 200, 200), font=subtitle_font)

    # First we'll do if the server is online or not
    if log_data.is_offline:
        status_rect = make_rectangle_to_fit_text("Offline Mode", (156, 26, 26))
        img.paste(status_rect, (40, 80))
    else:
        status_rect = make_rectangle_to_fit_text("Online Mode", (28, 156, 26))
        img.paste(status_rect, (40, 80))

    # Malware detected, put this next to the online/offline box
    if log_data.has_malware:
        malware_rect = make_rectangle_to_fit_text("Malware Detected", (156, 26, 26))
        img.paste(malware_rect, (40 + status_rect.width + 20, 80))
    else:
        malware_rect = make_rectangle_to_fit_text("No Malware", (28, 156, 26))
        img.paste(malware_rect, (40 + status_rect.width + 20, 80))

    if log_data.has_pirated_plugins:
        piracy_rect = make_rectangle_to_fit_text("Pirated Plugins", (156, 26, 26))
        img.paste(piracy_rect, (40 + status_rect.width + malware_rect.width + 40, 80))
    else:
        piracy_rect = make_rectangle_to_fit_text("No Piracy", (28, 156, 26))
        img.paste(piracy_rect, (40 + status_rect.width + malware_rect.width + 40, 80))

    # About half way down the image we wanna list the server's flavor
    text_font = ImageFont.truetype("project/static/fonts/Roboto-Regular.ttf", 30)
    flavor = log_data.flavor.split(" ")
    server_jar = flavor[0]
    flavor_version = " ".join(flavor[2:])
    drawer.text((40, 180), f"{server_jar} server '{flavor_version}'", (255, 255, 255), font=text_font)
    # Add the plugin count
    drawer.text((40, 230), f"Using {len(log_data.plugins)} plugins", (255, 255, 255), font=text_font)
    if log_data.invalid_config:
        drawer.text((40, 280), "Invalid config at: " + ".".join(log_data.invalid_config_locations), (255, 200, 200), font=text_font)
    else:
        # Add the exception count
        drawer.text((40, 280), f"Encountered {len(log_data.exceptions)} exceptions", (255, 255, 255), font=text_font)
    # Save the image
    img.save(f"project/static/parses/{url_hash}.png")
    return f"parses/{url_hash}.png"


def parse_manifest_for_dates(manifest):
    global MANIFEST_INFO
    for version in manifest["versions"]:
        version_name = version["id"]
        release_time = version["releaseTime"]
        # Parse the time "2023-03-14T12:56:18+00:00"
        release_time = dt.strptime(release_time, "%Y-%m-%dT%H:%M:%S+00:00").replace(tzinfo=timezone.utc)
        # Add it to the dict
        MANIFEST_INFO[version_name] = release_time


def get_mc_manifest_and_cache_it():
    global LAST_MANIFEST_UPDATE
    # If it's been more than an hour since we last updated the manifest, update it
    if LAST_MANIFEST_UPDATE is None or (dt.now() - LAST_MANIFEST_UPDATE).seconds > 3600:
        LAST_MANIFEST_UPDATE = dt.now()
        manifest_url = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"
        manifest = requests.get(manifest_url, headers=headers).json()
        with open("project/static/mc_manifest.json", "w") as f:
            json.dump(manifest, f)
        # We'll want to re-parse the manifest for dates
        parse_manifest_for_dates(manifest)
    else:
        # Otherwise we just read the file from disk
        with open("project/static/mc_manifest.json", "r") as f:
            manifest = json.load(f)

    return manifest


@app.route("/")
def index():
    version = "1.1.0"
    # check url params for a url arg
    url = request.args.get('url', None)
    if url:
        # We can do some fancy pre-parsing of the url here
        log_file = LogFile(url)
        try:
            log_file.run_checks()
        except Exception as e:
            print(f"Error: {e}")
        data = {
            "mc_version": log_file.mc_version,
            "paper_version": log_file.paper_version,
            "offline": log_file.is_offline,
            "plugin_count": len(log_file.plugins),
            "has_malware": log_file.has_malware,
        }
        image_path = generate_output_image(log_file, url)
        return render_template('index.html', url=url, data=data, image_url=url_for('static', filename=image_path), version=version)
    return render_template("index.html", url=url, version=version)


@app.route("/parse", methods=["POST"])
def parse():
    # This'll return some json shit
    # Get the post body
    body = request.get_json()
    # We'll need the log URL
    log_url = body.get('logUrl', None)
    if log_url is None:
        return jsonify({"error": "No log URL provided", "success": False}), 400
    # Create a new LogFile object
    log_file = LogFile(log_url)
    try:
        log_file.run_checks()
    except Exception as e:
        print(f"Ran into error parsing log file: {e}")
        return jsonify({"error": "Ran into an issue parsing the logs. Possible incomplete log file.", "success": False}), 500
    if len(log_file.lines) == 0:
        return jsonify({"error": "No log lines found. Most likely caused by an unsupported URL.", "success": False}), 400
    output = log_file.get_report_as_string()
    return jsonify({"output": output, "success": True}), 200


@app.route("/age/<string:version>", methods=["GET"])
def age(version):
    # We'll just redirect to our new site that handles this
    return redirect(f"https://minecraftishowold.today/{version}")


@app.route('/bingo', methods=["GET"])
def bingo():
    bingo_squares = [
        "I use authme for added security",
        "My country's laws allow it",
        "My players are all young children with no money",
        "My country has bad economy and very poor",
        "Everyone pirate the game in my country",
        "My country has weak currency",
        "One of my player cannot afford the game, I dont want him to feel left out",
        "An old Notch tweet",
        "I can't get players without it",
        "I don't want to rely on Microsoft's servers",
        "There are bigger offline networks, so why not me?",
        "Microsoft is bad",
        "I'm actually using bungee (timings/Spark says otherwise)",
        "Stop being toxic and shut up if you dont want to help",
        "Minecraft is not available for sale in my country",
        "Culture in (region)",
        "I use SkinRestorer so my players can change skins",
        "Mojang provides it so it must be ok",
        "It promotes the game so when people get money they'll buy it",
        "But you have to fix this bug. (The bug is due to offline mode)",
        "Most of my players are too busy to justify buying the game",
        "Mojang makes enough money already",
        "I don't know what offline mode is, one of my friends told me to use it",
        'I own the "premium" version'
    ]
    # Check for a seed url param
    seed = request.args.get('seed', None)

    if seed:
        try:
            seed = int(seed)
        except ValueError:
            seed = random.randint(0, 1000000000)
        # We'll use the seed to generate a new bingo card
        random.seed(seed)
        random.shuffle(bingo_squares)
    else:
        # Generate a random seed to use
        seed = random.randint(0, 1000000000)
        random.seed(seed)
        random.shuffle(bingo_squares)
    # Get the first 24 elements
    wanted_squares = bingo_squares[:24]
    # Add the free space after the first 12
    wanted_squares.insert(12, "Free")
    return render_template("bingo.html", bingo_squares=wanted_squares, seed=seed)
