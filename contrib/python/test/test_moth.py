import io
import os.path
import tempfile
import unittest

import moth
from moth.moth import sha256hash

class TestMoth(unittest.TestCase):

    def test_sha256hash(self):
        input_data = "test"
        expected = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
        self.assertEqual(sha256hash(input_data), expected)

    def test_log(self):
        puzzle = moth.Puzzle(12345, 1)
        message = "Test message"
        puzzle.log(message)
        self.assertIn(message, puzzle.logs)

    def test_random_hash(self):
        puzzle = moth.Puzzle(12345, 1)
        self.assertEqual(len(puzzle.random_hash()), 8)

    def test_random_hash_repeatable(self):
        puzzle1 = moth.Puzzle(12345, 1)
        puzzle2 = moth.Puzzle(12345, 1)
        puzzle3 = moth.Puzzle(11111, 1)
        puzzle4 = moth.Puzzle(12345, 2)

        p1_hash = puzzle1.random_hash()
        p2_hash = puzzle2.random_hash()
        p3_hash = puzzle3.random_hash()
        p4_hash = puzzle4.random_hash()

        self.assertEqual(p1_hash, p2_hash)
        self.assertNotEqual(p1_hash, p3_hash)
        self.assertNotEqual(p1_hash, p4_hash)

    def test_make_temp_file(self):
        puzzle = moth.Puzzle(12345, 1)
        tt = puzzle.make_temp_file(name="Test stream")
        tt.write(b"Test")
        self.assertIn("Test stream", puzzle.files)
        tt.seek(0)
        self.assertEqual(puzzle.files["Test stream"].stream.read(), b"Test")

    def test_add_stream_visible(self):
        puzzle = moth.Puzzle(12345, 1)
        data = b"Test"
        with io.BytesIO(data) as buf:
            puzzle.add_stream(buf, name="Test stream", visible=True)
            self.assertIn("Test stream", puzzle.files)
            self.assertEqual(puzzle.files["Test stream"].stream.read(), data)
            self.assertEqual(puzzle.files["Test stream"].visible, True)

    def test_add_stream_notvisible(self):
        puzzle = moth.Puzzle(12345, 1)
        data = b"Test"

        with io.BytesIO(data) as buf:
            puzzle.add_stream(buf, name="Test stream", visible=False)
            self.assertIn("Test stream", puzzle.files)
            self.assertEqual(puzzle.files["Test stream"].stream.read(), data)
            self.assertEqual(puzzle.files["Test stream"].visible, False)

    def test_add_stream_visible_no_name(self):
        puzzle = moth.Puzzle(12345, 1)
        data = b"Test"

        with io.BytesIO(data) as buf:
            puzzle.add_stream(buf, visible=True)
            self.assertGreater(len(puzzle.files), 0)

    def test_add_script_stream(self):
        puzzle = moth.Puzzle(12345, 1)
        data = b"Test"
        script_name = b"Test script"

        with io.BytesIO(data) as buf:
            puzzle.add_script_stream(buf, name=script_name)
            self.assertIn(script_name, puzzle.files)
            self.assertEqual(puzzle.files[script_name].stream.read(), data)
            self.assertEqual(puzzle.files[script_name].visible, False)
            self.assertIn(script_name, puzzle.scripts)
        
    def test_add_file(self):
        puzzle = moth.Puzzle(12345, 1)
        data = b"Test"
        with tempfile.NamedTemporaryFile() as tf:
            tf.write(data)
            tf.flush()
            puzzle.add_file(tf.name)
            self.assertIn(os.path.basename(tf.name), puzzle.files)
            self.assertEqual(puzzle.files[os.path.basename(tf.name)].stream.read(), data)
            self.assertEqual(puzzle.files[os.path.basename(tf.name)].visible, True)

    def test_hexdump(self):
        puzzle = moth.Puzzle(12345, 1)
        test_data = [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
        puzzle.hexdump(test_data)

    def test_hexump_none(self):
        puzzle = moth.Puzzle(12345, 1)
        test_data = [0, 1, 2, 3, None, 5, 6, 7, 8]
        puzzle.hexdump(test_data)

    def test_hexdump_elided_dupe_row(self):
        puzzle = moth.Puzzle(12345, 1)
        test_data = [1 for x in range(4*16)]
        puzzle.hexdump(test_data)

    def test_authors_legacy_interoperability(self):
        puzzle = moth.Puzzle(12345, 1)

        with self.assertWarns(DeprecationWarning):
            puzzle.author = "foo"

        self.assertEqual(puzzle.authors, ["foo"])

    def test_author_legacy_interoperability_empty(self):
        puzzle = moth.Puzzle(12345, 1)
        self.assertEqual(puzzle.authors, [])
        self.assertIsNone(puzzle.author)

    def test_authors_legacy(self):
        puzzle = moth.Puzzle(12345, 1)

        puzzle.authors = ["foo", "bar"]

        with self.assertWarns(DeprecationWarning):
            self.assertEqual(puzzle.author, "foo")

    def test_authors(self):
        puzzle = moth.Puzzle(12345, 1)

        self.assertEqual(puzzle.authors, [])

    def test_make_answer(self):
        puzzle = moth.Puzzle(12345, 1)
        word_count = 5
        separator = " "

        answer = puzzle.make_answer(word_count=word_count, sep=separator)

        self.assertIsNotNone(answer)

        self.assertEqual(puzzle.answers, [answer])

        self.assertEqual(answer.count(separator), word_count - 1)

    def test_html_body(self):
        puzzle = moth.Puzzle(12345, 1)
        message = "Hello there"
        puzzle.body.write(message)

        res = puzzle.html_body()

        self.assertEqual(message, res)

    def test_package(self):
        puzzle = moth.Puzzle(12345, 1)
        message = "foo"
        attachment_name = "bar"
        attachment = b"baz"

        with io.BytesIO(attachment) as buf:
            puzzle.add_stream(buf, name=attachment_name, visible=True)
            res = puzzle.package()

        self.assertIsInstance(res, dict)

        self.assertIn("Pre", res)
        for field in ["Authors", "Attachments", "Scripts", "Body", "AnswerHashes", "AnswerPattern"]:
            self.assertIn(field, res["Pre"])

        self.assertIn(attachment_name, res["Pre"]["Attachments"])


        self.assertIn("Post", res)
        for field in ["Objective", "Success", "KSAs"]:
            self.assertIn(field, res["Post"])

        self.assertIsInstance(res["Post"]["Success"], dict)


        self.assertIn("Debug", res)
        for field in ["Log", "Hints", "Summary"]:
            self.assertIn(field, res["Debug"])


        self.assertIn("Answers", res)
        self.assertIsInstance(res["Answers"], list)


    def test_v3_markdown(self):
        from moth.moth import v3markup
        puzzle = moth.Puzzle(12345, 1)
        puzzle.markup = v3markup()
        message = "**Hello there**"
        expected = "<p><strong>Hello there</strong></p>"
        puzzle.body.write(message)

        res = puzzle.html_body()

        self.assertIn(expected, res)


class TestPuzzleSuccess(unittest.TestCase):

    def test_success_set(self):
        success = moth.PuzzleSuccess()

        expected = "foo"

        success.acceptable = expected

        self.assertIn("acceptable", success)

        self.assertEqual(success["acceptable"], expected)

    def test_success_load(self):
        success = moth.PuzzleSuccess(acceptable="foo", mastery="bar")

        self.assertEqual(success.acceptable, "foo")
        self.assertEqual(success.mastery, "bar")

    def test_success_cast(self):
        success = moth.PuzzleSuccess(acceptable="foo", mastery="bar")

        self.assertIsInstance(success, dict)

    def test_success_default_attr(self):
        success = moth.PuzzleSuccess()
        self.assertIsNone(success.acceptable)
        self.assertIsNone(success.mastery)
        self.assertIsNone(success["acceptable"])
        self.assertIsNone(success["mastery"])

    def test_success_no_attr_get(self):
        success = moth.PuzzleSuccess()
        with self.assertRaisesRegex(AttributeError, "object has no attribute"):
            _ = success.foo

    def test_success_no_attr_set(self):
        success = moth.PuzzleSuccess()
        with self.assertRaisesRegex(AttributeError, "object has no attribute"):
            success.foo = "bar"

    def test_success_load_invalid_field(self):
        success = moth.PuzzleSuccess(acceptable="foo", mastery="bar", baz="bah")

        self.assertEqual(success.acceptable, "foo")
        self.assertEqual(success.mastery, "bar")

        with self.assertRaises(KeyError):
            success["baz"]

        with self.assertRaisesRegex(AttributeError, "object has no attribute"):
            _ = success.baz
