# Audio credits

Every sound in this folder is a recording released by its author under
[Creative Commons 0 (CC0 1.0)](https://creativecommons.org/publicdomain/zero/1.0/),
downloaded from [Freesound](https://freesound.org). CC0 does not require
credit. It is given here so each file can be traced to its source.

None of the sounds is synthesized. Each was cut from the original, mixed to
mono, resampled to 44.1 kHz and levelled by `frontend/scripts/build-audio.mjs`,
which records the exact cut for every file. Loops were also crossfaded end to
start (or cut on a whole period) so they repeat without a gap.

| File | Used for | Source recording | Author | Licence |
|---|---|---|---|---|
| `engine-idle.flac` | Engine at idle (loop) | [forklift.wav](https://freesound.org/people/soundman9826/sounds/571002/) | soundman9826 | CC0 1.0 |
| `engine-stop.mp3` | Engine switching off | [forklift.wav](https://freesound.org/people/soundman9826/sounds/571002/) | soundman9826 | CC0 1.0 |
| `engine-start.mp3` | Starter and engine catching | [Forklift starting](https://freesound.org/people/soundman9826/sounds/570979/) | soundman9826 | CC0 1.0 |
| `engine-high.flac` | Engine at high revs (loop) | [Elantra Engine Idle and Rev](https://freesound.org/people/microman502/sounds/865228/) | microman502 | CC0 1.0 |
| `reverse-beeper.flac` | Reverse beeper (loop), backup alarm test | [truck backup beeps](https://freesound.org/people/tambascot/sounds/196567/) | tambascot | CC0 1.0 |
| `hydraulic-whine.flac` | Hydraulic pump (loop) | [Industrial forklift hydraulics](https://freesound.org/people/peridactyloptrix/sounds/221925/) | peridactyloptrix | CC0 1.0 |
| `relief-strain.flac` | Relief valve at the lift's end stops (loop) | [Industrial forklift hydraulics](https://freesound.org/people/peridactyloptrix/sounds/221925/) | peridactyloptrix | CC0 1.0 |
| `chain-rattle.flac` | Lift chain and mast (loop) | [metal shop hoist chains thick rattle pull on track1.flac](https://freesound.org/people/kyles/sounds/453383/) | kyles | CC0 1.0 |
| `horn.mp3` | Horn, horn test | [05 Horn.wav](https://freesound.org/people/15HPanska_Ruttner_Jan/sounds/461679/) | 15HPanska_Ruttner_Jan | CC0 1.0 |
| `parking-brake.mp3` | Parking brake lever | [06 Handbrake.wav](https://freesound.org/people/15HPanska_Ruttner_Jan/sounds/461678/) | 15HPanska_Ruttner_Jan | CC0 1.0 |
| `seatbelt.mp3` | Seatbelt buckle | [02 Seatbelt.wav](https://freesound.org/people/15HPanska_Ruttner_Jan/sounds/461675/) | 15HPanska_Ruttner_Jan | CC0 1.0 |
| `key-click.mp3` | Key switch | [Key Turn without Ignition](https://freesound.org/people/microman502/sounds/818298/) | microman502 | CC0 1.0 |
| `denied.mp3` | Engine start refused by the interlock | [busdoorwarning.wav](https://freesound.org/people/Mihacappy/sounds/803765/) | Mihacappy | CC0 1.0 |
| `caution-chime.mp3` | Caution safety sign | [Chime-Improper.flac](https://freesound.org/people/drooler/sounds/660863/) | drooler | CC0 1.0 |
| `danger-alarm.mp3` | Danger safety sign | [Factory Warning Buzzer](https://freesound.org/people/qubodup/sounds/832414/) | qubodup, from a CC0 recording by AstraPLanetshine | CC0 1.0 |
| `fork-scrape.flac` | Fork tips dragged along the floor (loop) | [crowbar metal drag on concrete scrape and handling.wav](https://freesound.org/people/kyles/sounds/452587/) | kyles | CC0 1.0 |

To rebuild a file, download its source recording into
`frontend/audio-src/raw/` (keeping Freesound's file name) and run
`node scripts/build-audio.mjs <name>` from `frontend/`.
