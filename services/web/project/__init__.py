import os
from flask import Flask, render_template, jsonify, request
from .parser import LogFile

app = Flask(__name__)

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', "CHANGEME")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/parse", methods=["POST"])
def parse():
    # This'll return some json shit
    # Get the post body
    body = request.get_json()
    # We'll need the log URL
    log_url = body.get('logUrl', None)
    if log_url is None:
        return jsonify({"error": "No log URL provided"}), 400
    # Create a new LogFile object
    log_file = LogFile(log_url)
    log_file.run_checks()
    output = log_file.get_report_as_string()
    return jsonify({"output": output})
