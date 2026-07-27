"""Tiny development server for the dependency-free Mediator prototype."""

from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler


if __name__ == "__main__":
    print("Mediator available at http://localhost:8000")
    ThreadingHTTPServer(("0.0.0.0", 8000), SimpleHTTPRequestHandler).serve_forever()
