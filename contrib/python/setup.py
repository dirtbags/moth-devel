from setuptools import setup

import sys
if sys.version_info < (3,5):
    sys.exit("Sorry, Python < 3.5 is not supported")

setup(
    name = "moth",
    version = "4.4.11",
    description = "The MOTH development toolkit",
    packages = ["moth"],
    python_requires = "~=3.5",
    install_requires = [
        "mistune~=3.0",
        "PyYAML>=5.3.1",
    ],
    extras_require = {
        "scapy": ["scapy~=2.4"],
        "pillow": ["Pillow~=9.0"],
        "full": ["scapy~=2.4", "Pillow~=9.0"],
    },
    tests_require = [
        "coverage~=4.5", 
        "flake8~=3.7", 
        "frosted~=1.4",
        "nose2~=0.13", 
        "pylint~=2.3", 
        "requests~=2.22",
    ],
    include_package_data = True,
    entry_points = {
        "console_scripts": [],
    },
)
