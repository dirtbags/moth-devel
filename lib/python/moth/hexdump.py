import html

# Taken from glyphs.h from https://dirtbags.net/fluffy/
#     octets | cut -b 61- | sed 's/"/\\"/; s/.*/    "\0"/'
fluffyGlyphs = (
    "·☺☻♥♦♣♠•◘○◙♂♀♪♫☼"
    "⏵⏴↕‼¶§‽↨↑↓→←∟↔⏶⏷"
    " !\"#$%&'()*+,-./"
    "0123456789:;<=>?"
    "@ABCDEFGHIJKLMNO"
    "PQRSTUVWXYZ[\]^_"
    "`abcdefghijklmno"
    "pqrstuvwxyz{|}~⌂"
    "ÇüéâäàåçêëèïîìÄÅ"
    "ÉæÆôöòûùÿÖÜ¢£¥₧ƒ"
    "áíóúñÑªº¿⌐¬½¼¡«»"
    "░▒▓│┤╡╢╖╕╣║╗╝╜╛┐"
    "└┴┬├─┼╞╟╚╔╩╦╠═╬╧"
    "╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀"
    "αßΓπΣσµτΦΘΩδ∞φε∩"
    "≡±≥≤⌠⌡÷≈°∞⊻√ⁿ²■¤"
)

# The standard, aka "not overly helpful", glyph set
standardGlyphs = (
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


class HexDumper:
    def __init__(self, output, glyphset=fluffyGlyphs, elide="⋮", gap=("__", "�"), htmlEscape=True):
        """Write a hex dump of data to the puzzle body

        f is the file object where the dump will be written.
        
        buf is the bytes to dump. It can be a bytes object, or a list of ints.
        In the latter case, None indicates a "gap".

        glyphset is the dump glyph set.

        elide is the glyph to display if the previous line
        is the same as the current one. If None, every line will be dumped.

        gap is a 2-tuple (hex, glyph) of strings to represent None values in buf.
        """

        self.offset = 0
        self.last = None
        self.eliding = False
        self.hexes = []
        self.chars = []

        self.output = output
        self.glyphset = glyphset
        self.elide = elide
        self.gap = gap

        if htmlEscape:
            self.glyphset = [html.escape(c) for c in glyphset]

    def _spit(self):
        if self.elide:
            if self.chars == self.last:
                if not self.eliding:
                    self.output.write(self.elide + '\n')
                    self.eliding = True
                self.hexes = []
                self.chars = []
                return
            self.last = self.chars[:]
            self.eliding = False

        pad = 16 - len(self.chars)
        self.hexes += ['  '] * pad

        self.output.write('{:08x}  '.format(self.offset - len(self.chars)))
        self.output.write(' '.join(self.hexes[:8]))
        self.output.write('  ')
        self.output.write(' '.join(self.hexes[8:]))
        self.output.write('  |')
        self.output.write(''.join(self.chars))
        self.output.write('|\n')

        self.hexes = []
        self.chars = []

    def add(self, buf):
        for b in buf:
            if self.offset and self.offset % 16 == 0:
                self._spit()

            if b is None:
                h, c = self.gap
            else:
                h = '{:02x}'.format(b)
                c = self.glyphset[b]
            self.chars.append(c)
            self.hexes.append(h)

            self.offset += 1

    def done(self):
        self._spit()
        self.output.write('{:08x}\n'.format(self.offset))
