# sound slots

drop audio files here to replace the built-in synth blips. the build lists the
files in this folder, and the site loads only those. a file that is missing falls
back to the synth version, so you can replace one sound at a time. start the dev
server again after you add a file.

| file            | plays when                                  |
|-----------------|---------------------------------------------|
| `select.wav`    | you tap a spark and it starts to fly        |
| `land.wav`      | the spark lands in the box                  |
| `page.wav`      | a page turns forward in the reader          |
| `back.wav`      | a page turns back                           |
| `release.wav`   | a spark is let go and leaves the box        |
| `gather.wav`    | the sparks are called into orbit            |
| `scatter.wav`   | the sparks are sent back to drift           |
| `hover.wav`     | the pointer finds a spark (off by default)  |

sound is switched on the settings spark, page two, or with the `m` key.

`.wav`, `.mp3`, and `.ogg` all work. keep files short (under one second) and
quiet. the site plays them at the volume set in `src/sound.js`.

## the files now

recordings of a pencil and of a page that turns, from freesound.org. all have the cc0 license
(public domain), so no credit is necessary. the list is here to find them again. each
file is a short cut from the recording, at one loudness.

| file          | recording                                        | by         | freesound id |
|---------------|--------------------------------------------------|------------|--------------|
| `select.wav`  | pencil writing on paper (1 stroke, take a)       | ani_music  | 632473       |
| `release.wav` | pencil writing on paper (1 stroke, take b)       | ani_music  | 632472       |
| `land.wav`    | putting a pencil on paper to write               | ani_music  | 632474       |
| `gather.wav`  | pencil writing on paper (4 strokes)              | ani_music  | 632477       |
| `scatter.wav` | pencil writing on paper (3 strokes, take a)      | ani_music  | 632471       |
| `page.wav`    | quiet page turn - 7, the flick only              | SpaceJoe   | 484967       |
| `back.wav`    | quiet page turn - 4, the flick only              | SpaceJoe   | 484964       |

the night theme has its own set: chalk on a blackboard, and a soft eraser in place of the
page turn. a night file has the same name with `-night` at the end. if a night file is not
there, the day file plays at night too.

| file                | recording                                  | by          | freesound id |
|---------------------|--------------------------------------------|-------------|--------------|
| `select-night.wav`  | writing on black board, one stroke         | ta8keiteasy | 231453       |
| `release-night.wav` | writing on black board, one stroke         | ta8keiteasy | 231453       |
| `gather-night.wav`  | writing on black board, one stroke         | ta8keiteasy | 231453       |
| `scatter-night.wav` | writing on black board, one stroke         | ta8keiteasy | 231453       |
| `land-night.wav`    | writing on black board1, one tap           | ta8keiteasy | 231454       |
| `page-night.wav`    | dry erase, the same cut, a little higher   | Zermonth    | 116637       |
| `back-night.wav`    | dry erase: a felt eraser on a chalk tray   | Zermonth    | 116637       |

`hover` has no file. it uses the built-in sound, and it is off by default.
