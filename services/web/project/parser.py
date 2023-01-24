import sys
import requests
import bs4
import os
import re
from datetime import datetime as dt, timedelta
from colorama import Fore
from urllib.parse import urlparse
from .constants import data_version_to_mc

# We'll do some in-memory caching here for various things
latest_paper_versions = {}

# Constants
ambiguous_plugin_regex = r"\[(\d\d:\d\d:\d\d)\] \[Server thread/ERROR\]: Ambiguous plugin name `([^']+)' for files `([^']+)' and `([^']+)' in `plugins'"
attempted_downgrade_regex = r".*java\.lang\.RuntimeException: Server attempted to load chunk saved with newer version of minecraft! (\d+) > (\d+)"
malware1_regex = r"at Updater.a\(:\d+\)"
bad_config_regex = r"(\[(.*?)\]|java\.lang\.([a-zA-Z]+))"
common_leak_regex = r"\[\d{2}:\d{2}:\d{2}\] \[Server thread\/INFO\]: \[[A-Za-z]+\] \[[A-Za-z]+\] Leaked by [A-Za-z]+ @ [A-Za-z.]+"


def get_mc_from_data_version(data_version):
    try:
        return data_version_to_mc[int(data_version)]
    except KeyError:
        return data_version


class Plugin:
    def __init__(self, name, version):
        self.name = name
        self.version = version
        self.bad_plugins = [
            "SkinsRestorer",
            "AuthMe",
            "nLogin",
            "ClearLagg",
            "FastClearLag",
            "PlugMan",
            "Skript"
        ]
        self.meh_plugins = [
            "ViaVersion",
            "ProtocolLib",
            "ViaBackwards",
            "ViaRewind"
        ]

    def __str__(self):
        return f"{self.name} v{self.version}"

    def __repr__(self):
        return f"{self.name} v{self.version}"

    def get_version(self):
        return self.version

    def get_name(self):
        return self.name

    def get_color(self):
        if self.name in self.bad_plugins:
            return Fore.RED
        elif self.name in self.meh_plugins:
            return Fore.YELLOW
        else:
            return Fore.GREEN


class LogFile:
    def __init__(self, url):
        self.url = url
        self.host = ""
        self.max_lines = int(os.environ.get("MAX_LOG_LENGTH", 1000))
        self.headers = {
            "User-Agent": "Minecraft Latest.log Parser v1"
        }
        self.supported_versions = [
            "1.19.3"
        ]
        self.plugins = []
        self.mc_version = None
        self.paper_version = None
        self.flavor = None
        self.flavor_line = None
        self.supported = False
        self.lines = []
        self.is_offline = False
        self.weird_plugins = [
            "AuthMe",
            "nLogin",
            "SkinsRestorer"
        ]
        self.weird_plugins_acquired = []
        self.running_paper = False
        self.possibly_cracked = False
        self.has_pirated_plugins = False
        self.potentially_pirated_lines = []
        self.pirate_giveaways = [
            "BeastLeaks",
            "leak",
            "leaked",
            "cracked",
            "directleaks"
        ]
        self.has_missing_dependencies = False
        self.missing_dependencies = []
        self.has_exceptions = False
        self.exceptions = []
        self.ignored_exceptions = [
            "UnknownDependencyException",
            "CoercionFailedException"
        ]
        self.has_ambiguous_plugins = False
        self.ambiguous_plugins = []
        self.attempting_to_downgrade = False
        self.downgraded_versions = []
        self.has_malware = False
        self.malware_count = 0
        self.invalid_config = False
        self.invalid_config_locations = []
        self.mock_config = ""

    def run_checks(self):
        self.get_host_from_url()
        self.read_url_into_memory()
        if len(self.lines) == 0:
            return
        self.get_flavor_line()
        self.get_paper_version()
        self.get_plugins()
        self.check_for_ambiguous_plugin()
        self.check_offline_mode()
        self.check_for_weird_plugins()
        self.check_for_paper()
        self.check_possibly_cracked()
        self.check_for_pirated_plugins()
        self.check_for_mising_dependencies()
        self.find_exceptions()
        self.check_for_attempted_downgrade()
        self.check_for_malware()
        self.check_config()

    def get_host_from_url(self):
        # Parse the host from the given url
        parsed = urlparse(self.url)
        self.host = parsed.netloc

    def read_url_into_memory(self):
        resp = None
        match self.host:
            case "paste.gg":
                if not self.url.endswith("raw"):
                    # WE need to use bs4 to get the raw url
                    resp = requests.get(url=self.url, headers=self.headers)
                    soup = bs4.BeautifulSoup(resp.text, "html.parser")
                    raw_url = soup.find("a", {"class": "is-pulled-right button"}).get("href")
                    # Now we can handle the raw url
                    resp = requests.get(url=f"https://paste.gg{raw_url}", headers=self.headers)
                else:
                    # Already a raw url
                    resp = requests.get(url=self.url, headers=self.headers)
            case "pastes.dev":
                # The raw url is just the url with api.pastes.dev
                raw_url = self.url.replace("pastes.dev", "api.pastes.dev")
                resp = requests.get(url=raw_url, headers=self.headers)
            case "api.pastes.dev":
                # No need to get the raw url
                resp = requests.get(url=self.url, headers=self.headers)
            case "pastebin.com":
                raw_url = self.url.replace("pastebin.com", "pastebin.com/raw")
                resp = requests.get(url=raw_url, headers=self.headers)
            case "mclo.gs":
                # We'll want to get the ID of the logs, which is the last element of the url
                id = self.url.split("/")[-1]
                raw_url = f"https://api.mclo.gs/1/raw/{id}"
                resp = requests.get(url=raw_url, headers=self.headers)
            case _:
                # Not a site we support
                self.lines = []
                return ""
        self.lines = resp.text.splitlines()
        return resp.text

    def get_flavor_line(self):
        # Iterate over the lines looking for: This server is running
        # This should be within the first 30 lines
        line_count = 0
        for line in self.lines:
            if "This server is running" in line:
                # We've found the flavor line
                self.flavor_line = line
                self.get_mc_version()
                self.get_server_flavor()
                return
            line_count += 1
            if line_count > self.max_lines:
                return

    def get_mc_version(self):
        block = self.flavor_line.split("(MC: ")[1]
        self.mc_version = block.split(")")[0]
        if self.mc_version in self.supported_versions:
            self.supported = True
        return self.mc_version

    def get_server_flavor(self):
        self.flavor = self.flavor_line.split("This server is running ")[1].split("(Implementing")[0].strip()
        return self.flavor

    def get_paper_version(self):
        # Get the Flavor line and match against a regex string
        match = re.search(r"git-Paper-(\d+)", self.flavor)
        if match:
            try:
                self.paper_version = int(match.group(1))
            except ValueError:
                self.paper_version = None
            self.running_paper = True
        return self.paper_version

    def get_from_api(self):
        api_url = f"https://api.papermc.io/v2/projects/paper/versions/{self.mc_version}"
        resp = requests.get(url=api_url, headers=self.headers)
        if resp.status_code == 200:
            # Get the json
            data = resp.json()
            # Get the last element in the "builds" list
            return data["builds"][-1]
        return None

    def get_latest_paper_version(self):
        # Check our latest_paper_versions dict for the latest version, if it's not there, get it
        if self.mc_version not in latest_paper_versions:
            print("Pulling from Paper API")
            build = self.get_from_api()
            if build:
                # Add it to the dict
                latest_paper_versions[self.mc_version] = {
                    "build": build,
                    "timestamp": dt.utcnow()
                }
                return build
        else:
            # It's in there so lets grab the object
            build = latest_paper_versions[self.mc_version]
            # Check the timestamp to see if it's older than 30 minutes
            if build["timestamp"] < (dt.utcnow() - timedelta(minutes=30)):
                print("Cache expired, getting new build")
                # It's older than 30 minutes, so we need to get a new one
                build = self.get_from_api()
                if build:
                    # Update the dict
                    latest_paper_versions[self.mc_version] = {
                        "build": build,
                        "timestamp": dt.utcnow()
                    }
            print("Using cached build")
            return latest_paper_versions[self.mc_version]["build"]

    def get_plugins(self):
        # We want to iterate over the lines until we hit "Preparing level"
        checked_lines = 0
        for line in self.lines:
            if "Preparing level" in line:
                return
            # Do a regex check on the line for "\[(.*)\] Loading (.*) v(.*)" and then grab the 2nd and 3rd group
            regex = re.compile("\[(.*)\] Loading (.*) v(.*)")
            match = regex.search(line)
            if match:
                self.plugins.append(Plugin(match.group(2), match.group(3)))
            checked_lines += 1
            if checked_lines > self.max_lines:
                return

    def check_offline_mode(self):
        for i, line in enumerate(self.lines):
            if "SERVER IS RUNNING IN OFFLINE/INSECURE MODE!" in line:
                self.is_offline = True
        return False

    def check_for_weird_plugins(self):
        for plugin in self.plugins:
            if plugin.get_name() in self.weird_plugins:
                self.weird_plugins_acquired.append(plugin)

    def check_possibly_cracked(self):
        if len(self.weird_plugins_acquired) > 0:
            self.possibly_cracked = True

    def print_plugins_for_report(self):
        for plugin in self.plugins:
            print(f"{plugin.get_color()}{plugin}{Fore.RESET}")
        print(f"{Fore.GREEN}==============================")

    def output_plugins_for_report(self):
        output = []
        for plugin in self.plugins:
            output.append(f"{plugin.get_color()}{plugin}{Fore.RESET}")
        output.append(f"{Fore.GREEN}==============================")
        return output

    def check_for_paper(self):
        if "Paper version" in self.flavor and "git-Paper" in self.flavor:
            self.running_paper = True
            return True

    def check_for_pirated_plugins(self):
        lines_checked = 0
        for line in self.lines:
            matches = re.search(common_leak_regex, line)
            if matches:
                self.potentially_pirated_lines.append(matches[0])
                self.has_pirated_plugins = True
            elif any(word in line for word in self.pirate_giveaways) and "STDOUT" in line:
                self.potentially_pirated_lines.append(line)
                self.has_pirated_plugins = True
            lines_checked += 1
            if lines_checked > self.max_lines:
                return

    def check_for_mising_dependencies(self):
        # Iterate over the lines looking for lines containing "org.bukkit.plugin.UnknownDependencyException"
        lines_checked = 0
        for line in self.lines:
            if "org.bukkit.plugin.UnknownDependencyException" in line:
                self.has_missing_dependencies = True
                # Get the list of missing dependencies
                dependencies = line.split("Unknown/missing dependency plugins: ")[1].split(".")[0]
                # Remove brackets from the dependencies
                dependencies = dependencies.replace("[", "").replace("]", "")
                # Split the dependencies by comma, if no comma, then it's just one dependency
                if "," in dependencies:
                    found_dependencies = dependencies.split(",")
                    self.missing_dependencies.append(found_dependencies)
                else:
                    self.missing_dependencies.append(dependencies)
            lines_checked += 1
            if lines_checked > self.max_lines:
                return

    def find_exceptions(self):
        # Iterate over lines and keep an index
        for i, line in enumerate(self.lines):
            if "Exception" in line and "lost connection" not in line:
                # Ensure it's not in our ignored exceptions list
                if any(word in line for word in self.ignored_exceptions):
                    continue
                self.has_exceptions = True
                self.exceptions.append({
                    "line": line,
                    "line_number": i
                })
            if i > self.max_lines:
                return

    def check_for_ambiguous_plugin(self):
        for i, line in enumerate(self.lines):
            if "Ambiguous plugin name" in line:
                self.has_ambiguous_plugins = True
                # Parse out the plugin name
                matches = re.search(ambiguous_plugin_regex, line)
                if matches:
                    # The 2nd match is the plugin name
                    plugin_name = matches.group(2)
                    # The 3rd, and onward matches are the filenames of the plugins
                    plugin_filenames = [plugin for plugin in matches.groups()[2:] if plugin is not None]
                    self.ambiguous_plugins.append({
                        "plugin_name": plugin_name,
                        "plugin_filenames": plugin_filenames
                    })
            if i > self.max_lines:
                return

    def check_for_attempted_downgrade(self):
        for i, line in enumerate(self.lines):
            match = re.search(attempted_downgrade_regex, line)
            if match:
                self.attempting_to_downgrade = True
                version1 = match.group(1)
                version2 = match.group(2)
                self.downgraded_versions = [get_mc_from_data_version(version1), get_mc_from_data_version(version2)]
            if i > self.max_lines:
                return

    def check_for_malware(self):
        # Scan the entire log for any matches of the malware regex
        for i, line in enumerate(self.lines):
            if re.search(malware1_regex, line):
                self.has_malware = True
                self.malware_count += 1
            if i > self.max_lines:
                return

    def check_config(self):
        # Scan the logs for a line starting with org.spongepowered.configurate.serialize.CoercionFailedException
        for i, line in enumerate(self.lines):
            if "org.spongepowered.configurate.serialize.CoercionFailedException" in line:
                self.invalid_config = True
                # Pull out our needed information from the line
                matches = re.findall(bad_config_regex, line)
                # Our first match will be where in the config the error is
                config_location = matches[0][1].split(", ")
                self.invalid_config_locations = config_location
                valid_type = matches[1][2]
                invalid_type = matches[2][2]
                # We want to make a mock config to show the user
                # We'll start with the config location
                mock_config = f"{Fore.WHITE}"
                # For each location in the config it's a new json object
                for loc_i, location in enumerate(config_location):
                    # If it's the first location, we don't need to add a comma
                    if loc_i == 0:
                        mock_config += f'"{location}": {{'
                    elif loc_i == len(config_location) - 1:
                        # Last location, this is out invalid value
                        mock_config += f'\n{" " * (loc_i * 4)}"{location}": '
                    else:
                        mock_config += f'\n{" " * (loc_i * 4)}"{location}": {{'
                match invalid_type:
                    case "String":
                        mock_config += f'"{invalid_type}"'
                    case "Integer":
                        mock_config += f"{invalid_type}"
                    case "Boolean":
                        mock_config += f"{invalid_type}"
                    case _:
                        mock_config += f'"{invalid_type}"'
                # Add a cool arrow to show where the error is
                mock_config += f", <-- {Fore.RED}ERROR"
                # Add the valid type
                mock_config += f" (should be {valid_type}){Fore.RESET}"
                # Close out the json objects, loop through the config location backwards
                for loc_i, location in enumerate(config_location[::-1]):
                    # Our first element should be the trouble maker, so we don't need to close it
                    if loc_i == 0:
                        continue
                    # We need to indent by the number of locations we have, minus the current location
                    mock_config += f'\n{" " * ((len(config_location) - (loc_i + 1)) * 4)}}}'

                self.mock_config = mock_config
                return

            if i > self.max_lines:
                return

    def print_report(self):
        color = Fore.GREEN if self.supported else Fore.RED
        print(f"{color}Minecraft Version: {self.mc_version}{Fore.RESET}")
        color = Fore.GREEN if self.running_paper else Fore.RED
        print(f"{color}Server Flavor: {self.flavor}{Fore.RESET}")
        color = Fore.GREEN if not self.is_offline else Fore.RED
        print(f"{color}Offline Mode: {self.is_offline}{Fore.RESET}")
        print(f"{Fore.GREEN}============PLUGINS============")
        self.print_plugins_for_report()
        if self.has_ambiguous_plugins:
            print(f"{Fore.YELLOW}==========AMBIGUOUS PLUGINS==========")
            for plugin in self.ambiguous_plugins:
                print(f"{Fore.YELLOW}Plugin Name: {plugin['plugin_name']}")
                print(f"{Fore.YELLOW}Plugin Filenames: {plugin['plugin_filenames']}")
        if self.possibly_cracked:
            print(f"{Fore.CYAN}Server is possibly cracked. The following plugins suggest this: ")
            for plugin in self.weird_plugins_acquired:
                print(f"{plugin.get_color()}{plugin}{Fore.RESET}")
            print(f"{Fore.GREEN}==============================")
        if self.has_pirated_plugins:
            print(f"{Fore.CYAN}Server has pirated plugins. The following lines suggest this: ")
            for line in self.potentially_pirated_lines:
                print(f"{Fore.CYAN}{line}{Fore.RESET}")
            print(f"{Fore.GREEN}==============================")
        if self.has_missing_dependencies:
            print(f"{Fore.CYAN}Server has missing dependencies. The following dependencies are missing: ")
            for dependency in self.missing_dependencies:
                print(f"{Fore.CYAN}{dependency}{Fore.RESET}")
            print(f"{Fore.GREEN}==============================")
        if self.has_exceptions:
            print(f"{Fore.CYAN}Server has exceptions. The following exceptions were found: ")
            for exception in self.exceptions:
                print(f"{Fore.CYAN}Line {exception['line_number']}: {exception['line']}{Fore.RESET}")
            print(f"{Fore.GREEN}==============================")

    def get_report_as_string(self):
        output = []
        color = Fore.GREEN if self.supported else Fore.RED
        output.append(f"{color}Minecraft Version: {self.mc_version}{Fore.RESET}")
        color = Fore.GREEN if self.running_paper else Fore.RED
        output.append(f"{color}Server Flavor: {self.flavor}{Fore.RESET}")
        color = Fore.GREEN if self.paper_version == self.get_latest_paper_version() else Fore.RED
        output.append(f"{color}Paper Version: {self.paper_version}{Fore.RESET}")
        color = Fore.GREEN if not self.is_offline else Fore.RED
        output.append(f"{color}Offline Mode: {self.is_offline}{Fore.RESET}")
        color = Fore.GREEN if not self.has_malware else Fore.RED
        output.append(f"{color}Malware Detected: {self.has_malware}{Fore.RESET}")
        if self.attempting_to_downgrade:
            output.append(f"{Fore.RED}Server is attempting to downgrade. This is not supported! You're going from {self.downgraded_versions[0]} to {self.downgraded_versions[1]}{Fore.RESET}")
        output.append(f"{Fore.GREEN}============PLUGINS============{Fore.RESET}")
        for line in self.output_plugins_for_report():
            output.append(line)
        if self.has_ambiguous_plugins:
            # Get rid of the last line in the output
            output.pop()
            output.append(f"{Fore.YELLOW}==========AMBIGUOUS PLUGINS=========={Fore.RESET}")
            for plugin in self.ambiguous_plugins:
                output.append(f"{Fore.YELLOW}Plugin Name: {plugin['plugin_name']}")
                output.append(f"{Fore.YELLOW}Plugin Filenames: {plugin['plugin_filenames']}")
            output.append(f"{Fore.GREEN}=============================={Fore.RESET}")
        if self.has_missing_dependencies:
            output.append(
                f"{Fore.CYAN}Server has missing dependencies. The following dependencies are missing: {Fore.RESET}")
            for dependency in self.missing_dependencies:
                output.append(f"{Fore.CYAN}{dependency}{Fore.RESET}")
            output.append(f"{Fore.GREEN}=============================={Fore.RESET}")
        if self.possibly_cracked:
            output.append(f"{Fore.CYAN}Server is possibly cracked. The following plugins suggest this: {Fore.RESET}")
            for plugin in self.weird_plugins_acquired:
                output.append(f"{plugin.get_color()}{plugin}{Fore.RESET}")
            output.append(f"{Fore.GREEN}=============================={Fore.RESET}")
        if self.has_pirated_plugins:
            output.append(f"{Fore.CYAN}Server has pirated plugins. The following lines suggest this: {Fore.RESET}")
            for line in self.potentially_pirated_lines:
                output.append(f"{Fore.CYAN}{line}{Fore.RESET}")
            output.append(f"{Fore.GREEN}=============================={Fore.RESET}")
        if self.has_exceptions:
            output.append(f"{Fore.CYAN}Server has exceptions. The following exceptions were found: {Fore.RESET}")
            for exception in self.exceptions:
                output.append(
                    f"{Fore.CYAN}Line {exception['line_number']}: {Fore.YELLOW}{exception['line']}{Fore.RESET}")
            output.append(f"{Fore.GREEN}=============================={Fore.RESET}")
        if self.invalid_config:
            output.append(f"{Fore.RED}Server has an invalid config. Use the following info to fix it! {Fore.RESET}")
            output.append(self.mock_config)
            output.append(f"{Fore.YELLOW}You should find lines like look like this in your Paper configs.")
            output.append(f"{Fore.GREEN}=============================={Fore.RESET}")
        return output


def main():
    # Get first args
    url = sys.argv[1]
    log = LogFile(url)
    log.run_checks()
    log.print_report()


if __name__ == "__main__":
    main()
