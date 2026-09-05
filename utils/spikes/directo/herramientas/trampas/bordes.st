| o |
o := StdIOWriteStream stdout.
o nextPutAll: 'A1 '; nextPutAll: (1073741823 + 1) printString; nextPutAll: ' '; nextPutAll: (1073741823 + 1) class name; newLine.
o nextPutAll: 'A2 '; nextPutAll: (-1073741824 - 1) printString; nextPutAll: ' '; nextPutAll: (-1073741824 - 1) class name; newLine.
o nextPutAll: 'A3 '; nextPutAll: (1073741823 + 1 - 1) printString; nextPutAll: ' '; nextPutAll: (1073741823 + 1 - 1) class name; newLine.
o nextPutAll: 'B1 '; nextPutAll: (0 * -5) printString; nextPutAll: ' '; nextPutAll: ((0 * -5) = 0) printString; nextPutAll: ' '; nextPutAll: (1 / ((0 * -5) + 1)) printString; newLine.
o nextPutAll: 'B2 '; nextPutAll: ((0 - 5) * 0) printString; nextPutAll: ' '; nextPutAll: ((0 - 5) * 0) class name; newLine.
o nextPutAll: 'C1 '; nextPutAll: (-7 \\ 2) printString; nextPutAll: ' '; nextPutAll: (-7 // 2) printString; nextPutAll: ' '; nextPutAll: (7 \\ -2) printString; nextPutAll: ' '; nextPutAll: (-7 rem: 2) printString; nextPutAll: ' '; nextPutAll: (-7 quo: 2) printString; newLine.
o nextPutAll: 'D1 '; nextPutAll: (2147483648 * 2) printString; nextPutAll: ' '; nextPutAll: (2147483648 * 2) class name; newLine.
o nextPutAll: 'D2 '; nextPutAll: (4294967295 + 1) printString; nextPutAll: ' '; nextPutAll: (4294967295 + 1) class name; newLine.
o nextPutAll: 'D3 '; nextPutAll: (4294967295 + 0) printString; nextPutAll: ' '; nextPutAll: (4294967295 + 0) class name; newLine.
o nextPutAll: 'E1 '; nextPutAll: (1073741824 = 1073741824) printString; nextPutAll: ' '; nextPutAll: (1073741824 == 1073741824) printString; newLine.
o nextPutAll: 'E2 '; nextPutAll: (1.5 = 1.5) printString; nextPutAll: ' '; nextPutAll: (1.5 == 1.5) printString; newLine.
o nextPutAll: 'E3 '; nextPutAll: (100 factorial = (100 factorial + 0)) printString; nextPutAll: ' '; nextPutAll: (100 factorial == (100 factorial)) printString; newLine.
o nextPutAll: 'F1 '; nextPutAll: ((0/1) * -5.0) printString; nextPutAll: ' '; nextPutAll: (0.0 = -0.0) printString; nextPutAll: ' '; nextPutAll: (0.0 * -1.0) printString; newLine.
o nextPutAll: 'G1 '; nextPutAll: (1073741823 bitShift: 1) printString; nextPutAll: ' '; nextPutAll: (1073741823 bitShift: 1) class name; newLine.
o nextPutAll: 'FIN'; newLine.
o flush.
Smalltalk quitPrimitive.
