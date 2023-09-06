"""Basic library for building Python-based MOTH puzzles/categories"""

from argparse import ArgumentParser
import contextlib
import copy
import hashlib
import html
import io
import importlib.machinery
import json
import logging
import os
import pathlib
import random
import shutil
import string
import sys
import tempfile
import types
import warnings

API_VERSION = "4.0"

LOGGER = logging.getLogger(__name__)
SEED = os.getenv("SEED", "auto")


def sha256hash(buf):
    """Calculate a SHA256 hash

    :param buf: A bytes object containg the data to hash
    :returns: SHA256 hash digest as a hex string
    """
    return hashlib.sha256(buf.encode("utf-8")).hexdigest()


@contextlib.contextmanager
def pushd(newdir):
    """Context manager for limiting context to individual puzzles/categories"""
    newdir = str(newdir)
    curdir = os.getcwd()
    LOGGER.debug("Attempting to chdir from %s to %s", curdir, newdir)
    os.chdir(newdir)

    # Force a copy of the old path, instead of just a reference
    old_path = list(sys.path)
    old_modules = copy.copy(sys.modules)
    sys.path.append(newdir)

    try:
        yield
    finally:
        # Restore the old path
        to_remove = []
        for module in sys.modules:
            if module not in old_modules:
                to_remove.append(module)

        for module in to_remove:
            del sys.modules[module]

        sys.path = old_path
        LOGGER.debug("Changing directory back from %s to %s",
                     newdir, curdir)
        os.chdir(curdir)


def loadmod(name, path):
    """Load a specified puzzle module

    :param name: Name to load the module as
    :param path: Path of the module to load
    """
    abspath = str(path.resolve())
    loader = importlib.machinery.SourceFileLoader(name, abspath)
    mod = types.ModuleType(loader.name)
    return loader.exec_module(mod)


class PuzzleFile:  # pylint: disable=too-few-public-methods

    """A file associated with a puzzle.

    path: The path to the original input file. May be None (when this is created from a file handle
          and there is no original input.
    handle: A File-like object set to read the file from. You should be able to read straight
            from it without having to seek to the beginning of the file.
    name: The name of the output file.
    visible: A boolean indicating whether this file should visible to the user. If False,
             the file is still expected to be accessible, but it's path must be known
             (or figured out) to retrieve it."""

    def __init__(self, stream, name, visible=True):
        self.stream = stream
        self.name = name
        self.visible = visible


class PuzzleSuccess(dict):

    """Puzzle success objectives

    :param acceptable: Learning outcome from acceptable knowledge of the subject matter
    :param mastery: Learning outcome from mastery of the subject matter
    """

    valid_fields = ["acceptable", "mastery"]

    def __init__(self, **kwargs):
        super().__init__()
        for key in self.valid_fields:
            self[key] = None

        for key, value in kwargs.items():
            if key in self.valid_fields:
                self[key] = value

    def __getattr__(self, attr):
        if attr in self.valid_fields:
            return self[attr]
        raise AttributeError(f"'{type(self).__name__}' object has no attribute '{attr}'")

    def __setattr__(self, attr, value):
        if attr in self.valid_fields:
            self[attr] = value
        else:
            raise AttributeError(f"'{type(self).__name__}' object has no attribute '{attr}'")


class Puzzle:  # pylint: disable=too-many-instance-attributes

    """A MOTH Puzzle"""

    def __init__(self, seed=None):
        """A MOTH Puzzle."""

        self._source_format = "py"

        self.markup = None

        self.summary = None
        self.authors = []
        self.answers = []
        self.scripts = []
        self.pattern = None
        self.hints = []
        self.files = {}
        self.body = io.StringIO()

        # NIST NICE objective content
        self.objective = None  # Text describing the expected learning outcome from solving this puzzle, *why* are you solving this puzzle
        self.success = PuzzleSuccess()   # Text describing criteria for different levels of success, e.g. {"Acceptable": "Did OK", "Mastery": "Did even better"}
        self.solution = None  # Text describing how to solve the puzzle
        self.ksas = []  # A list of references to related NICE KSAs (e.g. K0058, . . .)

        self.logs = []

        if seed is None:
            seed = SEED

        if seed == "auto":
            seed = random.SystemRandom()

        self.randseed = f"{seed} {os.getcwd()}"
        self.rand = random.Random(self.randseed)

    @property
    def author(self):
        """Retrieve the first author

        This function is retained for backwards-compatibility with legacy puzzles which use the .author field

        :returns: The first author in the .authors field, if one exists
        """
        warnings.warn("This author field has been deprecated. Please use authors instead", DeprecationWarning)
        if len(self.authors) > 0:
            return self.authors[0]

        return None

    @author.setter
    def author(self, new_author):
        """Set the author

        This function is retained for backwards-compatibility with legacy puzzles which use the .author field

        :param new_author: The new author
        """

        warnings.warn("This author field has been deprecated. Please use authors instead", DeprecationWarning)

        self.authors = [new_author]

    def set_markup(self, markup):
        """Set the markup function to convert body to HTML.

        Normally this would be something like mistune.markdown.
        """
        self.markup = markup

    def open(self, filename):
        """Return a local file stream

        :param filename: A string representing the "name" of the puzzle file
        :returns: A file-like object
        """

        if filename in self.files:
            return self.files[filename].stream

        raise FileNotFoundError(f"{filename} was not found in this puzzle")

    def log(self, *vals):
        """Add a new log message to this puzzle.

        :param *vals: One or more str-able objects representing a log entry
        """
        msg = ' '.join(str(v) for v in vals)
        self.logs.append(msg)

    def random_hash(self):
        """Create a file basename (no extension) with our number generator.

        :returns: A string containing a pseuedo-random filename
        """
        return ''.join(self.rand.choice(string.ascii_lowercase) for i in range(8))

    def make_temp_file(self, name=None, visible=True):
        """Get a file object for adding dynamically generated data to the puzzle. When you're
        done with this file, flush it, but don't close it.

        :param name: The name of the file for links within the puzzle. If this is None, a name
                     will be generated for you.
        :param visible: Whether or not the file will be visible to the user.
        :returns: A file object for writing
        """

        stream = tempfile.TemporaryFile()  # pylint: disable=consider-using-with
        self.add_stream(stream, name, visible)
        return stream

    def add_script_stream(self, stream, name):
        """Adds a stream as a script which should appear in the header block of HTML output

        :param stream: A file-like object containing the body of the script
        :param name: A string containing the name of the script
        """
        self.files[name] = PuzzleFile(stream, name, visible=False)
        self.scripts.append(name)

    def add_stream(self, stream, name=None, visible=True):
        """Add a file-like object to a puzzle

        :param stream: A file-like object containing the "file" contents
        :param name (optional): The name of the file, if not provided, a random name is generated
        :param visble (optional): A boolean specifying whether the file should appear in the puzzle's public listing. True by default
        """

        if name is None:
            name = self.random_hash()
        self.files[name] = PuzzleFile(stream, name, visible)

    def add_file(self, filename, visible=True):
        """Add a file by name to a puzzle

        :param filename: A string containing the name of the file to include
        :param visble (optional): A boolean specifying whether the file should appear in the puzzle's public listing. True by default
        """

        fd = open(filename, 'rb')  # pylint: disable=invalid-name,consider-using-with
        name = os.path.basename(filename)
        self.add_stream(fd, name=name, visible=visible)

    def randword(self):
        """Return a randomly-chosen word

        :returns: A string containing a randomly-chosen word
        """

        return self.rand.choice(ANSWER_WORDS)

    def make_answer(self, word_count=4, sep=' '):
        """Generate and return a new answer. It's automatically added to the puzzle answer list.
        :param int word_count: The number of words to include in the answer.
        :param str|bytes sep: The word separator.
        :returns: The answer string
        """

        words = [self.randword() for i in range(word_count)]
        answer = sep.join(words)
        self.answers.append(answer)
        return answer

    hexdump_stdch = stdch = (
        '················'
        '················'
        ' !"#$%&\'()*+,-./'
        '0123456789:;<=>?'
        '@ABCDEFGHIJKLMNO'
        'PQRSTUVWXYZ[\\]^_'
        '`abcdefghijklmno'
        'pqrstuvwxyz{|}~·'
        '················'
        '················'
        '················'
        '················'
        '················'
        '················'
        '················'
        '················'
    )

    def hexdump(self, buf, charset=hexdump_stdch, gap=('�', '⌷')):
        """Write a hex dump of data to the puzzle body

        :param buf: Buffer of bytes to dump
        :param charset: Character set to use while dumping hex-equivalents. Default to ASCII
        :param gap: Length-2 tuple containing character to use to represent unprintable characters
        """
        hexes, chars = [], []
        out = []

        for buf_byte in buf:
            if len(chars) == 16:
                out.append((hexes, chars))
                hexes, chars = [], []

            if buf_byte is None:
                hex_char, char = gap
            else:
                hex_char = f'{buf_byte:02x}'
                char = charset[buf_byte]
            chars.append(char)
            hexes.append(hex_char)

        out.append((hexes, chars))

        offset = 0
        elided = False
        lastchars = None
        self.body.write('<pre>')
        for hexes, chars in out:
            if chars == lastchars:
                offset += len(chars)
                if not elided:
                    self.body.write('*\n')
                    elided = True
                continue
            lastchars = chars[:]
            elided = False

            pad = 16 - len(chars)
            hexes += ['  '] * pad

            self.body.write(f'{offset:08x}  ')
            self.body.write(' '.join(hexes[:8]))
            self.body.write('  ')
            self.body.write(' '.join(hexes[8:]))
            self.body.write('  |')
            self.body.write(html.escape(''.join(chars)))
            self.body.write('|\n')
            offset += len(chars)
        self.body.write(f'{offset:08x}\n')
        self.body.write('</pre>')

    def get_body(self):
        """Get the body of the puzzle

        :return: The body of the puzzle
        """
        return self.body.getvalue()

    def html_body(self):
        """Format and return the markdown for the puzzle body.

        :return: The rendered body of the puzzle
        """

        body = self.get_body()
        if self.markup:
            body = self.markup(body)
        return body

    def _validate(self):
        """Ensure that the puzzle can be exported

        :return: `False` if the puzzle is invalid, `True`, otherwise.
        """

        if len(self.answers) == 0 and self.answer.__code__ is Puzzle.answer.__code__:
            return False

        return True

    def package(self):
        """Return a dict packaging of the puzzle.
        :param answers: Whether or not to include answers in the results, defaults to False

        :return: Dict representation of the puzzle
        """

        if not self._validate():
            raise Exception("This puzzle does not currently validate")

        attachments = [fn for fn, f in self.files.items()]
        return {
            'Authors': self.authors,
            'Attachments': attachments,
            'Scripts': self.scripts,
            'Body': self.html_body(),
            'AnswerHashes': self.hashes(),
            'AnswerPattern': self.pattern,
            'Objective': self.objective,
            'Success': self.success,
            'KSAs': self.ksas,
            'Debug': {
                'Log': self.logs,
                'Hints': self.hints,
                'Summary': self.summary,
            },
            'Answers': self.answers,
        }

    def hashes(self):
        """Return a list of answer hashes

        :return: List of answer hashes
        """

        return [sha256hash(a) for a in self.answers]

    def answer(self, answer):
        """Handle an answer submission

        :return: a `dict` containing the key "Correct" which
            is either True, if the submission is correct, or
            False, otherwise. Other keys may be added
        """
        res = {"Correct": False}
        if answer in self.answers:
            res["Correct"] = True

        return res


class Category:
    """A category containing 1 or more puzzles"""

    pointvals = []

    def puzzle(self, points):  # pylint: disable=no-self-use
        """Return a puzzle with the given point value

        :param points: Point value to generate
        :return: Puzzle object worth `points` points
        """

        return Puzzle(seed=points)

    def __iter__(self):
        for point in self.pointvals:
            yield self.puzzle(point)

    def __call__(self, points):
        return self.puzzle(points)


def v3markup():
    """Get a markdown handler compatible with MOTHv3, using Mistune

    :param buf: A string containing valid Markdown

    :returns: A string containing rendered Markdown
    """
    import mistune  # pylint: disable=import-outside-toplevel
    return mistune.Markdown(renderer=mistune.HTMLRenderer(escape=False))


def _build_puzzle_parser(puzzle_parser):
    puzzle_parsers = puzzle_parser.add_subparsers()
    puzzle_puzzle_parser = puzzle_parsers.add_parser("puzzle")
    puzzle_puzzle_parser.set_defaults(func=lambda puzz_ob, args: json.dump(puzz_ob.package(), sys.stdout))

    puzzle_file_handler = puzzle_parsers.add_parser("file")
    puzzle_file_handler.set_defaults(func=lambda puzz_ob, args: shutil.copyfileobj(puzz_ob.open(args.filename), sys.stdout.buffer))
    puzzle_file_handler.add_argument("filename")

    puzzle_answer_handler = puzzle_parsers.add_parser("answer")
    puzzle_answer_handler.set_defaults(func=lambda puzz_ob, args: json.dump(puzz_ob.answer(args.answer), sys.stdout))
    puzzle_answer_handler.add_argument("answer")


def _build_category_parser(category_parser):
    category_parsers = category_parser.add_subparsers()

    category_inventory_handler = category_parsers.add_parser("inventory")
    category_inventory_handler.set_defaults(func=lambda cat_ob, args: json.dump({"Puzzles": sorted(cat_ob.pointvals)}, sys.stdout))

    category_puzzle_handler = category_parsers.add_parser("puzzle")
    category_puzzle_handler.add_argument("points")
    category_puzzle_handler.set_defaults(func=lambda cat_ob, args: json.dump(cat_ob(args.points).package(), sys.stdout))

    category_puzzle_file_handler = category_parsers.add_parser("file")
    category_puzzle_file_handler.add_argument("points")
    category_puzzle_file_handler.add_argument("filename")
    category_puzzle_file_handler.set_defaults(func=lambda cat_ob, args: shutil.copyfileobj(cat_ob(args.points).open(args.filename), sys.stdout.buffer))

    category_puzzle_answer_handler = category_parsers.add_parser("answer")
    category_puzzle_answer_handler.add_argument("points")
    category_puzzle_answer_handler.add_argument("answer")
    category_puzzle_answer_handler.set_defaults(func=lambda cat_ob, args: json.dump(cat_ob(args.points).answer(args.answer), sys.stdout))


def main(make):
    """main: Guess what to do based on how we were invoked.

    For transpiled puzzles, this will do the right thing.
    Uses the MOTHv3 devel-server API:

    Puzzle API:

        make(puzzle, None)
            Accepts a Puzzle object, and fills it in. The second value is always None.

    Category API:

        make(puzzle, points)
            Accepts a Puzzle object, and fills it in. points contains the number of points we are looking at.

    """

    parser = ArgumentParser(description="MOTH python handler. The file's name *must* be mkpuzzle or mkcategory")

    # If no command is provided, don't do anything
    parser.set_defaults(func=lambda *args: parser.print_help())
    subparsers = parser.add_subparsers()

    puzzle_parser = subparsers.add_parser("mkpuzzle")
    _build_puzzle_parser(puzzle_parser)

    category_parser = subparsers.add_parser("mkcategory")

    _build_category_parser(category_parser)

    raw_args = sys.argv
    raw_args[0] = pathlib.Path(raw_args[0]).name

    args = parser.parse_args(raw_args)

    args.func(make, args)


def build_puzzle(make):
    """Build a puzzle from a legacy make function

    :param make: a function which accepts a single argument,
        a `Puzzle` object, which the function modified to
        create a puzzle
    """
    puzzle = Puzzle()
    puzzle.markup = v3markup()
    make(puzzle)
    main(puzzle)


def build_category(make, pointvals):
    """Build a category from a legacy make function

    :param make: a function which accepts a `Puzzle` object
        and an `int` value for a point value, which modifies
        the provided `Puzzle` object to create a puzzle

    :param pointvals: an array of integer point values
        which this category holds
    """

    my_pointvals = list(pointvals)

    class CatWrapper(Category):  # pylint: disable=too-few-public-methods
        """A simple wrapper to convert a legacy make function into a `Category`"""
        pointvals = my_pointvals

        def puzzle(self, points):
            """A simple wrapper to convert a legacy make function into a `Category`'s `Puzzle`"""
            puzzle = Puzzle(seed=points)
            make(puzzle, points)
            return puzzle

    main(CatWrapper())


# Words for generating answers.
with open(os.path.join(os.path.dirname(__file__), 'answer_words.txt'), encoding="UTF-8") as wf:
    ANSWER_WORDS = [w.strip() for w in wf]
