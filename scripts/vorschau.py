"""Lokale Vorschau mit Medienerkennung und Teilabrufen für Safari-Videos."""
import argparse
import re
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from medien import ROOT, FILME, aktualisieren


class Vorschau(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_head(self):
        self.rest = None
        pfad = urlsplit(self.path).path
        if pfad == "/media/katalog.js":
            aktualisieren()

        datei = Path(self.translate_path(pfad))
        bereich = re.fullmatch(r"bytes=(\d*)-(\d*)", self.headers.get("Range", ""))
        if not bereich or not datei.is_file() or datei.suffix.lower() not in FILME:
            return super().send_head()

        # Medienplayer können für Metadaten oder zum Springen nur einige Bytes anfordern.
        groesse = datei.stat().st_size
        links, rechts = bereich.groups()
        if not links and not rechts:
            return super().send_head()
        start = int(links) if links else max(0, groesse - int(rechts))
        ende = min(int(rechts), groesse - 1) if rechts and links else groesse - 1
        if start > ende:
            self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
            self.send_header("Content-Range", f"bytes */{groesse}")
            self.end_headers()
            return None

        stream = datei.open("rb")
        stream.seek(start)
        self.rest = ende - start + 1
        self.send_response(HTTPStatus.PARTIAL_CONTENT)
        self.send_header("Content-Type", self.guess_type(str(datei)))
        self.send_header("Content-Range", f"bytes {start}-{ende}/{groesse}")
        self.send_header("Content-Length", str(self.rest))
        self.end_headers()
        return stream

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        if Path(urlsplit(self.path).path).suffix.lower() in FILME:
            self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def copyfile(self, source, outputfile):
        if self.rest is None:
            return super().copyfile(source, outputfile)
        while self.rest:
            block = source.read(min(self.rest, 64 * 1024))
            if not block:
                break
            outputfile.write(block)
            self.rest -= len(block)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8317)
    port = parser.parse_args().port
    with ThreadingHTTPServer(("127.0.0.1", port), Vorschau) as server:
        print(f"Portfolio: http://127.0.0.1:{port}/", flush=True)
        server.serve_forever()
