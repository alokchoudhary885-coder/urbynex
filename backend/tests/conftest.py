"""
backend/tests/conftest.py

Global pytest configuration and fixtures for Urbynex tests.
Ensures the test suite runs reliably offline in isolated sandbox environments
without requiring loopback socket permissions or external network access.
"""

import os
import sys

# ---------------------------------------------------------------------------
# Windows Sandbox Offline Event Loop Compatibility
# In sandboxed environments on Windows, outbound socket connections to 127.0.0.1
# are blocked by the OS filter, which causes Python's socket.socketpair() (used by
# asyncio.ProactorEventLoop for its self-pipe) to hang. We substitute native anonymous
# pipes for the self-pipe, allowing asyncio and AnyIO to run 100% offline.
# ---------------------------------------------------------------------------
if sys.platform == "win32":
    try:
        import asyncio
        import asyncio.proactor_events
        import asyncio.windows_events
        import _overlapped

        # 1. Catch Windows timeout and WinError 0 in Proactor _poll
        orig_poll = asyncio.windows_events.IocpProactor._poll

        def _patched_poll(self, timeout=None):
            try:
                return orig_poll(self, timeout)
            except (TimeoutError, OSError) as e:
                if (
                    getattr(e, "winerror", None) in (0, 258)
                    or getattr(e, "errno", None) == 0
                    or isinstance(e, TimeoutError)
                ):
                    return
                raise

        asyncio.windows_events.IocpProactor._poll = _patched_poll

        # 2. Pipe wrapper to emulate socket interface for ProactorEventLoop self-pipe
        class _OfflineSelfPipe:
            def __init__(self, fd: int):
                self._fd = fd

            def fileno(self) -> int:
                return self._fd

            def send(self, data: bytes) -> None:
                try:
                    os.write(self._fd, data)
                except OSError:
                    pass

            def setblocking(self, b: bool) -> None:
                pass

            def close(self) -> None:
                try:
                    os.close(self._fd)
                except OSError:
                    pass

        def _patched_make_self_pipe(self):
            r, w = os.pipe()
            self._ssock = _OfflineSelfPipe(r)
            self._csock = _OfflineSelfPipe(w)
            self._internal_fds += 1

        def _patched_loop_self_reading(self, f=None):
            pass

        def _patched_write_to_self(self):
            if (
                hasattr(self, "_proactor")
                and hasattr(self._proactor, "_iocp")
                and self._proactor._iocp
            ):
                try:
                    _overlapped.PostQueuedCompletionStatus(self._proactor._iocp, 0, 0, 0)
                except OSError:
                    pass

        asyncio.proactor_events.BaseProactorEventLoop._make_self_pipe = _patched_make_self_pipe
        asyncio.proactor_events.BaseProactorEventLoop._loop_self_reading = _patched_loop_self_reading
        asyncio.proactor_events.BaseProactorEventLoop._write_to_self = _patched_write_to_self

    except Exception:
        pass
