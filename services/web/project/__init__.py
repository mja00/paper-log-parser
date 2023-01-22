import os
from flask import Flask, render_template, jsonify, request, url_for
from .parser import LogFile
from PIL import Image, ImageDraw, ImageFont
from hashlib import sha256

app = Flask(__name__)

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', "CHANGEME")


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
    # Add the exception count
    drawer.text((40, 280), f"Encountered {len(log_data.exceptions)} exceptions", (255, 255, 255), font=text_font)
    # Save the image
    img.save(f"project/static/parses/{url_hash}.png")
    return f"parses/{url_hash}.png"


@app.route("/")
def index():
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
        return render_template('index.html', url=url, data=data, image_url=url_for('static', filename=image_path))
    return render_template("index.html", url=url)


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
