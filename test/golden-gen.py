"""
Generate golden report snapshots from a BUG-PATCHED copy of the legacy
services/web/project/parser.py, to use as the oracle for the TypeScript port.

The live Flask /parse mostly 500s today (the Fore.REDz typo), so we patch the
three crash-bugs the migration also fixes, then capture output:
  1. Fore.REDz -> Fore.RED
  2. guard get_paper_version / check_for_paper when there is no flavor line
  3. bound the offline-mode 10-line lookahead to len(lines)

Network is avoided: fixtures contain no "UUID of player" lines, and
get_latest_paper_version is stubbed to a constant (matched in the TS tests).

Run: python3 test/golden-gen.py
"""

import importlib.util
import json
import os
import sys
import types

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(ROOT)
SRC = os.path.join(REPO, "services", "web", "project")
FIXED_PAPER_BUILD = 999
MAX_LINES = 10000

# --- Stub the imports parser.py needs but the harness never exercises. ---
colorama = types.ModuleType("colorama")


class _Fore:
    BLACK = "\033[30m"
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN = "\033[36m"
    WHITE = "\033[37m"
    RESET = "\033[39m"


colorama.Fore = _Fore()
sys.modules["colorama"] = colorama
sys.modules["requests"] = types.ModuleType("requests")
sys.modules["bs4"] = types.ModuleType("bs4")

# Load the legacy constants.py as a top-level module.
spec = importlib.util.spec_from_file_location("constants", os.path.join(SRC, "constants.py"))
constants = importlib.util.module_from_spec(spec)
sys.modules["constants"] = constants
spec.loader.exec_module(constants)

# --- Patch parser.py source. ---
with open(os.path.join(SRC, "parser.py"), encoding="utf-8") as f:
    source = f.read()

source = source.replace("from .constants import data_version_to_mc", "from constants import data_version_to_mc")
source = source.replace("Fore.REDz", "Fore.RED")
source = source.replace(
    '    def get_paper_version(self):\n        # Get the Flavor line and match against a regex string\n'
    '        match = re.search(r"git-Paper-(\\d+)", self.flavor)',
    '    def get_paper_version(self):\n        if self.flavor is None or self.flavor_line is None:\n'
    "            return None\n"
    '        match = re.search(r"git-Paper-(\\d+)", self.flavor)',
)
source = source.replace(
    '    def check_for_paper(self):\n        if "Paper version" in self.flavor',
    '    def check_for_paper(self):\n        if self.flavor is None:\n            return\n'
    '        if "Paper version" in self.flavor',
)
source = source.replace("for j in range(i, i + 10):", "for j in range(i, min(i + 10, len(self.lines))):")

patched_path = os.path.join(ROOT, "_patched_parser.py")
with open(patched_path, "w", encoding="utf-8") as f:
    f.write(source)

spec2 = importlib.util.spec_from_file_location("patched_parser", patched_path)
patched = importlib.util.module_from_spec(spec2)
sys.modules["patched_parser"] = patched
spec2.loader.exec_module(patched)
LogFile = patched.LogFile


def analyze(log):
    # Mirror run_checks() minus the network read and player validation.
    log.get_flavor_line()
    log.get_paper_version()
    log.get_plugins()
    log.check_for_ambiguous_plugin()
    log.check_offline_mode()
    log.check_for_weird_plugins()
    log.check_for_paper()
    log.check_possibly_cracked()
    log.check_for_pirated_plugins()
    log.check_for_mising_dependencies()
    log.find_exceptions()
    log.check_for_attempted_downgrade()
    log.check_for_malware()
    log.check_config()
    log.get_players()


def main():
    fixtures_dir = os.path.join(ROOT, "fixtures")
    golden_dir = os.path.join(ROOT, "golden")
    os.makedirs(golden_dir, exist_ok=True)

    for name in sorted(os.listdir(fixtures_dir)):
        if not name.endswith(".log"):
            continue
        with open(os.path.join(fixtures_dir, name), encoding="utf-8") as f:
            lines = f.read().splitlines()

        log = LogFile("")
        log.lines = lines
        log.max_lines = MAX_LINES
        analyze(log)
        log.get_latest_paper_version = lambda: FIXED_PAPER_BUILD
        report = log.get_report_as_string()

        out_path = os.path.join(golden_dir, name.replace(".log", ".json"))
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(f"golden: {name} -> {len(report)} lines")

    os.remove(patched_path)


if __name__ == "__main__":
    main()
