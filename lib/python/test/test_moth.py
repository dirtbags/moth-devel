import io
import os.path
import tempfile
import unittest

import moth

class TestMoth(unittest.TestCase):

    def test_log(self):
        puzzle = moth.Puzzle(12345)
        message = "Test message"
        puzzle.log(message)
        self.assertIn(message, puzzle.logs)

    def test_random_repeatable(self):
        puzzle1 = moth.Puzzle(12345)
        puzzle2 = moth.Puzzle(12345)
        puzzle3 = moth.Puzzle(11111)

        p1_hash = puzzle1.rand.random()
        p2_hash = puzzle2.rand.random()
        p3_hash = puzzle3.rand.random()

        self.assertEqual(p1_hash, p2_hash)
        self.assertNotEqual(p1_hash, p3_hash)

    def test_attach_attachment(self):
        puzzle = moth.Puzzle(12345)
        data = b"Test"
        with io.BytesIO(data) as buf:
            puzzle.attach("Test stream", buf)
            self.assertIn("Test stream", puzzle.attachments)
            self.assertIn("Test stream", puzzle.streams)
            self.assertEqual(puzzle.streams["Test stream"].read(), data)

    def test_attach_script(self):
        puzzle = moth.Puzzle(12345)
        data = b"Test"
        with io.BytesIO(data) as buf:
            puzzle.attach("Test stream", buf, script=True)
            self.assertIn("Test stream", puzzle.scripts)
            self.assertIn("Test stream", puzzle.streams)
            self.assertEqual(puzzle.streams["Test stream"].read(), data)
        
    def test_attach_file(self):
        puzzle = moth.Puzzle(12345)
        data = b"Test"
        with tempfile.NamedTemporaryFile() as tf:
            tf.write(data)
            tf.flush()
            puzzle.attach_file(tf.name)
            self.assertIn(os.path.basename(tf.name), puzzle.streams)
            self.assertEqual(puzzle.streams[os.path.basename(tf.name)].read(), data)

    def test_hexdump(self):
        out = io.StringIO()
        test_data = [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
        hd = moth.HexDumper(out)
        hd.add(test_data)

    def test_hexump_none(self):
        out = io.StringIO()
        test_data = [0, 1, 2, 3, None, 5, 6, 7, 8]
        hd = moth.HexDumper(out)
        hd.add(test_data)

    def test_hexdump_elided_dupe_row(self):
        out = io.StringIO()
        puzzle = moth.Puzzle(12345)
        test_data = [1 for x in range(4*16)]
        hd = moth.HexDumper(out)
        hd.add(test_data)

    def test_authors(self):
        puzzle = moth.Puzzle(12345)

        self.assertEqual(puzzle.authors, [])

    def test_make_answer(self):
        puzzle = moth.Puzzle(12345)
        word_count = 5
        separator = " "

        answer = puzzle.make_answer(words=word_count, sep=separator)

        self.assertIsNotNone(answer)

        self.assertEqual(puzzle.answers, [answer])

        self.assertEqual(answer.count(separator), word_count - 1)

    def test_export(self):
        puzzle = moth.Puzzle(12345)
        message = "foo"
        attachment_name = "bar"
        attachment = b"baz"
        puzzle.answers.append("foo")

        with io.BytesIO(attachment) as buf:
            puzzle.attach(attachment_name, buf)
        res = puzzle.export()

        self.assertIsInstance(res, dict)

        for field in ["Authors", "Attachments", "Scripts", "Body", "AnswerPattern", "Objective", "Success", "KSAs"]:
            self.assertIn(field, res)

        self.assertIsInstance(res["Success"], dict)


        self.assertIn("Debug", res)
        for field in ["Log", "Hints", "Summary"]:
            self.assertIn(field, res["Debug"])


        self.assertIn("Answers", res)
        self.assertIsInstance(res["Answers"], list)
