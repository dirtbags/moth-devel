# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [unreleased] - 
### Added
- Brought in cyber fire theme from netarch repository
  - Includes built-in client-side Python IDE!
- A few sample puzzles to demonstrate:
  - What the Python `moth` library provides
  - The client-side Python IDE
- Client now provides the puzzle object and `checkAnswer()` to puzzle window

### Changed
- Restructured to handle more than just Python (eg. theme)
- Brought in moth.py from cyber fire puzzles repository
  - Conforms to MOTHv4.1 puzzle object structure
  - Removes a whole lot of unused legacy code
  - New HexDumper object
