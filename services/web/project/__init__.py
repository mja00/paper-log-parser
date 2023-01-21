import os
from flask import Flask, render_template, jsonify, request
from .parser import LogFile

app = Flask(__name__)

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', "CHANGEME")


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
        return render_template('index.html', url=url, data=data)
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
