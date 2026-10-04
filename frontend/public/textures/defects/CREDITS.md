# Decal texture credits

The decals the Defect Recognition Test projects onto the forklift. Every one
is cut from texture sets released by [ambientCG](https://ambientcg.com) under
[Creative Commons 0 (CC0 1.0)](https://creativecommons.org/publicdomain/zero/1.0/).
CC0 does not require credit. It is given here so each file can be traced to
its source.

Each file was cropped, resized, recoloured and given its alpha channel by
`frontend/scripts/build-decals.mjs`, which records the exact cut for every
file.

| File | Used for | Source set | Maps used | Licence |
|---|---|---|---|---|
| `crack.png` | Cracks at the fork heel and in a mast channel | [Asphalt Damage Set 001](https://ambientcg.com/view?id=AsphaltDamageSet001) | Opacity | CC0 1.0 |
| `tread-chunk.png` | Chunks torn out of a tyre's tread | [Asphalt Damage Set 001](https://ambientcg.com/view?id=AsphaltDamageSet001), [Rubber 001](https://ambientcg.com/view?id=Rubber001) | Opacity (shape), Color | CC0 1.0 |
| `wet.png` | Hydraulic oil weeping down a hose | [Leaking 006](https://ambientcg.com/view?id=Leaking006) | Color, Opacity | CC0 1.0 |
| `frost.png` | Frost on a leaking LPG fitting | [Ice 001](https://ambientcg.com/view?id=Ice001) | Color | CC0 1.0 |
| `bolt-hole.png` | An empty bolt hole | [Rust 001](https://ambientcg.com/view?id=Rust001) | Color (the hole and washer ring are drawn by the script) | CC0 1.0 |

To rebuild a file, download its source sets' 1K-PNG zips from ambientCG,
unzip each into `frontend/textures-src/raw/<asset>/` (keeping ambientCG's
file names) and run `node scripts/build-decals.mjs <name>` from `frontend/`.
