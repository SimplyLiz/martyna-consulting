#!/usr/bin/env python3
"""
Launch script for Claritas AI Consulting
Starts the Astro dev server with automatic port selection
"""

import subprocess
import time
import sys
import os
import signal
import socket
import select
import termios
import tty

DEFAULT_PORT = 4878


class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'
    DIM = '\033[2m'


processes = []
current_port = None
original_terminal_settings = None


def print_banner():
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*60}")
    print("  Claritas AI Consulting — Dev Server")
    print(f"{'='*60}{Colors.END}\n")


def print_success(message):
    print(f"{Colors.GREEN}✓ {message}{Colors.END}")


def print_error(message):
    print(f"{Colors.RED}✗ {message}{Colors.END}")


def print_info(message):
    print(f"{Colors.YELLOW}ℹ {message}{Colors.END}")


def print_section(title):
    print(f"\n{Colors.BOLD}{Colors.BLUE}▶ {title}{Colors.END}")


def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0


def find_available_port(start_port, max_attempts=10):
    for i in range(max_attempts):
        port = start_port + i
        if not is_port_in_use(port):
            return port
    return None


def wait_for_server(port, timeout=30):
    start_time = time.time()
    while time.time() - start_time < timeout:
        if is_port_in_use(port):
            return True
        time.sleep(0.5)
    return False


def setup_terminal():
    global original_terminal_settings
    if sys.stdin.isatty():
        original_terminal_settings = termios.tcgetattr(sys.stdin)
        tty.setcbreak(sys.stdin.fileno())


def restore_terminal():
    global original_terminal_settings
    if original_terminal_settings and sys.stdin.isatty():
        termios.tcsetattr(sys.stdin, termios.TCSADRAIN, original_terminal_settings)


def cleanup_processes():
    print(f"\n{Colors.YELLOW}Shutting down...{Colors.END}")
    for name, process in processes:
        try:
            if sys.platform != 'win32':
                os.killpg(os.getpgid(process.pid), signal.SIGTERM)
            else:
                process.terminate()
            print_success(f"Stopped {name}")
        except Exception:
            pass
    print_success("Done\n")


def signal_handler(sig, frame):
    cleanup_processes()
    restore_terminal()
    os.system('stty sane 2>/dev/null')
    sys.exit(0)


def open_browser(url):
    try:
        if sys.platform == 'darwin':
            subprocess.run(['open', url], capture_output=True, timeout=5)
        elif sys.platform == 'win32':
            os.startfile(url)
        else:
            subprocess.run(['xdg-open', url], capture_output=True, timeout=5)
        print_success("Browser opened")
    except Exception as e:
        print_info(f"Could not open browser: {e}")


def print_status():
    print_section("Running")
    print(f"\n  {Colors.BOLD}Claritas Dev:{Colors.END}")
    print(f"  {Colors.CYAN}http://localhost:{current_port}{Colors.END}")
    print(f"  {Colors.CYAN}http://10.0.0.140:{current_port}{Colors.END}")
    print(f"\n{Colors.BOLD}{Colors.GREEN}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}  O        Open in browser{Colors.END}")
    print(f"{Colors.BOLD}  Ctrl+C   Stop server{Colors.END}")
    print(f"{Colors.BOLD}{Colors.GREEN}{'='*60}{Colors.END}\n")


def main():
    global current_port

    import atexit
    atexit.register(restore_terminal)

    print_banner()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    print_section("Checking Port")
    port = find_available_port(DEFAULT_PORT)
    if port is None:
        print_error(f"No available port found near {DEFAULT_PORT}")
        sys.exit(1)

    print_success(f"Port {port} is available")
    current_port = port

    print_section("Starting Server")
    print_info(f"Starting Astro dev on port {port}...")

    process_env = os.environ.copy()
    process = subprocess.Popen(
        f"pnpm dev --port {port} --host 0.0.0.0",
        shell=True,
        cwd=script_dir,
        env=process_env,
        preexec_fn=os.setsid if sys.platform != 'win32' else None
    )
    processes.append(("Astro Dev", process))

    print_info("Waiting for server...")
    if wait_for_server(port, timeout=30):
        print_success(f"Server ready on port {port}")
    else:
        print_error("Timeout waiting for server — check output above")

    print_status()
    setup_terminal()

    try:
        while True:
            if processes and processes[0][1].poll() is not None:
                print_error(f"Server stopped unexpectedly (exit code: {processes[0][1].returncode})")
                break

            if sys.stdin.isatty() and select.select([sys.stdin], [], [], 0.5)[0]:
                key = sys.stdin.read(1)
                if key.lower() == 'o':
                    open_browser(f'http://localhost:{current_port}')
            else:
                time.sleep(0.5)
    except KeyboardInterrupt:
        cleanup_processes()
        restore_terminal()
        os.system('stty sane 2>/dev/null')


if __name__ == "__main__":
    main()
