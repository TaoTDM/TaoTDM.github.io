# fonts

the two screen fonts of the site. github pages serves them with the rest of the site, so
the page does not connect to google fonts for them.

| file                       | font                                  | copyright                                   |
|----------------------------|---------------------------------------|---------------------------------------------|
| `gaegu.woff2`              | gaegu regular, latin                  | 2018 the gaegu project authors              |
| `shantell-sans-text.woff2` | shantell sans, latin, one fixed style | 2022 the shantell sans project authors      |

both fonts have the sil open font license 1.1: https://openfontlicense.org

the files came from google fonts. `gaegu.woff2` is not changed. the shantell sans file was a
variable font. it is fixed here at weight 350, informality 55 and bounce 12, with
`fontTools.varLib.instancer`, because the site uses only that style.

a font from the `?hand` picker still comes from google fonts.
