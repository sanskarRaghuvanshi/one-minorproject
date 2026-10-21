#!/usr/bin/env python3
"""OneSpace frontend static server.

Serves the project root on http://localhost:8080 so the app runs over HTTP
(required once the real Django API is connected).

Usage:
    python serve.py            # serve on http://localhost:8080
    python serve.py 3000       # serve on a custom port
"""
import http.server
import functools
import os
import socket
import socketserver
import sys
import errno

ROOT = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PORT = 8080


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


def main():
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print("Invalid port, using %d." % DEFAULT_PORT)

    handler = functools.partial(QuietHandler)
    try:
        with ReusableTCPServer(("", port), handler) as httpd:
            print("=" * 56)
            print("OneSpace frontend is running at:")
            print("  http://localhost:%d" % port)
            print("  http://127.0.0.1:%d" % port)
            print()
            print("Press Ctrl+C to stop the server.")
            print("=" * 56)
            httpd.serve_forever()
    except OSError as exc:
        if exc.errno == errno.EADDRINUSE:
            print("Error: port %d is already in use." % port)
            print("Try a different port, e.g.  python serve.py 5500")
        else:
            raise


if __name__ == "__main__":
    main()