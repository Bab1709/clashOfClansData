"""Local web server for the Clash of Clans stats site.

Serves the static files in public/ and proxies /api/player/<tag> and
/api/clan/<tag> to the official Clash of Clans API. The API key stays on
the server (read from .env) and is never sent to the browser.

Run:  python3 server.py   then open http://localhost:8000
"""

import json
import os
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT / "public"
API_BASE = "https://api.clashofclans.com/v1"
HOST = "127.0.0.1"
PORT = int(os.environ.get("PORT", "8000"))

# Tags only ever use these characters (the letter O is shown as 0).
TAG_PATTERN = re.compile(r"^[0289PYLQGRJCUV]{3,15}$")
ROUTES = {"player": "players", "clan": "clans"}


def make_ssl_context():
    """Use certifi's certificates when available.

    Python from python.org on macOS ships without system certificates, so
    HTTPS fails until certifi is installed (or Install Certificates.command
    is run).
    """
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


SSL_CONTEXT = make_ssl_context()


def load_env(path):
    """Minimal .env reader so the project has no dependencies."""
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def normalize_tag(raw):
    tag = urllib.parse.unquote(raw).strip().upper().lstrip("#").replace("O", "0")
    return tag if TAG_PATTERN.match(tag) else None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC_DIR), **kwargs)

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path.startswith("/api/"):
            self.handle_api(path)
        else:
            super().do_GET()

    def handle_api(self, path):
        parts = path.strip("/").split("/")
        if len(parts) != 3 or parts[1] not in ROUTES:
            return self.send_json(404, {"error": "Unknown endpoint."})

        tag = normalize_tag(parts[2])
        if not tag:
            return self.send_json(400, {"error": "That doesn't look like a valid tag."})

        api_key = os.environ.get("COC_API_KEY")
        if not api_key:
            return self.send_json(500, {"error": "COC_API_KEY is missing. Add it to .env."})

        url = f"{API_BASE}/{ROUTES[parts[1]]}/{urllib.parse.quote('#' + tag)}"
        request = urllib.request.Request(
            url,
            headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=10, context=SSL_CONTEXT) as response:
                return self.send_json(200, json.load(response))
        except urllib.error.HTTPError as err:
            messages = {
                403: "The API refused the key. Check that it's valid and allows this computer's IP address.",
                404: f"No {parts[1]} found with tag #{tag}.",
                429: "Too many requests. Wait a moment and try again.",
                503: "The Clash of Clans API is down for maintenance.",
            }
            message = messages.get(err.code, f"The Clash of Clans API returned an error ({err.code}).")
            return self.send_json(err.code, {"error": message})
        except urllib.error.URLError as err:
            if isinstance(err.reason, ssl.SSLCertVerificationError):
                return self.send_json(502, {
                    "error": "Python can't verify HTTPS certificates. Run: python3 -m pip install certifi"
                })
            return self.send_json(502, {"error": "Couldn't reach the Clash of Clans API."})
        except TimeoutError:
            return self.send_json(502, {"error": "Couldn't reach the Clash of Clans API."})

    def send_json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    load_env(ROOT / ".env")
    if not os.environ.get("COC_API_KEY"):
        print("Warning: COC_API_KEY is not set. Copy .env.example to .env and add your key.")
    print(f"Serving on http://localhost:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
