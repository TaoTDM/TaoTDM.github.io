# sound slots

drop audio files here to replace the built-in synth blips. the site looks for
these names at start. a file that exists is used. a file that is missing falls
back to the synth version, so you can replace one sound at a time.

| file            | plays when                                  |
|-----------------|---------------------------------------------|
| `select.wav`    | you tap a spark and it starts to fly        |
| `land.wav`      | the spark lands in the box                  |
| `page.wav`      | a page turns in the reader                  |
| `release.wav`   | a spark is let go and leaves the box        |
| `gather.wav`    | the sparks are called into orbit            |
| `scatter.wav`   | the sparks are sent back to drift           |
| `hover.wav`     | the pointer finds a spark (off by default)  |

`.wav`, `.mp3`, and `.ogg` all work. keep files short (under one second) and
quiet. the site plays them at the volume set in `src/sound.js`.
