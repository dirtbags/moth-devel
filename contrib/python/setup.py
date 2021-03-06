from setuptools import setup

import sys
if sys.version_info < (3,5):
    sys.exit("Sorry, Python < 3.5 is not supported")

setup(
    name = "moth",
    version = "4.0.2",
    description = "The MOTH development toolkit",
    packages = ["moth"],
    python_requires = "~=3.5",
    install_requires = [
        "mistune>=0.8.4",
        "PyYAML>=5.3.1",
    ],
    extras_require = {
        "scapy": ["scapy>=2.4.2"],
        "pillow": ["Pillow>=5.4.1"],
        "full": ["scapy>=2.4.2", "Pillow>=5.4.1"],
    },
    tests_require = [
        "coverage==4.5.3", 
        "flake8==3.7.7", 
        "frosted==1.4.1",
        "nose>=1.3.7", 
        "pylint==2.3.1", 
        "requests>=2.22.0",
    ],
    include_package_data = True,
    entry_points = {
        "console_scripts": [],
    },
)
