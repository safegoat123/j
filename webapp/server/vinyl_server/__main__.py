"""Run with ``python -m vinyl_server`` (binds to 127.0.0.1 by default)."""

import uvicorn

from .app import create_app
from .config import Settings


def main() -> None:
    settings = Settings()
    print(f"Vinyl Music API — data dir: {settings.data_dir}")
    uvicorn.run(create_app(settings), host=settings.host, port=settings.port)


if __name__ == "__main__":
    main()
