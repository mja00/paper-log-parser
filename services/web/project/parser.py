import sys
import requests
import re
import bs4
from colorama import Fore


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
            "FastAsyncWorldEdit",
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
        self.headers = {
            "User-Agent": "Minecraft Latest.log Parser v1"
        }
        self.supported_versions = [
            "1.19.3"
        ]
        self.plugins = []
        self.mc_version = None
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
            "directleaks.com"
        ]
        self.has_missing_dependencies = False
        self.missing_dependencies = []
        self.has_exceptions = False
        self.exceptions = []

    def run_checks(self):
        self.read_url_into_memory()
        self.get_flavor_line()
        self.get_plugins()
        self.check_offline_mode()
        self.check_for_weird_plugins()
        self.check_for_paper()
        self.check_possibly_cracked()
        self.check_for_pirated_plugins()
        self.check_for_mising_dependencies()
        self.find_exceptions()

    def read_url_into_memory(self):
        # Check if the url is a paste.gg that isn't raw
        if "paste.gg" in self.url and not self.url.endswith("raw"):
            # WE need to use bs4 to get the raw url
            resp = requests.get(url=self.url, headers=self.headers)
            soup = bs4.BeautifulSoup(resp.text, "html.parser")
            raw_url = soup.find("a", {"class": "is-pulled-right button"}).get("href")
            # Now we can handle the raw url
            resp = requests.get(url=f"https://paste.gg{raw_url}", headers=self.headers)
            self.lines = resp.text.splitlines()
            return resp.text
        if "pastes.dev" in self.url and "api" not in self.url:
            # The raw url is just the url with api.pastes.dev
            raw_url = self.url.replace("pastes.dev", "api.pastes.dev")
            resp = requests.get(url=raw_url, headers=self.headers)
            self.lines = resp.text.splitlines()
            return resp.text
        if "api.pastes.dev" in self.url:
            # No need to get the raw url
            resp = requests.get(url=self.url, headers=self.headers)
            self.lines = resp.text.splitlines()
            return resp.text

    def get_flavor_line(self):
        # Iterate over the lines looking for: This server is running
        # This should be within the first 30 lines
        line_count = 0
        for line in self.lines:
            print(line)
            if "This server is running" in line:
                # We've found the flavor line
                self.flavor_line = line
                self.get_mc_version()
                self.get_server_flavor()
                return
            line_count += 1

    def get_mc_version(self):
        block = self.flavor_line.split("(MC: ")[1]
        self.mc_version = block.split(")")[0]
        if self.mc_version in self.supported_versions:
            self.supported = True
        return self.mc_version

    def get_server_flavor(self):
        self.flavor = self.flavor_line.split("This server is running ")[1]
        return self.flavor

    def get_plugins(self):
        # We want to iterate over the lines until we hit "Preparing level"
        for line in self.lines:
            if "Preparing level" in line:
                return
            # Do a regex check on the line for "\[(.*)\] Loading (.*) v(.*)" and then grab the 2nd and 3rd group
            regex = re.compile("\[(.*)\] Loading (.*) v(.*)")
            match = regex.search(line)
            if match:
                self.plugins.append(Plugin(match.group(2), match.group(3)))

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
        output.append(f"{Fore.GREEN}=============================={Fore.RESET}")
        return output

    def check_for_paper(self):
        if "Paper version" in self.flavor and "git-Paper" in self.flavor:
            self.running_paper = True
            return True

    def check_for_pirated_plugins(self):
        for line in self.lines:
            if any(word in line for word in self.pirate_giveaways):
                self.potentially_pirated_lines.append(line)
                self.has_pirated_plugins = True

    def check_for_mising_dependencies(self):
        # Iterate over the lines looking for lines containing "org.bukkit.plugin.UnknownDependencyException"
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

    def find_exceptions(self):
        # Iterate over lines and keep an index
        for i, line in enumerate(self.lines):
            if "Exception" in line and "lost connection" not in line:
                self.has_exceptions = True
                self.exceptions.append({
                    "line": line,
                    "line_number": i
                })

    def print_report(self):
        color = Fore.GREEN if self.supported else Fore.RED
        print(f"{color}Minecraft Version: {self.mc_version}{Fore.RESET}")
        color = Fore.GREEN if self.running_paper else Fore.RED
        print(f"{color}Server Flavor: {self.flavor}{Fore.RESET}")
        color = Fore.GREEN if not self.is_offline else Fore.RED
        print(f"{color}Offline Mode: {self.is_offline}{Fore.RESET}")
        print(f"{Fore.GREEN}============PLUGINS============")
        self.print_plugins_for_report()
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
        color = Fore.GREEN if not self.is_offline else Fore.RED
        output.append(f"{color}Offline Mode: {self.is_offline}{Fore.RESET}")
        output.append(f"{Fore.GREEN}============PLUGINS============{Fore.RESET}")
        for line in self.output_plugins_for_report():
            output.append(line)
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
        if self.has_missing_dependencies:
            output.append(
                f"{Fore.CYAN}Server has missing dependencies. The following dependencies are missing: {Fore.RESET}")
            for dependency in self.missing_dependencies:
                output.append(f"{Fore.CYAN}{dependency}{Fore.RESET}")
            output.append(f"{Fore.GREEN}=============================={Fore.RESET}")
        if self.has_exceptions:
            output.append(f"{Fore.CYAN}Server has exceptions. The following exceptions were found: {Fore.RESET}")
            for exception in self.exceptions:
                output.append(
                    f"{Fore.CYAN}Line {exception['line_number']}: {Fore.YELLOW}{exception['line']}{Fore.RESET}")
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
